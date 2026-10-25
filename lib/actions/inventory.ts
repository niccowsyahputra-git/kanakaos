"use server";

import { notificationMessage } from "@/lib/i18n/notification";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLogisticsSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { inventoryItemSchema, stockAdjustSchema } from "@/lib/validations";
import { z } from "zod";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Staf Logistik yang boleh mengelola inventori";

export async function createInventoryItem(
  values: z.input<typeof inventoryItemSchema>
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { inventoryItemSchema } = getSchemas(locale);

  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = inventoryItemSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
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
    return { success: false, error: tr("Gagal menambah barang") };
  }
}

export async function updateInventoryItem(
  id: string,
  values: Omit<z.input<typeof inventoryItemSchema>, "quantity">
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };
  if (!z.string().cuid().safeParse(id).success) return { success: false, error: tr("ID barang tidak valid") };
  const parsed = getSchemas(locale).inventoryItemSchema.omit({ quantity: true }).safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  try {
    const existing = await prisma.inventory.findUnique({ where: { id } });
    if (!existing) return { success: false, error: tr("Barang tidak ditemukan") };
    await prisma.$transaction([
      prisma.inventory.update({ where: { id }, data: parsed.data }),
      prisma.auditLog.create({ data: {
        userId: session.user.id, userName: session.user.name ?? "Unknown", action: "UPDATE",
        entity: "Inventory", entityId: id,
        detail: JSON.stringify({ before: { itemName: existing.itemName, category: existing.category, unit: existing.unit, minStock: existing.minStock }, after: parsed.data }),
      } }),
    ]);
    revalidatePath("/dashboard/inventory", "layout");
    revalidatePath("/dashboard");
    return { success: true, id };
  } catch (error) {
    console.error("updateInventoryItem error:", error);
    return { success: false, error: tr("Gagal memperbarui barang") };
  }
}

export async function adjustStock(
  values: z.input<typeof stockAdjustSchema>
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { stockAdjustSchema } = getSchemas(locale);

  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = stockAdjustSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const item = await prisma.inventory.findUnique({
      where: { id: parsed.data.inventoryId },
      select: { id: true, itemName: true, quantity: true, unit: true },
    });
    if (!item) return { success: false, error: tr("Barang tidak ditemukan") };

    const newQuantity = item.quantity + parsed.data.delta;
    if (newQuantity < 0) {
      return {
        success: false,
        error: tr(`Stok tidak cukup. Stok saat ini ${item.quantity} ${item.unit}`),
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
        description: notificationMessage("{0} tersisa {1} {2} (min {3})", { 0: updated.itemName, 1: updated.quantity, 2: updated.unit, 3: updated.minStock }),
        link: "/dashboard/inventory",
      });
    }

    revalidatePath("/dashboard/inventory");
    return { success: true, id: item.id };
  } catch (error) {
    console.error("adjustStock error:", error);
    return { success: false, error: tr("Gagal menyesuaikan stok") };
  }
}
