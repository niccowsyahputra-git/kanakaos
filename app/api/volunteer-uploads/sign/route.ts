import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { getT } from "@/lib/i18n/server";
import { signRequestSchema } from "@/lib/volunteer-upload-contract";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const { tr, locale } = await getT();
  const fail = (message: string, status: number) => NextResponse.json({ error: tr(message) }, { status });
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(process.env.NEXTAUTH_URL || request.url).origin;
  if (!origin || origin !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") return fail("Permintaan tidak diizinkan", 403);
  try {
    if (Number(request.headers.get("content-length")) > 16000) return fail("Data tidak valid", 400);
    const body = await request.text();
    if (body.length > 16000) return fail("Data tidak valid", 400);
    const parsed = signRequestSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return fail("Jenis, ukuran, atau jumlah file tidak valid", 400);
    if (parsed.data.mode === "staff" && !await requireStaffSession()) return fail("Akses ditolak", 403);
    // Legacy attachment readers remain available; no new Cloudinary claims are issued.
    return NextResponse.json({ error: locale === "en" ? "This upload form is outdated. Refresh the page and try again." : "Formulir unggahan ini sudah kedaluwarsa. Muat ulang halaman dan coba lagi." }, { status: 410, headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("Gagal menyiapkan unggahan", 400);
  }
}
