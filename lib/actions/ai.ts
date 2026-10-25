"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { aiConfigSchema, type AIConfigInput } from "@/lib/validations";
import { generateInsight, type AIResult } from "@/lib/ai-service";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult = { success: true } | { success: false; error: string };

const FORBIDDEN_ERROR = "Hanya Super Admin yang boleh mengatur konfigurasi AI";

async function upsertConfig(configKey: string, configValue: string) {
  await prisma.systemConfig.upsert({
    where: { configKey },
    update: { configValue },
    create: { configKey, configValue },
  });
}

export async function saveAIConfig(
  values: AIConfigInput
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { aiConfigSchema } = getSchemas(locale);

  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = aiConfigSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    await upsertConfig("AI_PROVIDER", parsed.data.provider);
    await upsertConfig("AI_BASE_URL", parsed.data.baseUrl);
    await upsertConfig("AI_MODEL_NAME", parsed.data.modelName);

    // API key kosong = pertahankan yang lama (tidak ditimpa string kosong)
    if (parsed.data.apiKey) {
      await upsertConfig("AI_API_KEY", parsed.data.apiKey);
    }

    revalidatePath("/dashboard/admin/ai-settings");
    return { success: true };
  } catch (error) {
    console.error("saveAIConfig error:", error);
    return { success: false, error: tr("Gagal menyimpan konfigurasi") };
  }
}

export async function testAIConnection(): Promise<AIResult> {
  const { tr, locale } = await getT();

  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  return generateInsight(tr("Halo, balas dengan 'Koneksi Berhasil'"), "");
}

const sleepLabel: Record<string, string> = {
  GOOD: "nyenyak",
  FAIR: "cukup",
  POOR: "kurang",
};

export async function generateChildInsight(
  childId: string
): Promise<AIResult> {
  const { tr, locale } = await getT();

  // Semua user login boleh meminta insight (pengasuh butuh fitur ini)
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const idParsed = z.string().cuid().safeParse(childId);
  if (!idParsed.success) {
    return { success: false, error: tr("ID anak tidak valid") };
  }

  const child = await prisma.child.findUnique({
    where: { id: idParsed.data },
    include: {
      dailyLogs: {
        orderBy: { date: "desc" },
        take: 5,
      },
    },
  });

  if (!child) {
    return { success: false, error: tr("Data anak tidak ditemukan") };
  }
  if (child.dailyLogs.length === 0) {
    return {
      success: false,
      error: tr("Belum ada log harian untuk dianalisis. Catat log dulu."),
    };
  }

  const ageYears = Math.floor(
    (Date.now() - child.dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  // Format 5 log terakhir menjadi context string yang mudah dibaca LLM.
  // Nama anak sengaja TIDAK dikirim ke AI (minimisasi data pribadi).
  const logLines = child.dailyLogs
    .map((log) => {
      const date = new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
        dateStyle: "medium",
      }).format(log.date);
      const evaluation = log.evaluationNotes
        ? tr(" | Catatan evaluasi: {0}", { "0": log.evaluationNotes })
        : "";
      const prayers = [
        log.prayerSubuh,
        log.prayerDzuhur,
        log.prayerAshar,
        log.prayerMaghrib,
        log.prayerIsya,
      ].filter(Boolean).length;
      return tr("- {0}: mood {1}/5, makan {2}%, tidur {3}, sholat {4}/5, piket {5}{6}", { "0": date, "1": log.moodScore, "2": log.mealPercentage, "3": sleepLabel[log.sleepQuality] ?? log.sleepQuality, "4": prayers, "5": log.piketDone ? "ya" : "tidak", "6": evaluation });
    })
    .join("\n");

  const childContext = tr("Profil: anak {0}, usia {1} tahun.\nLog harian 5 hari terakhir (terbaru di atas):\n{2}", { "0": child.gender === "MALE" ? "laki-laki" : "perempuan", "1": ageYears, "2": logLines });

  return generateInsight(
    tr("Berdasarkan data harian anak ini, berikan ringkasan kondisi emosional/fisik dan 1 saran intervensi untuk pengasuh dalam bahasa Indonesia yang empatik."),
    childContext
  );
}
