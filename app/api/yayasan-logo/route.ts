import { prisma } from "@/lib/prisma";
import { readCurrentBranding } from "@/lib/managed-file-read.server";
import { getT } from "@/lib/i18n/server";
import { StorageError, storageErrorMessage } from "@/lib/storage-contract";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

/** Public access is limited to the currently configured branding, including legacy database images. */
export async function GET() {
  const { locale } = await getT();
  try {
    const response = await readCurrentBranding(prisma);
    return response ?? new Response(locale === "en" ? "Logo not found" : "Logo tidak ditemukan", { status: 404, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof StorageError ? error.code : "UNAVAILABLE";
    return new Response(storageErrorMessage(code, locale), { status: code === "FORBIDDEN" ? 404 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
