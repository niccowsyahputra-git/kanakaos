"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";

type ActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Tugaskan (atau lepas) pengasuh untuk seorang anak.
 * caregiverId null/"NONE" = lepas penugasan.
 */
export async function assignCaregiver(
  childId: string,
  caregiverId: string | null
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) {
    return {
      success: false,
      error: "Hanya Super Admin dan Pekerja Sosial yang boleh mengatur penugasan",
    };
  }

  const childParsed = z.string().cuid().safeParse(childId);
  if (!childParsed.success) {
    return { success: false, error: "ID anak tidak valid" };
  }

  const normalizedCaregiverId =
    caregiverId && caregiverId !== "NONE" ? caregiverId : null;

  try {
    const child = await prisma.child.findUnique({
      where: { id: childParsed.data },
      select: { id: true, fullName: true },
    });
    if (!child) return { success: false, error: "Data anak tidak ditemukan" };

    let caregiverName = "-";
    if (normalizedCaregiverId) {
      const caregiver = await prisma.user.findUnique({
        where: { id: normalizedCaregiverId },
        select: { id: true, name: true, role: true, isActive: true },
      });
      if (!caregiver) {
        return { success: false, error: "Pengasuh tidak ditemukan" };
      }
      if (caregiver.role !== "CAREGIVER") {
        return { success: false, error: "User tersebut bukan pengasuh" };
      }
      if (!caregiver.isActive) {
        return { success: false, error: "Pengasuh tersebut sudah nonaktif" };
      }
      caregiverName = caregiver.name;
    }

    await prisma.child.update({
      where: { id: childParsed.data },
      data: { assignedCaregiverId: normalizedCaregiverId },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Child",
      entityId: child.id,
      detail: normalizedCaregiverId
        ? `Menugaskan ${caregiverName} sebagai pengasuh ${child.fullName}`
        : `Melepas penugasan pengasuh dari ${child.fullName}`,
    });

    revalidatePath("/dashboard/my-assignments");
    revalidatePath("/dashboard/children");
    return { success: true };
  } catch (error) {
    console.error("assignCaregiver error:", error);
    return { success: false, error: "Gagal mengatur penugasan" };
  }
}
