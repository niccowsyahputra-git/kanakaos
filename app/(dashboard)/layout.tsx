import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { NavLinks } from "@/components/dashboard/nav-links";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { Separator } from "@/components/ui/separator";
import { Bell } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Jumlah notifikasi belum dibaca untuk badge lonceng di header
  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden w-full shrink-0 flex-col border-r bg-card md:flex md:w-64">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-xl font-bold">KanakaOS</h1>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <NavLinks role={session.user.role} />
          <div className="mt-auto pt-4">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
          <div className="flex items-center gap-3">
            <MobileSidebar role={session.user.role} />
            <span className="text-sm text-muted-foreground md:hidden">
              KanakaOS
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Lonceng notifikasi dengan badge unread */}
            <Link
              href="/dashboard/notifications"
              className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <Link href="/dashboard/profile" className="hidden text-right md:block">
              <p className="text-sm font-medium hover:underline">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {session.user.role?.toLowerCase().replace("_", " ")}
              </p>
            </Link>
            <div className="md:hidden">
              <LogoutButton />
            </div>
          </div>
        </header>

        <Separator />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
