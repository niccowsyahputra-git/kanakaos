"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession, requireSuperAdminSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { nextDocNumber, assertExpenseFunding, FundingRuleError, lockFundingWallets } from "@/lib/finance-balance";
import { expenseCoaLabel } from "@/components/finance/finance-labels";
import { saveManagedForm } from "@/lib/managed-form.server";
import { MANAGED_FORM_FIELDS, StorageError, storageErrorMessage } from "@/lib/storage-contract";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";
import { localizeLabels } from "@/lib/i18n/translate";


type ActionResult =
  | { success: true; id?: string; voucherNumber?: string; warning?: string }
  | { success: false; error: string };

const FORBIDDEN =
  "Hanya Super Admin dan Bendahara yang boleh mengelola kas keluar";

/** Sinkronkan pengeluaran SELESAI ke buku besar lama (Transaction CREDIT) */
async function syncExpenseToLedger(expenseId: string) {
  const { tr, locale } = await getT();
  const expenseCoaLabel = localizeLabels(__expenseCoaLabel, tr);

  const expense = await prisma.financeExpense.findUnique({
    where: { id: expenseId },
    include: { program: { select: { name: true } } },
  });
  if (!expense || expense.approval !== "SELESAI") return;

  const category = await prisma.financeCategory.upsert({
    where: { name: expenseCoaLabel[expense.coa] },
    update: {},
    create: { name: expenseCoaLabel[expense.coa] },
  });

  await prisma.transaction.create({
    data: {
      date: expense.date,
      description: `${expense.voucherNumber}${expense.program ? ` — ${expense.program.name}` : ""}${expense.beneficiaryName ? ` — ${expense.beneficiaryName}` : ""}`,
      categoryId: category.id,
      type: "CREDIT",
      amount: expense.amount,
      proofUrl: expense.proofUrl,
      createdById: expense.createdById,
    },
  });
}

