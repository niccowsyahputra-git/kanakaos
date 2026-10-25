"use server";

import { notificationMessage } from "@/lib/i18n/notification";

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
import { saveManagedForm } from "@/lib/managed-form.server";
import { MANAGED_FORM_FIELDS, StorageError, storageErrorMessage } from "@/lib/storage-contract";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

export async function reportIncident(
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { incidentSchema } = getSchemas(locale);

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const parsed = incidentSchema.safeParse({
    childId: formData.get("childId"),
    incidentType: formData.get("incidentType"),
    description: formData.get("description"),
    handling: formData.get("handling") ?? "",
    urgency: formData.get("urgency"),
  });
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: parsed.data.childId },
      select: { id: true, fullName: true },
    });
    if (!child) return { success: false, error: tr("Data anak tidak ditemukan") };

    const incident = await saveManagedForm(prisma, formData, { id: session.user.id }, undefined, MANAGED_FORM_FIELDS.incident, (tx, urls) => tx.incident.create({
      data: {
        childId: parsed.data.childId,
        incidentType: parsed.data.incidentType,
        description: parsed.data.description,
        handling: parsed.data.handling ?? null,
        urgency: parsed.data.urgency,
        ...urls,
        reportedById: session.user.id,
      },
    }));

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
        title: notificationMessage("Insiden baru: {0}", { 0: child.fullName }),
        description: notificationMessage(parsed.data.urgency === "CRITICAL" ? "⚠️ KRITIS — {0}" : "{0}", { 0: parsed.data.description.slice(0, 100) }),
        link: `/dashboard/incidents/${incident.id}`,
      },
      session.user.id
    ).catch(() => console.error("Incident saved; notification delivery failed."));

    revalidatePath("/dashboard/incidents");
    return { success: true, id: incident.id };
  } catch (error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("reportIncident failed");
    return { success: false, error: tr("Gagal melaporkan insiden") };
  }
}

export async function addIncidentUpdate(values: {
  incidentId: string;
  notes: string;
  newStatus?: "OPEN" | "IN_PROGRESS" | "RESOLVED";
}): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { incidentUpdateSchema } = getSchemas(locale);

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const parsed = incidentUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const incident = await prisma.incident.findUnique({
      where: { id: parsed.data.incidentId },
      select: { id: true, status: true },
    });
    if (!incident) return { success: false, error: tr("Insiden tidak ditemukan") };
    if (incident.status === "RESOLVED" && !parsed.data.newStatus) {
      return {
        success: false,
        error: tr("Insiden sudah selesai. Ubah status jika perlu dibuka kembali"),
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
    return { success: false, error: tr("Gagal menambah update penanganan") };
  }
}

/** Simpan catatan penanganan + status sederhana (Masih Berjalan / Selesai) */
export async function updateIncidentHandling(values: {
  incidentId: string;
  handling: string;
  status: "BERJALAN" | "SELESAI";
}): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { incidentHandlingSchema } = getSchemas(locale);

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const parsed = incidentHandlingSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const incident = await prisma.incident.findUnique({
      where: { id: parsed.data.incidentId },
      select: { id: true, status: true },
    });
    if (!incident) {
      return { success: false, error: tr("Insiden tidak ditemukan") };
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
    return { success: false, error: tr("Gagal menyimpan penanganan insiden") };
  }
}
