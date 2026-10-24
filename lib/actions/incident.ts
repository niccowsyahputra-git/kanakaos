"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import {
  incidentSchema,
  incidentUpdateSchema,
  incidentHandlingSchema,
} from "@/lib/validations";
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

export async function reportIncident(
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const parsed = incidentSchema.safeParse({
    childId: formData.get("childId"),
    incidentType: formData.get("incidentType"),
    description: formData.get("description"),
    handling: formData.get("handling") ?? "",
    urgency: formData.get("urgency"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: parsed.data.childId },
      select: { id: true, fullName: true },
    });
    if (!child) return { success: false, error: "Data anak tidak ditemukan" };

    // Upload foto pendukung (opsional)
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
            "yayasan/incidents"
          );
        } catch (error) {
          console.error("reportIncident upload error:", error);
          return { success: false, error: "Gagal meng-upload foto" };
        }
      }
    }

    const incident = await prisma.incident.create({
      data: {
        childId: parsed.data.childId,
        incidentType: parsed.data.incidentType,
        description: parsed.data.description,
        handling: parsed.data.handling ?? null,
        urgency: parsed.data.urgency,
        photoUrl,
        reportedById: session.user.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Incident",
      entityId: incident.id,
      detail: `Melaporkan insiden ${parsed.data.incidentType} (${parsed.data.urgency}) untuk ${child.fullName}`,
    });

    // Staff wajib tahu insiden baru, apalagi yang urgensinya tinggi
    await notifyRoles(
      ["SUPER_ADMIN", "SOCIAL_WORKER"],
      {
        title: `Insiden baru: ${child.fullName}`,
        description: `${parsed.data.urgency === "CRITICAL" ? "⚠️ KRITIS — " : ""}${parsed.data.description.slice(0, 100)}`,
        link: `/dashboard/incidents/${incident.id}`,
      },
      session.user.id
    );

    revalidatePath("/dashboard/incidents");
    return { success: true, id: incident.id, warning };
  } catch (error) {
    console.error("reportIncident error:", error);
    return { success: false, error: "Gagal melaporkan insiden" };
  }
}

export async function addIncidentUpdate(values: {
  incidentId: string;
  notes: string;
  newStatus?: "OPEN" | "IN_PROGRESS" | "RESOLVED";
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const parsed = incidentUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const incident = await prisma.incident.findUnique({
      where: { id: parsed.data.incidentId },
      select: { id: true, status: true },
    });
    if (!incident) return { success: false, error: "Insiden tidak ditemukan" };
    if (incident.status === "RESOLVED" && !parsed.data.newStatus) {
      return {
        success: false,
        error: "Insiden sudah selesai. Ubah status jika perlu dibuka kembali",
      };
    }

    const update = await prisma.incidentUpdate.create({
      data: {
        incidentId: parsed.data.incidentId,
        notes: parsed.data.notes,
        newStatus: parsed.data.newStatus ?? null,
        createdById: session.user.id,
      },
    });

    if (parsed.data.newStatus && parsed.data.newStatus !== incident.status) {
      await prisma.incident.update({
        where: { id: parsed.data.incidentId },
        data: { status: parsed.data.newStatus },
      });
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Incident",
      entityId: parsed.data.incidentId,
      detail: parsed.data.newStatus
        ? `Update penanganan insiden (status -> ${parsed.data.newStatus})`
        : "Update penanganan insiden",
    });

    revalidatePath("/dashboard/incidents");
    revalidatePath(`/dashboard/incidents/${parsed.data.incidentId}`);
    return { success: true, id: update.id };
  } catch (error) {
    console.error("addIncidentUpdate error:", error);
    return { success: false, error: "Gagal menambah update penanganan" };
  }
}

/** Simpan catatan penanganan + status sederhana (Masih Berjalan / Selesai) */
export async function updateIncidentHandling(values: {
  incidentId: string;
  handling: string;
  status: "BERJALAN" | "SELESAI";
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const parsed = incidentHandlingSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const incident = await prisma.incident.findUnique({
      where: { id: parsed.data.incidentId },
      select: { id: true, status: true },
    });
    if (!incident) {
      return { success: false, error: "Insiden tidak ditemukan" };
    }

    const newStatus =
      parsed.data.status === "SELESAI" ? "RESOLVED" : "IN_PROGRESS";

    await prisma.incident.update({
      where: { id: incident.id },
      data: {
        handling: parsed.data.handling ?? null,
        status: newStatus,
      },
    });

    // Catat juga di timeline agar riwayat penanganan tetap utuh
    if (incident.status !== newStatus) {
      await prisma.incidentUpdate.create({
        data: {
          incidentId: incident.id,
          notes: `Status insiden diubah menjadi ${
            parsed.data.status === "SELESAI" ? "Selesai" : "Masih Berjalan"
          }`,
          newStatus,
          createdById: session.user.id,
        },
      });
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Incident",
      entityId: incident.id,
      detail: `Memperbarui penanganan insiden (status: ${parsed.data.status})`,
    });

    revalidatePath("/dashboard/incidents");
    revalidatePath(`/dashboard/incidents/${incident.id}`);
    return { success: true, id: incident.id };
  } catch (error) {
    console.error("updateIncidentHandling error:", error);
    return { success: false, error: "Gagal menyimpan penanganan insiden" };
  }
}
