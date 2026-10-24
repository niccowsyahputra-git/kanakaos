"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  volunteerNeedSchema,
  type VolunteerNeedInput,
} from "@/lib/validations";

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola kebutuhan relawan";

const idSchema = z.string().cuid("ID kebutuhan relawan tidak valid");

function revalidateNeedPages() {
  revalidatePath("/dashboard/volunteers/needs");
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/volunteer/apply");
}

export async function createVolunteerNeed(
  values: VolunteerNeedInput
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = volunteerNeedSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const need = await prisma.volunteerNeed.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        quantity: parsed.data.quantity,
        schedule: parsed.data.schedule ?? null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "VolunteerNeed",
      entityId: need.id,
      detail: `Buka kebutuhan relawan ${need.title} (${need.quantity} orang)`,
    });

    revalidateNeedPages();
    return { success: true, id: need.id };
  } catch (error) {
    console.error("createVolunteerNeed error:", error);
    return { success: false, error: "Gagal menyimpan kebutuhan relawan" };
  }
}

export async function updateVolunteerNeed(
  id: string,
  values: VolunteerNeedInput
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: idParsed.error.errors[0].message };
  }
  const parsed = volunteerNeedSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const existing = await prisma.volunteerNeed.findUnique({
      where: { id: idParsed.data },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Kebutuhan relawan tidak ditemukan" };
    }

    await prisma.volunteerNeed.update({
      where: { id: idParsed.data },
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        quantity: parsed.data.quantity,
        schedule: parsed.data.schedule ?? null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "VolunteerNeed",
      entityId: idParsed.data,
      detail: `Ubah kebutuhan relawan ${parsed.data.title} (${parsed.data.quantity} orang)`,
    });

    revalidateNeedPages();
    return { success: true, id: idParsed.data };
  } catch (error) {
    console.error("updateVolunteerNeed error:", error);
    return { success: false, error: "Gagal memperbarui kebutuhan relawan" };
  }
}

/** Tutup (CLOSED) atau buka kembali (OPEN) kebutuhan relawan */
export async function setVolunteerNeedStatus(
  id: string,
  status: "OPEN" | "CLOSED"
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = idSchema.safeParse(id);
  const statusParsed = z.enum(["OPEN", "CLOSED"]).safeParse(status);
  if (!idParsed.success || !statusParsed.success) {
    return { success: false, error: "Data tidak valid" };
  }

  try {
    const existing = await prisma.volunteerNeed.findUnique({
      where: { id: idParsed.data },
      select: { id: true, title: true, status: true },
    });
    if (!existing) {
      return { success: false, error: "Kebutuhan relawan tidak ditemukan" };
    }
    if (existing.status === statusParsed.data) {
      return { success: true, id: existing.id };
    }

    const isClosing = statusParsed.data === "CLOSED";
    await prisma.volunteerNeed.update({
      where: { id: existing.id },
      data: {
        status: statusParsed.data,
        closedAt: isClosing ? new Date() : null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "VolunteerNeed",
      entityId: existing.id,
      detail: `${isClosing ? "Tutup" : "Buka kembali"} kebutuhan relawan ${existing.title}`,
    });

    revalidateNeedPages();
    return { success: true, id: existing.id };
  } catch (error) {
    console.error("setVolunteerNeedStatus error:", error);
    return { success: false, error: "Gagal mengubah status kebutuhan relawan" };
  }
}

/** Hapus hanya jika belum ada relawan yang terhubung (jaga riwayat) */
export async function deleteVolunteerNeed(id: string): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: idParsed.error.errors[0].message };
  }

  try {
    const existing = await prisma.volunteerNeed.findUnique({
      where: { id: idParsed.data },
      select: { id: true, title: true, _count: { select: { volunteers: true } } },
    });
    if (!existing) {
      return { success: false, error: "Kebutuhan relawan tidak ditemukan" };
    }
    if (existing._count.volunteers > 0) {
      return {
        success: false,
        error:
          "Kebutuhan ini sudah memiliki pendaftar/relawan. Tutup (close) saja agar riwayat tetap tersimpan.",
      };
    }

    await prisma.volunteerNeed.delete({ where: { id: existing.id } });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "DELETE",
      entity: "VolunteerNeed",
      entityId: existing.id,
      detail: `Hapus kebutuhan relawan ${existing.title}`,
    });

    revalidateNeedPages();
    return { success: true };
  } catch (error) {
    console.error("deleteVolunteerNeed error:", error);
    return { success: false, error: "Gagal menghapus kebutuhan relawan" };
  }
}
