"use server";

import { createElement, type ReactElement } from "react";
import { revalidatePath } from "next/cache";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { donationSchema, type DonationInput } from "@/lib/validations";
import { ReceiptPdf, type ReceiptData } from "@/lib/receipt-pdf";
import { getReceiptYayasan } from "@/lib/site-settings";
import { donationCategoryLabel } from "@/components/donations/donation-labels";
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

type ProcessDonationResult =
  | {
      success: true;
      receiptNumber: string;
      receiptPdfUrl: string | null;
      /** PDF dalam base64 agar client bisa langsung men-download */
      pdfBase64: string;
      fileName: string;
      warning?: string;
    }
  | { success: false; error: string };

/**
 * Generate nomor kwitansi format KW/YYYY/MM/XXX.
 * XXX = urutan donasi pada bulan berjalan (auto-increment sederhana).
 */
async function generateReceiptNumber(date: Date): Promise<string> {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const monthStart = new Date(year, date.getMonth(), 1);
  const monthEnd = new Date(year, date.getMonth() + 1, 1);

  const countThisMonth = await prisma.donation.count({
    where: { createdAt: { gte: monthStart, lt: monthEnd } },
  });

  const sequence = String(countThisMonth + 1).padStart(3, "0");
  return `KW/${year}/${month}/${sequence}`;
}

