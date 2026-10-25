import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  MarkAllReadButton,
  NotificationItem,
} from "@/components/notifications/notification-items";
import { NotificationDateFilter } from "@/components/notifications/notification-filter";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";


export const dynamic = "force-dynamic";

function formatDateTime(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { tr, locale } = await getT();

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const fromDate =
    searchParams.from && !Number.isNaN(Date.parse(searchParams.from))
      ? new Date(searchParams.from)
      : undefined;
  const toDate =
    searchParams.to && !Number.isNaN(Date.parse(searchParams.to))
      ? new Date(new Date(searchParams.to).setHours(23, 59, 59, 999))
      : undefined;

  const where: Prisma.NotificationWhereInput = {
    userId: session.user.id,
    ...((fromDate || toDate) && {
      createdAt: {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate }),
      },
    }),
  };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tr("Notifikasi")}</h2>
          <p className="text-sm text-muted-foreground">
            {unreadCount} {tr(" belum dibaca.")}</p>
        </div>
        <MarkAllReadButton unreadCount={unreadCount} />
      </div>

      <NotificationDateFilter />

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Tidak ada notifikasi.")}</CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={{
                id: notification.id,
                title: notification.title,
                description: notification.description,
                link: notification.link,
                isRead: notification.isRead,
                createdAtLabel: formatDateTime(notification.createdAt, locale),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
