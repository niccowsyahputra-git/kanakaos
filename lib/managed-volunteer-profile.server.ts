import "server-only";
import { createHmac } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { z } from "zod";
import type { volunteerSchema } from "./validations";
import { ATTACHMENT_KINDS, UPLOAD_LIMITS, managedVolunteerBundleSchema, normalizeVolunteerAttachments } from "./volunteer-upload-contract";
import { VolunteerSaveError } from "./volunteer-uploads.server";
import { StorageError, managedFileUrl, type StoragePurpose } from "./storage-contract";
import { assertStorageAccess, attachManagedFiles, loadManagedClaims, lockManagedFiles } from "./managed-storage.server";

const purposes: StoragePurpose[] = ["VOLUNTEER_PHOTO", "VOLUNTEER_CERTIFICATE", "VOLUNTEER_KTP", "VOLUNTEER_SKCK"];
export async function persistManagedVolunteerProfile(db: PrismaClient, secret: string, profile: z.infer<typeof volunteerSchema>, rawBundle: unknown, actor: { id: string; name: string; public: boolean }, volunteerId?: string) {
  const parsed = managedVolunteerBundleSchema.safeParse(rawBundle);
  if (!parsed.success) throw new VolunteerSaveError("Data unggahan tidak valid");
  const bundle = parsed.data;
  const storageActor = { id: actor.public ? null : actor.id };
  if (actor.public && (volunteerId || bundle.removeIds.length)) throw new StorageError("FORBIDDEN");
  await assertStorageAccess(db, storageActor, "VOLUNTEER_PHOTO", volunteerId, actor.public);
  const key = createHmac("sha256", secret).update(JSON.stringify(["drive-volunteer-submission", storageActor.id, bundle.nonce])).digest("hex");
  const retry = async () => !volunteerId ? db.volunteer.findUnique({ where: { submissionKey: key }, select: { id: true } }) : null;
  const previous = await retry();
  if (previous) return { id: previous.id, created: false };
  try {
    return await db.$transaction(async tx => {
      await lockManagedFiles(tx);
      await assertStorageAccess(tx, storageActor, "VOLUNTEER_PHOTO", volunteerId, actor.public);
      if (!volunteerId) {
        const repeated = await tx.volunteer.findUnique({ where: { submissionKey: key }, select: { id: true } });
        if (repeated) return { id: repeated.id, created: false };
      }
      const files = await loadManagedClaims(tx, { nonce: bundle.nonce, claims: bundle.claims }, storageActor, volunteerId, purposes, secret);
      const current = volunteerId ? await tx.volunteer.findUnique({ where: { id: volunteerId }, include: { attachments: true, managedFiles: { where: { state: "ATTACHED" } } } }) : null;
      if (volunteerId && !current) throw new VolunteerSaveError("Relawan tidak ditemukan");
      if (files.some(file => file.state === "ATTACHED" && (file.parentType !== "Volunteer" || file.parentId !== volunteerId || file.volunteerId !== volunteerId))) throw new StorageError("FORBIDDEN");
      if (profile.needId && profile.needId !== current?.needId) {
        const need = await tx.volunteerNeed.findUnique({ where: { id: profile.needId }, select: { status: true } });
        if (!need || need.status !== "OPEN") throw new VolunteerSaveError("Kebutuhan relawan yang dipilih sudah ditutup. Silakan pilih yang lain");
      }
      if (actor.public && profile.email) {
        const duplicates = await tx.volunteer.findMany({ where: { status: "PENDING", email: { not: null } }, select: { email: true } });
        if (duplicates.some(record => record.email?.trim().toLowerCase() === profile.email!.trim().toLowerCase())) throw new VolunteerSaveError("Pendaftaran dengan email ini sedang kami review. Mohon tunggu 3 hari kerja");
      }
      const legacy = current?.attachments ?? [];
      const managed = current?.managedFiles ?? [];
      const legacyRemovals = await tx.volunteerAttachment.findMany({ where: { id: { in: bundle.removeIds } } });
      const managedRemovals = await tx.managedFile.findMany({ where: { id: { in: bundle.removeIds } } });
      if (legacyRemovals.some(file => file.volunteerId !== volunteerId || file.kind === "PHOTO") ||
        managedRemovals.some(file => file.parentType !== "Volunteer" || file.parentId !== volunteerId || file.purpose === "VOLUNTEER_PHOTO")) throw new VolunteerSaveError("Lampiran tidak ditemukan");
      const additions = files.filter(file => file.state === "UPLOADED");
      const replace = new Set(additions.filter(file => file.purpose !== "VOLUNTEER_CERTIFICATE").map(file => file.purpose));
      const removedLegacy = legacy.filter(file => bundle.removeIds.includes(file.id) || replace.has(`VOLUNTEER_${file.kind}`));
      const removedManaged = managed.filter(file => bundle.removeIds.includes(file.id) || replace.has(file.purpose));
      const retainedLegacy = legacy.filter(file => !removedLegacy.includes(file));
      const retainedManaged = managed.filter(file => !removedManaged.includes(file));
      const final = normalizeVolunteerAttachments(retainedLegacy, [...retainedManaged, ...additions]);
      if (!final.some(file => file.kind === "PHOTO")) throw new VolunteerSaveError("Foto relawan wajib diunggah");
      if (ATTACHMENT_KINDS.some(kind => final.filter(file => file.kind === kind).length > UPLOAD_LIMITS[kind])) throw new VolunteerSaveError("Jumlah lampiran tidak valid");
      const urls: { ktpUrl?: string | null; skckUrl?: string | null } = {};
      for (const [purpose, field] of [["VOLUNTEER_KTP", "ktpUrl"], ["VOLUNTEER_SKCK", "skckUrl"]] as const) {
        const replacement = additions.find(file => file.purpose === purpose);
        if (replacement) urls[field] = managedFileUrl(replacement.id);
        else if (removedManaged.some(file => file.purpose === purpose && current?.[field] === managedFileUrl(file.id))) urls[field] = null;
      }
      const data = {
        name: profile.name, phone: profile.phone ?? null, email: profile.email?.trim().toLowerCase() ?? null,
        dob: profile.dob ? new Date(`${profile.dob}T00:00:00.000Z`) : null,
        address: profile.address ?? null, occupation: profile.occupation ?? null,
        highestEducation: profile.highestEducation ?? null, major: profile.major ?? null,
        skillsJson: JSON.stringify(profile.skills), availability: profile.availability ?? null, motivation: profile.motivation ?? null,
        hasSafeguardingCert: actor.public ? false : profile.hasSafeguardingCert, needId: profile.needId ?? null, ...urls,
      };
      const volunteer = current ? await tx.volunteer.update({ where: { id: current.id }, data }) : await tx.volunteer.create({ data: { ...data, status: "PENDING", submissionKey: key } });
      if (removedLegacy.length) await tx.volunteerAttachment.deleteMany({ where: { id: { in: removedLegacy.map(file => file.id) }, volunteerId: volunteer.id } });
      // Explicit removal detaches the active relation without deleting historical Drive content.
      if (removedManaged.length) await tx.managedFile.updateMany({ where: { id: { in: removedManaged.map(file => file.id) }, volunteerId: volunteer.id }, data: { volunteerId: null } });
      await attachManagedFiles(tx, additions, "Volunteer", volunteer.id);
      await tx.auditLog.create({ data: { userId: storageActor.id, userName: actor.name, action: current ? "UPDATE" : "CREATE", entity: "Volunteer", entityId: volunteer.id,
        detail: `${actor.public ? "Public registration" : "Volunteer profile"}: ${profile.name}; safeguarding verified: ${data.hasSafeguardingCert}` } });
      return { id: volunteer.id, created: !current };
    }, { timeout: 30_000 });
  } catch (error) {
    const committed = await retry();
    if (committed) return { id: committed.id, created: false };
    throw error;
  }
}
