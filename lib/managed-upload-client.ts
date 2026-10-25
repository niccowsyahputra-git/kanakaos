import { MANAGED_FORM_KEY, type ManagedFormFields, StorageError, UPLOAD_CHUNK_BYTES, managedClaimSchema, managedFileDescriptionSchema, managedUploadSchema, validDriveSession, type ManagedClaim, type ManagedUpload, type StorageErrorCode, type StoragePurpose } from "./storage-contract";

const codes: StorageErrorCode[] = ["NOT_CONFIGURED", "RECONNECT", "WRONG_OWNER", "QUOTA", "UNAVAILABLE", "INVALID", "EXPIRED", "FORBIDDEN", "RATE_LIMIT"];
export async function uploadCommand(operation: "start" | "finalize" | "discard", input: unknown, transport: typeof fetch = fetch) {
  let response: Response;
  try { response = await transport(`/api/uploads/${operation}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(60_000) }); }
  catch { throw new StorageError("UNAVAILABLE"); }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new StorageError(codes.includes(result?.code) ? result.code : "UNAVAILABLE");
  return result;
}

export function confirmedUploadOffset(response: Response, total: number) {
  const override = response.headers.get("X-HTTP-Status-Code-Override");
  if (override && (override !== "308" || response.status !== 200)) throw new StorageError("INVALID");
  if (!override && (response.status === 200 || response.status === 201)) return total;
  if (response.status === 404 || response.status === 410) throw new StorageError("EXPIRED");
  if (response.status === 429) throw new StorageError("QUOTA");
  if (response.status !== 308 && override !== "308") throw new StorageError(response.status >= 500 ? "UNAVAILABLE" : "INVALID");
  const range = response.headers.get("Range");
  if (!range) return 0;
  const match = /^bytes=0-(\d+)$/.exec(range);
  const offset = match ? Number(match[1]) + 1 : NaN;
  if (!Number.isSafeInteger(offset) || offset < 1 || offset > total) throw new StorageError("INVALID");
  return offset;
}

// Every retry starts with Drive's confirmed offset, never the browser's last attempted offset.
export async function uploadResumable(file: Blob, sessionUrl: string, progress: (percent: number) => void, transport: typeof fetch = fetch, signal?: AbortSignal) {
  if (!validDriveSession(sessionUrl) || file.size < 1) throw new StorageError("INVALID");
  const put = async (body?: Blob, start?: number, end?: number) => {
    try {
      return await transport(sessionUrl, { method: "PUT", body: body ?? new Blob([]), credentials: "omit", redirect: "error", cache: "no-store",
        // Google uses 308 for incomplete uploads; request its non-redirect status representation.
        headers: { "X-GUploader-No-308": "yes", "Content-Type": file.type || "application/octet-stream", "Content-Range": body ? `bytes ${start}-${end}/${file.size}` : `bytes */${file.size}` },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
      });
    } catch { throw new StorageError("UNAVAILABLE"); }
  };
  let offset = confirmedUploadOffset(await put(), file.size);
  let failures = 0;
  progress(Math.floor(offset / file.size * 95));
  while (offset < file.size) {
    if (signal?.aborted) throw new StorageError("UNAVAILABLE");
    const end = Math.min(offset + UPLOAD_CHUNK_BYTES, file.size);
    try {
      const next = confirmedUploadOffset(await put(file.slice(offset, end, file.type), offset, end - 1), file.size);
      if (next <= offset || next > end) throw new StorageError("UNAVAILABLE");
      offset = next;
      failures = 0;
    } catch (error) {
      if (signal?.aborted || !(error instanceof StorageError) || error.code !== "UNAVAILABLE" || ++failures > 3) throw error;
      await new Promise(resolve => setTimeout(resolve, failures * 250));
      offset = confirmedUploadOffset(await put(), file.size);
    }
    progress(Math.floor(offset / file.size * 95));
  }
}

type Entry = { purpose: StoragePurpose; upload?: ManagedUpload; bytesUploaded?: boolean; receipt?: ManagedClaim; pending?: Promise<ManagedClaim>; abort: AbortController };
export class ManagedUploadController {
  readonly nonce: string;
  private readonly entries = new Map<File, Entry>();
  constructor(readonly mode: "public" | "staff", readonly targetId?: string, private readonly transport: typeof fetch = fetch, nonce = crypto.randomUUID()) { this.nonce = nonce; }
  async upload(file: File, purpose: StoragePurpose, progress: (percent: number) => void = () => {}) {
    let entry = this.entries.get(file);
    if (entry && entry.purpose !== purpose) throw new StorageError("INVALID");
    if (!entry) { entry = { purpose, abort: new AbortController() }; this.entries.set(file, entry); }
    if (entry.pending) return entry.pending;
    entry.pending = this.perform(file, entry, progress);
    try { return await entry.pending; }
    catch (error) {
      if (error instanceof StorageError && error.code === "EXPIRED" && entry.upload) entry.upload.expiresAt = 0;
      throw error;
    }
    finally { entry.pending = undefined; }
  }
  private async perform(file: File, entry: Entry, progress: (percent: number) => void) {
    const description = managedFileDescriptionSchema.safeParse({ purpose: entry.purpose, filename: file.name, mime: file.type, bytes: file.size });
    if (!description.success) throw new StorageError("INVALID");
    if (entry.upload && entry.upload.expiresAt <= Date.now() + 30_000) {
      await this.discardClaim(entry.upload);
      entry.upload = undefined; entry.bytesUploaded = false; entry.receipt = undefined;
    }
    if (entry.receipt) { progress(100); return entry.receipt; }
    if (!entry.upload) {
      const response = await uploadCommand("start", { mode: this.mode, targetId: this.targetId, nonce: this.nonce, file: description.data }, this.transport);
      const parsed = managedUploadSchema.safeParse(response);
      if (!parsed.success || !validDriveSession(parsed.data.sessionUrl)) throw new StorageError("INVALID");
      entry.upload = parsed.data;
    }
    if (entry.abort.signal.aborted) { await this.discardClaim(entry.upload); throw new StorageError("UNAVAILABLE"); }
    if (!entry.bytesUploaded) {
      await uploadResumable(file, entry.upload.sessionUrl, progress, this.transport, entry.abort.signal);
      entry.bytesUploaded = true;
    }
    const receipt = await uploadCommand("finalize", { mode: this.mode, claim: { id: entry.upload.id, ticket: entry.upload.ticket } }, this.transport);
    const parsed = managedClaimSchema.safeParse(receipt);
    if (!parsed.success || parsed.data.id !== entry.upload.id || parsed.data.ticket !== entry.upload.ticket) throw new StorageError("INVALID");
    entry.receipt = parsed.data;
    progress(100);
    return parsed.data;
  }
  private async discardClaim(upload: ManagedClaim) { await uploadCommand("discard", { mode: this.mode, claim: { id: upload.id, ticket: upload.ticket } }, this.transport); }
  async discard(file: File) {
    const entry = this.entries.get(file);
    if (!entry) return;
    entry.abort.abort();
    if (entry.pending) await entry.pending.catch(() => {});
    if (entry.upload) await this.discardClaim(entry.upload);
    this.entries.delete(file);
  }
  async discardAll() { await Promise.all([...this.entries.keys()].map(file => this.discard(file))); }
}

export class ManagedFormUploadController extends ManagedUploadController {
  private selected = new Map<string, File>();
  async prepare(form: FormData, fields: ManagedFormFields, progress: (percent: number) => void = () => {}) {
    const result = new FormData();
    const selected = new Map<string, File>();
    for (const [field, value] of form.entries()) {
      if (field === MANAGED_FORM_KEY) continue;
      if (typeof value === "string") {
        if (Object.hasOwn(fields, field)) throw new StorageError("INVALID");
        result.append(field, value);
      } else if (value.size > 0) {
        if (!Object.hasOwn(fields, field) || selected.has(field)) throw new StorageError("INVALID");
        const description = managedFileDescriptionSchema.safeParse({ purpose: fields[field], filename: value.name, mime: value.type, bytes: value.size });
        if (!description.success) throw new StorageError("INVALID");
        selected.set(field, value);
      }
    }
    for (const [field, file] of this.selected) if (selected.get(field) !== file) await this.discard(file);
    this.selected = selected;
    const claims: ManagedClaim[] = [];
    let completed = 0;
    for (const [field, file] of selected) {
      claims.push(await this.upload(file, fields[field], percent => progress(Math.floor((completed * 100 + percent) / selected.size))));
      completed++;
    }
    result.set(MANAGED_FORM_KEY, JSON.stringify({ nonce: this.nonce, claims }));
    return result;
  }
}
