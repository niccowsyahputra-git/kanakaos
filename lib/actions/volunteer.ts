"use server";

import { notificationMessage } from "@/lib/i18n/notification";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession, requireSuperAdminSession } from "@/lib/auth-guard";
import { notifyRoles } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import {
  volunteerSchema,
  volunteerUpdateSchema,
  volunteerAccountSchema,
  redFlagSchema,
  type VolunteerInput,
  type VolunteerUpdateInput,
  type VolunteerAccountInput,
  type RedFlagInput,
} from "@/lib/validations";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";
import type { ManagedVolunteerBundle } from "@/lib/volunteer-upload-contract";
import { persistManagedVolunteerProfile } from "@/lib/managed-volunteer-profile.server";
import { VolunteerSaveError } from "@/lib/volunteer-uploads.server";
import { storageSigningSecret } from "@/lib/managed-storage.server";
import { StorageError, storageErrorMessage } from "@/lib/storage-contract";


type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola relawan";

const ACCOUNT_FORBIDDEN_ERROR =
  "Hanya Super Admin yang boleh membuat akun login relawan";

function revalidateVolunteerPages() {
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard/volunteers/needs");
}

/** Status akun login relawan mengikuti status relawan */
async function syncLinkedAccount(userId: string | null, isActive: boolean) {
  if (!userId) return;
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
}

/** Pastikan kebutuhan relawan yang dipilih memang ada */
async function needExists(needId: string | undefined): Promise<boolean> {
  if (!needId) return true;
  const need = await prisma.volunteerNeed.findUnique({
    where: { id: needId },
    select: { id: true },
  });
  return Boolean(need);
}

export async function createVolunteer(
  values: VolunteerInput,
  uploads: ManagedVolunteerBundle
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { volunteerSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = volunteerSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const volunteer = await persistManagedVolunteerProfile(prisma, storageSigningSecret(), parsed.data, uploads, { id: session.user.id, name: session.user.name ?? "Staff", public: false });
    try { revalidateVolunteerPages(); } catch (error) { console.error("Volunteer saved; refresh failed", error); }
    return { success: true, id: volunteer.id };
  } catch (error) {
    if (!(error instanceof StorageError || error instanceof VolunteerSaveError)) console.error("Volunteer creation failed");
    return { success: false, error: error instanceof StorageError ? storageErrorMessage(error.code, locale) : tr(error instanceof VolunteerSaveError ? error.message : "Gagal menyimpan data relawan") };
  }
}

/** Edit / lengkapi data relawan, berlaku untuk semua status */
export async function updateVolunteer(
  values: VolunteerUpdateInput,
  uploads: ManagedVolunteerBundle
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { volunteerUpdateSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = volunteerUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }
  const data = parsed.data;

  try {
    await persistManagedVolunteerProfile(prisma, storageSigningSecret(), data, uploads, { id: session.user.id, name: session.user.name ?? "Staff", public: false }, data.id);
    try { revalidateVolunteerPages(); } catch (error) { console.error("Volunteer saved; refresh failed", error); }
    return { success: true, id: data.id };
  } catch (error) {
    if (!(error instanceof StorageError || error instanceof VolunteerSaveError)) console.error("Volunteer update failed");
    return { success: false, error: error instanceof StorageError ? storageErrorMessage(error.code, locale) : tr(error instanceof VolunteerSaveError ? error.message : "Gagal memperbarui data relawan") };
  }
}

/**
 * Approve relawan. Child safeguarding: sertifikat wajib ada. Jika belum
 * tercatat, staf harus mengonfirmasi bahwa sertifikat sudah diverifikasi
 * (confirmCertificate) dan status sertifikat ikut diperbarui.
 */
export async function approveVolunteer(
  id: string,
  options?: { confirmCertificate?: boolean }
): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID relawan tidak valid") };
  }

  try {
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: idParsed.data },
      select: { id: true, name: true, hasSafeguardingCert: true, userId: true },
    });
    if (!volunteer) {
      return { success: false, error: tr("Relawan tidak ditemukan") };
    }

    const confirmCertificate = options?.confirmCertificate === true;
    if (!volunteer.hasSafeguardingCert && !confirmCertificate) {
      return {
        success: false,
        error:
          tr("Relawan belum memiliki sertifikat safeguarding. Konfirmasi verifikasi sertifikat sebelum approve."),
      };
    }

    await prisma.volunteer.update({
      where: { id: idParsed.data },
      data: { status: "APPROVED", hasSafeguardingCert: true },
    });
    // Relawan yang di-approve / diaktifkan lagi: akun login ikut aktif
    await syncLinkedAccount(volunteer.userId, true);

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Volunteer",
      entityId: volunteer.id,
      detail: volunteer.hasSafeguardingCert
        ? `Approve relawan ${volunteer.name}`
        : `Approve relawan ${volunteer.name} (sertifikat safeguarding diverifikasi)`,
    });

    revalidateVolunteerPages();
    return { success: true, id: idParsed.data };
  } catch (error) {
    console.error("approveVolunteer error:", error);
    return { success: false, error: tr("Gagal meng-approve relawan") };
  }
}

