import "server-only";
import type { ManagedFile, Prisma, PrismaClient } from "@prisma/client";
import { MANAGED_FORM_KEY, STORAGE_PURPOSES, StorageError, managedBundleSchema, managedFileUrl, type ManagedFormFields } from "./storage-contract";
import { assertStorageAccess, attachManagedFiles, loadManagedClaims, lockManagedFiles, storageSigningSecret, type StorageActor } from "./managed-storage.server";

export async function loadManagedFormFiles(tx: Prisma.TransactionClient, form: FormData, actor: StorageActor, targetId: string | undefined, fields: ManagedFormFields) {
  // Old or forged forms must not silently bypass the direct-upload verification flow.
  for (const [field, value] of form.entries()) {
    if (typeof value !== "string" || Object.hasOwn(fields, field)) throw new StorageError("INVALID");
  }
  const values = form.getAll(MANAGED_FORM_KEY);
  if (values.length > 1) throw new StorageError("INVALID");
  let files: ManagedFile[] = [];
  const allowed = Object.values(fields);
  for (const purpose of allowed) await assertStorageAccess(tx, actor, purpose, targetId);
  if (values.length) {
    const raw = values[0];
    if (typeof raw !== "string" || raw.length > 16_384) throw new StorageError("INVALID");
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new StorageError("INVALID"); }
    const bundle = managedBundleSchema.safeParse(input);
    if (!bundle.success) throw new StorageError("INVALID");
    if (bundle.data.claims.length) files = await loadManagedClaims(tx, bundle.data, actor, targetId, allowed, storageSigningSecret());
  }
  const urls: Record<string, string> = {};
  for (const file of files) {
    const purpose = allowed.find(purpose => purpose === file.purpose);
    if (!purpose) throw new StorageError("INVALID");
    urls[STORAGE_PURPOSES[purpose].field] = managedFileUrl(file.id);
  }
  return { files, urls };
}

export async function saveManagedForm<T extends { id: string }>(
  db: PrismaClient, form: FormData, actor: StorageActor, targetId: string | undefined, fields: ManagedFormFields,
  save: (tx: Prisma.TransactionClient, urls: Record<string, string>, files: ManagedFile[]) => Promise<T>,
): Promise<T> {
  const parents = [...new Set(Object.values(fields).map(purpose => STORAGE_PURPOSES[purpose].parent))];
  if (parents.length !== 1) throw new StorageError("INVALID");
  return db.$transaction(async tx => {
    await lockManagedFiles(tx);
    const { files, urls } = await loadManagedFormFiles(tx, form, actor, targetId, fields);
    const saved = await save(tx, urls, files);
    await attachManagedFiles(tx, files, parents[0], saved.id);
    return saved;
  }, { timeout: 30_000 });
}
