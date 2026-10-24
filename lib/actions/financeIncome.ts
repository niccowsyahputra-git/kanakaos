"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  financeIncomeSchema,
  type FinanceIncomeInput,
} from "@/lib/validations";
import { nextDocNumber } from "@/lib/finance-balance";
import { incomeFundCategoryLabel } from "@/components/finance/finance-labels";

type ActionResult =
  | { success: true; id?: string; refNumber?: string }
  | { success: false; error: string };

const FORBIDDEN =
  "Hanya Super Admin dan Bendahara yang boleh mengelola kas masuk";

/**
 * Sinkronkan pemasukan VERIFIED ke buku besar lama (Transaction DEBIT)
 * agar dashboard keuangan & laporan bulanan tetap akurat.
 */
async function syncIncomeToLedger(incomeId: string) {
  const income = await prisma.financeIncome.findUnique({
    where: { id: incomeId },
  });
  if (!income || income.verification !== "VERIFIED") return;

  const categoryName =
    income.fundCategory === "PENDAPATAN_USAHA"
      ? "Pendapatan Usaha"
      : "Donasi & Dana Sosial";

  const category = await prisma.financeCategory.upsert({
    where: { name: categoryName },
    update: {},
    create: { name: categoryName },
  });

  await prisma.transaction.create({
    data: {
      date: income.date,
      description: `${income.refNumber} — ${income.sourceName} (${incomeFundCategoryLabel[income.fundCategory]})`,
      categoryId: category.id,
      type: "DEBIT",
      amount: income.amount,
      createdById: income.createdById,
    },
  });
}

export async function createFinanceIncome(
  values: FinanceIncomeInput
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const parsed = financeIncomeSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    // Validasi referensi
    if (parsed.data.programId) {
      const program = await prisma.program.findUnique({
        where: { id: parsed.data.programId },
        select: { id: true, status: true },
      });
      if (!program) {
        return { success: false, error: "Program tidak ditemukan" };
      }
    }
    if (parsed.data.donorId) {
      const donor = await prisma.donor.findUnique({
        where: { id: parsed.data.donorId },
        select: { id: true },
      });
      if (!donor) return { success: false, error: "Donatur tidak ditemukan" };
    }

    // Status verifikasi otomatis: transfer bank menunggu cek mutasi,
    // tunai langsung dianggap dana riil diterima
    const verification =
      parsed.data.method === "TRANSFER_BANK" ? "PENDING" : "VERIFIED";

    let income;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const count = await prisma.financeIncome.count();
        income = await prisma.financeIncome.create({
          data: {
            refNumber: await nextDocNumber("KM", count + attempt),
            date: parsed.data.date,
            contactCategory: parsed.data.contactCategory,
            donorId: parsed.data.donorId ?? null,
            sourceName: parsed.data.sourceName,
            restriction: parsed.data.restriction,
            fundCategory: parsed.data.fundCategory,
            programId:
              parsed.data.restriction === "TIDAK_TERIKAT"
                ? null
                : parsed.data.programId,
            method: parsed.data.method,
            amount: parsed.data.amount,
            verification,
            accountId: parsed.data.accountId ?? null,
            memo: parsed.data.memo ?? null,
            createdById: session.user.id,
          },
        });
        break;
      } catch (e) {
        if (
          attempt === 2 ||
          !(e instanceof Error) ||
          !e.message.includes("Unique constraint")
        )
          throw e;
      }
    }
    if (!income) throw new Error("Gagal membuat nomor referensi");

    if (verification === "VERIFIED") {
      await syncIncomeToLedger(income.id);
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "FinanceIncome",
      entityId: income.id,
      detail: `Kas masuk ${income.refNumber} dari ${income.sourceName} (Rp ${income.amount.toLocaleString("id-ID")})`,
    });

    revalidatePath("/dashboard/finance/income");
    revalidatePath("/dashboard/finance");
    return { success: true, id: income.id, refNumber: income.refNumber };
  } catch (error) {
    console.error("createFinanceIncome error:", error);
    return { success: false, error: "Gagal mencatat kas masuk" };
  }
}

/** Verifikasi/tolak pemasukan transfer bank setelah cek mutasi */
export async function setIncomeVerification(
  id: string,
  status: "VERIFIED" | "REJECTED"
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID pemasukan tidak valid" };
  }

  try {
    const income = await prisma.financeIncome.findUnique({
      where: { id: idParsed.data },
    });
    if (!income) return { success: false, error: "Pemasukan tidak ditemukan" };
    if (income.verification !== "PENDING") {
      return {
        success: false,
        error: "Hanya pemasukan berstatus Pending yang bisa diproses",
      };
    }

    await prisma.financeIncome.update({
      where: { id: idParsed.data },
      data: { verification: status },
    });

    if (status === "VERIFIED") {
      await syncIncomeToLedger(idParsed.data);
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "FinanceIncome",
      entityId: idParsed.data,
      detail: `${status === "VERIFIED" ? "Memverifikasi" : "Menolak"} kas masuk ${income.refNumber}`,
    });

    revalidatePath("/dashboard/finance/income");
    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (error) {
    console.error("setIncomeVerification error:", error);
    return { success: false, error: "Gagal memproses verifikasi" };
  }
}
