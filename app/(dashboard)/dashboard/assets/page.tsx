import { redirect } from "next/navigation";
import { AssetCategory, AssetCondition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireLogisticsSession } from "@/lib/auth-guard";
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { Wrench } from "lucide-react";
import {
  AddAssetDialog,
  ScheduleMaintenanceDialog,
} from "@/components/assets/asset-tools";
import { MaintenanceDoneButton } from "@/components/assets/maintenance-done-button";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { ASSET_LOCATIONS, catalogLabel } from "@/lib/option-catalogs";


export const dynamic = "force-dynamic";

const categoryLabel: Record<AssetCategory, string> = {
  KENDARAAN: "Kendaraan",
  ELEKTRONIK: "Elektronik",
  FURNITUR: "Furnitur",
  BANGUNAN: "Bangunan",
  LAINNYA: "Lainnya",
};

const conditionLabel: Record<AssetCondition, string> = {
  BAIK: "Baik",
  PERLU_PERBAIKAN: "Perlu Perbaikan",
  RUSAK: "Rusak",
};

const conditionClass: Record<AssetCondition, string> = {
  BAIK: "border-transparent bg-green-100 text-green-800",
  PERLU_PERBAIKAN: "border-transparent bg-amber-100 text-amber-800",
  RUSAK: "border-transparent bg-red-100 text-red-800",
};

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "medium" }).format(
    date
  );
}

export default async function AssetsPage() {
  const { tr, locale } = await getT();

  const session = await requireLogisticsSession();
  if (!session) redirect("/dashboard");

  const [assets, upcomingMaintenances] = await Promise.all([
    prisma.asset.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.assetMaintenance.findMany({
      where: { completedAt: null },
      include: { asset: { select: { name: true } } },
      orderBy: { maintenanceDate: "asc" },
      take: 10,
    }),
  ]);

  const totalValue = assets.reduce(
    (sum, asset) => sum + Number(asset.value),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tr("Aset Panti")}</h2>
          <p className="text-sm text-muted-foreground">
            {assets.length} {tr(" aset · total nilai")}{" "}
            <span className="font-semibold text-foreground">
              {formatRupiah(totalValue, locale)}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ScheduleMaintenanceDialog
            assets={assets.map((asset) => ({
              id: asset.id,
              name: asset.name,
            }))}
          />
          <AddAssetDialog />
        </div>
      </div>

      {assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada aset terdaftar.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {assets.map((asset) => (
              <Card key={asset.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tr(categoryLabel[asset.category])}
                        {asset.location ? ` · ${catalogLabel(asset.location, ASSET_LOCATIONS, tr)}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={conditionClass[asset.condition]}
                    >
                      {tr(conditionLabel[asset.condition])}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {tr("Perolehan ")}{formatDate(asset.acquisitionDate, locale)}
                    </span>
                    <span className="font-medium">
                      {formatRupiah(Number(asset.value), locale)}
                    </span>
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
                  <TableHead>{tr("Nama Aset")}</TableHead>
                  <TableHead>{tr("Kategori")}</TableHead>
                  <TableHead>{tr("Tgl Perolehan")}</TableHead>
                  <TableHead className="text-right">{tr("Nilai")}</TableHead>
                  <TableHead>{tr("Lokasi")}</TableHead>
                  <TableHead>{tr("Kondisi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>{tr(categoryLabel[asset.category])}</TableCell>
                    <TableCell>{formatDate(asset.acquisitionDate, locale)}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(Number(asset.value), locale)}
                    </TableCell>
                    <TableCell>{catalogLabel(asset.location, ASSET_LOCATIONS, tr) ?? "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={conditionClass[asset.condition]}
                      >
                        {tr(conditionLabel[asset.condition])}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Jadwal maintenance mendatang */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            {tr("Jadwal Maintenance")}</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingMaintenances.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {tr("Tidak ada maintenance terjadwal.")}</p>
          ) : (
            <ul className="divide-y">
              {upcomingMaintenances.map((maintenance) => {
                const isOverdue = maintenance.maintenanceDate < new Date();
                return (
                  <li
                    key={maintenance.id}
                    className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {maintenance.asset.name} —{" "}
                        {maintenance.maintenanceType}
                      </p>
                      {maintenance.notes && (
                        <p className="text-xs text-muted-foreground">
                          {maintenance.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          isOverdue
                            ? "w-fit border-transparent bg-red-100 text-red-800"
                            : "w-fit border-transparent bg-blue-100 text-blue-800"
                        }
                      >
                        {isOverdue ? tr("Terlewat: ") : ""}
                        {formatDate(maintenance.maintenanceDate, locale)}
                      </Badge>
                      <MaintenanceDoneButton
                        maintenanceId={maintenance.id}
                        assetName={maintenance.asset.name}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
