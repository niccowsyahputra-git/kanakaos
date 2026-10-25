import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ShieldX } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { tr, locale } = await getT();

  const { identity } = await getSiteSettings();
  return { title: tr("Verifikasi Kwitansi — {0}", { "0": identity.name }) };
}

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "long" }).format(date);
}

const typeLabel: Record<string, string> = {
  CASH: "Tunai",
  TRANSFER: "Transfer Bank",
  IN_KIND: "Barang (In-Kind)",
};

export default async function VerifyReceiptPage({
  params,
}: {
  params: { number: string };
}) {
  const { tr, locale } = await getT();
  const typeLabel = localizeLabels(__typeLabel, tr);

  // Nomor kwitansi di QR di-encode (KW%2F2026%2F...). Next.js biasanya sudah
  // men-decode params, tapi kita tangani dua-duanya agar robust.
  let receiptNumber = params.number;
  try {
    receiptNumber = decodeURIComponent(params.number);
  } catch {
    // biarkan raw jika decode gagal
  }

  const [donation, { identity }] = await Promise.all([
    prisma.donation.findFirst({
      where: { receiptNumber: { in: [params.number, receiptNumber] } },
    }),
    getSiteSettings(),
  ]);
  const yayasanName = identity.name;
  const contacts = [identity.email, identity.phone].filter(Boolean);
  const contactText =
    contacts.length > 0 ? tr("di {0}", { "0": contacts.join(" atau ") }) : tr("melalui pengurus yayasan");

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 md:py-20">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {tr("Verifikasi Kwitansi")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{yayasanName}</p>
      </div>

      {donation ? (
        <Card className="border-green-200">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center md:p-8">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <ShieldCheck className="h-9 w-9 text-green-600" />
            </span>
            <Badge className="bg-green-600 text-white hover:bg-green-600">
              {tr("✓ KWITANSI VALID")}</Badge>
            <p className="text-sm text-muted-foreground">
              {tr("Kwitansi ini tercatat resmi di sistem ")}{yayasanName}.
            </p>

            <dl className="w-full space-y-2 rounded-lg border bg-muted/40 p-4 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tr("Nomor Kwitansi")}</dt>
                <dd className="font-mono font-medium">
                  {donation.receiptNumber}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tr("Nama Donatur")}</dt>
                <dd className="font-medium">{donation.donaturName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tr("Jumlah")}</dt>
                <dd className="font-medium">
                  {formatRupiah(Number(donation.amount), locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tr("Metode")}</dt>
                <dd className="font-medium">
                  {typeLabel[donation.type] ?? donation.type}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tr("Tanggal")}</dt>
                <dd className="font-medium">
                  {formatDate(donation.createdAt, locale)}
                </dd>
              </div>
            </dl>

            <p className="text-xs text-muted-foreground">
              {tr("Terima kasih telah memverifikasi. Jika ada ketidaksesuaian data, hubungi kami ")}{contactText}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-red-200">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center md:p-8">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <ShieldX className="h-9 w-9 text-red-600" />
            </span>
            <Badge variant="destructive">{tr("✗ TIDAK VALID")}</Badge>
            <p className="text-sm font-medium text-destructive">
              {tr("Kwitansi tidak ditemukan atau tidak valid.")}</p>
            <p className="text-xs text-muted-foreground">
              {tr("Nomor yang dicari:")}{" "}
              <span className="font-mono">{receiptNumber}</span>
              <br />
              {tr("Jika Anda yakin kwitansi ini asli, segera hubungi kami")}{" "}
              {contactText} {tr(" — bisa jadi ada indikasi pemalsuan kwitansi atas nama yayasan.")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const __typeLabel = typeLabel;
