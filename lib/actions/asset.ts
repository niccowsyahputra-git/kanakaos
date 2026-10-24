"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLogisticsSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { assetSchema, maintenanceSchema } from "@/lib/validations";
import { z } from "zod";

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Staf Logistik yang boleh mengelola aset";

export async function createAsset(
  values: z.input<typeof assetSchema>
): Promise<ActionResult> {
  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = assetSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const asset = await prisma.asset.create({
      data: {
        name: parsed.data.name,
        category: parsed.data.category,
        acquisitionDate: new Date(parsed.data.acquisitionDate),
        value: parsed.data.value,
        location: parsed.data.location ?? null,
        condition: parsed.data.condition,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Asset",
      entityId: asset.id,
      detail: `Menambah aset ${asset.name}`,
    });

    revalidatePath("/dashboard/assets");
    return { success: true, id: asset.id };
  } catch (error) {
    console.error("createAsset error:", error);
    return { success: false, error: "Gagal menambah aset" };
  }
}

export async function scheduleMaintenance(
  values: z.input<typeof maintenanceSchema>
): Promise<ActionResult> {
  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = maintenanceSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const asset = await prisma.asset.findUnique({
      where: { id: parsed.data.assetId },
      select: { id: true, name: true },
    });
    if (!asset) return { success: false, error: "Aset tidak ditemukan" };

    const maintenance = await prisma.assetMaintenance.create({
      data: {
        assetId: parsed.data.assetId,
        maintenanceDate: new Date(parsed.data.maintenanceDate),
        maintenanceType: parsed.data.maintenanceType,
        notes: parsed.data.notes ?? null,
        createdById: session.user.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "AssetMaintenance",
      entityId: maintenance.id,
      detail: `Jadwal maintenance ${asset.name}: ${parsed.data.maintenanceType}`,
    });

    revalidatePath("/dashboard/assets");
    return { success: true, id: maintenance.id };
  } catch (error) {
    console.error("scheduleMaintenance error:", error);
    return { success: false, error: "Gagal menjadwalkan maintenance" };
  }
}

export async function completeMaintenance(id: string): Promise<ActionResult> {
  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID maintenance tidak valid" };
  }

  try {
    const maintenance = await prisma.assetMaintenance.findUnique({
      where: { id: idParsed.data },
      include: { asset: { select: { name: true } } },
    });
    if (!maintenance) {
      return { success: false, error: "Jadwal maintenance tidak ditemukan" };
    }
    if (maintenance.completedAt) {
      return { success: false, error: "Maintenance sudah ditandai selesai" };
    }

    await prisma.assetMaintenance.update({
      where: { id: idParsed.data },
      data: { completedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "AssetMaintenance",
      entityId: idParsed.data,
      detail: `Maintenance ${maintenance.asset.name} (${maintenance.maintenanceType}) selesai`,
    });

    revalidatePath("/dashboard/assets");
    return { success: true };
  } catch (error) {
    console.error("completeMaintenance error:", error);
    return { success: false, error: "Gagal menandai maintenance selesai" };
  }
}
