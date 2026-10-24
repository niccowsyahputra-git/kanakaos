"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { partnerSchema, type PartnerInput } from "@/lib/validations";

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola mitra";

export async function createPartner(
  values: PartnerInput
): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = partnerSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const partner = await prisma.partner.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        picName: parsed.data.picName ?? null,
        picPhone: parsed.data.picPhone ?? null,
        mouExpiryDate: parsed.data.mouExpiryDate ?? null,
      },
    });

    revalidatePath("/dashboard/partners");
    return { success: true, id: partner.id };
  } catch (error) {
    console.error("createPartner error:", error);
    return { success: false, error: "Gagal menyimpan data mitra" };
  }
}

export async function deletePartner(id: string): Promise<ActionResult> {
  const session = await requireStaffSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID mitra tidak valid" };
  }

  try {
    await prisma.partner.delete({ where: { id: idParsed.data } });

    revalidatePath("/dashboard/partners");
    return { success: true };
  } catch (error) {
    console.error("deletePartner error:", error);
    return { success: false, error: "Gagal menghapus mitra" };
  }
}
