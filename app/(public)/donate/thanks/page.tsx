import Link from "next/link";
import { getSiteSettings, type YayasanIdentity } from "@/lib/site-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Home } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { identity } = await getSiteSettings();
  return { title: `Terima Kasih — ${identity.name}` };
}

function paymentInstructions(
  yayasan: YayasanIdentity
): Record<string, { title: string; lines: string[] }> {
  const holder = `a.n. ${yayasan.name}`;
  return {
    TRANSFER_BANK: {
      title: "Instruksi Transfer Bank",
      lines: [
        "Bank BCA — No. Rekening: 123 456 7890",
        holder,
        "Mohon sertakan berita transfer: DONASI [Nama Anda]",
      ],
    },
    QRIS: {
      title: "Instruksi Pembayaran QRIS",
      lines: [
        "Scan kode QRIS kami di kantor yayasan, atau",
        yayasan.phone
          ? `hubungi WhatsApp ${yayasan.phone} untuk menerima kode QRIS`
          : "hubungi pengurus yayasan untuk menerima kode QRIS",
        holder,
      ],
    },
    E_WALLET: {
      title: "Instruksi E-Wallet",
      lines: [
        "OVO / GoPay / Dana: 0812-3456-7890",
        holder,
        "Mohon konfirmasi setelah transfer via WhatsApp",
      ],
    },
  };
}

export default async function DonateThanksPage({
  searchParams,
}: {
  searchParams: { method?: string };
}) {
  const { identity } = await getSiteSettings();
  const allInstructions = paymentInstructions(identity);
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
            Terima Kasih! 🙏
          </h1>
          <p className="text-sm text-muted-foreground">
            Niat donasi Anda sudah kami terima. Silakan selesaikan pembayaran
            dengan instruksi di bawah ini. Tim kami akan mengirimkan kwitansi
            resmi setelah dana diterima.
          </p>

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
              Konfirmasi pembayaran: {contacts.join(" atau ")}
            </p>
          )}

          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">
              <Home className="h-4 w-4" />
              Kembali ke Beranda
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