export async function rejectVolunteer(id: string): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID relawan tidak valid") };
  }

  try {
    const volunteer = await prisma.volunteer.update({
      where: { id: idParsed.data },
      data: { status: "REJECTED" },
      select: { id: true, name: true, userId: true },
    });
    // Relawan ditolak: akun login dinonaktifkan
    await syncLinkedAccount(volunteer.userId, false);

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Volunteer",
      entityId: volunteer.id,
      detail: `Tolak pendaftaran relawan ${volunteer.name}`,
    });

    revalidateVolunteerPages();
    return { success: true, id: idParsed.data };
  } catch (error) {
    console.error("rejectVolunteer error:", error);
    return { success: false, error: tr("Gagal menolak relawan") };
  }
}

/**
 * Suspend relawan. Jika dipanggil dari "Mark Red Flag",
 * sertakan alasan yang akan disimpan ke redFlagNotes (audit trail).
 */
export async function suspendVolunteer(
  values: RedFlagInput
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { redFlagSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = redFlagSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: parsed.data.volunteerId },
      select: { id: true, name: true, redFlagNotes: true, userId: true },
    });
    if (!volunteer) {
      return { success: false, error: tr("Relawan tidak ditemukan") };
    }

    // Catatan lama tidak ditimpa: alasan baru di-append dengan timestamp
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const newNote = `[${timestamp} oleh ${session.user.name}] ${parsed.data.reason}`;
    const combinedNotes = volunteer.redFlagNotes
      ? `${volunteer.redFlagNotes}\n${newNote}`
      : newNote;

    await prisma.volunteer.update({
      where: { id: parsed.data.volunteerId },
      data: {
        status: "SUSPENDED",
        redFlagNotes: combinedNotes,
      },
    });

    // Relawan di-suspend: akun login langsung dinonaktifkan (child safeguarding)
    await syncLinkedAccount(volunteer.userId, false);

    // Red flag = isu safeguarding serius, ketua panti harus tahu segera
    await notifyRoles(
      ["SUPER_ADMIN"],
      {
        title: "🚩 Red Flag Relawan",
        description: notificationMessage("Relawan di-suspend oleh {0}: {1}", { 0: session.user.name, 1: parsed.data.reason.slice(0, 100) }),
        link: "/dashboard/volunteers",
      },
      session.user.id
    );

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Volunteer",
      entityId: volunteer.id,
      detail: `Suspend (red flag) relawan ${volunteer.name}: ${parsed.data.reason.slice(0, 200)}`,
    });

    revalidateVolunteerPages();
    return { success: true, id: parsed.data.volunteerId };
  } catch (error) {
    console.error("suspendVolunteer error:", error);
    return { success: false, error: tr("Gagal men-suspend relawan") };
  }
}

/**
 * Buatkan akun login untuk relawan (mirip pegawai). Role otomatis VOLUNTEER.
 * Syarat: relawan APPROVED dan bersertifikat child safeguarding.
 * 1 relawan : 1 akun; akun nonaktif otomatis saat suspend/reject (syncLinkedAccount).
 */
export async function createUserForVolunteer(
  volunteerId: string,
  values: VolunteerAccountInput
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { volunteerAccountSchema } = getSchemas(locale);

  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: tr(ACCOUNT_FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(volunteerId);
  if (!idParsed.success) {
    return { success: false, error: tr("ID relawan tidak valid") };
  }

  const parsed = volunteerAccountSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: idParsed.data },
      select: {
        id: true,
        name: true,
        status: true,
        hasSafeguardingCert: true,
        userId: true,
      },
    });
    if (!volunteer) {
      return { success: false, error: tr("Relawan tidak ditemukan") };
    }
    if (volunteer.userId) {
      return { success: false, error: tr("Relawan ini sudah punya akun login") };
    }
    // Child safeguarding: akun hanya untuk relawan aktif yang bersertifikat
    if (volunteer.status !== "APPROVED") {
      return {
        success: false,
        error: tr("Hanya relawan berstatus APPROVED yang bisa dibuatkan akun"),
      };
    }
    if (!volunteer.hasSafeguardingCert) {
      return {
        success: false,
        error:
          tr("Relawan belum bersertifikat child safeguarding. Verifikasi dulu sebelum membuat akun"),
      };
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: tr("Email sudah terdaftar") };
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: await bcrypt.hash(parsed.data.password, 10),
        role: "VOLUNTEER",
      },
    });
    await prisma.volunteer.update({
      where: { id: volunteer.id },
      data: { userId: user.id },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      detail: `Membuat akun login ${user.email} (VOLUNTEER) untuk relawan ${volunteer.name}`,
    });

    revalidateVolunteerPages();
    revalidatePath("/dashboard/admin/settings");
    return { success: true, id: user.id };
  } catch (error) {
    console.error("createUserForVolunteer error:", error);
    return { success: false, error: tr("Gagal membuat akun untuk relawan") };
  }
}
