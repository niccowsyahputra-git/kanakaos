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
import { saveManagedForm } from "@/lib/managed-form.server";
import { MANAGED_FORM_FIELDS, StorageError, storageErrorMessage } from "@/lib/storage-contract";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola kasus";

export async function createCase(values: CaseInput): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { caseSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = caseSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: parsed.data.childId },
      select: { id: true, fullName: true },
    });
    if (!child) return { success: false, error: tr("Data anak tidak ditemukan") };

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
    return { success: false, error: tr("Gagal membuka kasus") };
  }
}

export async function addIntervention(
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { interventionSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = interventionSchema.safeParse({
    caseId: formData.get("caseId"),
    date: formData.get("date"),
    interventionType: formData.get("interventionType"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const caseRecord = await prisma.case.findUnique({
      where: { id: parsed.data.caseId },
      select: { id: true, status: true },
    });
    if (!caseRecord) return { success: false, error: tr("Kasus tidak ditemukan") };
    if (caseRecord.status === "CLOSED") {
      return { success: false, error: tr("Kasus sudah ditutup") };
    }

    const intervention = await saveManagedForm(prisma, formData, { id: session.user.id }, parsed.data.caseId, MANAGED_FORM_FIELDS.caseIntervention, async (tx, urls) => {
      const current = await tx.case.findUnique({ where: { id: parsed.data.caseId } });
      if (!current || current.status === "CLOSED") throw new StorageError("INVALID");
      const saved = await tx.caseIntervention.create({
        data: {
          caseId: parsed.data.caseId,
          date: new Date(parsed.data.date),
          interventionType: parsed.data.interventionType,
          notes: parsed.data.notes,
          ...urls,
          createdById: session.user.id,
        },
      });

      // Kasus otomatis naik status begitu intervensi pertama dicatat
      await tx.case.update({
        where: { id: parsed.data.caseId },
        data: { status: "IN_PROGRESS" },
      });
      return saved;
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
    return { success: true, id: intervention.id };
  } catch (error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("addIntervention failed");
    return { success: false, error: tr("Gagal menambah intervensi") };
  }
}

export async function addCaseNote(values: {
  caseId: string;
  content: string;
}): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { caseNoteSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = caseNoteSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
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
    return { success: false, error: tr("Gagal menambah catatan") };
  }
}

export async function uploadCaseDocument(
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const caseId = z.string().cuid().safeParse(formData.get("caseId"));
  if (!caseId.success) return { success: false, error: tr("ID kasus tidak valid") };

  try {
    const document = await saveManagedForm(prisma, formData, { id: session.user.id }, caseId.data, MANAGED_FORM_FIELDS.caseDocument, async (tx, urls, files) => {
      if (!urls.fileUrl || files.length !== 1) throw new StorageError("INVALID");
      const current = await tx.case.findUnique({ where: { id: caseId.data } });
      if (!current || current.status === "CLOSED") throw new StorageError("INVALID");
      return tx.caseDocument.create({
        data: {
          caseId: caseId.data,
          fileName: files[0].filename,
          fileUrl: urls.fileUrl,
          uploadedById: session.user.id,
        },
      });
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "CaseDocument",
      entityId: document.id,
      detail: `Upload dokumen "${document.fileName}" ke kasus ${caseId.data}`,
    });

    revalidatePath(`/dashboard/cases/${caseId.data}`);
    return { success: true, id: document.id };
  } catch (error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("uploadCaseDocument failed");
    return { success: false, error: tr("Gagal meng-upload dokumen") };
  }
}

export async function closeCase(values: {
  caseId: string;
  closeReason: string;
}): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { closeCaseSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = closeCaseSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const caseRecord = await prisma.case.findUnique({
      where: { id: parsed.data.caseId },
      select: { id: true, status: true },
    });
    if (!caseRecord) return { success: false, error: tr("Kasus tidak ditemukan") };
    if (caseRecord.status === "CLOSED") {
      return { success: false, error: tr("Kasus sudah ditutup sebelumnya") };
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
    return { success: false, error: tr("Gagal menutup kasus") };
  }
}

/** Simpan catatan penanganan + status sederhana (Masih Berjalan / Selesai) */
export async function updateCaseHandling(values: {
  caseId: string;
  handling: string;
  status: "BERJALAN" | "SELESAI";
}): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { caseHandlingSchema } = getSchemas(locale);

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = caseHandlingSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const caseRecord = await prisma.case.findUnique({
      where: { id: parsed.data.caseId },
      select: { id: true, status: true },
    });
    if (!caseRecord) {
      return { success: false, error: tr("Kasus tidak ditemukan") };
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
    return { success: false, error: tr("Gagal menyimpan penanganan kasus") };
  }
}
