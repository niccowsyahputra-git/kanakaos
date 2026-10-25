"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { getT } from "@/lib/i18n/server";
import { normalizeLocationName } from "@/lib/option-catalogs";

type Result = { success: true } | { success: false; error: string };

export async function saveEmployeeLocation(values: { id?: string; name: string; isActive: boolean }): Promise<Result> {
  const { tr } = await getT();
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: tr("Hanya Super Admin yang boleh mengelola entitas lokasi") };
  const parsed = z.object({
    id: z.string().cuid().optional(),
    name: z.string().trim().min(2, tr("Nama lokasi minimal 2 karakter")).max(100).transform(v => v.replace(/\s+/g, " ")),
    isActive: z.boolean(),
  }).safeParse(values);
  if (!parsed.success) return { success: false, error: tr("Nama atau data entitas lokasi tidak valid") };
  try {
    const data = { name: parsed.data.name, normalizedName: normalizeLocationName(parsed.data.name), isActive: parsed.data.isActive };
    await prisma.$transaction(async tx => {
      const location = parsed.data.id
        ? await tx.employeeLocation.update({ where: { id: parsed.data.id }, data })
        : await tx.employeeLocation.create({ data });
      await tx.auditLog.create({ data: {
        userId: session.user.id, userName: session.user.name, action: parsed.data.id ? "UPDATE" : "CREATE",
        entity: "EmployeeLocation", entityId: location.id, detail: JSON.stringify(data),
      } });
    });
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/employees");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: tr("Nama entitas lokasi sudah digunakan") };
    }
    console.error("saveEmployeeLocation error:", error);
    return { success: false, error: tr("Gagal menyimpan entitas lokasi") };
  }
}
