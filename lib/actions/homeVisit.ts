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
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola kunjungan rumah";

export async function scheduleHomeVisit(
  values: HomeVisitInput
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = homeVisitSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: parsed.data.childId },
      select: { id: true, fullName: true, guardianId: true },
    });
    if (!child) return { success: false, error: "Data anak tidak ditemukan" };
    if (!child.guardianId) {
      return {
        success: false,
        error: "Anak ini belum punya wali terdaftar. Lengkapi data wali dulu",
      };
    }

    // Pastikan petugas valid & aktif
    const officer = await prisma.user.findUnique({
      where: { id: parsed.data.officerId },
      select: { id: true, name: true, isActive: true },
    });
    if (!officer || !officer.isActive) {
      return { success: false, error: "Petugas kunjungan tidak valid" };
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
    return { success: false, error: "Gagal menjadwalkan kunjungan" };
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
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

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
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const visit = await prisma.homeVisit.findUnique({
      where: { id: parsed.data.visitId },
      include: { child: { select: { fullName: true, guardianId: true } } },
    });
    if (!visit) return { success: false, error: "Kunjungan tidak ditemukan" };
    if (visit.status !== "PLANNED") {
      return { success: false, error: "Kunjungan sudah selesai/dibatalkan" };
    }

    // Upload foto rumah (opsional)
    let photoUrl: string | null = null;
    let warning: string | undefined;
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!photo.type.startsWith("image/")) {
        return { success: false, error: "Foto harus berupa gambar" };
      }
      if (photo.size > 5 * 1024 * 1024) {
        return { success: false, error: "Ukuran foto maksimal 5MB" };
      }
      if (!isCloudinaryConfigured()) {
        warning = "Foto tidak tersimpan: Cloudinary belum dikonfigurasi";
      } else {
        try {
          photoUrl = await uploadFileToCloudinary(
            Buffer.from(await photo.arrayBuffer()),
            "yayasan/home-visits"
          );
        } catch (error) {
          console.error("completeHomeVisit upload error:", error);
          return { success: false, error: "Gagal meng-upload foto" };
        }
      }
    }

    const { visitId, visitNotes, ...checklist } = parsed.data;

    await prisma.homeVisit.update({
      where: { id: visitId },
      data: {
        ...checklist,
        visitNotes,
        photoUrl,
        status: "DONE",
        completedAt: new Date(),
        // Data lama tanpa petugas: yang menyelesaikan = yang melakukan
        ...(visit.officerId ? {} : { officerId: session.user.id }),
      },
    });

    // Sinkronkan skor kerentanan ke profil wali
    if (visit.child.guardianId) {
      await prisma.guardian.update({
        where: { id: visit.child.guardianId },
        data: { vulnerabilityScore: parsed.data.vulnerabilityScore },
      });
    }

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
    return { success: true, id: visitId, warning };
  } catch (error) {
    console.error("completeHomeVisit error:", error);
    return { success: false, error: "Gagal menyelesaikan kunjungan" };
  }
}

export async function cancelHomeVisit(id: string): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID kunjungan tidak valid" };
  }

  try {
    const visit = await prisma.homeVisit.findUnique({
      where: { id: idParsed.data },
      select: { id: true, status: true },
    });
    if (!visit) return { success: false, error: "Kunjungan tidak ditemukan" };
    if (visit.status !== "PLANNED") {
      return { success: false, error: "Hanya kunjungan terjadwal yang bisa dibatalkan" };
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
    return { success: false, error: "Gagal membatalkan kunjungan" };
  }
}
