import "server-only";
import { z } from "zod";
import { StorageError, validDriveSession, type StoragePurpose } from "./storage-contract";
export { validDriveSession } from "./storage-contract";

export const DRIVE_OWNER = "niccowsyahputra@gmail.com";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const driveIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,200}$/);
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const TOKEN = "https://oauth2.googleapis.com/token";
const metadataSchema = z.object({
  id: driveIdSchema, mimeType: z.string(), size: z.string().regex(/^\d+$/).optional(),
  parents: z.array(z.string()).optional(), trashed: z.boolean(), ownedByMe: z.boolean(),
  appProperties: z.record(z.string()).optional(),
  permissions: z.array(z.object({ type: z.string(), role: z.string() })).optional(),
});
export type DriveMetadata = z.infer<typeof metadataSchema>;
export type DriveConfig = { clientId: string; clientSecret: string; refreshToken: string; folderId: string };
export type DriveFileSpec = { id: string; managedId: string; purpose: StoragePurpose; filename: string; mime: string; bytes: number };
export interface DriveStorage {
  folderId: string;
  generateId(): Promise<string>;
  start(file: DriveFileSpec, browserOrigin?: string): Promise<string>;
  metadata(id: string): Promise<DriveMetadata | null>;
  prefix(id: string): Promise<Uint8Array>;
  download(id: string): Promise<Response>;
  trash(id: string): Promise<void>;
  upload(file: DriveFileSpec, bytes: Uint8Array): Promise<void>;
  health(): Promise<void>;
}

async function safeError(response: Response, tokenRequest = false): Promise<never> {
  const body = await response.json().catch(() => null);
  const reasons = body?.error?.errors?.map((error: { reason?: string }) => error.reason) ?? [];
  if (tokenRequest || response.status === 401) throw new StorageError("RECONNECT");
  if (response.status === 429 || reasons.some((reason: string) => ["storageQuotaExceeded", "dailyLimitExceeded", "userRateLimitExceeded", "rateLimitExceeded"].includes(reason))) throw new StorageError("QUOTA");
  if (response.status === 403) throw new StorageError("RECONNECT");
  throw new StorageError("UNAVAILABLE");
}

