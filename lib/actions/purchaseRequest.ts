"use server";

import { notificationMessage } from "@/lib/i18n/notification";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireLogisticsSession,
  requireSuperAdminSession,
} from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { purchaseRequestSchema, prDecisionSchema } from "@/lib/validations";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Staf Logistik yang boleh mengelola purchase request";

export async function createPurchaseRequest(
  values: z.input<typeof purchaseRequestSchema>
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { purchaseRequestSchema } = getSchemas(locale);

  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = purchaseRequestSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const item = await prisma.inventory.findUnique({
      where: { id: parsed.data.inventoryId },
      select: { id: true, itemName: true },
    });
    if (!item) return { success: false, error: tr("Barang tidak ditemukan") };

    const pr = await prisma.purchaseRequest.create({
      data: {
        inventoryId: parsed.data.inventoryId,
        quantity: parsed.data.quantity,
        notes: parsed.data.notes ?? null,
        requestedById: session.user.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "PurchaseRequest",
      entityId: pr.id,
      detail: `PR ${item.itemName} x${parsed.data.quantity}`,
    });

    // Approval ada di tangan Super Admin
    await notifyRoles(
      ["SUPER_ADMIN"],
      {
        title: "🛒 PR baru menunggu persetujuan",
        description: notificationMessage("{0} ×{1} diajukan oleh {2}", { 0: item.itemName, 1: parsed.data.quantity, 2: session.user.name }),
        link: `/dashboard/inventory/purchase-requests/${pr.id}`,
      },
      session.user.id
    );

    revalidatePath("/dashboard/inventory/purchase-requests");
    return { success: true, id: pr.id };
  } catch (error) {
    console.error("createPurchaseRequest error:", error);
    return { success: false, error: tr("Gagal membuat purchase request") };
  }
}

/** Approve/Reject PR — hanya SUPER_ADMIN (approval workflow) */
export async function decidePurchaseRequest(
  values: z.input<typeof prDecisionSchema>
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { prDecisionSchema } = getSchemas(locale);

  const session = await requireSuperAdminSession();
  if (!session) {
    return {
      success: false,
      error: tr("Hanya Super Admin yang boleh approve/reject PR"),
    };
  }

  const parsed = prDecisionSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: parsed.data.prId },
      include: { inventory: { select: { itemName: true } } },
    });
    if (!pr) return { success: false, error: tr("PR tidak ditemukan") };
    if (pr.status !== "PENDING") {
      return { success: false, error: tr("PR sudah diputuskan sebelumnya") };
    }

    await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: {
        status: parsed.data.decision,
        decidedById: session.user.id,
        decisionNotes: parsed.data.decisionNotes ?? null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "PurchaseRequest",
      entityId: pr.id,
      detail: `${parsed.data.decision === "APPROVED" ? "Menyetujui" : "Menolak"} PR ${pr.inventory.itemName} x${pr.quantity}`,
    });

    revalidatePath("/dashboard/inventory/purchase-requests");
    revalidatePath(`/dashboard/inventory/purchase-requests/${pr.id}`);
    return { success: true };
  } catch (error) {
    console.error("decidePurchaseRequest error:", error);
    return { success: false, error: tr("Gagal memproses keputusan PR") };
  }
}

export async function markPurchaseRequestOrdered(
  prId: string
): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(prId);
  if (!idParsed.success) return { success: false, error: tr("ID PR tidak valid") };

  try {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: idParsed.data },
      select: { id: true, status: true },
    });
    if (!pr) return { success: false, error: tr("PR tidak ditemukan") };
    if (pr.status !== "APPROVED") {
      return { success: false, error: tr("Hanya PR yang disetujui bisa dipesan") };
    }

    await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: { status: "ORDERED" },
    });

    revalidatePath("/dashboard/inventory/purchase-requests");
    revalidatePath(`/dashboard/inventory/purchase-requests/${pr.id}`);
    return { success: true };
  } catch (error) {
    console.error("markPurchaseRequestOrdered error:", error);
    return { success: false, error: tr("Gagal menandai PR dipesan") };
  }
}

/**
 * Tandai barang diterima: status -> RECEIVED, stok inventory otomatis
 * bertambah + tercatat di riwayat adjustment.
 */
export async function markPurchaseRequestReceived(
  prId: string
): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireLogisticsSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(prId);
  if (!idParsed.success) return { success: false, error: tr("ID PR tidak valid") };

  try {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: idParsed.data },
      include: { inventory: { select: { id: true, itemName: true } } },
    });
    if (!pr) return { success: false, error: tr("PR tidak ditemukan") };
    if (pr.status !== "ORDERED") {
      return {
        success: false,
        error: tr("Hanya PR berstatus dipesan yang bisa diterima"),
      };
    }

    await prisma.$transaction([
      prisma.purchaseRequest.update({
        where: { id: pr.id },
        data: { status: "RECEIVED" },
      }),
      prisma.inventory.update({
        where: { id: pr.inventory.id },
        data: { quantity: { increment: pr.quantity } },
      }),
      prisma.stockAdjustment.create({
        data: {
          inventoryId: pr.inventory.id,
          delta: pr.quantity,
          reason: `Penerimaan PR ${pr.id.slice(0, 8)}`,
          createdById: session.user.id,
        },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "PurchaseRequest",
      entityId: pr.id,
      detail: `Menerima PR ${pr.inventory.itemName} x${pr.quantity}, stok bertambah otomatis`,
    });

    revalidatePath("/dashboard/inventory/purchase-requests");
    revalidatePath(`/dashboard/inventory/purchase-requests/${pr.id}`);
    revalidatePath("/dashboard/inventory");
    return { success: true };
  } catch (error) {
    console.error("markPurchaseRequestReceived error:", error);
    return { success: false, error: tr("Gagal menandai PR diterima") };
  }
}
