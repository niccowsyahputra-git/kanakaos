"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { childSchema, siblingsArraySchema } from "@/lib/validations";
import { saveManagedForm } from "@/lib/managed-form.server";
import { MANAGED_FORM_FIELDS, StorageError, storageErrorMessage } from "@/lib/storage-contract";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

/** Parse seluruh field teks form anak dari FormData */
function parseChildForm(formData: FormData) {
  return childSchema.safeParse({
    fullName: formData.get("fullName"),
    nik: formData.get("nik") ?? "",
    dob: formData.get("dob"),
    gender: formData.get("gender"),
    religion: formData.get("religion") ?? "",
    bloodType: formData.get("bloodType") || "UNKNOWN",
    heightCm: formData.get("heightCm") ?? "",
    weightKg: formData.get("weightKg") ?? "",
    status: formData.get("status") || "ACTIVE",
    orphanStatus: formData.get("orphanStatus") ?? "",
    lastEducation: formData.get("lastEducation") ?? "",
    admissionDate: formData.get("admissionDate") || undefined,
    admissionReason: formData.get("admissionReason") ?? "",
    homeAddress: formData.get("homeAddress") ?? "",
    fatherName: formData.get("fatherName") ?? "",
    fatherNik: formData.get("fatherNik") ?? "",
    fatherReligion: formData.get("fatherReligion") ?? "",
    fatherOccupation: formData.get("fatherOccupation") ?? "",
    fatherStatus: formData.get("fatherStatus") ?? "",
    motherName: formData.get("motherName") ?? "",
    motherNik: formData.get("motherNik") ?? "",
    motherReligion: formData.get("motherReligion") ?? "",
    motherOccupation: formData.get("motherOccupation") ?? "",
    motherStatus: formData.get("motherStatus") ?? "",
    lastGrade: formData.get("lastGrade") ?? "",
    birthOrder: formData.get("birthOrder") ?? "",
    siblingsCount: formData.get("siblingsCount") ?? "",
    previousSchool: formData.get("previousSchool") ?? "",
    achievements: formData.get("achievements") ?? "",
    medicalHistory: formData.get("medicalHistory") ?? "",
    notes: formData.get("notes") ?? "",
    guardianId: formData.get("guardianId") || "",
  });
}

/** Bangun objek data Prisma dari hasil parse (undefined -> null agar bisa dikosongkan) */
function buildChildData(parsed: z.infer<typeof childSchema>) {
  return {
    fullName: parsed.fullName,
    nik: parsed.nik ?? null,
    dob: parsed.dob,
    gender: parsed.gender,
    religion: parsed.religion ?? null,
    bloodType: parsed.bloodType === "UNKNOWN" ? null : parsed.bloodType,
    heightCm: parsed.heightCm ?? null,
    weightKg: parsed.weightKg ?? null,
    status: parsed.status,
    orphanStatus: parsed.orphanStatus ?? null,
    lastEducation: parsed.lastEducation ?? null,
    admissionReason: parsed.admissionReason ?? null,
    homeAddress: parsed.homeAddress ?? null,
    fatherName: parsed.fatherName ?? null,
    fatherNik: parsed.fatherNik ?? null,
    fatherReligion: parsed.fatherReligion ?? null,
    fatherOccupation: parsed.fatherOccupation ?? null,
    fatherStatus: parsed.fatherStatus ?? null,
    motherName: parsed.motherName ?? null,
    motherNik: parsed.motherNik ?? null,
    motherReligion: parsed.motherReligion ?? null,
    motherOccupation: parsed.motherOccupation ?? null,
    motherStatus: parsed.motherStatus ?? null,
    lastGrade: parsed.lastGrade ?? null,
    birthOrder: parsed.birthOrder ?? null,
    siblingsCount: parsed.siblingsCount ?? null,
    previousSchool: parsed.previousSchool ?? null,
    achievements: parsed.achievements ?? null,
    medicalHistory: parsed.medicalHistory ?? null,
    notes: parsed.notes ?? null,
    guardianId: parsed.guardianId ?? null,
  };
}

/** Ambil & validasi daftar saudara dari FormData (JSON string) */
function parseSiblings(
  formData: FormData
):
  | { ok: true; siblings: ReturnType<typeof toSiblingDb>[] }
  | { ok: false; error: string } {
  const raw = formData.get("siblings");
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: true, siblings: [] };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Data saudara tidak valid" };
  }
  const parsed = siblingsArraySchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }
  return { ok: true, siblings: parsed.data.map(toSiblingDb) };
}

