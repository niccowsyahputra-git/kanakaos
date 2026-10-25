"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  homeVisitSchema,
  completeVisitSchema,
  type HomeVisitInput,
} from "@/lib/validations";
import { saveManagedForm } from "@/lib/managed-form.server";
import { MANAGED_FORM_FIELDS, StorageError, storageErrorMessage } from "@/lib/storage-contract";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola kunjungan rumah";

export async function scheduleHomeVisit(
  values: HomeVisitInput
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { homeVisitSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = homeVisitSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: parsed.data.childId },
      select: { id: true, fullName: true, guardianId: true },
    });
    if (!child) return { success: false, error: tr("Data anak tidak ditemukan") };
    if (!child.guardianId) {
      return {
        success: false,
        error: tr("Anak ini belum punya wali terdaftar. Lengkapi data wali dulu"),
      };
    }

    // Pastikan petugas valid & aktif
    const officer = await prisma.user.findUnique({
      where: { id: parsed.data.officerId },
      select: { id: true, name: true, isActive: true },
    });
    if (!officer || !officer.isActive) {
      return { success: false, error: tr("Petugas kunjungan tidak valid") };
    }

    const visit = await prisma.homeVisit.create({
      data: {
        childId: parsed.data.childId,
        officerId: officer.id,
        scheduledDate: new Date(parsed.data.scheduledDate),
        purpose: parsed.data.purpose,
        createdById: session.user.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "HomeVisit",
      entityId: visit.id,
      detail: `Menjadwalkan kunjungan rumah ${child.fullName} (petugas: ${officer.name})`,
    });

    revalidatePath("/dashboard/home-visits");
    return { success: true, id: visit.id };
  } catch (error) {
    console.error("scheduleHomeVisit error:", error);
    return { success: false, error: tr("Gagal menjadwalkan kunjungan") };
  }
}

/**
 * Selesaikan kunjungan: simpan checklist kelayakan rumah, foto, dan skor
 * kerentanan. Skor juga disalin ke Guardian.vulnerabilityScore agar profil
 * wali selalu memuat hasil asesmen terbaru.
 */
export async function completeHomeVisit(
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { completeVisitSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = completeVisitSchema.safeParse({
    visitId: formData.get("visitId"),
    sanitationOk: formData.get("sanitationOk") === "true",
    safetyOk: formData.get("safetyOk") === "true",
    cleanWaterOk: formData.get("cleanWaterOk") === "true",
    childSpaceOk: formData.get("childSpaceOk") === "true",
    foodSecurityOk: formData.get("foodSecurityOk") === "true",
    vulnerabilityScore: formData.get("vulnerabilityScore"),
    visitNotes: formData.get("visitNotes") ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const visit = await prisma.homeVisit.findUnique({
      where: { id: parsed.data.visitId },
      include: { child: { select: { fullName: true, guardianId: true } } },
    });
    if (!visit) return { success: false, error: tr("Kunjungan tidak ditemukan") };
    if (visit.status !== "PLANNED") {
      return { success: false, error: tr("Kunjungan sudah selesai/dibatalkan") };
    }

    const { visitId, visitNotes, ...checklist } = parsed.data;
    await saveManagedForm(prisma, formData, { id: session.user.id }, visitId, MANAGED_FORM_FIELDS.homeVisit, async (tx, urls) => {
      const current = await tx.homeVisit.findUnique({ where: { id: visitId }, include: { child: { select: { guardianId: true } } } });
      if (!current || current.status !== "PLANNED") throw new StorageError("INVALID");
      const saved = await tx.homeVisit.update({
        where: { id: visitId },
        data: {
          ...checklist,
          visitNotes,
          ...urls,
          status: "DONE",
          completedAt: new Date(),
          // Data lama tanpa petugas: yang menyelesaikan = yang melakukan
          ...(current.officerId ? {} : { officerId: session.user.id }),
        },
      });

      // Sinkronkan skor kerentanan ke profil wali
      if (current.child.guardianId) {
        await tx.guardian.update({
          where: { id: current.child.guardianId },
          data: { vulnerabilityScore: parsed.data.vulnerabilityScore },
        });
      }
      return saved;
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "HomeVisit",
      entityId: visitId,
      detail: `Menyelesaikan kunjungan rumah ${visit.child.fullName} (skor kerentanan ${parsed.data.vulnerabilityScore}/10)`,
    });

    revalidatePath("/dashboard/home-visits");
    revalidatePath(`/dashboard/home-visits/${visitId}`);
    return { success: true, id: visitId };
  } catch (error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("completeHomeVisit failed");
    return { success: false, error: tr("Gagal menyelesaikan kunjungan") };
  }
}

export async function cancelHomeVisit(id: string): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID kunjungan tidak valid") };
  }

  try {
    const visit = await prisma.homeVisit.findUnique({
      where: { id: idParsed.data },
      select: { id: true, status: true },
    });
    if (!visit) return { success: false, error: tr("Kunjungan tidak ditemukan") };
    if (visit.status !== "PLANNED") {
      return { success: false, error: tr("Hanya kunjungan terjadwal yang bisa dibatalkan") };
    }

    await prisma.homeVisit.update({
      where: { id: idParsed.data },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/dashboard/home-visits");
    revalidatePath(`/dashboard/home-visits/${idParsed.data}`);
    return { success: true };
  } catch (error) {
    console.error("cancelHomeVisit error:", error);
    return { success: false, error: tr("Gagal membatalkan kunjungan") };
  }
}
