import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

/**
 * Kirim notifikasi in-app ke semua user aktif dengan role tertentu.
 * Tidak melempar error: kegagalan notifikasi tidak boleh membatalkan
 * operasi utama.
 */
export async function notifyRoles(
  roles: UserRole[],
  notification: { title: string; description?: string; link?: string },
  excludeUserId?: string
): Promise<void> {
  try {
    const recipients = await prisma.user.findMany({
      where: {
        role: { in: roles },
        isActive: true,
        ...(excludeUserId && { NOT: { id: excludeUserId } }),
      },
      select: { id: true },
    });
    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        title: notification.title,
        description: notification.description ?? null,
        link: notification.link ?? null,
      })),
    });
  } catch (error) {
    console.error("notifyRoles error (diabaikan):", error);
  }
}
