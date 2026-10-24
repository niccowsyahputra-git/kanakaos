import Link from "next/link";
import { Target, Users2, UserPlus, MessageCircle } from "lucide-react";
import { getProgramDonorData } from "@/lib/dashboard-data";
import { formatRupiah } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DonorAcquisitionChart } from "@/components/dashboard/dashboard-charts";

/** Bangun link WhatsApp dari nomor telepon Indonesia */
function waLink(phone: string, name: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0")
    ? `62${digits.slice(1)}`
    : digits.startsWith("62")
      ? digits
      : `62${digits}`;
  const text = encodeURIComponent(
    `Assalamu'alaikum ${name}, semoga sehat selalu. Kami dari yayasan ingin menyapa dan menyampaikan terima kasih atas kebaikan Bapak/Ibu selama ini. 🙏`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}

export async function ProgramDonorSection() {
  const data = await getProgramDonorData();

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-purple-100 p-1.5 text-purple-700">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight">
            Manajemen Program &amp; Donatur
          </h3>
          <p className="text-xs text-muted-foreground">
            Efektivitas fundraising &amp; retensi donatur.
          </p>
        </div>
      </div>

      {/* Progress penggalangan dana program */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">
            Progress Penggalangan Dana Program
          </CardTitle>
          <Link
            href="/dashboard/finance/programs"
            className="text-xs text-primary hover:underline"
          >
            Kelola program →
          </Link>
        </CardHeader>
        <CardContent>
          {data.programs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Belum ada program aktif.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {data.programs.map((p) => (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRupiah(p.raised)}
                      {p.target > 0 ? ` / ${formatRupiah(p.target)}` : ""}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-purple-600 transition-all"
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                  <p className="text-right text-xs text-muted-foreground">
                    {p.target > 0
                      ? `${p.percent}% tercapai`
                      : "Target belum ditetapkan"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Kesehatan basis donatur */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users2 className="h-4 w-4 text-muted-foreground" />
              Kesehatan Basis Donatur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 rounded-md bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {data.activeDonors}
                </p>
                <p className="text-xs text-muted-foreground">
                  Aktif bulan ini
                </p>
              </div>
              <div className="flex-1 rounded-md bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">
                  {data.passiveDonors.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Belum transfer
                </p>
              </div>
            </div>

            {data.passiveDonors.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Kirim pengingat sapaan:
                </p>
                <ul className="flex flex-col divide-y">
                  {data.passiveDonors.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span className="truncate">{d.name}</span>
                      {d.phone ? (
                        <a
                          href={waLink(d.phone, d.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Sapa via WA
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          No. telp kosong
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Akuisisi donatur */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              Akuisisi Donatur Baru
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Total {data.totalDonors} donatur
            </span>
          </CardHeader>
          <CardContent>
            <DonorAcquisitionChart data={data.acquisition} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