function toSiblingDb(s: {
  name: string;
  gender?: "MALE" | "FEMALE";
  dob?: Date;
  activity?: "SEKOLAH" | "BEKERJA" | "BELUM_SEKOLAH" | "TIDAK_BEKERJA";
  livingWith?: "ORANG_TUA" | "WALI" | "KELUARGA" | "PANTI_ASUHAN";
  pantiName?: string;
  relation?: "KAKAK" | "ADIK";
}) {
  return {
    name: s.name,
    gender: s.gender ?? null,
    dob: s.dob ?? null,
    activity: s.activity ?? null,
    livingWith: s.livingWith ?? null,
    // Nama panti hanya relevan jika tinggal di panti asuhan
    pantiName: s.livingWith === "PANTI_ASUHAN" ? s.pantiName ?? null : null,
    relation: s.relation ?? null,
  };
}

export async function createChild(formData: FormData): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await auth();
  if (!session?.user) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const parsed = parseChildForm(formData);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  // --- Saudara kandung ---
  const sib = parseSiblings(formData);
  if (!sib.ok) return { success: false, error: tr(sib.error) };

  try {
    if (parsed.data.guardianId) {
      const guardian = await prisma.guardian.findUnique({
        where: { id: parsed.data.guardianId },
        select: { id: true },
      });
      if (!guardian) return { success: false, error: tr("Wali tidak ditemukan") };
    }

    const child = await saveManagedForm(prisma, formData, { id: session.user.id }, undefined, MANAGED_FORM_FIELDS.child, (tx, urls) => tx.child.create({
      data: {
        ...buildChildData(parsed.data),
        // admissionDate: pakai input jika ada, jika tidak biarkan default now()
        ...(parsed.data.admissionDate && {
          admissionDate: parsed.data.admissionDate,
        }),
        ...urls,
        ...(sib.siblings.length > 0 && {
          siblings: { create: sib.siblings },
        }),
      },
    }));

    revalidatePath("/dashboard/children");
    revalidatePath("/dashboard");
    return {
      success: true,
      id: child.id,
    };
  } catch (error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("createChild failed");
    return { success: false, error: tr("Gagal menyimpan data anak") };
  }
}

export async function updateChild(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await auth();
  if (!session?.user) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID anak tidak valid") };
  }

  const parsed = parseChildForm(formData);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  // --- Saudara kandung (strategi ganti-total agar konsisten dgn form) ---
  const sib = parseSiblings(formData);
  if (!sib.ok) return { success: false, error: tr(sib.error) };

  try {
    const existing = await prisma.child.findUnique({
      where: { id: idParsed.data },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: tr("Data anak tidak ditemukan") };
    }

    if (parsed.data.guardianId) {
      const guardian = await prisma.guardian.findUnique({
        where: { id: parsed.data.guardianId },
        select: { id: true },
      });
      if (!guardian) return { success: false, error: tr("Wali tidak ditemukan") };
    }

    await saveManagedForm(prisma, formData, { id: session.user.id }, idParsed.data, MANAGED_FORM_FIELDS.child, (tx, urls) => tx.child.update({
      where: { id: idParsed.data },
      data: {
        ...buildChildData(parsed.data),
        ...(parsed.data.admissionDate && {
          admissionDate: parsed.data.admissionDate,
        }),
        ...urls,
        // Ganti seluruh daftar saudara sesuai isi form terbaru
        siblings: {
          deleteMany: {},
          ...(sib.siblings.length > 0 && { create: sib.siblings }),
        },
      },
    }));

    revalidatePath("/dashboard/children");
    revalidatePath(`/dashboard/children/${idParsed.data}`);
    return {
      success: true,
      id: idParsed.data,
    };
  } catch (error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("updateChild failed");
    return { success: false, error: tr("Gagal memperbarui data anak") };
  }
}

export async function deleteChild(id: string): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await auth();
  if (!session?.user) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  // Hanya role tertentu yang boleh menghapus
  if (
    session.user.role !== "SUPER_ADMIN" &&
    session.user.role !== "SOCIAL_WORKER"
  ) {
    return { success: false, error: tr("Anda tidak punya izin menghapus data") };
  }

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID anak tidak valid") };
  }

  try {
    await prisma.child.delete({ where: { id: idParsed.data } });

    revalidatePath("/dashboard/children");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("deleteChild error:", error);
    return { success: false, error: tr("Gagal menghapus data anak") };
  }
}
