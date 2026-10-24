"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { familyVisitSchema, type FamilyVisitInput } from "@/lib/validations";

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export async function createFamilyVisit(
  values: FamilyVisitInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const parsed = familyVisitSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: parsed.data.childId },
      select: { id: true, fullName: true },
    });
    if (!child) return { success: false, error: "Data anak tidak ditemukan" };

    const visit = await prisma.familyVisit.create({
      data: {
        childId: parsed.data.childId,
        visitorName: parsed.data.visitorName,
        relationship: parsed.data.relationship ?? null,
        visitDate: parsed.data.visitDate,
        purpose: parsed.data.purpose,
        createdById: session.user.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "FamilyVisit",
      entityId: visit.id,
      detail: `Mencatat kunjungan ${parsed.data.visitorName} untuk ${child.fullName}`,
    });

    revalidatePath("/dashboard/family-visits");
    return { success: true, id: visit.id };
  } catch (error) {
    console.error("createFamilyVisit error:", error);
    return { success: false, error: "Gagal mencatat kunjungan" };
  }
}

export async function updateFamilyVisit(
  id: string,
  values: FamilyVisitInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID kunjungan tidak valid" };
  }

  const parsed = familyVisitSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const existing = await prisma.familyVisit.findUnique({
      where: { id: idParsed.data },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Data kunjungan tidak ditemukan" };
    }

    await prisma.familyVisit.update({
      where: { id: idParsed.data },
      data: {
        childId: parsed.data.childId,
        visitorName: parsed.data.visitorName,
        relationship: parsed.data.relationship ?? null,
        visitDate: parsed.data.visitDate,
        purpose: parsed.data.purpose,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "FamilyVisit",
      entityId: idParsed.data,
      detail: `Memperbarui kunjungan ${parsed.data.visitorName}`,
    });

    revalidatePath("/dashboard/family-visits");
    return { success: true, id: idParsed.data };
  } catch (error) {
    console.error("updateFamilyVisit error:", error);
    return { success: false, error: "Gagal memperbarui kunjungan" };
  }
}

export async function deleteFamilyVisit(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID kunjungan tidak valid" };
  }

  try {
    const visit = await prisma.familyVisit.findUnique({
      where: { id: idParsed.data },
      include: { child: { select: { fullName: true } } },
    });
    if (!visit) {
      return { success: false, error: "Data kunjungan tidak ditemukan" };
    }

    await prisma.familyVisit.delete({ where: { id: idParsed.data } });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "DELETE",
      entity: "FamilyVisit",
      entityId: idParsed.data,
      detail: `Menghapus kunjungan ${visit.visitorName} (${visit.child.fullName})`,
    });

    revalidatePath("/dashboard/family-visits");
    return { success: true };
  } catch (error) {
    console.error("deleteFamilyVisit error:", error);
    return { success: false, error: "Gagal menghapus data kunjungan" };
  }
}
