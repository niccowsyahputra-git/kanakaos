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
        location,
        condition: condition as "BAIK",
      });
      if (result.success) {
        toast.success("Aset ditambahkan");
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
          Tambah Aset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Aset</DialogTitle>
          <DialogDescription>
            Daftarkan aset panti untuk pencatatan & jadwal perawatan.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="asset-name">Nama Aset</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Mobil Operasional Avanza"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full space-y-2 sm:w-1/2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label>Kondisi</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="asset-date">Tanggal Perolehan</Label>
              <Input
                id="asset-date"
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
              />
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="asset-value">Nilai (Rp)</Label>
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
              Lokasi{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <Input
              id="asset-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Contoh: Garasi / Aula / Dapur"
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Batal
          </Button>
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
                Menyimpan...
              </>
            ) : (
              "Simpan Aset"
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
        toast.success("Maintenance dijadwalkan");
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
          Jadwalkan Maintenance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Jadwalkan Maintenance</DialogTitle>
          <DialogDescription>
            Perawatan rutin memperpanjang umur aset panti.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>Aset</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih aset" />
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
              <Label htmlFor="maint-date">Tanggal</Label>
              <Input
                id="maint-date"
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
              />
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="maint-type">Jenis Maintenance</Label>
              <Input
                id="maint-type"
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                placeholder="Servis rutin / ganti oli..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maint-notes">
              Catatan{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
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
            Batal
          </Button>
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
                Menyimpan...
              </>
            ) : (
              "Jadwalkan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
