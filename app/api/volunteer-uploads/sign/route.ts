import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getT } from "@/lib/i18n/server";
import { signRequestSchema } from "@/lib/volunteer-upload-contract";
import { issueUpload, volunteerStorage, VolunteerSaveError } from "@/lib/volunteer-uploads.server";

export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  const { tr } = await getT();
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
    const { nonce, mode, volunteerId, files } = parsed.data;
    let actor = "public";
    if (mode === "staff") {
      const session = await requireStaffSession();
      if (!session) return fail("Akses ditolak", 403);
      actor = session.user.id;
      if (volunteerId && !await prisma.volunteer.findUnique({ where: { id: volunteerId }, select: { id: true } })) return fail("Relawan tidak ditemukan", 404);
    }
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = `${actor}:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}`;
    const current = attempts.get(key) ?? { count: 0, until: now + 15 * 60 * 1000 };
    if (current.count + files.length > 40 || attempts.size >= 10000) return fail("Terlalu banyak percobaan. Coba lagi nanti.", 429);
    current.count += files.length;
    attempts.set(key, current);
    const storage = volunteerStorage();
    return NextResponse.json({ uploads: files.map(file => issueUpload(file, { actor, nonce, volunteerId }, storage)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof VolunteerSaveError)) console.error("Volunteer upload signing failed", error);
    return fail(error instanceof VolunteerSaveError ? error.message : "Gagal menyiapkan unggahan", 400);
  }
}
