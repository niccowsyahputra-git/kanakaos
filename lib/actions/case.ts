"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  caseSchema,
  interventionSchema,
  caseNoteSchema,
  closeCaseSchema,
  caseHandlingSchema,
  type CaseInput,
} from "@/lib/validations";
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola kasus";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

/** Upload lampiran kasus ke Cloudinary. Return null + warning jika storage belum siap. */
async function uploadCaseFile(
  file: File
): Promise<{ url: string | null; warning?: string; error?: string }> {
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    return { url: null, error: "File harus JPG, PNG, WebP, atau PDF" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { url: null, error: "Ukuran file maksimal 5MB" };
  }
  if (!isCloudinaryConfigured()) {
    return {
      url: null,
      warning: "File tidak tersimpan: Cloudinary belum dikonfigurasi",
    };
  }
  try {
    const isPdf = file.type === "application/pdf";
    const url = await uploadFileToCloudinary(
      Buffer.from(await file.arrayBuffer()),
      "yayasan/cases",
      isPdf ? `${Date.now()}-${file.name}` : undefined,
      isPdf ? "raw" : "image"
    );
    return { url };
  } catch (error) {
    console.error("uploadCaseFile error:", error);
    return { url: null, error: "Gagal meng-upload file" };
  }
}

export async function createCase(values: CaseInput): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = caseSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: parsed.data.childId },
      select: { id: true, fullName: true },
    });
    if (!child) return { success: false, error: "Data anak tidak ditemukan" };

    const newCase = await prisma.case.create({
      data: {
        childId: parsed.data.childId,
        caseType: parsed.data.caseType,
        description: parsed.data.description,
        handling: parsed.data.handling ?? null,
        priority: parsed.data.priority,
        assignedToId: session.user.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Case",
      entityId: newCase.id,
      detail: `Membuka kasus ${parsed.data.caseType} untuk ${child.fullName} (prioritas ${parsed.data.priority})`,
    });

    revalidatePath("/dashboard/cases");
    return { success: true, id: newCase.id };
  } catch (error) {
    console.error("createCase error:", error);
    return { success: false, error: "Gagal membuka kasus" };
  }
}

export async function addIntervention(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = interventionSchema.safeParse({
    caseId: formData.get("caseId"),
    date: formData.get("date"),
    interventionType: formData.get("interventionType"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const caseRecord = await prisma.case.findUnique({
      where: { id: parsed.data.caseId },
      select: { id: true, status: true },
    });
    if (!caseRecord) return { success: false, error: "Kasus tidak ditemukan" };
    if (caseRecord.status === "CLOSED") {
      return { success: false, error: "Kasus sudah ditutup" };
    }

    // Upload lampiran opsional
    let attachmentUrl: string | null = null;
    let warning: string | undefined;
    const attachment = formData.get("attachment");
    if (attachment instanceof File && attachment.size > 0) {
      const uploaded = await uploadCaseFile(attachment);
      if (uploaded.error) return { success: false, error: uploaded.error };
      attachmentUrl = uploaded.url;
      warning = uploaded.warning;
    }

    const intervention = await prisma.caseIntervention.create({
      data: {
        caseId: parsed.data.caseId,
        date: new Date(parsed.data.date),
        interventionType: parsed.data.interventionType,
        notes: parsed.data.notes,
        attachmentUrl,
        createdById: session.user.id,
      },
    });

    // Kasus otomatis naik status begitu intervensi pertama dicatat
    await prisma.case.update({
      where: { id: parsed.data.caseId },
      data: { status: "IN_PROGRESS" },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "CaseIntervention",
      entityId: intervention.id,
      detail: `Intervensi "${parsed.data.interventionType}" pada kasus ${parsed.data.caseId}`,
    });

    revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
    return { success: true, id: intervention.id, warning };
  } catch (error) {
    console.error("addIntervention error:", error);
    return { success: false, error: "Gagal menambah intervensi" };
  }
}

export async function addCaseNote(values: {
  caseId: string;
  content: string;
}): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = caseNoteSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const note = await prisma.caseNote.create({
      data: {
        caseId: parsed.data.caseId,
        content: parsed.data.content,
        authorId: session.user.id,
      },
    });

    revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
    return { success: true, id: note.id };
  } catch (error) {
    console.error("addCaseNote error:", error);
    return { success: false, error: "Gagal menambah catatan" };
  }
}

