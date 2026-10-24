import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = ["image/png", "image/jpeg"];

/** Menyajikan logo yayasan yang disimpan di database (tanpa Cloudinary). */
export async function GET() {
  const row = await prisma.systemConfig.findUnique({
    where: { configKey: "YAYASAN_LOGO_DATA" },
  });
  const match = row?.configValue.match(/^data:([^;]+);base64,(.+)$/);
  if (!match || !ALLOWED_MIME.includes(match[1])) {
    return new Response("Logo tidak ditemukan", { status: 404 });
  }

  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "X-Content-Type-Options": "nosniff",
      // URL logo selalu memuat parameter versi (?v=...), jadi aman di-cache lama
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
