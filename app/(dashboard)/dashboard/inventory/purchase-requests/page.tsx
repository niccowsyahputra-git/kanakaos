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

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function PurchaseRequestsPage() {
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
          Inventori
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Purchase Requests
          </h2>
          <p className="text-sm text-muted-foreground">
            {pendingCount} menunggu persetujuan dari total {requests.length}{" "}
            PR.
          </p>
        </div>
        <NewPRDialog items={items} />
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada purchase request.
          </CardContent>
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
                        {pr.requestedBy.name} · {formatDate(pr.createdAt)}
                      </p>
                      <Badge variant="outline" className={prStatusClass[pr.status]}>
                        {prStatusLabel[pr.status]}
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
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Pemohon</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((pr) => (
                  <TableRow key={pr.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(pr.createdAt)}
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
                        {prStatusLabel[pr.status]}
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
