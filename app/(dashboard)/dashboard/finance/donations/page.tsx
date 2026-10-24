import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, DonationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { formatRupiah } from "@/lib/utils";
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
import { Plus, Inbox } from "lucide-react";
import {
  DonationFilters,
  ReceiptActions,
} from "@/components/finance/donation-tools";

export const dynamic = "force-dynamic";

const typeLabel: Record<DonationType, string> = {
  CASH: "Tunai",
  TRANSFER: "Transfer",
  IN_KIND: "Barang",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function FinanceDonationsPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    minAmount?: string;
    from?: string;
    to?: string;
  };
}) {
  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const pendingPledges = await prisma.donationPledge.count({
    where: { followedUp: false },
  });

  const typeFilter = Object.values(DonationType).includes(
    searchParams.type as DonationType
  )
    ? (searchParams.type as DonationType)
    : undefined;

  const minAmount = Number(searchParams.minAmount) || undefined;
  const fromDate =
    searchParams.from && !Number.isNaN(Date.parse(searchParams.from))
      ? new Date(searchParams.from)
      : undefined;
  const toDate =
    searchParams.to && !Number.isNaN(Date.parse(searchParams.to))
      ? new Date(new Date(searchParams.to).setHours(23, 59, 59, 999))
      : undefined;

  const where: Prisma.DonationWhereInput = {
    ...(typeFilter && { type: typeFilter }),
    ...(minAmount && { amount: { gte: minAmount } }),
    ...((fromDate || toDate) && {
      createdAt: {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate }),
      },
    }),
  };

  const donations = await prisma.donation.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const total = donations.reduce(
    (sum, donation) => sum + Number(donation.amount),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Riwayat Donasi
          </h2>
          <p className="text-sm text-muted-foreground">
            {donations.length} donasi · total{" "}
            <span className="font-semibold text-foreground">
              {formatRupiah(total)}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/finance/pledges">
              <Inbox className="h-4 w-4" />
              Niat Donasi
              {pendingPledges > 0 && (
                <span className="ml-1 rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
                  {pendingPledges}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/donations/new">
              <Plus className="h-4 w-4" />
              Catat Donasi Baru
            </Link>
          </Button>
        </div>
      </div>

      <DonationFilters />

      {donations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Tidak ada donasi untuk filter ini.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {donations.map((donation) => (
              <Card key={donation.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {donation.donaturName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {donation.receiptNumber} ·{" "}
                        {formatDate(donation.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-green-600">
                      {formatRupiah(Number(donation.amount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {typeLabel[donation.type]}
                    </Badge>
                    <ReceiptActions
                      donationId={donation.id}
                      receiptNumber={donation.receiptNumber}
                      defaultEmail={
                        donation.donaturContact?.includes("@")
                          ? donation.donaturContact
                          : undefined
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Kwitansi</TableHead>
                  <TableHead>Donatur</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Peruntukan</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations.map((donation) => (
                  <TableRow key={donation.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {donation.receiptNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {donation.donaturName}
                      {donation.donaturContact && (
                        <span className="block text-xs text-muted-foreground">
                          {donation.donaturContact}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(donation.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {typeLabel[donation.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {donation.purpose ?? "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatRupiah(Number(donation.amount))}
                    </TableCell>
                    <TableCell>
                      <ReceiptActions
                        donationId={donation.id}
                        receiptNumber={donation.receiptNumber}
                        defaultEmail={
                          donation.donaturContact?.includes("@")
                            ? donation.donaturContact
                            : undefined
                        }
                      />
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
