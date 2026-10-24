"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type ActionResult = { success: true } | { success: false; error: string };

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
  }

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID notifikasi tidak valid" };
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
    return { success: false, error: "Gagal menandai notifikasi" };
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tidak terautentikasi" };
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
    return { success: false, error: "Gagal menandai semua notifikasi" };
  }
}
