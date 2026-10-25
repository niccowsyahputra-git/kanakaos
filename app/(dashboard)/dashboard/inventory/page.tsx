import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireLogisticsSession } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import {
  AddItemDialog,
  AdjustStockDialog,
  InventoryFilters,
} from "@/components/inventory/inventory-tools";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";


export const dynamic = "force-dynamic";

const categoryLabel: Record<InventoryCategory, string> = {
  MAKANAN: "Makanan",
  ATK: "ATK",
  OBAT: "Obat",
  PERLENGKAPAN: "Perlengkapan",
  LAINNYA: "Lainnya",
};

function formatDateTime(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const { tr, locale } = await getT();

  const session = await requireLogisticsSession();
  if (!session) redirect("/dashboard");

  const categoryFilter = Object.values(InventoryCategory).includes(
    searchParams.category as InventoryCategory
  )
    ? (searchParams.category as InventoryCategory)
    : undefined;

  const [items, recentAdjustments] = await Promise.all([
    prisma.inventory.findMany({
      where: categoryFilter ? { category: categoryFilter } : undefined,
      orderBy: [{ category: "asc" }, { itemName: "asc" }],
    }),
    prisma.stockAdjustment.findMany({
      include: {
        inventory: { select: { itemName: true, unit: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const lowStockCount = items.filter(
    (item) => item.quantity < item.minStock
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tr("Inventori")}</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} {tr(" barang")}{lowStockCount > 0 && (
              <span className="text-destructive">
                {" "}
                · {lowStockCount} {tr(" stok menipis")}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/inventory/purchase-requests">
              <ShoppingCart className="h-4 w-4" />
              {tr("Purchase Requests")}</Link>
          </Button>
          <AddItemDialog />
        </div>
      </div>

      <InventoryFilters />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Tidak ada barang untuk kategori ini.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((item) => {
              const isLow = item.quantity < item.minStock;
              return (
                <Card key={item.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          {tr(categoryLabel[item.category])} · min {item.minStock}{" "}
                          {item.unit}
                        </p>
                      </div>
                      <span
                        className={`text-lg font-bold ${isLow ? "text-destructive" : ""}`}
                      >
                        {item.quantity}{" "}
                        <span className="text-xs font-normal">{item.unit}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      {isLow ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {tr("Stok Menipis")}</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-green-100 text-green-800"
                        >
                          {tr("Aman")}</Badge>
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                      <AddItemDialog item={item} />
                      <AdjustStockDialog
                        inventoryId={item.id}
                        itemName={item.itemName}
                        unit={item.unit}
                        currentQuantity={item.quantity}
                      />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Barang")}</TableHead>
                  <TableHead>{tr("Kategori")}</TableHead>
                  <TableHead className="text-right">{tr("Stok")}</TableHead>
                  <TableHead className="text-right">{tr("Min. Stok")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead className="text-right">{tr("Aksi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isLow = item.quantity < item.minStock;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.itemName}
                      </TableCell>
                      <TableCell>{tr(categoryLabel[item.category])}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${isLow ? "text-destructive" : ""}`}
                      >
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.minStock} {item.unit}
                      </TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {tr("Stok Menipis")}</Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-green-100 text-green-800"
                          >
                            {tr("Aman")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                        <AddItemDialog item={item} />
                        <AdjustStockDialog
                          inventoryId={item.id}
                          itemName={item.itemName}
                          unit={item.unit}
                          currentQuantity={item.quantity}
                        />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Riwayat adjustment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {tr("Riwayat Adjustment")}<span className="ml-2 text-sm font-normal text-muted-foreground">
              {tr("(10 terakhir)")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAdjustments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {tr("Belum ada riwayat adjustment.")}</p>
          ) : (
            <ul className="divide-y">
              {recentAdjustments.map((adjustment) => (
                <li
                  key={adjustment.id}
                  className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span
                        className={`font-semibold ${
                          adjustment.delta > 0
                            ? "text-green-600"
                            : "text-destructive"
                        }`}
                      >
                        {adjustment.delta > 0 ? "+" : ""}
                        {adjustment.delta} {adjustment.inventory.unit}
                      </span>{" "}
                      {adjustment.inventory.itemName}
                      <span className="text-muted-foreground">
                        {" "}
                        — {adjustment.reason}
                      </span>
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {adjustment.createdBy.name} ·{" "}
                    {formatDateTime(adjustment.createdAt, locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
