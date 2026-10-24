"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLogisticsSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { inventoryItemSchema, stockAdjustSchema } from "@/lib/validations";
import type { z } from "zod";

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Staf Logistik yang boleh mengelola inventori";

export async function createInventoryItem(
  values: z.input<typeof inventoryItemSchema>
): Promise<ActionResult> {
  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = inventoryItemSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const item = await prisma.inventory.create({ data: parsed.data });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Inventory",
      entityId: item.id,
      detail: `Menambah barang ${item.itemName} (${item.quantity} ${item.unit})`,
    });

    revalidatePath("/dashboard/inventory");
    return { success: true, id: item.id };
  } catch (error) {
    console.error("createInventoryItem error:", error);
    return { success: false, error: "Gagal menambah barang" };
  }
}

export async function adjustStock(
  values: z.input<typeof stockAdjustSchema>
): Promise<ActionResult> {
  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = stockAdjustSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const item = await prisma.inventory.findUnique({
      where: { id: parsed.data.inventoryId },
      select: { id: true, itemName: true, quantity: true, unit: true },
    });
    if (!item) return { success: false, error: "Barang tidak ditemukan" };

    const newQuantity = item.quantity + parsed.data.delta;
    if (newQuantity < 0) {
      return {
        success: false,
        error: `Stok tidak cukup. Stok saat ini ${item.quantity} ${item.unit}`,
      };
    }

    // Update stok + catat riwayat adjustment secara atomik
    await prisma.$transaction([
      prisma.inventory.update({
        where: { id: item.id },
        data: { quantity: newQuantity },
      }),
      prisma.stockAdjustment.create({
        data: {
          inventoryId: item.id,
          delta: parsed.data.delta,
          reason: parsed.data.reason,
          createdById: session.user.id,
        },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Inventory",
      entityId: item.id,
      detail: `Adjust stok ${item.itemName}: ${parsed.data.delta > 0 ? "+" : ""}${parsed.data.delta} ${item.unit} (${parsed.data.reason})`,
    });

    // Peringatkan jika hasil adjustment membuat stok jatuh di bawah minimum
    const updated = await prisma.inventory.findUnique({
      where: { id: item.id },
      select: { quantity: true, minStock: true, itemName: true, unit: true },
    });
    if (updated && updated.quantity < updated.minStock) {
      await notifyRoles(["SUPER_ADMIN", "LOGISTICS"], {
        title: "📦 Stok menipis",
        description: `${updated.itemName} tersisa ${updated.quantity} ${updated.unit} (min ${updated.minStock})`,
        link: "/dashboard/inventory",
      });
    }

    revalidatePath("/dashboard/inventory");
    return { success: true, id: item.id };
  } catch (error) {
    console.error("adjustStock error:", error);
    return { success: false, error: "Gagal menyesuaikan stok" };
  }
}
