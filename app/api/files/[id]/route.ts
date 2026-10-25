import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { driveStorage } from "@/lib/google-drive.server";
import { readManagedFile } from "@/lib/managed-file-read.server";
import { StorageError, storageErrorMessage } from "@/lib/storage-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user) throw new StorageError("FORBIDDEN");
    return await readManagedFile(prisma, driveStorage(), params.id, { id: session.user.id });
  } catch (error) {
    const code = error instanceof StorageError ? error.code : "UNAVAILABLE";
    return NextResponse.json({ error: storageErrorMessage(code, request.cookies.get("NEXT_LOCALE")?.value === "en" ? "en" : "id") }, {
      status: code === "FORBIDDEN" ? 404 : 503,
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" },
    });
  }
}
