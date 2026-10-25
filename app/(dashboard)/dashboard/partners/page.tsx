import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { PartnerType } from "@prisma/client";
import { PartnerForm } from "@/components/partners/partner-form";
import { DeletePartnerButton } from "@/components/partners/delete-partner-button";
import { getT } from "@/lib/i18n/server";
import { PARTNER_LABELS } from "@/lib/option-catalogs";


export const dynamic = "force-dynamic";

const typeLabel: Record<PartnerType, string> = PARTNER_LABELS;

const DAY_MS = 24 * 60 * 60 * 1000;
const MOU_WARNING_DAYS = 30;

type MouStatus = "NONE" | "OK" | "EXPIRING" | "EXPIRED";

/** Cek status MoU: EXPIRING jika < 30 hari dari hari ini, EXPIRED jika lewat */
function getMouStatus(mouExpiryDate: Date | null): MouStatus {
  if (!mouExpiryDate) return "NONE";
  const daysLeft = Math.ceil((mouExpiryDate.getTime() - Date.now()) / DAY_MS);
  if (daysLeft < 0) return "EXPIRED";
  if (daysLeft <= MOU_WARNING_DAYS) return "EXPIRING";
  return "OK";
}

async function MouBadge({ mouExpiryDate }: { mouExpiryDate: Date | null }) {
  const { tr, locale } = await getT();

  const status = getMouStatus(mouExpiryDate);

  if (status === "NONE") {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const formatted = new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
    dateStyle: "medium",
  }).format(mouExpiryDate!);

  if (status === "EXPIRED") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm">{formatted}</span>
        <Badge variant="destructive" className="w-fit gap-1">
          <AlertTriangle className="h-3 w-3" />
          {tr("MoU Kedaluwarsa")}</Badge>
      </div>
    );
  }

  if (status === "EXPIRING") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm">{formatted}</span>
        <Badge variant="destructive" className="w-fit gap-1">
          <AlertTriangle className="h-3 w-3" />
          {tr("MoU Segera Habis")}</Badge>
      </div>
    );
  }

  return <span className="text-sm">{formatted}</span>;
}

export default async function PartnersPage() {
  const { tr, locale } = await getT();

  // Proteksi role lapis kedua (lapis pertama di middleware)
  const session = await requireStaffSession();
  if (!session) {
    redirect("/dashboard");
  }

  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{tr("Mitra Eksternal")}</h2>
        <p className="text-sm text-muted-foreground">
          {tr("Rumah sakit, sekolah, kepolisian, dan mitra CSR beserta status MoU.")}</p>
      </div>

      <PartnerForm />

      {partners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada mitra terdaftar.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {partners.map((partner) => (
              <Card key={partner.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{partner.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tr(typeLabel[partner.type])}
                      </p>
                    </div>
                    <DeletePartnerButton
                      partnerId={partner.id}
                      partnerName={partner.name}
                    />
                  </div>
                  {(partner.picName || partner.picPhone) && (
                    <p className="text-sm text-muted-foreground">
                      PIC: {partner.picName ?? "-"}
                      {partner.picPhone ? ` (${partner.picPhone})` : ""}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">MoU:</span>
                    <MouBadge mouExpiryDate={partner.mouExpiryDate} />
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
                  <TableHead>{tr("Nama Mitra")}</TableHead>
                  <TableHead>{tr("Jenis")}</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>{tr("Kontak PIC")}</TableHead>
                  <TableHead>{tr("MoU Berlaku Sampai")}</TableHead>
                  <TableHead className="text-right">{tr("Aksi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">
                      {partner.name}
                    </TableCell>
                    <TableCell>{tr(typeLabel[partner.type])}</TableCell>
                    <TableCell>{partner.picName ?? "-"}</TableCell>
                    <TableCell>{partner.picPhone ?? "-"}</TableCell>
                    <TableCell>
                      <MouBadge mouExpiryDate={partner.mouExpiryDate} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <DeletePartnerButton
                          partnerId={partner.id}
                          partnerName={partner.name}
                        />
                      </div>
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

