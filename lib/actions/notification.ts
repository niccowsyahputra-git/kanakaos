"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getT } from "@/lib/i18n/server";


type ActionResult = { success: true } | { success: false; error: string };

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID notifikasi tidak valid") };
  }

  try {
    // updateMany + filter userId: user hanya bisa menandai notifikasinya sendiri
    await prisma.notification.updateMany({
      where: { id: idParsed.data, userId: session.user.id },
      data: { isRead: true },
    });

    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    console.error("markNotificationRead error:", error);
    return { success: false, error: tr("Gagal menandai notifikasi") };
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  try {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });

    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error) {
    console.error("markAllNotificationsRead error:", error);
    return { success: false, error: tr("Gagal menandai semua notifikasi") };
  }
}