export function createDriveStorage(config: DriveConfig, transport: typeof fetch = fetch, now = Date.now): DriveStorage {
  if (!config.clientId || !config.clientSecret || !config.refreshToken || !driveIdSchema.safeParse(config.folderId).success) throw new StorageError("NOT_CONFIGURED");
  let cached: { value: string; until: number } | undefined;
  let refreshing: Promise<string> | undefined;
  async function send(url: string, init: RequestInit = {}) {
    try { return await transport(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000) }); }
    catch { throw new StorageError("UNAVAILABLE"); }
  }
  async function token() {
    if (cached && cached.until > now()) return cached.value;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const response = await send(TOKEN, { method: "POST", body: new URLSearchParams({
        client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: "refresh_token",
      }) });
      if (!response.ok) await safeError(response, true);
      const parsed = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).safeParse(await response.json());
      if (!parsed.success) throw new StorageError("RECONNECT");
      const value = parsed.data.access_token;
      const owner = await send(`${API}/about?fields=user(emailAddress),storageQuota`, { headers: { Authorization: `Bearer ${value}` } });
      if (!owner.ok) await safeError(owner);
      const about = await owner.json();
      if (about?.user?.emailAddress?.toLowerCase() !== DRIVE_OWNER) throw new StorageError("WRONG_OWNER");
      cached = { value, until: now() + Math.max(0, parsed.data.expires_in - 60) * 1000 };
      return value;
    })();
    try { return await refreshing; }
    finally { refreshing = undefined; }
  }
  async function request(url: string, init: RequestInit = {}, missingAllowed = false): Promise<Response> {
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${await token()}`);
      response = await send(url, { ...init, headers });
      if (response.status !== 401 || attempt > 0) break;
      cached = undefined;
    }
    if (missingAllowed && response.status === 404) return response;
    if (!response.ok) await safeError(response);
    return response;
  }
  function checkedId(value: string) {
    const result = driveIdSchema.safeParse(value);
    if (!result.success) throw new StorageError("INVALID");
    return result.data;
  }
  async function metadata(id: string) {
    const response = await request(`${API}/files/${checkedId(id)}?fields=id,mimeType,size,parents,trashed,ownedByMe,appProperties,permissions(type,role)`, {}, true);
    if (response.status === 404) return null;
    const parsed = metadataSchema.safeParse(await response.json());
    if (!parsed.success) throw new StorageError("INVALID");
    return parsed.data;
  }
  async function health() {
    const folder = await metadata(config.folderId);
    if (!folder || folder.trashed || !folder.ownedByMe || folder.mimeType !== "application/vnd.google-apps.folder" ||
      !folder.permissions || folder.permissions.some(permission => permission.type !== "user" || permission.role !== "owner")) throw new StorageError("RECONNECT");
  }
  async function start(file: DriveFileSpec, browserOrigin?: string) {
    checkedId(file.id);
    const headers: Record<string, string> = { "Content-Type": "application/json", "X-Upload-Content-Type": file.mime, "X-Upload-Content-Length": String(file.bytes) };
    if (browserOrigin) {
      let origin: URL;
      try { origin = new URL(browserOrigin); } catch { throw new StorageError("INVALID"); }
      if (origin.origin !== browserOrigin || (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))) throw new StorageError("INVALID");
      // Google binds resumable-session CORS to the origin of its initialization request.
      headers.Origin = browserOrigin;
    }
    await health();
    const response = await request(`${UPLOAD}?uploadType=resumable&fields=id`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: file.id, name: file.filename, mimeType: file.mime, parents: [config.folderId],
        appProperties: { application: "kanakaos", managedId: file.managedId, purpose: file.purpose } }),
    });
    const location = response.headers.get("Location");
    if (!location || !validDriveSession(location)) throw new StorageError("INVALID");
    return location;
  }
  return {
    folderId: config.folderId, health, metadata, start,
    async generateId() {
      const response = await request(`${API}/files/generateIds?count=1&space=drive&type=files`);
      const result = z.object({ ids: z.array(driveIdSchema).length(1) }).safeParse(await response.json());
      if (!result.success) throw new StorageError("INVALID");
      return result.data.ids[0];
    },
    async prefix(id) {
      const response = await request(`${API}/files/${checkedId(id)}?alt=media`, { headers: { Range: "bytes=0-31" } });
      const reader = response.body?.getReader();
      if (!reader) throw new StorageError("INVALID");
      const bytes = new Uint8Array(32);
      let length = 0;
      try {
        while (length < bytes.length) {
          const chunk = await reader.read();
          if (chunk.done) break;
          const take = chunk.value.subarray(0, bytes.length - length);
          bytes.set(take, length); length += take.length;
        }
      } finally { await reader.cancel(); }
      return bytes.subarray(0, length);
    },
    download: async id => request(`${API}/files/${checkedId(id)}?alt=media`),
    async trash(id) {
      const response = await request(`${API}/files/${checkedId(id)}`, { method: "DELETE" }, true);
      if (response.status !== 204 && response.status !== 404) throw new StorageError("UNAVAILABLE");
    },
    async upload(file, bytes) {
      if (bytes.byteLength !== file.bytes) throw new StorageError("INVALID");
      const session = await start(file);
      const response = await send(session, { method: "PUT", headers: { "Content-Type": file.mime, "Content-Range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` }, body: new Uint8Array(bytes) });
      if (!response.ok) await safeError(response);
    },
  };
}

let storage: DriveStorage | undefined;
export function driveStorage() {
  if (!storage) storage = createDriveStorage({ clientId: process.env.GOOGLE_DRIVE_CLIENT_ID ?? "", clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? "", refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? "", folderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "" });
  return storage;
}

export function hasFileSignature(mime: string, bytes: Uint8Array) {
  const starts = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (mime === "image/jpeg") return starts([0xff, 0xd8, 0xff]);
  if (mime === "image/png") return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/webp") return starts([0x52, 0x49, 0x46, 0x46]) && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP";
  if (mime === "application/pdf") return starts([0x25, 0x50, 0x44, 0x46, 0x2d]);
  return false;
}
