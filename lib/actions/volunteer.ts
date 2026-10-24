"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { notifyRoles } from "@/lib/notify";
import {
  volunteerSchema,
  redFlagSchema,
  type VolunteerInput,
  type RedFlagInput,
} from "@/lib/validations";

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola relawan";

export async function createVolunteer(
  values: VolunteerInput
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = volunteerSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const volunteer = await prisma.volunteer.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        skill: parsed.data.skill ?? null,
        hasSafeguardingCert: parsed.data.hasSafeguardingCert,
      },
    });

    revalidatePath("/dashboard/volunteers");
    return { success: true, id: volunteer.id };
  } catch (error) {
    console.error("createVolunteer error:", error);
    return { success: false, error: "Gagal menyimpan data relawan" };
  }
}

export async function approveVolunteer(id: string): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID relawan tidak valid" };
  }

  try {
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: idParsed.data },
      select: { id: true, hasSafeguardingCert: true },
    });
    if (!volunteer) {
      return { success: false, error: "Relawan tidak ditemukan" };
    }

    // Child Safeguarding: relawan wajib punya sertifikat sebelum di-approve
    if (!volunteer.hasSafeguardingCert) {
      return {
        success: false,
        error:
          "Relawan belum memiliki sertifikat safeguarding. Lengkapi dulu sebelum approve.",
      };
    }

    await prisma.volunteer.update({
      where: { id: idParsed.data },
      data: { status: "APPROVED" },
    });

    revalidatePath("/dashboard/volunteers");
    return { success: true, id: idParsed.data };
  } catch (error) {
    console.error("approveVolunteer error:", error);
    return { success: false, error: "Gagal meng-approve relawan" };
  }
}

export async function rejectVolunteer(id: string): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID relawan tidak valid" };
  }

  try {
    await prisma.volunteer.update({
      where: { id: idParsed.data },
      data: { status: "REJECTED" },
    });

    revalidatePath("/dashboard/volunteers");
    return { success: true, id: idParsed.data };
  } catch (error) {
    console.error("rejectVolunteer error:", error);
    return { success: false, error: "Gagal menolak relawan" };
  }
}

/**
 * Suspend relawan. Jika dipanggil dari "Mark Red Flag",
 * sertakan alasan yang akan disimpan ke redFlagNotes (audit trail).
 */
export async function suspendVolunteer(
  values: RedFlagInput
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = redFlagSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: parsed.data.volunteerId },
      select: { id: true, redFlagNotes: true },
    });
    if (!volunteer) {
      return { success: false, error: "Relawan tidak ditemukan" };
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

    // Red flag = isu safeguarding serius, ketua panti harus tahu segera
    await notifyRoles(
      ["SUPER_ADMIN"],
      {
        title: "🚩 Red Flag Relawan",
        description: `Relawan di-suspend oleh ${session.user.name}: ${parsed.data.reason.slice(0, 100)}`,
        link: "/dashboard/volunteers",
      },
      session.user.id
    );

    revalidatePath("/dashboard/volunteers");
    return { success: true, id: parsed.data.volunteerId };
  } catch (error) {
    console.error("suspendVolunteer error:", error);
    return { success: false, error: "Gagal men-suspend relawan" };
  }
}
