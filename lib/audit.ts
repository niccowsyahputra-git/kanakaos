import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

/** Ambil IP client dari header (Vercel meneruskan x-forwarded-for) */
export function getClientIp(): string | null {
  try {
    const headerList = headers();
    const forwarded = headerList.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return headerList.get("x-real-ip");
  } catch {
    return null;
  }
}

/**
 * Catat aktivitas ke AuditLog. Sengaja tidak melempar error:
 * kegagalan audit tidak boleh membatalkan operasi utama.
 */
export async function logAudit(params: {
  userId?: string | null;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        userName: params.userName,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        detail: params.detail ?? null,
        ipAddress: getClientIp(),
      },
    });
  } catch (error) {
    console.error("logAudit error (diabaikan):", error);
  }
}
