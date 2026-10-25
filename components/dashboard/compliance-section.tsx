import { ShieldCheck, CalendarClock, Gavel } from "lucide-react";
import { getComplianceData } from "@/lib/dashboard-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApprovalQueue } from "@/components/dashboard/approval-queue";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


const PARTNER_TYPE_LABEL: Record<string, string> = {
  RS: "Rumah Sakit",
  SEKOLAH: "Sekolah",
  POLISI: "Kepolisian",
  CSR: "CSR/Perusahaan",
};

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "medium" }).format(date);
}

export async function ComplianceSection() {
  const { tr, locale } = await getT();
  const PARTNER_TYPE_LABEL = localizeLabels(__PARTNER_TYPE_LABEL, tr);

  const data = await getComplianceData();

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-red-100 p-1.5 text-red-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight">
            {tr("Pengingat & Kepatuhan Hukum")}</h3>
          <p className="text-xs text-muted-foreground">
            {tr("Kontrol legalitas & pusat kendali persetujuan Ketua.")}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Kalender jatuh tempo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-amber-600" />
              {tr("Kalender Jatuh Tempo (90 Hari)")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.mouReminders.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {tr("Tidak ada MoU/perjanjian mitra yang akan jatuh tempo dalam 90 hari.")}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {data.mouReminders.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {PARTNER_TYPE_LABEL[m.type] ?? m.type} ·{" "}
                        {formatDate(m.expiry, locale)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        m.daysLeft <= 14
                          ? "border-transparent bg-red-100 text-red-800"
                          : m.daysLeft <= 30
                            ? "border-transparent bg-amber-100 text-amber-800"
                            : "border-transparent bg-gray-100 text-gray-700"
                      }
                    >
                      {m.daysLeft <= 0
                        ? tr("Kadaluarsa")
                        : tr("{0} hari lagi", { "0": m.daysLeft })}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {tr("Sumber data: MoU mitra (RS, sekolah, kepolisian, CSR). Untuk pengingat izin operasional & kontrak pengasuh, lengkapi tanggal berlaku di modul terkait.")}</p>
          </CardContent>
        </Card>

        {/* Antrean approval */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="h-4 w-4 text-blue-600" />
              {tr("Antrean Approval Ketua")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalQueue items={data.approvalQueue} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

const __PARTNER_TYPE_LABEL = PARTNER_TYPE_LABEL;
