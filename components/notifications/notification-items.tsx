"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Loader2, Bell } from "lucide-react";

import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notification";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { translateNotification } from "@/lib/i18n/notification";


export function MarkAllReadButton({ unreadCount }: { unreadCount: number }) {
  const { tr, locale } = useI18n();

  const [isPending, startTransition] = useTransition();

  function handleMarkAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.success) {
        toast.success(tr("Semua notifikasi ditandai sudah dibaca"));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleMarkAll}
      disabled={isPending || unreadCount === 0}
      className="w-full sm:w-auto"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCheck className="h-4 w-4" />
      )}
      {tr("Tandai Semua Sudah Dibaca")}</Button>
  );
}

export function NotificationItem({
  notification,
}: {
  notification: {
    id: string;
    title: string;
    description: string | null;
    link: string | null;
    isRead: boolean;
    createdAtLabel: string;
  };
}) {
  const { tr } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      if (!notification.isRead) {
        await markNotificationRead(notification.id);
      }
      if (notification.link) {
        router.push(notification.link);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
        !notification.isRead && "border-primary/30 bg-primary/5"
      )}
    >
      <span
        className={cn(
          "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          notification.isRead
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary"
        )}
      >
        <Bell className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm",
            notification.isRead ? "font-normal" : "font-semibold"
          )}
        >
          {translateNotification(notification.title, tr)}
        </span>
        {notification.description && (
          <span className="block text-sm text-muted-foreground">
            {translateNotification(notification.description, tr)}
          </span>
        )}
        <span className="mt-1 block text-xs text-muted-foreground">
          {notification.createdAtLabel}
        </span>
      </span>
      {!notification.isRead && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}
