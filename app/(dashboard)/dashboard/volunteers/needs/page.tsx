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
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { NEED_STATUSES, NEED_STATUS_LABELS, dateOnlyLabel, needFieldLabel } from "@/lib/option-catalogs";


export const dynamic = "force-dynamic";

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "medium" }).format(date);
}

export default async function VolunteerNeedsPage({ searchParams }: { searchParams: { status?: string } }) {
  const { tr, locale } = await getT();

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

  needs.sort((a, b) => NEED_STATUSES.indexOf(a.status) - NEED_STATUSES.indexOf(b.status));
  const openCount = needs.filter((need) => need.status === "OPEN").length;
  const visibleNeeds = needs.filter(need => !NEED_STATUSES.includes(searchParams.status as typeof NEED_STATUSES[number]) || need.status === searchParams.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/volunteers"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {tr("Relawan")}</Link>
          <h2 className="text-2xl font-bold tracking-tight">
            {tr("Kebutuhan Relawan")}</h2>
          <p className="text-sm text-muted-foreground">
            {tr("Bidang relawan yang sedang dibutuhkan yayasan. ")}{openCount} {tr(" kebutuhan sedang dibuka.")}</p>
        </div>
        <NeedFormDialog />
      </div>

      <div className="flex flex-wrap gap-2"><Button asChild variant={!searchParams.status ? "default" : "outline"} size="sm"><Link href="/dashboard/volunteers/needs">{tr("Semua Status")} ({needs.length})</Link></Button>{NEED_STATUSES.map(status => <Button asChild key={status} size="sm" variant={searchParams.status === status ? "default" : "outline"}><Link href={`/dashboard/volunteers/needs?status=${status}`}>{tr(NEED_STATUS_LABELS[status])} ({needs.filter(n => n.status === status).length})</Link></Button>)}</div>
      {visibleNeeds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada kebutuhan relawan. Klik ")}<b>{tr("Tambah Kebutuhan")}</b> {tr(" untuk membuka lowongan relawan.")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleNeeds.map((need) => {
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
                    <p className="font-semibold leading-snug">{need.field && need.field !== "OTHER" ? tr(needFieldLabel(need.field, need.otherField, need.title)) : need.title}</p>
                    <Badge
                      variant="outline"
                      className={
                        isOpen
                          ? "shrink-0 border-transparent bg-green-100 text-green-800 hover:bg-green-100"
                          : "shrink-0 border-transparent bg-gray-200 text-gray-700 hover:bg-gray-200"
                      }
                    >
                      {tr(NEED_STATUS_LABELS[need.status])}
                    </Badge>
                  </div>

                  {need.description && (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {need.description}
                    </p>
                  )}

                  <p className="text-sm text-muted-foreground">{need.startDate && need.endDate ? `${dateOnlyLabel(need.startDate, locale)} – ${dateOnlyLabel(need.endDate, locale)}` : tr("Tanggal belum ditentukan")}</p>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {tr("Dibutuhkan ")}<b>{need.quantity}</b> {tr(" orang")}</p>
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
                        {tr("Terpenuhi ")}{approved}/{need.quantity}
                        {isFulfilled && " ✓"}
                      </span>
                      <span className="text-muted-foreground">
                        {pending} {tr(" pendaftar pending")}</span>
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
                    {tr("Dibuat ")}{formatDate(need.createdAt, locale)}
                    {!isOpen && need.closedAt
                      ? tr(" · Ditutup {0}", { "0": formatDate(need.closedAt, locale) })
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
                        field: need.field,
                        otherField: need.otherField,
                        startDate: need.startDate?.toISOString().slice(0, 10) ?? null,
                        endDate: need.endDate?.toISOString().slice(0, 10) ?? null,
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
        {tr("Kebutuhan berstatus ")}<b>{tr("Aktif")}</b> {tr(" tampil di halaman")}{" "}
        <Button asChild variant="link" className="h-auto p-0 text-xs">
          <Link href="/volunteer/apply" target="_blank">
            {tr("pendaftaran relawan publik")}</Link>
        </Button>{" "}
        {tr("dan bisa dipilih oleh calon relawan.")}</p>
    </div>
  );
}
