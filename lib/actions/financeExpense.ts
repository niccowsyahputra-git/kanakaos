"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession, requireSuperAdminSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  financeExpenseSchema,
} from "@/lib/validations";
import {
  nextDocNumber,
  getUnrestrictedBalance,
  getProgramBalances,
} from "@/lib/finance-balance";
import { expenseCoaLabel } from "@/components/finance/finance-labels";
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

type ActionResult =
  | { success: true; id?: string; voucherNumber?: string; warning?: string }
  | { success: false; error: string };

const FORBIDDEN =
  "Hanya Super Admin dan Bendahara yang boleh mengelola kas keluar";

/** Sinkronkan pengeluaran SELESAI ke buku besar lama (Transaction CREDIT) */
async function syncExpenseToLedger(expenseId: string) {
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
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const parsed = financeExpenseSchema.safeParse({
    date: formData.get("date"),
    accountId: formData.get("accountId"),
    pocket: formData.get("pocket"),
    programId: formData.get("programId") || undefined,
    coa: formData.get("coa"),
    beneficiaryChildId: formData.get("beneficiaryChildId") || undefined,
    beneficiaryName: formData.get("beneficiaryName") ?? "",
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    // Validasi rekening
    const account = await prisma.cashAccount.findUnique({
      where: { id: parsed.data.accountId },
      select: { id: true, name: true, isActive: true },
    });
    if (!account || !account.isActive) {
      return { success: false, error: "Rekening kas tidak valid" };
    }

    // ===== Penolakan otomatis: saldo kantong dana tidak mencukupi =====
    if (parsed.data.pocket === "TIDAK_TERIKAT") {
      const balance = await getUnrestrictedBalance();
      if (parsed.data.amount > balance) {
        return {
          success: false,
          error: `Saldo tidak cukup — sisa dana tidak terikat Rp ${balance.toLocaleString("id-ID")}`,
        };
      }
    } else {
      const balances = await getProgramBalances();
      const program = balances.find((p) => p.id === parsed.data.programId);
      if (!program) {
        return { success: false, error: "Program tidak ditemukan" };
      }
      if (parsed.data.amount > program.balance) {
        return {
          success: false,
          error: `Saldo tidak cukup — sisa saldo ${program.name} Rp ${program.balance.toLocaleString("id-ID")}`,
        };
      }
    }

    // Validasi penerima manfaat (anak)
    if (parsed.data.beneficiaryChildId) {
      const child = await prisma.child.findUnique({
        where: { id: parsed.data.beneficiaryChildId },
        select: { id: true },
      });
      if (!child) {
        return { success: false, error: "Data anak tidak ditemukan" };
      }
    }

    // ===== Bukti dokumen wajib (PDF/JPG/PNG) =====
    const proof = formData.get("proof");
    if (!(proof instanceof File) || proof.size === 0) {
      return {
        success: false,
        error: "Bukti dokumen wajib diunggah (PDF, JPG, atau PNG)",
      };
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(proof.type)) {
      return { success: false, error: "Format bukti harus PDF, JPG, atau PNG" };
    }
    if (proof.size > 5 * 1024 * 1024) {
      return { success: false, error: "Ukuran bukti maksimal 5MB" };
    }

    let proofUrl: string | null = null;
    let warning: string | undefined;
    if (!isCloudinaryConfigured()) {
      warning = "Bukti tidak tersimpan: Cloudinary belum dikonfigurasi";
    } else {
      try {
        proofUrl = await uploadFileToCloudinary(
          Buffer.from(await proof.arrayBuffer()),
          "yayasan/expenses",
          undefined,
          proof.type === "application/pdf" ? "raw" : "image"
        );
      } catch (error) {
        console.error("createFinanceExpense upload error:", error);
        return { success: false, error: "Gagal meng-upload bukti dokumen" };
      }
    }

    let expense;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const count = await prisma.financeExpense.count();
        expense = await prisma.financeExpense.create({
          data: {
            voucherNumber: await nextDocNumber("PV", count + attempt),
            date: parsed.data.date,
            accountId: parsed.data.accountId,
            pocket: parsed.data.pocket,
            programId:
              parsed.data.pocket === "TERIKAT" ? parsed.data.programId : null,
            coa: parsed.data.coa,
            beneficiaryChildId: parsed.data.beneficiaryChildId ?? null,
            beneficiaryName: parsed.data.beneficiaryName ?? null,
            amount: parsed.data.amount,
            proofUrl,
            approval: "DRAFT",
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
    if (!expense) throw new Error("Gagal membuat nomor voucher");

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "FinanceExpense",
      entityId: expense.id,
      detail: `Voucher keluar ${expense.voucherNumber} (Rp ${expense.amount.toLocaleString("id-ID")})`,
    });

    revalidatePath("/dashboard/finance/expense");
    revalidatePath("/dashboard/finance");
    return {
      success: true,
      id: expense.id,
      voucherNumber: expense.voucherNumber,
      warning,
    };
  } catch (error) {
    console.error("createFinanceExpense error:", error);
    return { success: false, error: "Gagal membuat voucher pengeluaran" };
  }
}

/**
 * Naikkan level persetujuan voucher:
 * DRAFT -> REVIEW (staf/bendahara ajukan)
 * REVIEW -> APPROVAL (bendahara selesai meninjau)
 * APPROVAL -> SELESAI (hanya Super Admin / Ketua)
 */
export async function advanceExpenseApproval(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID voucher tidak valid" };
  }

  try {
    const expense = await prisma.financeExpense.findUnique({
      where: { id: idParsed.data },
    });
    if (!expense) return { success: false, error: "Voucher tidak ditemukan" };

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
          error: "Approval final hanya boleh dilakukan Ketua (Super Admin)",
        };
      }
      next = "SELESAI";
      extra.approvedById = session.user.id;
    } else {
      return { success: false, error: "Voucher sudah selesai / dana cair" };
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

    revalidatePath("/dashboard/finance/expense");
    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (error) {
    console.error("advanceExpenseApproval error:", error);
    return { success: false, error: "Gagal memproses persetujuan" };
  }
}

/** Hapus voucher — hanya status Draft */
export async function deleteFinanceExpense(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID voucher tidak valid" };
  }

  try {
    const expense = await prisma.financeExpense.findUnique({
      where: { id: idParsed.data },
      select: { id: true, voucherNumber: true, approval: true },
    });
    if (!expense) return { success: false, error: "Voucher tidak ditemukan" };
    if (expense.approval !== "DRAFT") {
      return {
        success: false,
        error: "Hanya voucher berstatus Draft yang bisa dihapus",
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

    revalidatePath("/dashboard/finance/expense");
    return { success: true };
  } catch (error) {
    console.error("deleteFinanceExpense error:", error);
    return { success: false, error: "Gagal menghapus voucher" };
  }
}