export async function processDonation(
  data: DonationInput
): Promise<ProcessDonationResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const parsed = donationSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const input = parsed.data;
  const now = new Date();
  const isInKind = input.type === "IN_KIND";
  // Satuan enum -> label yang dipakai modul inventori
  const unitLabel: Record<string, string> = {
    PCS: "pcs",
    KG: "kg",
    LTR: "ltr",
    BOX: "box",
  };

  try {
    // a + b. Simpan donasi dengan receiptNumber unik.
    // Retry maks 3x jika terjadi tabrakan nomor (unique constraint P2002).
    let donation = null;
    let receiptNumber = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      receiptNumber = await generateReceiptNumber(now);
      try {
        donation = await prisma.donation.create({
          data: {
            donaturName: input.donaturName,
            donorType: input.donorType,
            donaturContact: input.donaturContact ?? null,
            donaturAddress: input.donaturAddress ?? null,
            // Donasi barang tidak membawa nominal uang
            amount: isInKind ? 0 : input.amount,
            type: input.type,
            category: input.category ?? null,
            purpose: input.purpose ?? null,
            receiptNumber,
          },
        });
        break;
      } catch (err: unknown) {
        const isUniqueConflict =
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002";
        if (!isUniqueConflict || attempt === 2) throw err;
        // nomor bentrok (submit bersamaan) -> hitung ulang lalu coba lagi
      }
    }
    if (!donation) {
      return { success: false, error: "Gagal membuat nomor kwitansi" };
    }

    // Donasi barang: catat rincian + sinkron otomatis ke modul Inventori.
    // Barang yang sudah ada stoknya bertambah; barang baru dibuatkan item
    // inventori baru. Semua tercatat di riwayat StockAdjustment.
    let inventoryWarning: string | undefined;
    if (isInKind) {
      try {
        const donationId = donation.id;
        await prisma.$transaction(async (tx) => {
          for (const item of input.items) {
            const name = item.itemName.trim();
            const existing = await tx.inventory.findFirst({
              where: { itemName: name },
              select: { id: true },
            });

            let inventoryId: string;
            if (existing) {
              await tx.inventory.update({
                where: { id: existing.id },
                data: { quantity: { increment: item.quantity } },
              });
              inventoryId = existing.id;
            } else {
              const created = await tx.inventory.create({
                data: {
                  itemName: name,
                  category: "LAINNYA",
                  quantity: item.quantity,
                  unit: unitLabel[item.unit] ?? "pcs",
                  minStock: 0,
                },
              });
              inventoryId = created.id;
            }

            await tx.stockAdjustment.create({
              data: {
                inventoryId,
                delta: item.quantity,
                reason: `Donasi barang dari ${input.donaturName} (${receiptNumber})`,
                createdById: session.user.id,
              },
            });

            await tx.donationItem.create({
              data: {
                donationId,
                itemName: name,
                quantity: item.quantity,
                unit: item.unit,
                inventoryId,
              },
            });
          }
        });
      } catch (error) {
        console.error("processDonation inventory sync error:", error);
        inventoryWarning =
          "Sinkronisasi ke inventori gagal — tambahkan stok secara manual";
      }
    }

    // c. Render PDF kwitansi (QR berisi link verifikasi publik)
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify/${encodeURIComponent(receiptNumber)}`;
    const [qrCodeDataUrl, yayasan] = await Promise.all([
      QRCode.toDataURL(verifyUrl, { width: 144, margin: 1 }),
      getReceiptYayasan(),
    ]);

    const receiptData: ReceiptData = {
      receiptNumber,
      donaturName: input.donaturName,
      donaturContact: input.donaturContact,
      amount: isInKind ? 0 : input.amount,
      type: input.type,
      categoryLabel: input.category
        ? donationCategoryLabel[input.category]
        : undefined,
      purpose: input.purpose,
      date: now,
      items: isInKind
        ? input.items.map((item) => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unit: unitLabel[item.unit] ?? "pcs",
          }))
        : undefined,
      qrCodeDataUrl,
      yayasan,
    };

    const pdfBuffer = await renderToBuffer(
      createElement(ReceiptPdf, {
        data: receiptData,
      }) as ReactElement<DocumentProps>
    );

    // d. Upload PDF ke Cloudinary (resource_type "raw" wajib untuk PDF).
    //    Jika storage belum diset / gagal, donasi tetap sah — user tetap
    //    menerima PDF via download langsung (base64).
    const safeFileName = `${receiptNumber.replaceAll("/", "-")}.pdf`;
    let receiptPdfUrl: string | null = null;
    let warning: string | undefined;

    if (!isCloudinaryConfigured()) {
      warning =
        "PDF tidak tersimpan ke storage: Cloudinary belum dikonfigurasi";
    } else {
      try {
        receiptPdfUrl = await uploadFileToCloudinary(
          pdfBuffer,
          "yayasan/receipts",
          safeFileName, // public_id lengkap dengan .pdf agar URL raw valid
          "raw"
        );
      } catch (error) {
        console.error("processDonation upload PDF error:", error);
        warning = "PDF gagal di-upload ke storage, tapi kwitansi tetap sah";
      }
    }

    // e. Update record dengan URL PDF (null jika upload gagal)
    await prisma.donation.update({
      where: { id: donation.id },
      data: { receiptPdfUrl },
    });

    // Integrasi keuangan: donasi uang otomatis tercatat sebagai kas masuk.
    // Donasi barang (IN_KIND) tidak menambah kas.
    if (input.type !== "IN_KIND") {
      try {
        const donationCategory = await prisma.financeCategory.upsert({
          where: { name: "Donasi" },
          update: {},
          create: { name: "Donasi", monthlyBudget: 0 },
        });
        await prisma.transaction.create({
          data: {
            date: now,
            description: `Donasi${
              input.category ? ` ${donationCategoryLabel[input.category]}` : ""
            } dari ${input.donaturName} (${receiptNumber})`,
            categoryId: donationCategory.id,
            type: "DEBIT",
            amount: input.amount,
            donationId: donation.id,
            createdById: session.user.id,
          },
        });
      } catch (error) {
        // Kegagalan pencatatan kas tidak membatalkan donasi (bisa direkonsiliasi manual)
        console.error("processDonation transaction error:", error);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/inventory");

    // f. Return PDF (base64) agar user langsung bisa download
    const combinedWarning =
      [warning, inventoryWarning].filter(Boolean).join(". ") || undefined;
    return {
      success: true,
      receiptNumber,
      receiptPdfUrl,
      pdfBase64: pdfBuffer.toString("base64"),
      fileName: safeFileName,
      warning: combinedWarning,
    };
  } catch (error) {
    console.error("processDonation error:", error);
    return { success: false, error: "Gagal memproses donasi" };
  }
}
