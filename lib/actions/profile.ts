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
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";
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
    // Upload foto profil (opsional)
    let photoUrl: string | undefined;
    let warning: string | undefined;
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!photo.type.startsWith("image/")) {
        return { success: false, error: tr("Foto harus berupa gambar") };
      }
      if (photo.size > 3 * 1024 * 1024) {
        return { success: false, error: tr("Ukuran foto maksimal 3MB") };
      }
      if (!isCloudinaryConfigured()) {
        warning = tr("Foto tidak tersimpan: Cloudinary belum dikonfigurasi");
      } else {
        try {
          photoUrl = await uploadFileToCloudinary(
            Buffer.from(await photo.arrayBuffer()),
            "yayasan/profiles",
            session.user.id // 1 foto per user, overwrite
          );
        } catch (error) {
          console.error("updateProfile upload error:", error);
          return { success: false, error: tr("Gagal meng-upload foto profil") };
        }
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        phone: parsed.data.phone ?? null,
        ...(photoUrl && { photoUrl }),
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "User",
      entityId: session.user.id,
      detail: "Memperbarui profil sendiri",
    });

    revalidatePath("/dashboard/profile");
    return { success: true, warning: warning ? tr(warning) : undefined };
  } catch (error) {
    console.error("updateProfile error:", error);
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
