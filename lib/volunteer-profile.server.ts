import type { PrismaClient } from "@prisma/client";
import type { z } from "zod";
import type { volunteerSchema } from "./validations";
import { ATTACHMENT_KINDS, UPLOAD_LIMITS, uploadBundleSchema } from "./volunteer-upload-contract";
import { submissionKey, verifyUploads, VolunteerSaveError, type VolunteerStorage } from "./volunteer-uploads.server";

type Profile = z.infer<typeof volunteerSchema>;
type Actor = { id: string; name: string; public: boolean };

// The caller validates the profile and authorizes the actor; only whitelisted fields are persisted.
export async function persistVolunteerProfile(db: PrismaClient, storage: VolunteerStorage, profile: Profile, rawBundle: unknown, actor: Actor, volunteerId?: string) {
  const parsed = uploadBundleSchema.safeParse(rawBundle);
  if (!parsed.success) throw new VolunteerSaveError("Data unggahan tidak valid");
  const bundle = parsed.data;
  if (actor.public && (volunteerId || bundle.removeIds.length)) throw new VolunteerSaveError("Akses ditolak");
  const scope = { actor: actor.public ? "public" : actor.id, nonce: bundle.nonce, volunteerId };
  const key = submissionKey(scope, storage.secret);
  if (!volunteerId) {
    const retry = await db.volunteer.findUnique({ where: { submissionKey: key }, select: { id: true } });
    if (retry) return { id: retry.id, created: false };
  }
  try {
    return await db.$transaction(async tx => {
      if (!volunteerId) {
        const retry = await tx.volunteer.findUnique({ where: { submissionKey: key }, select: { id: true } });
        if (retry) return { id: retry.id, created: false };
      }
      const verified = await verifyUploads(bundle.receipts, scope, storage);
      const current = volunteerId ? await tx.volunteer.findUnique({ where: { id: volunteerId }, include: { attachments: true } }) : null;
      if (volunteerId && !current) throw new VolunteerSaveError("Relawan tidak ditemukan");
      if (profile.needId && profile.needId !== current?.needId) {
        const need = await tx.volunteerNeed.findUnique({ where: { id: profile.needId }, select: { status: true } });
        if (!need || need.status !== "OPEN") throw new VolunteerSaveError("Kebutuhan relawan yang dipilih sudah ditutup. Silakan pilih yang lain");
      }
      if (actor.public && profile.email) {
        const duplicates = await tx.volunteer.findMany({ where: { status: "PENDING", email: { not: null } }, select: { email: true } });
        if (duplicates.some(v => v.email?.trim().toLowerCase() === profile.email!.trim().toLowerCase())) throw new VolunteerSaveError("Pendaftaran dengan email ini sedang kami review. Mohon tunggu 3 hari kerja");
      }
      const existing = current?.attachments ?? [];
      const removals = await tx.volunteerAttachment.findMany({ where: { id: { in: bundle.removeIds } } });
      // Missing IDs may be removals from a committed edit whose response was lost.
      if (removals.some(a => a.volunteerId !== volunteerId || a.kind === "PHOTO")) throw new VolunteerSaveError("Lampiran tidak ditemukan");
      const known = await tx.volunteerAttachment.findMany({ where: { publicId: { in: verified.map(a => a.publicId) } } });
      if (known.some(a => a.volunteerId !== volunteerId)) throw new VolunteerSaveError("Bukti unggahan sudah digunakan");
      const additions = verified.filter(a => !known.some(k => k.publicId === a.publicId));
      const replacements = new Set(additions.filter(a => a.kind !== "CERTIFICATE").map(a => a.kind));
      const removed = existing.filter(a => bundle.removeIds.includes(a.id) || replacements.has(a.kind));
      const retained = existing.filter(a => !removed.includes(a));
      const final = [...retained, ...additions];
      if (!final.some(a => a.kind === "PHOTO")) throw new VolunteerSaveError("Foto relawan wajib diunggah");
      if (ATTACHMENT_KINDS.some(kind => final.filter(a => a.kind === kind).length > UPLOAD_LIMITS[kind])) throw new VolunteerSaveError("Jumlah lampiran tidak valid");
      const data = {
        name: profile.name, phone: profile.phone ?? null, email: profile.email?.trim().toLowerCase() ?? null,
        dob: profile.dob ? new Date(`${profile.dob}T00:00:00.000Z`) : null,
        address: profile.address ?? null, occupation: profile.occupation ?? null,
        highestEducation: profile.highestEducation ?? null, major: profile.major ?? null,
        skillsJson: JSON.stringify(profile.skills), availability: profile.availability ?? null, motivation: profile.motivation ?? null,
        hasSafeguardingCert: actor.public ? false : profile.hasSafeguardingCert, needId: profile.needId ?? null,
      };
      const volunteer = current
        ? await tx.volunteer.update({ where: { id: current.id }, data })
        : await tx.volunteer.create({ data: { ...data, status: "PENDING", submissionKey: key } });
      if (removed.length) await tx.volunteerAttachment.deleteMany({ where: { id: { in: removed.map(a => a.id) }, volunteerId: volunteer.id } });
      for (const attachment of additions) await tx.volunteerAttachment.create({ data: { ...attachment, volunteerId: volunteer.id } });
      await tx.auditLog.create({ data: {
        userId: actor.public ? null : actor.id, userName: actor.name, action: current ? "UPDATE" : "CREATE",
        entity: "Volunteer", entityId: volunteer.id,
        detail: `${actor.public ? "Public registration" : "Volunteer profile"}: ${profile.name}; safeguarding verified: ${data.hasSafeguardingCert}`,
      } });
      return { id: volunteer.id, created: !current };
    }, { timeout: 30000 });
  } catch (error) {
    // A response may be lost after commit, or a concurrent retry may win the unique key.
    if (!volunteerId) {
      const retry = await db.volunteer.findUnique({ where: { submissionKey: key }, select: { id: true } });
      if (retry) return { id: retry.id, created: false };
    }
    // Keep verified uploads available for retry. Explicit discard removes only unclaimed, owned uploads.
    throw error;
  }
}