export async function uploadCaseDocument(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const caseId = z.string().cuid().safeParse(formData.get("caseId"));
  if (!caseId.success) return { success: false, error: "ID kasus tidak valid" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Pilih file terlebih dahulu" };
  }

  try {
    const uploaded = await uploadCaseFile(file);
    if (uploaded.error) return { success: false, error: uploaded.error };
    if (!uploaded.url) {
      return {
        success: false,
        error: uploaded.warning ?? "Storage belum dikonfigurasi",
      };
    }

    const document = await prisma.caseDocument.create({
      data: {
        caseId: caseId.data,
        fileName: file.name,
        fileUrl: uploaded.url,
        uploadedById: session.user.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "CaseDocument",
      entityId: document.id,
      detail: `Upload dokumen "${file.name}" ke kasus ${caseId.data}`,
    });

    revalidatePath(`/dashboard/cases/${caseId.data}`);
    return { success: true, id: document.id };
  } catch (error) {
    console.error("uploadCaseDocument error:", error);
    return { success: false, error: "Gagal meng-upload dokumen" };
  }
}

export async function closeCase(values: {
  caseId: string;
  closeReason: string;
}): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = closeCaseSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const caseRecord = await prisma.case.findUnique({
      where: { id: parsed.data.caseId },
      select: { id: true, status: true },
    });
    if (!caseRecord) return { success: false, error: "Kasus tidak ditemukan" };
    if (caseRecord.status === "CLOSED") {
      return { success: false, error: "Kasus sudah ditutup sebelumnya" };
    }

    await prisma.case.update({
      where: { id: parsed.data.caseId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closeReason: parsed.data.closeReason,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Case",
      entityId: parsed.data.caseId,
      detail: `Menutup kasus: ${parsed.data.closeReason}`,
    });

    revalidatePath("/dashboard/cases");
    revalidatePath(`/dashboard/cases/${parsed.data.caseId}`);
    return { success: true };
  } catch (error) {
    console.error("closeCase error:", error);
    return { success: false, error: "Gagal menutup kasus" };
  }
}

/** Simpan catatan penanganan + status sederhana (Masih Berjalan / Selesai) */
export async function updateCaseHandling(values: {
  caseId: string;
  handling: string;
  status: "BERJALAN" | "SELESAI";
}): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = caseHandlingSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const caseRecord = await prisma.case.findUnique({
      where: { id: parsed.data.caseId },
      select: { id: true, status: true },
    });
    if (!caseRecord) {
      return { success: false, error: "Kasus tidak ditemukan" };
    }

    const isDone = parsed.data.status === "SELESAI";
    await prisma.case.update({
      where: { id: caseRecord.id },
      data: {
        handling: parsed.data.handling ?? null,
        status: isDone ? "CLOSED" : "IN_PROGRESS",
        // Selesai -> catat waktu tutup; dibuka lagi -> reset
        closedAt: isDone ? new Date() : null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Case",
      entityId: caseRecord.id,
      detail: `Memperbarui penanganan kasus (status: ${parsed.data.status})`,
    });

    revalidatePath("/dashboard/cases");
    revalidatePath(`/dashboard/cases/${caseRecord.id}`);
    return { success: true, id: caseRecord.id };
  } catch (error) {
    console.error("updateCaseHandling error:", error);
    return { success: false, error: "Gagal menyimpan penanganan kasus" };
  }
}
