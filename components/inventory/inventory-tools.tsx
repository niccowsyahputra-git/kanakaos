"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, SlidersHorizontal } from "lucide-react";

import { createInventoryItem, updateInventoryItem, adjustStock } from "@/lib/actions/inventory";
import type { Inventory } from "@prisma/client";
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
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


export const INVENTORY_CATEGORY_OPTIONS = [
  { value: "MAKANAN", label: "Makanan" },
  { value: "ATK", label: "ATK" },
  { value: "OBAT", label: "Obat" },
  { value: "PERLENGKAPAN", label: "Perlengkapan" },
  { value: "LAINNYA", label: "Lainnya" },
];

// ---------- Filter kategori ----------

export function InventoryFilters() {
  const { tr, locale } = useI18n();
  const INVENTORY_CATEGORY_OPTIONS = localizeLabels(__INVENTORY_CATEGORY_OPTIONS, tr);

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
        <SelectValue placeholder={tr("Filter kategori")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{tr("Semua Kategori")}</SelectItem>
        {INVENTORY_CATEGORY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {tr(option.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------- Tambah barang ----------

export function AddItemDialog({ item }: { item?: Pick<Inventory, "id" | "itemName" | "category" | "quantity" | "unit" | "minStock"> }) {
  const { tr, locale } = useI18n();
  const INVENTORY_CATEGORY_OPTIONS = localizeLabels(__INVENTORY_CATEGORY_OPTIONS, tr);

  const [open, setOpen] = useState(false);
  const [itemName, setItemName] = useState(item?.itemName ?? "");
  const [category, setCategory] = useState<string>(item?.category ?? "");
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 0));
  const [unit, setUnit] = useState(item?.unit ?? "pcs");
  const [minStock, setMinStock] = useState(String(item?.minStock ?? 0));
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const values = { itemName, category: category as "LAINNYA", unit, minStock: Number(minStock) };
      const result = item
        ? await updateInventoryItem(item.id, values)
        : await createInventoryItem({ ...values, quantity: Number(quantity) });
      if (result.success) {
        toast.success(item ? tr("Barang diperbarui") : tr("Barang ditambahkan"));
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
    <Dialog open={open} onOpenChange={(next) => {
      if (next && item) {
        setItemName(item.itemName); setCategory(item.category); setQuantity(String(item.quantity));
        setUnit(item.unit); setMinStock(String(item.minStock));
      }
      setOpen(next);
    }}>
      <DialogTrigger asChild>
        <Button variant={item ? "outline" : "default"} size={item ? "sm" : "default"} className={item ? "gap-1" : "w-full sm:w-auto"}>
          {item ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {item ? tr("Edit") : tr("Tambah Barang")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? tr("Edit Barang Inventori") : tr("Tambah Barang Inventory")}</DialogTitle>
          <DialogDescription>
            {item ? tr("Ubah informasi barang. Gunakan penyesuaian stok untuk mengubah jumlah.") : tr("Daftarkan barang baru beserta stok awal & batas minimum.")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="inv-name">{tr("Nama Barang")}</Label>
            <Input
              id="inv-name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={tr("Contoh: Beras")}
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
                  {INVENTORY_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {tr(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="inv-unit">{tr("Satuan")}</Label>
              <Input
                id="inv-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={tr("kg / pcs / liter")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            {!item && <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="inv-qty">{tr("Stok Awal")}</Label>
              <Input
                id="inv-qty"
                type="number"
                min={0}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>}
            <div className="w-full space-y-2 sm:w-1/2">
              <Label htmlFor="inv-min">{tr("Stok Minimum")}</Label>
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
            {tr("Batal")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending || itemName.trim().length < 2 || !category || !unit
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menyimpan...")}</>
            ) : (
              tr("Simpan Barang")
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
  const { tr, locale } = useI18n();

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
        toast.success(tr("Stok {0} diperbarui", { "0": itemName }));
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
          {tr("Adjust")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("Adjust Stok: ")}{itemName}</DialogTitle>
          <DialogDescription>
            {tr("Stok saat ini: ")}{currentQuantity} {unit}
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
              {tr("+ Tambah Stok")}</button>
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
              {tr("− Kurangi Stok")}</button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-amount">{tr("Jumlah (")}{unit})</Label>
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
            <Label htmlFor="adj-reason">{tr("Alasan")}</Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tr("Contoh: Pemakaian dapur mingguan / donasi barang masuk")}
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
              isPending || amountNumber < 1 || reason.trim().length < 3
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menyimpan...")}</>
            ) : (
              tr("Simpan Adjustment")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const __INVENTORY_CATEGORY_OPTIONS = INVENTORY_CATEGORY_OPTIONS;
