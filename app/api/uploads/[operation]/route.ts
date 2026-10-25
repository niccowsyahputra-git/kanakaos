import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { driveStorage } from "@/lib/google-drive.server";
import { discardManagedUpload, finalizeManagedUpload, startManagedUpload, storageIpHash, storageSigningSecret } from "@/lib/managed-storage.server";
import { StorageError, managedClaimSchema, storageErrorMessage } from "@/lib/storage-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const command = z.object({ mode: z.enum(["public", "staff"]), claim: managedClaimSchema }).strict();
async function readJson(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new StorageError("FORBIDDEN");
  const reader = request.body?.getReader();
  if (!reader) throw new StorageError("INVALID");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 16_384) throw new StorageError("INVALID");
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { throw new StorageError("INVALID"); }
  finally { await reader.cancel(); }
}

export async function POST(request: NextRequest, { params }: { params: { operation: string } }) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    if (!["start", "finalize", "discard"].includes(params.operation)) return new NextResponse(null, { status: 404, headers });
    const input = await readJson(request);
    if (input?.mode !== "public" && input?.mode !== "staff") throw new StorageError("INVALID");
    const session = input.mode === "staff" ? await auth() : null;
    if (input.mode === "staff" && !session?.user) throw new StorageError("FORBIDDEN");
    const actor = { id: session?.user.id ?? null };
    const secret = storageSigningSecret();
    if (params.operation === "start") {
      // Vercel overwrites this header. Local development shares a conservative loopback bucket.
      const forwarded = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : "127.0.0.1";
      const ip = forwarded && isIP(forwarded) ? forwarded : "unknown";
      const upload = await startManagedUpload(prisma, driveStorage(), input, actor, secret, storageIpHash(secret, ip), Date.now(), request.nextUrl.origin);
      return NextResponse.json(upload, { headers });
    }
    const parsed = command.safeParse(input);
    if (!parsed.success) throw new StorageError("INVALID");
    if (params.operation === "discard") {
      await discardManagedUpload(prisma, parsed.data.claim, actor, secret);
      return NextResponse.json({ success: true }, { headers });
    }
    const claim = await finalizeManagedUpload(prisma, driveStorage(), parsed.data.claim, actor, secret);
    return NextResponse.json(claim, { headers });
  } catch (error) {
    const code = error instanceof StorageError ? error.code : "UNAVAILABLE";
    const locale = request.cookies.get("NEXT_LOCALE")?.value === "en" ? "en" : "id";
    const status = code === "FORBIDDEN" ? 403 : code === "RATE_LIMIT" ? 429 : ["INVALID", "EXPIRED"].includes(code) ? 400 : 503;
    return NextResponse.json({ code, error: storageErrorMessage(code, locale) }, { status, headers });
  }
}
