"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { guardianSchema } from "@/lib/validations";
import { saveManagedForm } from "@/lib/managed-form.server";
import { MANAGED_FORM_FIELDS, StorageError, storageErrorMessage } from "@/lib/storage-contract";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola data wali";

/** Parse seluruh field teks form wali dari FormData */
function parseGuardianForm(formData: FormData) {
  return guardianSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    dob: formData.get("dob") || undefined,
    relationship: formData.get("relationship") ?? "",
    nik: formData.get("nik") ?? "",
    kkNumber: formData.get("kkNumber") ?? "",
    religion: formData.get("religion") ?? "",
    spouseName: formData.get("spouseName") ?? "",
    spouseStatus: formData.get("spouseStatus") ?? "",
    spouseNik: formData.get("spouseNik") ?? "",
    occupation: formData.get("occupation") ?? "",
    lastEducation: formData.get("lastEducation") ?? "",
    residenceStatus: formData.get("residenceStatus") ?? "",
    monthlyIncome: formData.get("monthlyIncome") ?? "",
    dependentsCount: formData.get("dependentsCount") ?? "",
    address: formData.get("address") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

/** Bangun objek data Prisma (undefined -> null agar bisa dikosongkan saat edit) */
function buildGuardianData(parsed: z.infer<typeof guardianSchema>) {
  return {
    name: parsed.name,
    phone: parsed.phone ?? null,
    dob: parsed.dob ?? null,
    relationship: parsed.relationship ?? null,
    nik: parsed.nik ?? null,
    kkNumber: parsed.kkNumber ?? null,
    religion: parsed.religion ?? null,
    spouseName: parsed.spouseName ?? null,
    spouseStatus: parsed.spouseStatus ?? null,
    spouseNik: parsed.spouseNik ?? null,
    occupation: parsed.occupation ?? null,
    lastEducation: parsed.lastEducation ?? null,
    residenceStatus: parsed.residenceStatus ?? null,
    monthlyIncome: parsed.monthlyIncome ?? null,
    dependentsCount: parsed.dependentsCount ?? null,
    address: parsed.address ?? null,
    notes: parsed.notes ?? null,
  };
}

/** Ambil & validasi daftar anak yang diasuh dari FormData */
function parseChildIds(formData: FormData): string[] | null {
  const ids = formData.getAll("childIds").map(String);
  for (const id of ids) {
    if (!z.string().cuid().safeParse(id).success) return null;
  }
  return ids;
}

export async function createGuardian(
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = parseGuardianForm(formData);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  const childIds = parseChildIds(formData);
  if (childIds === null) {
    return { success: false, error: tr("Daftar anak tidak valid") };
  }

  try {
    const guardian = await saveManagedForm(prisma, formData, { id: session.user.id }, undefined, MANAGED_FORM_FIELDS.guardian, async (tx, urls) => {
      const saved = await tx.guardian.create({ data: { ...buildGuardianData(parsed.data), ...urls } });
      // Hubungkan anak terpilih ke wali ini (1 anak 1 wali)
      if (childIds.length > 0) {
        await tx.child.updateMany({ where: { id: { in: childIds } }, data: { guardianId: saved.id } });
      }
      await tx.auditLog.create({ data: {
        userId: session.user.id, userName: session.user.name ?? "Unknown", action: "CREATE", entity: "Guardian", entityId: saved.id,
        detail: `Menambah wali ${saved.name} (${childIds.length} anak terhubung)`,
      } });
      return saved;
    });

    revalidatePath("/dashboard/guardians");
    revalidatePath("/dashboard/children");
    revalidatePath("/dashboard/children/new");
    return {
      success: true,
      id: guardian.id,
    };
  } catch (error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("createGuardian failed");
    return { success: false, error: tr("Gagal menambah wali") };
  }
}

export async function updateGuardian(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID wali tidak valid") };
  }

  const parsed = parseGuardianForm(formData);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  const childIds = parseChildIds(formData);
  if (childIds === null) {
    return { success: false, error: tr("Daftar anak tidak valid") };
  }

  try {
    const existing = await prisma.guardian.findUnique({
      where: { id: idParsed.data },
      select: { id: true },
    });
    if (!existing) return { success: false, error: tr("Wali tidak ditemukan") };

    // Sinkron dua arah secara atomik:
    // - anak yang di-uncheck dilepas dari wali ini
    // - anak yang dipilih dipindahkan ke wali ini (menimpa wali lama)
    await saveManagedForm(prisma, formData, { id: session.user.id }, idParsed.data, MANAGED_FORM_FIELDS.guardian, async (tx, urls) => {
      const saved = await tx.guardian.update({ where: { id: idParsed.data }, data: { ...buildGuardianData(parsed.data), ...urls } });
      await tx.child.updateMany({ where: { guardianId: idParsed.data, id: { notIn: childIds } }, data: { guardianId: null } });
      if (childIds.length > 0) await tx.child.updateMany({ where: { id: { in: childIds } }, data: { guardianId: idParsed.data } });
      await tx.auditLog.create({ data: {
        userId: session.user.id, userName: session.user.name ?? "Unknown", action: "UPDATE", entity: "Guardian", entityId: idParsed.data,
        detail: `Memperbarui data wali ${parsed.data.name} (${childIds.length} anak terhubung)`,
      } });
      return saved;
    });

    revalidatePath("/dashboard/guardians");
    revalidatePath("/dashboard/children");
    return {
      success: true,
      id: idParsed.data,
    };
  } catch (error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("updateGuardian failed");
    return { success: false, error: tr("Gagal memperbarui wali") };
  }
}

export async function deleteGuardian(id: string): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireStaffSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID wali tidak valid") };
  }

  try {
    const guardian = await prisma.guardian.findUnique({
      where: { id: idParsed.data },
      select: { id: true, name: true, _count: { select: { children: true } } },
    });
    if (!guardian) return { success: false, error: tr("Wali tidak ditemukan") };

    // Cegah hapus wali yang masih terkait anak (jaga integritas relasi)
    if (guardian._count.children > 0) {
      return {
        success: false,
        error: tr(`Wali masih terkait ${guardian._count.children} anak. Lepas keterkaitan dulu`),
      };
    }

    await prisma.guardian.delete({ where: { id: idParsed.data } });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "DELETE",
      entity: "Guardian",
      entityId: idParsed.data,
      detail: `Menghapus wali ${guardian.name}`,
    });

    revalidatePath("/dashboard/guardians");
    return { success: true };
  } catch (error) {
    console.error("deleteGuardian error:", error);
    return { success: false, error: tr("Gagal menghapus wali") };
  }
}
