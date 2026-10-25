"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { getT } from "@/lib/i18n/server";
import { uploadClaimSchema } from "@/lib/volunteer-upload-contract";
import { discardOwnedUploads, volunteerStorage } from "@/lib/volunteer-uploads.server";

export async function discardVolunteerUploads(values: unknown) {
  const { tr } = await getT();
  const parsed = z.object({ mode: z.enum(["public", "staff"]), volunteerId: z.string().cuid().optional(), nonce: z.string().uuid(), uploads: z.array(uploadClaimSchema).max(8) }).strict().safeParse(values);
  if (!parsed.success || (parsed.data.mode === "public" && parsed.data.volunteerId)) return { success: false as const, error: tr("Data unggahan tidak valid") };
  let actor = "public";
  if (parsed.data.mode === "staff") {
    const session = await requireStaffSession();
    if (!session) return { success: false as const, error: tr("Akses ditolak") };
    actor = session.user.id;
  }
  try {
    await discardOwnedUploads(prisma, volunteerStorage(), parsed.data.uploads, { actor, nonce: parsed.data.nonce, volunteerId: parsed.data.volunteerId });
    return { success: true as const };
  } catch (error) {
    console.error("Discarding owned volunteer uploads failed", error);
    return { success: false as const, error: tr("Gagal membersihkan unggahan. Hubungi pengelola.") };
  }
}
