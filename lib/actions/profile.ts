"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import {
  updateProfileSchema,
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validations";
import { saveManagedForm } from "@/lib/managed-form.server";
import { MANAGED_FORM_FIELDS, StorageError, storageErrorMessage } from "@/lib/storage-contract";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; warning?: string }
  | { success: false; error: string };

export async function updateProfile(
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { updateProfileSchema } = getSchemas(locale);

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const parsed = updateProfileSchema.safeParse({
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    await saveManagedForm(prisma, formData, { id: session.user.id }, session.user.id, MANAGED_FORM_FIELDS.profile, async (tx, urls) => {
      const saved = await tx.user.update({ where: { id: session.user.id }, data: { phone: parsed.data.phone ?? null, ...urls } });
      await tx.auditLog.create({ data: {
        userId: session.user.id, userName: session.user.name ?? "Unknown", action: "UPDATE", entity: "User", entityId: session.user.id,
        detail: "Memperbarui profil sendiri",
      } });
      return saved;
    });

    revalidatePath("/dashboard/profile");
    return { success: true };
  } catch (error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("updateProfile failed");
    return { success: false, error: tr("Gagal menyimpan profil") };
  }
}

export async function changePassword(
  values: ChangePasswordInput
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { changePasswordSchema } = getSchemas(locale);

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const parsed = changePasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });
    if (!user) return { success: false, error: tr("User tidak ditemukan") };

    const isValid = await bcrypt.compare(
      parsed.data.oldPassword,
      user.password
    );
    if (!isValid) {
      return { success: false, error: tr("Password lama salah") };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(parsed.data.newPassword, 10) },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "User",
      entityId: session.user.id,
      detail: "Mengganti password sendiri",
    });

    return { success: true };
  } catch (error) {
    console.error("changePassword error:", error);
    return { success: false, error: tr("Gagal mengganti password") };
  }
}
