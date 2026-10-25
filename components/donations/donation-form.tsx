"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, FileDown, Plus, Trash2 } from "lucide-react";

import { processDonation } from "@/lib/actions/donation";
import { formatRupiah, numberToWords, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { donationCategoryOptions } from "@/components/donations/donation-labels";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


const NONE = "NONE";

const UNIT_OPTIONS = [
  { value: "PCS", label: "pcs" },
  { value: "KG", label: "KG" },
  { value: "LTR", label: "Ltr" },
  { value: "BOX", label: "box" },
] as const;

const METHOD_OPTIONS = [
  { value: "CASH", label: "💵 Tunai" },
  { value: "TRANSFER", label: "🏦 Transfer Bank" },
  { value: "IN_KIND", label: "📦 Barang" },
] as const;

type ItemRow = { itemName: string; quantity: string; unit: string };

const EMPTY_ITEM: ItemRow = { itemName: "", quantity: "", unit: "PCS" };

/** Trigger download PDF dari base64 tanpa library tambahan */
function downloadPdf(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DonationForm() {
  const { tr, locale } = useI18n();
  const donationCategoryOptions = localizeLabels(__donationCategoryOptions, tr);
  const METHOD_OPTIONS = localizeLabels(__METHOD_OPTIONS, tr);
  const UNIT_OPTIONS = localizeLabels(__UNIT_OPTIONS, tr);

  const [isPending, startTransition] = useTransition();

  const [donorType, setDonorType] = useState("PERORANGAN");
  const [donaturName, setDonaturName] = useState("");
  const [donaturContact, setDonaturContact] = useState("");
  const [donaturAddress, setDonaturAddress] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState(NONE);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);

  const isInKind = type === "IN_KIND";
  const isMoney = type === "CASH" || type === "TRANSFER";
  const amountNumber = Number(amount) || 0;

  function setItem(index: number, key: keyof ItemRow, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  function resetForm() {
    setDonorType("PERORANGAN");
    setDonaturName("");
    setDonaturContact("");
    setDonaturAddress("");
    setType("");
    setCategory(NONE);
    setAmount("");
    setPurpose("");
    setItems([{ ...EMPTY_ITEM }]);
  }

  function handleSubmit() {
    if (donaturName.trim().length < 3) {
      toast.error(tr("Nama donatur minimal 3 karakter"));
      return;
    }
    if (!type) {
      toast.error(tr("Pilih metode donasi"));
      return;
    }
    if (isMoney && amountNumber < 1000) {
      toast.error(tr("Nominal minimal Rp 1.000"));
      return;
    }

    const filledItems = items
      .filter((item) => item.itemName.trim() !== "")
      .map((item) => ({
        itemName: item.itemName.trim(),
        quantity: Number(item.quantity) || 0,
        unit: item.unit as "PCS",
      }));

    if (isInKind) {
      if (filledItems.length === 0) {
        toast.error(tr("Tambahkan minimal 1 barang"));
        return;
      }
      const invalidQty = filledItems.find((item) => item.quantity < 1);
      if (invalidQty) {
        toast.error(tr("Qty untuk \"{0}\" minimal 1", { "0": invalidQty.itemName }));
        return;
      }
    }

    startTransition(async () => {
      const result = await processDonation({
        donaturName,
        donorType: donorType as "PERORANGAN",
        donaturContact,
        donaturAddress,
        type: type as "CASH",
        category: (category === NONE ? "" : category) as "ZAKAT_MAAL",
        amount: isMoney ? amountNumber : 0,
        items: isInKind ? filledItems : [],
        purpose,
      });

      if (result.success) {
        downloadPdf(result.pdfBase64, result.fileName);
        if (result.warning) {
          toast.warning(tr("Donasi tersimpan"), {
            description: tr("Kwitansi {0} ter-download. {1}.", { "0": result.receiptNumber, "1": result.warning }),
          });
        } else {
          toast.success(
            isInKind
              ? tr("Donasi barang tersimpan & stok inventori diperbarui")
              : tr("Berhasil disimpan"),
            {
              description: tr("Kwitansi {0} sedang di-download.", { "0": result.receiptNumber }),
            }
          );
        }
        resetForm();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-4 md:p-6">
        {/* Jenis donatur */}
        <div className="space-y-2">
          <Label>{tr("Jenis Donatur")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "PERORANGAN", label: tr("🙋 Perorangan") },
              { value: "PERUSAHAAN", label: tr("🏢 Perusahaan") },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDonorType(option.value)}
                className={cn(
                  "flex min-h-[48px] items-center justify-center rounded-lg border-2 border-muted px-2 py-3 text-sm font-medium transition-colors hover:bg-accent",
                  donorType === option.value && "border-primary bg-primary/10"
                )}
              >
                {tr(option.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="donaturName">
            {donorType === "PERUSAHAAN" ? tr("Nama Perusahaan") : tr("Nama Donatur")}
          </Label>
          <Input
            id="donaturName"
            value={donaturName}
            onChange={(e) => setDonaturName(e.target.value)}
            placeholder={
              donorType === "PERUSAHAAN"
                ? tr("mis. PT Maju Bersama")
                : tr("Nama lengkap donatur")
            }
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-5 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="donaturContact">
              {tr("Kontak")}{" "}
              <span className="font-normal text-muted-foreground">
                {tr("(opsional)")}</span>
            </Label>
            <Input
              id="donaturContact"
              value={donaturContact}
              onChange={(e) => setDonaturContact(e.target.value)}
              placeholder={tr("No. HP / email donatur")}
              autoComplete="off"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="donaturAddress">
              {tr("Alamat")}{" "}
              <span className="font-normal text-muted-foreground">
                {tr("(opsional)")}</span>
            </Label>
            <Input
              id="donaturAddress"
              value={donaturAddress}
              onChange={(e) => setDonaturAddress(e.target.value)}
              placeholder={tr("Alamat donatur / perusahaan")}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Kategori dana */}
        <div className="space-y-2">
          <Label>
            {tr("Kategori Dana")}{" "}
            <span className="font-normal text-muted-foreground">
              {tr("(opsional)")}</span>
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder={tr("Pilih kategori dana")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{tr("Tidak ditentukan")}</SelectItem>
              {donationCategoryOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {tr(o.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Metode donasi */}
        <div className="space-y-2">
          <Label>{tr("Metode Donasi")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {METHOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={cn(
                  "flex min-h-[48px] items-center justify-center rounded-lg border-2 border-muted px-2 py-3 text-xs font-medium transition-colors hover:bg-accent sm:text-sm",
                  type === option.value && "border-primary bg-primary/10"
                )}
              >
                {tr(option.label)}
              </button>
            ))}
          </div>
        </div>

        {/* Kondisional: Nominal untuk Tunai/Transfer */}
        {isMoney && (
          <div className="space-y-2">
            <Label htmlFor="amount">{tr("Nominal (Rp)")}</Label>
            <Input
              id="amount"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500000"
              className="text-base"
            />
            {amountNumber > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatRupiah(amountNumber, locale)} —{" "}
                <span className="italic">{numberToWords(amountNumber, locale)}</span>
              </p>
            )}
          </div>
        )}

        {/* Kondisional: daftar barang untuk donasi Barang */}
        {isInKind && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{tr("Barang yang Didonasikan")}</Label>
              <span className="text-xs text-muted-foreground">
                {tr("Otomatis menambah stok Inventori")}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-end"
                >
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={`item-name-${index}`}
                      className="text-xs text-muted-foreground"
                    >
                      {tr("Nama Barang")}</Label>
                    <Input
                      id={`item-name-${index}`}
                      value={item.itemName}
                      onChange={(e) =>
                        setItem(index, "itemName", e.target.value)
                      }
                      placeholder={tr("mis. Beras Premium 5kg")}
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-24 space-y-1">
                      <Label
                        htmlFor={`item-qty-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        {tr("Qty")}</Label>
                      <Input
                        id={`item-qty-${index}`}
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) =>
                          setItem(index, "quantity", e.target.value)
                        }
                        placeholder="10"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {tr("Satuan")}</Label>
                      <Select
                        value={item.unit}
                        onValueChange={(v) => setItem(index, "unit", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_OPTIONS.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="h-10 w-10 shrink-0 self-end text-destructive hover:text-destructive"
                      title={tr("Hapus barang")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              {tr("Tambah Barang")}</Button>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="purpose">
            {tr("Peruntukan")}{" "}
            <span className="font-normal text-muted-foreground">
              {tr("(opsional)")}</span>
          </Label>
          <Textarea
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={tr("Contoh: Biaya pendidikan anak asuh")}
            rows={3}
          />
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="h-12 w-full text-base"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {tr("Memproses kwitansi...")}</>
          ) : (
            <>
              <FileDown className="h-5 w-5" />
              {tr("Simpan & Cetak Kwitansi")}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

const __donationCategoryOptions = donationCategoryOptions;
const __METHOD_OPTIONS = METHOD_OPTIONS;
const __UNIT_OPTIONS = UNIT_OPTIONS;
