"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { programSchema } from "@/lib/validations";
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

const FORBIDDEN =
  "Hanya Super Admin dan Bendahara yang boleh mengelola program";

function parseProgramForm(formData: FormData) {
  return programSchema.safeParse({
    name: formData.get("name"),
    field: formData.get("field"),
    fundraisingTarget: formData.get("fundraisingTarget") || 0,
    maxBudget: formData.get("maxBudget") || 0,
    startDate: formData.get("startDate") || undefined,
    picId: formData.get("picId"),
    status: formData.get("status"),
    leftoverRule: formData.get("leftoverRule"),
    description: formData.get("description") ?? "",
  });
}

async function uploadProposal(
  formData: FormData
): Promise<{ url: string | null; warning?: string; error?: string }> {
  const file = formData.get("proposal");
  if (!(file instanceof File) || file.size === 0) return { url: null };
  if (file.type !== "application/pdf") {
    return { url: null, error: "Proposal harus berupa file PDF" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { url: null, error: "Ukuran proposal maksimal 10MB" };
  }
  if (!isCloudinaryConfigured()) {
    return {
      url: null,
      warning: "Proposal tidak tersimpan: Cloudinary belum dikonfigurasi",
    };
  }
  try {
    const url = await uploadFileToCloudinary(
      Buffer.from(await file.arrayBuffer()),
      "yayasan/programs",
      undefined,
      "raw"
    );
    return { url };
  } catch (error) {
    console.error("uploadProposal error:", error);
    return { url: null, error: "Gagal meng-upload proposal" };
  }
}

/** Kode program otomatis: PRG/YYYY/XXX */
async function nextProgramCode(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.program.count({
    where: { code: { startsWith: `PRG/${year}/` } },
  });
  return `PRG/${year}/${String(count + 1).padStart(3, "0")}`;
}

export async function createProgram(formData: FormData): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const parsed = parseProgramForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const proposal = await uploadProposal(formData);
  if (proposal.error) return { success: false, error: proposal.error };

  try {
    let program;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        program = await prisma.program.create({
          data: {
            code: await nextProgramCode(),
            name: parsed.data.name,
            field: parsed.data.field,
            fundraisingTarget: parsed.data.fundraisingTarget,
            maxBudget: parsed.data.maxBudget,
            startDate: parsed.data.startDate ?? null,
            picId: parsed.data.picId,
            status: parsed.data.status,
            leftoverRule: parsed.data.leftoverRule,
            description: parsed.data.description ?? null,
            proposalUrl: proposal.url,
          },
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
    if (!program) throw new Error("Gagal membuat kode program");

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Program",
      entityId: program.id,
      detail: `Membuat program ${program.code} — ${program.name}`,
    });

    revalidatePath("/dashboard/finance/programs");
    return { success: true, id: program.id, warning: proposal.warning };
  } catch (error) {
    console.error("createProgram error:", error);
    return { success: false, error: "Gagal membuat program" };
  }
}

export async function updateProgram(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID program tidak valid" };
  }

  const parsed = parseProgramForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const proposal = await uploadProposal(formData);
  if (proposal.error) return { success: false, error: proposal.error };

  try {
    const existing = await prisma.program.findUnique({
      where: { id: idParsed.data },
      select: { id: true, code: true },
    });
    if (!existing) return { success: false, error: "Program tidak ditemukan" };

    await prisma.program.update({
      where: { id: idParsed.data },
      data: {
        name: parsed.data.name,
        field: parsed.data.field,
        fundraisingTarget: parsed.data.fundraisingTarget,
        maxBudget: parsed.data.maxBudget,
        startDate: parsed.data.startDate ?? null,
        picId: parsed.data.picId,
        status: parsed.data.status,
        leftoverRule: parsed.data.leftoverRule,
        description: parsed.data.description ?? null,
        // Proposal baru menggantikan yang lama; jika tidak upload, biarkan
        ...(proposal.url ? { proposalUrl: proposal.url } : {}),
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Program",
      entityId: idParsed.data,
      detail: `Memperbarui program ${existing.code}`,
    });

    revalidatePath("/dashboard/finance/programs");
    return { success: true, id: idParsed.data, warning: proposal.warning };
  } catch (error) {
    console.error("updateProgram error:", error);
    return { success: false, error: "Gagal memperbarui program" };
  }
}

export async function deleteProgram(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID program tidak valid" };
  }

  try {
    const program = await prisma.program.findUnique({
      where: { id: idParsed.data },
      include: {
        _count: { select: { incomes: true, expenses: true } },
      },
    });
    if (!program) return { success: false, error: "Program tidak ditemukan" };
    if (program._count.incomes > 0 || program._count.expenses > 0) {
      return {
        success: false,
        error:
          "Program sudah punya transaksi — tidak bisa dihapus. Ubah statusnya menjadi Ditangguhkan",
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

    revalidatePath("/dashboard/finance/programs");
    return { success: true };
  } catch (error) {
    console.error("deleteProgram error:", error);
    return { success: false, error: "Gagal menghapus program" };
  }
}
