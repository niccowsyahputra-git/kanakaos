"use server";

import { z } from "zod";
import { createElement, type ReactElement } from "react";
import { revalidatePath } from "next/cache";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  budgetSchema,
  emailReceiptSchema,
} from "@/lib/validations";
import { ReceiptPdf, type ReceiptData } from "@/lib/receipt-pdf";

type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

type FileResult =
  | { success: true; fileName: string; contentBase64: string; mime: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin dan Bendahara yang boleh mengelola keuangan";

export async function updateBudget(values: {
  categoryId: string;
  monthlyBudget: number;
}): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = budgetSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const category = await prisma.financeCategory.update({
      where: { id: parsed.data.categoryId },
      data: { monthlyBudget: parsed.data.monthlyBudget },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "FinanceCategory",
      entityId: category.id,
      detail: `Ubah budget ${category.name} -> Rp${parsed.data.monthlyBudget.toLocaleString("id-ID")}/bulan`,
    });

    revalidatePath("/dashboard/finance/budget");
    revalidatePath("/dashboard/finance/overview");
    return { success: true };
  } catch (error) {
    console.error("updateBudget error:", error);
    return { success: false, error: "Gagal memperbarui budget" };
  }
}

/** Escape nilai agar aman untuk format CSV */
function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replaceAll('"', '""')}"`;
  return str;
}

export async function exportTransactionsCsv(): Promise<FileResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  try {
    const transactions = await prisma.transaction.findMany({
      include: { category: { select: { name: true } } },
      orderBy: { date: "asc" },
    });

    let balance = 0;
    const rows = transactions.map((transaction) => {
      const amount = Number(transaction.amount);
      balance += transaction.type === "DEBIT" ? amount : -amount;
      return [
        transaction.date.toISOString().slice(0, 10),
        transaction.description,
        transaction.category.name,
        transaction.type === "DEBIT" ? "Masuk" : "Keluar",
        amount,
        balance,
      ];
    });

    const csv = [
      ["Tanggal", "Deskripsi", "Kategori", "Tipe", "Jumlah", "Saldo"].join(","),
      ...rows.map((row) => row.map(csvCell).join(",")),
    ].join("\n");

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Export",
      detail: "Export transaksi keuangan ke CSV",
    });

    return {
      success: true,
      fileName: `transaksi-${new Date().toISOString().slice(0, 10)}.csv`,
      contentBase64: Buffer.from("\uFEFF" + csv, "utf-8").toString("base64"),
      mime: "text/csv",
    };
  } catch (error) {
    console.error("exportTransactionsCsv error:", error);
    return { success: false, error: "Gagal meng-export transaksi" };
  }
}

/** Cetak ulang kwitansi donasi: regenerate PDF dari data tersimpan */
export async function reprintReceipt(donationId: string): Promise<FileResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(donationId);
  if (!idParsed.success) {
    return { success: false, error: "ID donasi tidak valid" };
  }

  try {
    const donation = await prisma.donation.findUnique({
      where: { id: idParsed.data },
    });
    if (!donation) return { success: false, error: "Donasi tidak ditemukan" };

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify/${encodeURIComponent(donation.receiptNumber)}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 144,
      margin: 1,
    });

    const receiptData: ReceiptData = {
      receiptNumber: donation.receiptNumber,
      donaturName: donation.donaturName,
      donaturContact: donation.donaturContact,
      amount: Number(donation.amount),
      type: donation.type,
      purpose: donation.purpose,
      date: donation.createdAt,
      qrCodeDataUrl,
    };

    const pdfBuffer = await renderToBuffer(
      createElement(ReceiptPdf, {
        data: receiptData,
      }) as ReactElement<DocumentProps>
    );

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Donation",
      entityId: donation.id,
      detail: `Cetak ulang kwitansi ${donation.receiptNumber}`,
    });

    return {
      success: true,
      fileName: `${donation.receiptNumber.replaceAll("/", "-")}.pdf`,
      contentBase64: pdfBuffer.toString("base64"),
      mime: "application/pdf",
    };
  } catch (error) {
    console.error("reprintReceipt error:", error);
    return { success: false, error: "Gagal mencetak ulang kwitansi" };
  }
}

/**
 * Kirim kwitansi via email (placeholder).
 * Pengiriman aktual menunggu integrasi SMTP; permintaan dicatat di audit log.
 */
export async function emailReceipt(values: {
  donationId: string;
  email: string;
}): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = emailReceiptSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const donation = await prisma.donation.findUnique({
      where: { id: parsed.data.donationId },
      select: { id: true, receiptNumber: true },
    });
    if (!donation) return { success: false, error: "Donasi tidak ditemukan" };

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "EmailQueue",
      entityId: donation.id,
      detail: `Permintaan kirim kwitansi ${donation.receiptNumber} ke ${parsed.data.email}`,
    });

    return {
      success: true,
      warning:
        "Permintaan tercatat. Pengiriman otomatis aktif setelah SMTP dikonfigurasi — sementara silakan download & kirim manual",
    };
  } catch (error) {
    console.error("emailReceipt error:", error);
    return { success: false, error: "Gagal mencatat permintaan email" };
  }
}

/** Tandai niat donasi publik sudah ditindaklanjuti bendahara */
export async function markPledgeFollowedUp(
  pledgeId: string
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(pledgeId);
  if (!idParsed.success) {
    return { success: false, error: "ID pledge tidak valid" };
  }

  try {
    await prisma.donationPledge.update({
      where: { id: idParsed.data },
      data: { followedUp: true },
    });

    revalidatePath("/dashboard/finance/donations");
    return { success: true };
  } catch (error) {
    console.error("markPledgeFollowedUp error:", error);
    return { success: false, error: "Gagal menandai pledge" };
  }
}
