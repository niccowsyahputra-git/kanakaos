"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { FinanceIncomeInput } from "@/lib/validations";
import type { Prisma } from "@prisma/client";
import { nextDocNumber, assertFundraisingProgram, FundingRuleError, lockFundingWallets } from "@/lib/finance-balance";
import { incomeFundCategoryLabel } from "@/components/finance/finance-labels";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";
import { localizeLabels } from "@/lib/i18n/translate";


type ActionResult =
  | { success: true; id?: string; refNumber?: string }
  | { success: false; error: string };

const FORBIDDEN =
  "Hanya Super Admin dan Bendahara yang boleh mengelola kas masuk";

/**
 * Sinkronkan pemasukan VERIFIED ke buku besar lama (Transaction DEBIT)
 * agar dashboard keuangan & laporan bulanan tetap akurat.
 */
async function syncIncomeToLedger(incomeId: string, db: Prisma.TransactionClient) {
  const { tr, locale } = await getT();
  const incomeFundCategoryLabel = localizeLabels(__incomeFundCategoryLabel, tr);

  const income = await db.financeIncome.findUnique({
    where: { id: incomeId },
  });
  if (!income || income.verification !== "VERIFIED") return;

  const categoryName =
    income.fundCategory === "PENDAPATAN_USAHA"
      ? tr("Pendapatan Usaha")
      : tr("Donasi & Dana Sosial");

  const category = await db.financeCategory.upsert({
    where: { name: categoryName },
    update: {},
    create: { name: categoryName },
  });

  await db.transaction.create({
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
  const { tr, locale } = await getT();
  const { financeIncomeSchema } = getSchemas(locale);

  const session = await requireFinanceSession();
  if (!session) return { success: false, error: tr(FORBIDDEN) };

  const parsed = financeIncomeSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    // Validasi referensi
    if (parsed.data.programId) await assertFundraisingProgram(prisma, parsed.data.programId);
    if (parsed.data.donorId) {
      const donor = await prisma.donor.findUnique({
        where: { id: parsed.data.donorId },
        select: { id: true },
      });
      if (!donor) return { success: false, error: tr("Donatur tidak ditemukan") };
    }

    // Status verifikasi otomatis: transfer bank menunggu cek mutasi,
    // tunai langsung dianggap dana riil diterima
    const verification =
      parsed.data.method === "TRANSFER_BANK" ? "PENDING" : "VERIFIED";

    let income;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        income = await prisma.$transaction(async tx => {
          await lockFundingWallets(tx);
          if (parsed.data.programId) await assertFundraisingProgram(tx, parsed.data.programId);
          const count = await tx.financeIncome.count();
          const created = await tx.financeIncome.create({
            data: {
              refNumber: await nextDocNumber("KM", count + attempt),
              ...parsed.data,
              donorId: parsed.data.donorId ?? null,
              // A linked receipt belongs only to its program, regardless of the restriction label.
              programId: parsed.data.programId ?? null,
              verification,
              accountId: parsed.data.accountId ?? null,
              memo: parsed.data.memo ?? null,
              createdById: session.user.id,
            },
          });
          if (verification === "VERIFIED") await syncIncomeToLedger(created.id, tx);
          return created;
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
    if (!income) throw new Error(tr("Gagal membuat nomor referensi"));

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "FinanceIncome",
      entityId: income.id,
      detail: `Kas masuk ${income.refNumber} dari ${income.sourceName} (Rp ${income.amount.toLocaleString("id-ID")})`,
    });

    revalidatePath("/dashboard/finance", "layout");
    revalidatePath("/dashboard");
    return { success: true, id: income.id, refNumber: income.refNumber };
  } catch (error) {
    if (error instanceof FundingRuleError) return { success: false, error: tr(error.message) };
    console.error("createFinanceIncome error:", error);
    return { success: false, error: tr("Gagal mencatat kas masuk") };
  }
}

/** Verifikasi/tolak pemasukan transfer bank setelah cek mutasi */
export async function setIncomeVerification(
  id: string,
  status: "VERIFIED" | "REJECTED"
): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireFinanceSession();
  if (!session) return { success: false, error: tr(FORBIDDEN) };

  if (!z.enum(["VERIFIED", "REJECTED"]).safeParse(status).success) {
    return { success: false, error: tr("Status verifikasi tidak valid") };
  }
  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID pemasukan tidak valid") };
  }

  try {
    const income = await prisma.$transaction(async tx => {
      await lockFundingWallets(tx);
      const existing = await tx.financeIncome.findUnique({ where: { id: idParsed.data } });
      if (!existing) throw new FundingRuleError("Pemasukan tidak ditemukan");
      if (existing.verification !== "PENDING") {
        throw new FundingRuleError("Hanya pemasukan berstatus Pending yang bisa diproses");
      }
      if (status === "VERIFIED" && existing.programId) await assertFundraisingProgram(tx, existing.programId);
      await tx.financeIncome.update({ where: { id: existing.id }, data: { verification: status } });
      if (status === "VERIFIED") await syncIncomeToLedger(existing.id, tx);
      return existing;
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "FinanceIncome",
      entityId: idParsed.data,
      detail: `${status === "VERIFIED" ? "Memverifikasi" : "Menolak"} kas masuk ${income.refNumber}`,
    });

    revalidatePath("/dashboard/finance", "layout");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    if (error instanceof FundingRuleError) return { success: false, error: tr(error.message) };
    console.error("setIncomeVerification error:", error);
    return { success: false, error: tr("Gagal memproses verifikasi") };
  }
}

const __incomeFundCategoryLabel = incomeFundCategoryLabel;
