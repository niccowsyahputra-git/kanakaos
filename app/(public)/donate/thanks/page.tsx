import Link from "next/link";
import { getSiteSettings, type YayasanIdentity } from "@/lib/site-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Home } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";


export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { tr, locale } = await getT();

  const { identity } = await getSiteSettings();
  return { title: tr("Terima Kasih — {0}", { "0": identity.name }) };
}

function paymentInstructions(
  yayasan: YayasanIdentity, locale: Locale = "id"
): Record<string, { title: string; lines: string[] }> {
  const tr = createTranslator(locale);

  const holder = tr("a.n. {0}", { "0": yayasan.name });
  return {
    TRANSFER_BANK: {
      title: tr("Instruksi Transfer Bank"),
      lines: [
        tr("Bank BCA — No. Rekening: 123 456 7890"),
        holder,
        tr("Mohon sertakan berita transfer: DONASI [Nama Anda]"),
      ],
    },
    QRIS: {
      title: tr("Instruksi Pembayaran QRIS"),
      lines: [
        tr("Scan kode QRIS kami di kantor yayasan, atau"),
        yayasan.phone
          ? tr("hubungi WhatsApp {0} untuk menerima kode QRIS", { "0": yayasan.phone })
          : tr("hubungi pengurus yayasan untuk menerima kode QRIS"),
        holder,
      ],
    },
    E_WALLET: {
      title: tr("Instruksi E-Wallet"),
      lines: [
        "OVO / GoPay / Dana: 0812-3456-7890",
        holder,
        tr("Mohon konfirmasi setelah transfer via WhatsApp"),
      ],
    },
  };
}

export default async function DonateThanksPage({
  searchParams,
}: {
  searchParams: { method?: string };
}) {
  const { tr, locale } = await getT();

  const { identity } = await getSiteSettings();
  const allInstructions = paymentInstructions(identity, locale);
  const instructions =
    allInstructions[searchParams.method ?? ""] ??
    allInstructions.TRANSFER_BANK;
  const contacts = [
    identity.phone && `WhatsApp ${identity.phone}`,
    identity.email,
  ].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 md:py-20">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center md:p-8">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            {tr("Terima Kasih! 🙏")}</h1>
          <p className="text-sm text-muted-foreground">
            {tr("Niat donasi Anda sudah kami terima. Silakan selesaikan pembayaran dengan instruksi di bawah ini. Tim kami akan mengirimkan kwitansi resmi setelah dana diterima.")}</p>

          <div className="w-full rounded-lg border bg-muted/40 p-4 text-left">
            <p className="mb-2 text-sm font-semibold">{instructions.title}</p>
            <ul className="space-y-1">
              {instructions.lines.map((line) => (
                <li key={line} className="text-sm text-muted-foreground">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {contacts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {tr("Konfirmasi pembayaran: ")}{contacts.join(tr(" atau "))}
            </p>
          )}

          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">
              <Home className="h-4 w-4" />
              {tr("Kembali ke Beranda")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
