import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CalendarClock, Users } from "lucide-react";
import {
  NeedFormDialog,
  NeedStatusButton,
  DeleteNeedButton,
} from "@/components/volunteers/need-tools";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

export default async function VolunteerNeedsPage() {
  // Proteksi role lapis kedua (lapis pertama di middleware)
  const session = await requireStaffSession();
  if (!session) {
    redirect("/dashboard");
  }

  const needs = await prisma.volunteerNeed.findMany({
    // OPEN tampil lebih dulu ("OPEN" > "CLOSED")
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
    include: { volunteers: { select: { status: true } } },
  });

  const openCount = needs.filter((need) => need.status === "OPEN").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/volunteers"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Relawan
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">
            Kebutuhan Relawan
          </h2>
          <p className="text-sm text-muted-foreground">
            Bidang relawan yang sedang dibutuhkan yayasan. {openCount} kebutuhan
            sedang dibuka.
          </p>
        </div>
        <NeedFormDialog />
      </div>

      {needs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada kebutuhan relawan. Klik <b>Tambah Kebutuhan</b> untuk
            membuka lowongan relawan.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {needs.map((need) => {
            const approved = need.volunteers.filter(
              (v) => v.status === "APPROVED"
            ).length;
            const pending = need.volunteers.filter(
              (v) => v.status === "PENDING"
            ).length;
            const isOpen = need.status === "OPEN";
            const isFulfilled = approved >= need.quantity;
            const percent = Math.min(
              100,
              Math.round((approved / need.quantity) * 100)
            );

            return (
              <Card key={need.id} className={isOpen ? "" : "bg-muted/40"}>
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{need.title}</p>
                    <Badge
                      variant="outline"
                      className={
                        isOpen
                          ? "shrink-0 border-transparent bg-green-100 text-green-800 hover:bg-green-100"
                          : "shrink-0 border-transparent bg-gray-200 text-gray-700 hover:bg-gray-200"
                      }
                    >
                      {isOpen ? "Open" : "Closed"}
                    </Badge>
                  </div>

                  {need.description && (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {need.description}
                    </p>
                  )}

                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      Dibutuhkan <b>{need.quantity}</b> orang
                    </p>
                    {need.schedule && (
                      <p className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                        {need.schedule}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>
                        Terpenuhi {approved}/{need.quantity}
                        {isFulfilled && " ✓"}
                      </span>
                      <span className="text-muted-foreground">
                        {pending} pendaftar pending
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          isFulfilled ? "h-full bg-green-600" : "h-full bg-primary"
                        }
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Dibuat {formatDate(need.createdAt)}
                    {!isOpen && need.closedAt
                      ? ` · Ditutup ${formatDate(need.closedAt)}`
                      : ""}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                    <NeedStatusButton
                      needId={need.id}
                      title={need.title}
                      status={need.status}
                    />
                    <NeedFormDialog
                      need={{
                        id: need.id,
                        title: need.title,
                        description: need.description,
                        quantity: need.quantity,
                        schedule: need.schedule,
                      }}
                    />
                    {need.volunteers.length === 0 && (
                      <DeleteNeedButton needId={need.id} title={need.title} />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Kebutuhan berstatus <b>Open</b> tampil di halaman{" "}
        <Button asChild variant="link" className="h-auto p-0 text-xs">
          <Link href="/volunteer/apply" target="_blank">
            pendaftaran relawan publik
          </Link>
        </Button>{" "}
        dan bisa dipilih oleh calon relawan.
      </p>
    </div>
  );
}
