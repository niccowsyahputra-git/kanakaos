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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function AssetsPage() {
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
          <h2 className="text-2xl font-bold tracking-tight">Aset Panti</h2>
          <p className="text-sm text-muted-foreground">
            {assets.length} aset · total nilai{" "}
            <span className="font-semibold text-foreground">
              {formatRupiah(totalValue)}
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
            Belum ada aset terdaftar.
          </CardContent>
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
                        {categoryLabel[asset.category]}
                        {asset.location ? ` · ${asset.location}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={conditionClass[asset.condition]}
                    >
                      {conditionLabel[asset.condition]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Perolehan {formatDate(asset.acquisitionDate)}
                    </span>
                    <span className="font-medium">
                      {formatRupiah(Number(asset.value))}
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
                  <TableHead>Nama Aset</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tgl Perolehan</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Kondisi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>{categoryLabel[asset.category]}</TableCell>
                    <TableCell>{formatDate(asset.acquisitionDate)}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(Number(asset.value))}
                    </TableCell>
                    <TableCell>{asset.location ?? "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={conditionClass[asset.condition]}
                      >
                        {conditionLabel[asset.condition]}
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
            Jadwal Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingMaintenances.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Tidak ada maintenance terjadwal.
            </p>
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
                        {isOverdue ? "Terlewat: " : ""}
                        {formatDate(maintenance.maintenanceDate)}
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
