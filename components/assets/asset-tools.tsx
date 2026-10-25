"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Wrench } from "lucide-react";

import { createAsset, scheduleMaintenance } from "@/lib/actions/asset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";
import { ASSET_LOCATIONS } from "@/lib/option-catalogs";
import { localizeLabels } from "@/lib/i18n/translate";


const ASSET_CATEGORY_OPTIONS = [
  { value: "KENDARAAN", label: "Kendaraan" },
  { value: "ELEKTRONIK", label: "Elektronik" },
  { value: "FURNITUR", label: "Furnitur" },
  { value: "BANGUNAN", label: "Bangunan" },
  { value: "LAINNYA", label: "Lainnya" },
];

const CONDITION_OPTIONS = [
  { value: "BAIK", label: "Baik" },
  { value: "PERLU_PERBAIKAN", label: "Perlu Perbaikan" },
  { value: "RUSAK", label: "Rusak" },
];

// ---------- Tambah aset ----------

export function AddAssetDialog() {
  const { tr, locale } = useI18n();
  const ASSET_CATEGORY_OPTIONS = localizeLabels(__ASSET_CATEGORY_OPTIONS, tr);
  const CONDITION_OPTIONS = localizeLabels(__CONDITION_OPTIONS, tr);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [value, setValue] = useState("");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("BAIK");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await createAsset({
        name,
        category: category as "LAINNYA",
        acquisitionDate,
        value: Number(value) || 0,
        location: location as typeof ASSET_LOCATIONS[number] | "",
        condition: condition as "BAIK",
      });
      if (result.success) {
        toast.success(tr("Aset ditambahkan"));
        setOpen(false);
        setName("");
        setCategory("");
        setAcquisitionDate("");
        setValue("");
        setLocation("");
        setCondition("BAIK");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          {tr("Tambah Aset")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Tambah Aset")}</DialogTitle>
          <DialogDescription>
            {tr("Daftarkan aset panti untuk pencatatan & jadwal perawatan.")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="asset-name">{tr("Nama Aset")}</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("Contoh: Mobil Operasional Avanza")}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full space-y-2 sm:w-1/2">
              <Label>{tr("Kategori")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih kategori")} />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {tr(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label>{tr("Kondisi")}</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {tr(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="asset-date">{tr("Tanggal Perolehan")}</Label>
              <Input
                id="asset-date"
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
              />
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="asset-value">{tr("Nilai (Rp)")}</Label>
              <Input
                id="asset-value"
                type="number"
                min={0}
                step={100000}
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="150000000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-location">
              {tr("Lokasi")}{" "}
              <span className="font-normal text-muted-foreground">
                {tr("(opsional)")}</span>
            </Label>
            <Select value={location || "__none__"} onValueChange={(v) => setLocation(v === "__none__" ? "" : v)}>
              <SelectTrigger id="asset-location"><SelectValue placeholder={tr("Pilih lokasi")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{tr("Belum ditentukan")}</SelectItem>
                {ASSET_LOCATIONS.map(value => <SelectItem key={value} value={value}>{tr(value)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {tr("Batal")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              name.trim().length < 2 ||
              !category ||
              !acquisitionDate
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menyimpan...")}</>
            ) : (
              tr("Simpan Aset")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Jadwalkan maintenance ----------

type AssetOption = { id: string; name: string };

export function ScheduleMaintenanceDialog({
  assets,
}: {
  assets: AssetOption[];
}) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [maintenanceType, setMaintenanceType] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await scheduleMaintenance({
        assetId,
        maintenanceDate,
        maintenanceType,
        notes,
      });
      if (result.success) {
        toast.success(tr("Maintenance dijadwalkan"));
        setOpen(false);
        setAssetId("");
        setMaintenanceDate("");
        setMaintenanceType("");
        setNotes("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <Wrench className="h-4 w-4" />
          {tr("Jadwalkan Maintenance")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Jadwalkan Maintenance")}</DialogTitle>
          <DialogDescription>
            {tr("Perawatan rutin memperpanjang umur aset panti.")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{tr("Aset")}</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder={tr("Pilih aset")} />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="maint-date">{tr("Tanggal")}</Label>
              <Input
                id="maint-date"
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
              />
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="maint-type">{tr("Jenis Maintenance")}</Label>
              <Input
                id="maint-type"
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                placeholder={tr("Servis rutin / ganti oli...")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maint-notes">
              {tr("Catatan")}{" "}
              <span className="font-normal text-muted-foreground">
                {tr("(opsional)")}</span>
            </Label>
            <Textarea
              id="maint-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {tr("Batal")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !assetId ||
              !maintenanceDate ||
              maintenanceType.trim().length < 3
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menyimpan...")}</>
            ) : (
              tr("Jadwalkan")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const __ASSET_CATEGORY_OPTIONS = ASSET_CATEGORY_OPTIONS;
const __CONDITION_OPTIONS = CONDITION_OPTIONS;
