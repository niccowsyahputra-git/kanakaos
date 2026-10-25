import Link from "next/link";
import { Prisma, AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AuditFilters } from "@/components/admin/audit-filters";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";


const PAGE_SIZE = 50;

const actionClass: Record<AuditAction, string> = {
  CREATE: "border-transparent bg-green-100 text-green-800",
  UPDATE: "border-transparent bg-blue-100 text-blue-800",
  DELETE: "border-transparent bg-red-100 text-red-800",
  LOGIN: "border-transparent bg-gray-100 text-gray-600",
};

function formatDateTime(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export type AuditSearchParams = {
  page?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
};

function buildPageUrl(searchParams: AuditSearchParams, page: number) {
  const params = new URLSearchParams();
  params.set("tab", "audit");
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  return `/dashboard/admin/settings?${params.toString()}`;
}

/** Konten Audit Log — dirender sebagai tab di Pengaturan Sistem */
export async function AuditSection({
  searchParams,
}: {
  searchParams: AuditSearchParams;
}) {
  const { tr, locale } = await getT();

  const page = Math.max(1, Number(searchParams.page) || 1);

  const actionFilter = Object.values(AuditAction).includes(
    searchParams.action as AuditAction
  )
    ? (searchParams.action as AuditAction)
    : undefined;

  // Rentang tanggal: "to" inklusif sampai akhir hari
  const fromDate =
    searchParams.from && !Number.isNaN(Date.parse(searchParams.from))
      ? new Date(searchParams.from)
      : undefined;
  const toDate =
    searchParams.to && !Number.isNaN(Date.parse(searchParams.to))
      ? new Date(new Date(searchParams.to).setHours(23, 59, 59, 999))
      : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(actionFilter && { action: actionFilter }),
    ...(searchParams.userId && { userId: searchParams.userId }),
    ...((fromDate || toDate) && {
      createdAt: {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate }),
      },
    }),
  };

  const [logs, totalCount, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {totalCount} {tr(" aktivitas tercatat. Halaman ")}{page} {tr(" dari ")}{totalPages}.
      </p>

      <AuditFilters users={users} />

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Tidak ada log aktivitas untuk filter ini.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={actionClass[log.action]}>
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(log.createdAt, locale)}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{log.userName}</span>{" "}
                    <span className="text-muted-foreground">
                      → {log.entity}
                      {log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ""}
                    </span>
                  </p>
                  {log.detail && (
                    <p className="text-sm text-muted-foreground">
                      {log.detail}
                    </p>
                  )}
                  {log.ipAddress && (
                    <p className="text-xs text-muted-foreground">
                      IP: {log.ipAddress}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Waktu")}</TableHead>
                  <TableHead>{tr("User")}</TableHead>
                  <TableHead>{tr("Aksi")}</TableHead>
                  <TableHead>{tr("Entity")}</TableHead>
                  <TableHead>{tr("Detail")}</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(log.createdAt, locale)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.userName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={actionClass[log.action]}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.entity}
                      {log.entityId && (
                        <span className="block text-xs text-muted-foreground">
                          {log.entityId.slice(0, 12)}…
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">
                      {log.detail ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.ipAddress ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={buildPageUrl(searchParams, page - 1)}>
              <ChevronLeft className="h-4 w-4" />
              {tr("Sebelumnya")}</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {tr("Halaman ")}{page} / {totalPages}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
          >
            <Link href={buildPageUrl(searchParams, page + 1)}>
              {tr("Berikutnya")}<ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
