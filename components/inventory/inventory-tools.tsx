"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, SlidersHorizontal } from "lucide-react";

import { createInventoryItem, adjustStock } from "@/lib/actions/inventory";
import { cn } from "@/lib/utils";
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

export const INVENTORY_CATEGORY_OPTIONS = [
  { value: "MAKANAN", label: "Makanan" },
  { value: "ATK", label: "ATK" },
  { value: "OBAT", label: "Obat" },
  { value: "PERLENGKAPAN", label: "Perlengkapan" },
  { value: "LAINNYA", label: "Lainnya" },
];

// ---------- Filter kategori ----------

export function InventoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={searchParams.get("category") ?? "ALL"}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "ALL") params.delete("category");
        else params.set("category", value);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-full md:w-52">
        <SelectValue placeholder="Filter kategori" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">Semua Kategori</SelectItem>
        {INVENTORY_CATEGORY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------- Tambah barang ----------

export function AddItemDialog() {
  const [open, setOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [unit, setUnit] = useState("pcs");
  const [minStock, setMinStock] = useState("0");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await createInventoryItem({
        itemName,
        category: category as "LAINNYA",
        quantity: Number(quantity),
        unit,
        minStock: Number(minStock),
      });
      if (result.success) {
        toast.success("Barang ditambahkan");
        setOpen(false);
        setItemName("");
        setCategory("");
        setQuantity("0");
        setUnit("pcs");
        setMinStock("0");
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
          Tambah Barang
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Barang Inventory</DialogTitle>
          <DialogDescription>
            Daftarkan barang baru beserta stok awal & batas minimum.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="inv-name">Nama Barang</Label>
            <Input
              id="inv-name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Contoh: Beras"
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
                  {INVENTORY_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="inv-unit">Satuan</Label>
              <Input
                id="inv-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg / pcs / liter"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="inv-qty">Stok Awal</Label>
              <Input
                id="inv-qty"
                type="number"
                min={0}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="inv-min">Stok Minimum</Label>
              <Input
                id="inv-min"
                type="number"
                min={0}
                inputMode="numeric"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </div>
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
              isPending || itemName.trim().length < 2 || !category || !unit
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Barang"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Adjust stok ----------

export function AdjustStockDialog({
  inventoryId,
  itemName,
  unit,
  currentQuantity,
}: {
  inventoryId: string;
  itemName: string;
  unit: string;
  currentQuantity: number;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"IN" | "OUT">("OUT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const amountNumber = Number(amount) || 0;

  function handleSubmit() {
    startTransition(async () => {
      const result = await adjustStock({
        inventoryId,
        delta: direction === "IN" ? amountNumber : -amountNumber,
        reason,
      });
      if (result.success) {
        toast.success(`Stok ${itemName} diperbarui`);
        setOpen(false);
        setAmount("");
        setReason("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Adjust
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust Stok: {itemName}</DialogTitle>
          <DialogDescription>
            Stok saat ini: {currentQuantity} {unit}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection("IN")}
              className={cn(
                "rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                direction === "IN"
                  ? "border-green-500 bg-green-50 text-green-800"
                  : "border-muted hover:bg-accent"
              )}
            >
              + Tambah Stok
            </button>
            <button
              type="button"
              onClick={() => setDirection("OUT")}
              className={cn(
                "rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                direction === "OUT"
                  ? "border-red-500 bg-red-50 text-red-800"
                  : "border-muted hover:bg-accent"
              )}
            >
              − Kurangi Stok
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-amount">Jumlah ({unit})</Label>
            <Input
              id="adj-amount"
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-reason">Alasan</Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Pemakaian dapur mingguan / donasi barang masuk"
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
              isPending || amountNumber < 1 || reason.trim().length < 3
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Adjustment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
