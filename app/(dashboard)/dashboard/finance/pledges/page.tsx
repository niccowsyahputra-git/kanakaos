import Link from "next/link";
import { redirect } from "next/navigation";
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
import { ArrowLeft } from "lucide-react";
import { PledgeFollowUpButton } from "@/components/finance/pledge-followup-button";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

const purposeLabel: Record<string, string> = {
  UNRESTRICTED: "Kebutuhan Umum",
  PENDIDIKAN: "Pendidikan",
  KESEHATAN: "Kesehatan",
  MAKANAN: "Makanan & Gizi",
  RENOVASI: "Renovasi",
};

const methodLabel: Record<string, string> = {
  TRANSFER_BANK: "Transfer Bank",
  QRIS: "QRIS",
  E_WALLET: "E-Wallet",
};

function formatDateTime(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function PledgesPage() {
  const { tr, locale } = await getT();
  const purposeLabel = localizeLabels(__purposeLabel, tr);
  const methodLabel = localizeLabels(__methodLabel, tr);

  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const pledges = await prisma.donationPledge.findMany({
    orderBy: [{ followedUp: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const pendingCount = pledges.filter((p) => !p.followedUp).length;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/finance/donations">
          <ArrowLeft className="h-4 w-4" />
          {tr("Riwayat Donasi")}</Link>
      </Button>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {tr("Niat Donasi (Form Publik)")}</h2>
        <p className="text-sm text-muted-foreground">
          {pendingCount} {tr(" niat donasi belum ditindaklanjuti. Hubungi donatur, konfirmasi pembayaran, lalu catat sebagai donasi resmi.")}</p>
      </div>

      {pledges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada niat donasi dari form publik.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {pledges.map((pledge) => (
              <Card
                key={pledge.id}
                className={pledge.followedUp ? "opacity-60" : ""}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{pledge.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pledge.email}
                        {pledge.phone ? ` · ${pledge.phone}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-green-600">
                      {formatRupiah(Number(pledge.amount), locale)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {purposeLabel[pledge.purpose] ?? pledge.purpose} ·{" "}
                    {methodLabel[pledge.method] ?? pledge.method} ·{" "}
                    {formatDateTime(pledge.createdAt, locale)}
                  </p>
                  {pledge.message && (
                    <p className="rounded-md bg-muted/60 p-2 text-xs italic">
                      &ldquo;{pledge.message}&rdquo;
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    {pledge.followedUp ? (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-green-100 text-green-800"
                      >
                        {tr("Sudah ditindaklanjuti")}</Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-yellow-100 text-yellow-800"
                      >
                        {tr("Menunggu")}</Badge>
                    )}
                    {!pledge.followedUp && (
                      <PledgeFollowUpButton
                        pledgeId={pledge.id}
                        pledgeName={pledge.name}
                      />
                    )}
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
                  <TableHead>{tr("Waktu")}</TableHead>
                  <TableHead>{tr("Donatur")}</TableHead>
                  <TableHead>{tr("Tujuan")}</TableHead>
                  <TableHead>{tr("Metode")}</TableHead>
                  <TableHead className="text-right">{tr("Jumlah")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead className="text-right">{tr("Aksi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pledges.map((pledge) => (
                  <TableRow
                    key={pledge.id}
                    className={pledge.followedUp ? "opacity-60" : ""}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(pledge.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{pledge.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {pledge.email}
                        {pledge.phone ? ` · ${pledge.phone}` : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      {purposeLabel[pledge.purpose] ?? pledge.purpose}
                    </TableCell>
                    <TableCell>
                      {methodLabel[pledge.method] ?? pledge.method}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatRupiah(Number(pledge.amount), locale)}
                    </TableCell>
                    <TableCell>
                      {pledge.followedUp ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-green-100 text-green-800"
                        >
                          {tr("Ditindaklanjuti")}</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-yellow-100 text-yellow-800"
                        >
                          {tr("Menunggu")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!pledge.followedUp && (
                        <PledgeFollowUpButton
                          pledgeId={pledge.id}
                          pledgeName={pledge.name}
                        />
                      )}
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

const __purposeLabel = purposeLabel;
const __methodLabel = methodLabel;