export async function createFinanceExpense(
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { financeExpenseSchema } = getSchemas(locale);

  const session = await requireFinanceSession();
  if (!session) return { success: false, error: tr(FORBIDDEN) };

  const parsed = financeExpenseSchema.safeParse({
    date: formData.get("date"),
    accountId: formData.get("accountId"),
    pocket: formData.get("pocket"),
    programId: formData.get("programId") || undefined,
    sumberDana: formData.get("sumberDana") || undefined,
    coa: formData.get("coa"),
    beneficiaryChildId: formData.get("beneficiaryChildId") || undefined,
    beneficiaryName: formData.get("beneficiaryName") ?? "",
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    // Validasi rekening
    const account = await prisma.cashAccount.findUnique({
      where: { id: parsed.data.accountId },
      select: { id: true, name: true, isActive: true },
    });
    if (!account || !account.isActive) {
      return { success: false, error: tr("Rekening kas tidak valid") };
    }

    // ===== Penolakan otomatis: saldo kantong dana tidak mencukupi =====
    await assertExpenseFunding(prisma, parsed.data);

    // Validasi penerima manfaat (anak)
    if (parsed.data.beneficiaryChildId) {
      const child = await prisma.child.findUnique({
        where: { id: parsed.data.beneficiaryChildId },
        select: { id: true },
      });
      if (!child) {
        return { success: false, error: tr("Data anak tidak ditemukan") };
      }
    }

    let expense;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        expense = await saveManagedForm(prisma, formData, { id: session.user.id }, undefined, MANAGED_FORM_FIELDS.expense, async (tx, urls) => {
          if (!urls.proofUrl) throw new StorageError("INVALID");
          await lockFundingWallets(tx);
          // Recheck after upload under the write lock; parallel drafts cannot spend the same balance.
          const activeAccount = await tx.cashAccount.findUnique({ where: { id: parsed.data.accountId } });
          if (!activeAccount?.isActive) throw new FundingRuleError("Rekening kas tidak valid");
          await assertExpenseFunding(tx, parsed.data);
          const count = await tx.financeExpense.count();
          return tx.financeExpense.create({
            data: {
              voucherNumber: await nextDocNumber("PV", count + attempt),
              ...parsed.data,
              programId: parsed.data.programId ?? null,
              sumberDana: parsed.data.sumberDana ?? null,
              beneficiaryChildId: parsed.data.beneficiaryChildId ?? null,
              beneficiaryName: parsed.data.beneficiaryName ?? null,
              proofUrl: urls.proofUrl,
              approval: "DRAFT",
              createdById: session.user.id,
            },
          });
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
    if (!expense) throw new Error(tr("Gagal membuat nomor voucher"));

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "FinanceExpense",
      entityId: expense.id,
      detail: `Voucher keluar ${expense.voucherNumber} (Rp ${expense.amount.toLocaleString("id-ID")})`,
    });

    revalidatePath("/dashboard/finance", "layout");
    revalidatePath("/dashboard");
    return {
      success: true,
      id: expense.id,
      voucherNumber: expense.voucherNumber,
    };
  } catch (error) {
    if (error instanceof FundingRuleError) return { success: false, error: tr(error.message) };
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("createFinanceExpense failed");
    return { success: false, error: tr("Gagal membuat voucher pengeluaran") };
  }
}

/**
 * Naikkan level persetujuan voucher:
 * DRAFT -> REVIEW (staf/bendahara ajukan)
 * REVIEW -> APPROVAL (bendahara selesai meninjau)
 * APPROVAL -> SELESAI (hanya Super Admin / Ketua)
 */
export async function advanceExpenseApproval(id: string): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireFinanceSession();
  if (!session) return { success: false, error: tr(FORBIDDEN) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID voucher tidak valid") };
  }

  try {
    const expense = await prisma.financeExpense.findUnique({
      where: { id: idParsed.data },
    });
    if (!expense) return { success: false, error: tr("Voucher tidak ditemukan") };

    let next: "REVIEW" | "APPROVAL" | "SELESAI";
    const extra: { reviewedById?: string; approvedById?: string } = {};

    if (expense.approval === "DRAFT") {
      next = "REVIEW";
    } else if (expense.approval === "REVIEW") {
      next = "APPROVAL";
      extra.reviewedById = session.user.id;
    } else if (expense.approval === "APPROVAL") {
      // Tahap final hanya boleh oleh Ketua / Super Admin
      const admin = await requireSuperAdminSession();
      if (!admin) {
        return {
          success: false,
          error: tr("Approval final hanya boleh dilakukan Ketua (Super Admin)"),
        };
      }
      next = "SELESAI";
      extra.approvedById = session.user.id;
    } else {
      return { success: false, error: tr("Voucher sudah selesai / dana cair") };
    }

    await prisma.financeExpense.update({
      where: { id: idParsed.data },
      data: { approval: next, ...extra },
    });

    if (next === "SELESAI") {
      await syncExpenseToLedger(idParsed.data);
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "FinanceExpense",
      entityId: idParsed.data,
      detail: `Voucher ${expense.voucherNumber} naik status ke ${next}`,
    });

    revalidatePath("/dashboard/finance", "layout");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("advanceExpenseApproval error:", error);
    return { success: false, error: tr("Gagal memproses persetujuan") };
  }
}

/** Hapus voucher — hanya status Draft */
export async function deleteFinanceExpense(id: string): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireFinanceSession();
  if (!session) return { success: false, error: tr(FORBIDDEN) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID voucher tidak valid") };
  }

  try {
    const expense = await prisma.financeExpense.findUnique({
      where: { id: idParsed.data },
      select: { id: true, voucherNumber: true, approval: true },
    });
    if (!expense) return { success: false, error: tr("Voucher tidak ditemukan") };
    if (expense.approval !== "DRAFT") {
      return {
        success: false,
        error: tr("Hanya voucher berstatus Draft yang bisa dihapus"),
      };
    }

    await prisma.financeExpense.delete({ where: { id: idParsed.data } });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "DELETE",
      entity: "FinanceExpense",
      entityId: idParsed.data,
      detail: `Menghapus voucher ${expense.voucherNumber}`,
    });

    revalidatePath("/dashboard/finance", "layout");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("deleteFinanceExpense error:", error);
    return { success: false, error: tr("Gagal menghapus voucher") };
  }
}

const __expenseCoaLabel = expenseCoaLabel;
