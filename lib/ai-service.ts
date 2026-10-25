import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getT } from "@/lib/i18n/server";

export const AI_CONFIG_KEYS = [
  "AI_PROVIDER",
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_MODEL_NAME",
] as const;

export type AIConfigKey = (typeof AI_CONFIG_KEYS)[number];

export type AIConfig = {
  provider: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
};

export type AIResult =
  | { success: true; text: string }
  | { success: false; error: string };

/**
 * Ambil seluruh konfigurasi AI dari tabel SystemConfig.
 * Return null jika konfigurasi wajib (API key / base URL / model) belum lengkap.
 */
export async function getAIConfig(): Promise<AIConfig | null> {
  const rows = await prisma.systemConfig.findMany({
    where: { configKey: { in: [...AI_CONFIG_KEYS] } },
  });

  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));

  const apiKey = map.get("AI_API_KEY");
  const baseUrl = map.get("AI_BASE_URL");
  const modelName = map.get("AI_MODEL_NAME");

  if (!apiKey || !baseUrl || !modelName) return null;

  return {
    provider: map.get("AI_PROVIDER") ?? "CUSTOM",
    apiKey,
    baseUrl,
    modelName,
  };
}

/**
 * Kirim prompt + context ke AI provider (endpoint OpenAI-compatible,
 * termasuk Qwen/DashScope) dan kembalikan teks jawaban.
 */
export async function generateInsight(
  prompt: string,
  childContext: string
): Promise<AIResult> {
  const { tr, locale } = await getT();
  const config = await getAIConfig();
  if (!config) {
    return {
      success: false,
      error:
        tr("Konfigurasi AI belum lengkap. Minta Super Admin mengatur di menu Pengaturan AI."),
    };
  }

  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: 30_000, // 30 detik: aman untuk Vercel serverless
      maxRetries: 1,
    });

    const completion = await client.chat.completions.create({
      model: config.modelName,
      messages: [
        {
          role: "system",
          content: locale === "en"
            ? "You assist social workers at an orphanage in Indonesia. Always respond in empathetic, concise English that caregivers can understand. Do not provide medical diagnoses."
            : "Kamu adalah asisten pekerja sosial di panti asuhan anak di Indonesia. Jawab selalu dalam Bahasa Indonesia yang empatik, ringkas, dan mudah dipahami pengasuh. Jangan memberikan diagnosis medis.",
        },
        {
          role: "user",
          content: childContext
            ? `${prompt}\n\n--- DATA ANAK ---\n${childContext}`
            : prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return { success: false, error: tr("AI tidak mengembalikan jawaban") };
    }

    return { success: true, text };
  } catch (error: unknown) {
    console.error("generateInsight error:", error);

    // Pesan error yang informatif tapi tidak membocorkan API key
    if (error instanceof OpenAI.APIConnectionError) {
      return {
        success: false,
        error: tr("Tidak bisa terhubung ke provider AI. Periksa Base URL"),
      };
    }

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return { success: false, error: tr("API Key tidak valid atau kedaluwarsa") };
      }
      if (error.status === 404) {
        return {
          success: false,
          error: tr("Model tidak ditemukan. Periksa kembali nama model & Base URL"),
        };
      }
      if (error.status === 429) {
        return {
          success: false,
          error: tr("Kuota AI habis atau terlalu banyak request. Coba lagi nanti"),
        };
      }
      return {
        success: false,
        error: tr("Provider AI menolak request (HTTP {0})", { 0: error.status ?? "?" }),
      };
    }

    return { success: false, error: tr("Terjadi kesalahan saat menghubungi AI") };
  }
}
