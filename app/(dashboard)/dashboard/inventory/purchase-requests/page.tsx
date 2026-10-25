import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireLogisticsSession } from "@/lib/auth-guard";
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
import { ArrowLeft, ChevronRight } from "lucide-react";
import { NewPRDialog } from "@/components/inventory/pr-tools";
import {
  prStatusLabel,
  prStatusClass,
} from "@/components/inventory/pr-labels";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "medium" }).format(
    date
  );
}

export default async function PurchaseRequestsPage() {
  const { tr, locale } = await getT();
  const prStatusClass = localizeLabels(__prStatusClass, tr);

  const session = await requireLogisticsSession();
  if (!session) redirect("/dashboard");

  const [requests, items] = await Promise.all([
    prisma.purchaseRequest.findMany({
      include: {
        inventory: { select: { itemName: true, unit: true } },
        requestedBy: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.inventory.findMany({
      select: {
        id: true,
        itemName: true,
        unit: true,
        quantity: true,
        minStock: true,
      },
      orderBy: { itemName: "asc" },
    }),
  ]);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/inventory">
          <ArrowLeft className="h-4 w-4" />
          {tr("Inventori")}</Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {tr("Purchase Requests")}</h2>
          <p className="text-sm text-muted-foreground">
            {pendingCount} {tr(" menunggu persetujuan dari total ")}{requests.length}{" "}
            {tr("PR.")}</p>
        </div>
        <NewPRDialog items={items} />
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada purchase request.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {requests.map((pr) => (
              <Card key={pr.id}>
                <CardContent className="p-4">
                  <Link
                    href={`/dashboard/inventory/purchase-requests/${pr.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold">
                        {pr.inventory.itemName} × {pr.quantity}{" "}
                        {pr.inventory.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pr.requestedBy.name} · {formatDate(pr.createdAt, locale)}
                      </p>
                      <Badge variant="outline" className={prStatusClass[pr.status]}>
                        {tr(prStatusLabel[pr.status])}
                      </Badge>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Tanggal")}</TableHead>
                  <TableHead>{tr("Barang")}</TableHead>
                  <TableHead className="text-right">{tr("Jumlah")}</TableHead>
                  <TableHead>{tr("Pemohon")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((pr) => (
                  <TableRow key={pr.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(pr.createdAt, locale)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/inventory/purchase-requests/${pr.id}`}
                        className="hover:underline"
                      >
                        {pr.inventory.itemName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {pr.quantity} {pr.inventory.unit}
                    </TableCell>
                    <TableCell>{pr.requestedBy.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={prStatusClass[pr.status]}
                      >
                        {tr(prStatusLabel[pr.status])}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

const __prStatusClass = prStatusClass;
