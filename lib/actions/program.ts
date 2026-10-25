"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";
import type { Locale } from "@/lib/i18n/config";
import { effectiveProgramFundingSource, FundingRuleError, getUnrestrictedBalance, lockFundingWallets } from "@/lib/finance-balance";
import { saveManagedForm } from "@/lib/managed-form.server";
import { MANAGED_FORM_FIELDS, StorageError, storageErrorMessage } from "@/lib/storage-contract";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

const FORBIDDEN =
  "Hanya Super Admin dan Bendahara yang boleh mengelola program";

function parseProgramForm(formData: FormData, locale: Locale, fundraisingTarget?: number) {
  return getSchemas(locale).programSchema.safeParse({
    name: formData.get("name"),
    field: formData.get("field"),
    fundraisingTarget: fundraisingTarget ?? (formData.get("fundraisingTarget") || 0),
    maxBudget: formData.get("maxBudget") || 0,
    startDate: formData.get("startDate") || undefined,
    picId: formData.get("picId"),
    status: formData.get("status"),
    leftoverRule: formData.get("leftoverRule"),
    description: formData.get("description") ?? "",
  });
}

/** Kode program otomatis: PRG/YYYY/XXX */
async function nextProgramCode(db: Prisma.TransactionClient, attempt: number): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.program.count({
    where: { code: { startsWith: `PRG/${year}/` } },
  });
  return `PRG/${year}/${String(count + attempt + 1).padStart(3, "0")}`;
}

export async function createProgram(formData: FormData): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireFinanceSession();
  if (!session) return { success: false, error: tr(FORBIDDEN) };

  const funding = getSchemas(locale).programFundingSchema.safeParse(Object.fromEntries(formData));
  if (!funding.success) return { success: false, error: funding.error.issues[0].message };

  const parsed = parseProgramForm(formData, locale, funding.data.fundraisingTarget);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    let program;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        program = await saveManagedForm(prisma, formData, { id: session.user.id }, undefined, MANAGED_FORM_FIELDS.program, async (tx, urls) => {
          await lockFundingWallets(tx);
          const allocation = funding.data.alokasiDanaInternal;
          if (allocation > 0 && allocation > await getUnrestrictedBalance(tx)) {
            throw new FundingRuleError("Saldo dana tidak terikat tidak cukup untuk alokasi internal");
          }
          return tx.program.create({
            data: {
              code: await nextProgramCode(tx, attempt),
              ...parsed.data,
              sumberDana: funding.data.sumberDana,
              porsiPenggalangan: funding.data.porsiPenggalangan,
              startDate: parsed.data.startDate ?? null,
              description: parsed.data.description ?? null,
              ...urls,
              ...(allocation > 0 ? {
                internalAllocations: { create: { amount: allocation, createdById: session.user.id } },
              } : {}),
            },
          });
        });
        break;
      } catch (e) {
        // Retry bila kode bentrok (unique constraint)
        if (
          attempt === 2 ||
          !(e instanceof Error) ||
          !e.message.includes("Unique constraint")
        )
          throw e;
      }
    }
    if (!program) throw new Error(tr("Gagal membuat kode program"));

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Program",
      entityId: program.id,
      detail: `Membuat program ${program.code} — ${program.name}; ${funding.data.sumberDana}; internal Rp ${funding.data.alokasiDanaInternal}`,
    });

    revalidatePath("/dashboard/finance", "layout");
    revalidatePath("/dashboard");
    return { success: true, id: program.id };
  } catch (error) {
    if (error instanceof FundingRuleError) return { success: false, error: tr(error.message) };
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("createProgram failed");
    return { success: false, error: tr("Gagal membuat program") };
  }
}

export async function updateProgram(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireFinanceSession();
  if (!session) return { success: false, error: tr(FORBIDDEN) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID program tidak valid") };
  }

  const parsed = parseProgramForm(formData, locale);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const existing = await saveManagedForm(prisma, formData, { id: session.user.id }, idParsed.data, MANAGED_FORM_FIELDS.program, async (tx, urls) => {
      const program = await tx.program.findUnique({ where: { id: idParsed.data } });
      if (!program) throw new FundingRuleError("Program tidak ditemukan");
      await tx.program.update({
        where: { id: idParsed.data },
        data: {
          name: parsed.data.name,
          field: parsed.data.field,
          fundraisingTarget: parsed.data.fundraisingTarget,
          // Keep a legacy program's classification stable when its old target is edited.
          sumberDana: effectiveProgramFundingSource(program),
          maxBudget: parsed.data.maxBudget,
          startDate: parsed.data.startDate ?? null,
          picId: parsed.data.picId,
          status: parsed.data.status,
          leftoverRule: parsed.data.leftoverRule,
          description: parsed.data.description ?? null,
          // Proposal baru menggantikan yang lama; jika tidak upload, biarkan
          ...urls,
        },
      });
      return program;
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Program",
      entityId: idParsed.data,
      detail: `Memperbarui program ${existing.code}`,
    });

    revalidatePath("/dashboard/finance", "layout");
    revalidatePath("/dashboard");
    return { success: true, id: idParsed.data };
  } catch (error) {
    if (error instanceof FundingRuleError) return { success: false, error: tr(error.message) };
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("updateProgram failed");
    return { success: false, error: tr("Gagal memperbarui program") };
  }
}

export async function deleteProgram(id: string): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireFinanceSession();
  if (!session) return { success: false, error: tr(FORBIDDEN) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID program tidak valid") };
  }

  try {
    const program = await prisma.program.findUnique({
      where: { id: idParsed.data },
      include: {
        _count: { select: { incomes: true, expenses: true, internalAllocations: true } },
      },
    });
    if (!program) return { success: false, error: tr("Program tidak ditemukan") };
    if (program._count.incomes > 0 || program._count.expenses > 0 || program._count.internalAllocations > 0) {
      return {
        success: false,
        error:
          tr("Program sudah punya transaksi — tidak bisa dihapus. Ubah statusnya menjadi Ditangguhkan"),
      };
    }

    await prisma.program.delete({ where: { id: idParsed.data } });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "DELETE",
      entity: "Program",
      entityId: idParsed.data,
      detail: `Menghapus program ${program.code} — ${program.name}`,
    });

    revalidatePath("/dashboard/finance", "layout");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("deleteProgram error:", error);
    return { success: false, error: tr("Gagal menghapus program") };
  }
}
