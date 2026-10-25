import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { privateAttachmentLink } from "@/lib/volunteer-uploads.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireStaffSession();
  if (!session) return new NextResponse(null, { status: 403 });
  if (!z.string().cuid().safeParse(params.id).success) return new NextResponse(null, { status: 404 });
  const attachment = await prisma.volunteerAttachment.findUnique({ where: { id: params.id } });
  if (!attachment) return new NextResponse(null, { status: 404 });
  try {
    return NextResponse.redirect(privateAttachmentLink(attachment), { status: 307, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return new NextResponse(null, { status: 503 }); }
}
