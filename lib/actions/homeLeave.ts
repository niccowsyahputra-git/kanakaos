"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { homeLeaveSchema, type HomeLeaveInput } from "@/lib/validations";
import type { HomeLeaveReturnStatus } from "@prisma/client";

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

/** Bandingkan tanggal saja (abaikan jam) */
function toDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Status kembali dihitung otomatis:
 * - belum ada tanggal aktual -> BELUM_KEMBALI
 * - aktual < rencana  -> LEBIH_CEPAT
 * - aktual > rencana  -> TERLAMBAT
 * - selain itu        -> TEPAT_WAKTU
 */
function computeReturnStatus(
  planned: Date | undefined,
  actual: Date | undefined
): HomeLeaveReturnStatus {
  if (!actual) return "BELUM_KEMBALI";
  if (!planned) return "TEPAT_WAKTU";
  if (toDay(actual) < toDay(planned)) return "LEBIH_CEPAT";
  if (toDay(actual) > toDay(planned)) return "TERLAMBAT";
  return "TEPAT_WAKTU";
}

/** Cek apakah anak masih punya kepulangan aktif (belum kembali) */
async function findActiveLeave(childId: string, excludeId?: string) {
  return prisma.homeLeave.findFirst({
    where: {
      childId,
      returnStatus: "BELUM_KEMBALI",
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { id: true, leaveDate: true },
  });
}

export async function createHomeLeave(
  values: HomeLeaveInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const parsed = homeLeaveSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: parsed.data.childId },
      select: { id: true, fullName: true },
    });
    if (!child) return { success: false, error: "Data anak tidak ditemukan" };

    // Anak yang belum kembali tidak boleh dibuatkan kepulangan baru
    const active = await findActiveLeave(child.id);
    if (active) {
      return {
        success: false,
        error: `${child.fullName} masih dalam masa kepulangan (belum kembali ke panti). Tandai kembali dulu sebelum mencatat kepulangan baru`,
      };
    }

    const returnStatus = computeReturnStatus(
      parsed.data.plannedReturnDate,
      parsed.data.actualReturnDate
    );

    const leave = await prisma.homeLeave.create({
      data: {
        childId: parsed.data.childId,
        leaveDate: parsed.data.leaveDate,
        plannedReturnDate: parsed.data.plannedReturnDate ?? null,
        actualReturnDate: parsed.data.actualReturnDate ?? null,
        returnStatus,
        reason: parsed.data.reason,
        description: parsed.data.description ?? null,
        createdById: session.user.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "HomeLeave",
      entityId: leave.id,
      detail: `Mencatat kepulangan ${child.fullName} (${parsed.data.reason})`,
    });

    revalidatePath("/dashboard/home-leaves");
    return { success: true, id: leave.id };
  } catch (error) {
    console.error("createHomeLeave error:", error);
    return { success: false, error: "Gagal mencatat kepulangan anak" };
  }
}

export async function updateHomeLeave(
  id: string,
  values: HomeLeaveInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID kepulangan tidak valid" };
  }

  const parsed = homeLeaveSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const existing = await prisma.homeLeave.findUnique({
      where: { id: idParsed.data },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Data kepulangan tidak ditemukan" };
    }

    // Jika hasil edit membuat catatan ini "belum kembali", pastikan tidak
    // bentrok dengan kepulangan aktif lain milik anak yang sama
    const returnStatus = computeReturnStatus(
      parsed.data.plannedReturnDate,
      parsed.data.actualReturnDate
    );
    if (returnStatus === "BELUM_KEMBALI") {
      const active = await findActiveLeave(
        parsed.data.childId,
        idParsed.data
      );
      if (active) {
        return {
          success: false,
          error:
            "Anak ini sudah punya catatan kepulangan aktif lain yang belum kembali",
        };
      }
    }

    await prisma.homeLeave.update({
      where: { id: idParsed.data },
      data: {
        childId: parsed.data.childId,
        leaveDate: parsed.data.leaveDate,
        plannedReturnDate: parsed.data.plannedReturnDate ?? null,
        actualReturnDate: parsed.data.actualReturnDate ?? null,
        returnStatus,
        reason: parsed.data.reason,
        description: parsed.data.description ?? null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "HomeLeave",
      entityId: idParsed.data,
      detail: `Memperbarui kepulangan anak (status kembali: ${returnStatus})`,
    });

    revalidatePath("/dashboard/home-leaves");
    return { success: true, id: idParsed.data };
  } catch (error) {
    console.error("updateHomeLeave error:", error);
    return { success: false, error: "Gagal memperbarui data kepulangan" };
  }
}

export async function deleteHomeLeave(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID kepulangan tidak valid" };
  }

  try {
    const leave = await prisma.homeLeave.findUnique({
      where: { id: idParsed.data },
      include: { child: { select: { fullName: true } } },
    });
    if (!leave) {
      return { success: false, error: "Data kepulangan tidak ditemukan" };
    }

    await prisma.homeLeave.delete({ where: { id: idParsed.data } });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "DELETE",
      entity: "HomeLeave",
      entityId: idParsed.data,
      detail: `Menghapus data kepulangan ${leave.child.fullName}`,
    });

    revalidatePath("/dashboard/home-leaves");
    return { success: true };
  } catch (error) {
    console.error("deleteHomeLeave error:", error);
    return { success: false, error: "Gagal menghapus data kepulangan" };
  }
}
