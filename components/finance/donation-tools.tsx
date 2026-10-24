"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Printer, Mail, X } from "lucide-react";

import { reprintReceipt, emailReceipt } from "@/lib/actions/finance";
import { downloadBase64 } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// ---------- Filter ----------

export function DonationFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilter =
    searchParams.get("type") ||
    searchParams.get("minAmount") ||
    searchParams.get("from") ||
    searchParams.get("to");

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <Select
        value={searchParams.get("type") ?? "ALL"}
        onValueChange={(v) => setParam("type", v)}
      >
        <SelectTrigger className="w-full md:w-44">
          <SelectValue placeholder="Tipe donasi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Semua Tipe</SelectItem>
          <SelectItem value="CASH">Tunai</SelectItem>
          <SelectItem value="TRANSFER">Transfer Bank</SelectItem>
          <SelectItem value="IN_KIND">Barang (In-Kind)</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="number"
        min={0}
        step={50000}
        inputMode="numeric"
        placeholder="Jumlah minimum (Rp)"
        className="w-full md:w-48"
        defaultValue={searchParams.get("minAmount") ?? ""}
        onBlur={(e) => setParam("minAmount", e.target.value || null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setParam("minAmount", (e.target as HTMLInputElement).value || null);
          }
        }}
      />

      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="w-full md:w-40"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value || null)}
          aria-label="Dari tanggal"
        />
        <span className="text-sm text-muted-foreground">s/d</span>
        <Input
          type="date"
          className="w-full md:w-40"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value || null)}
          aria-label="Sampai tanggal"
        />
      </div>

      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
          className="w-fit gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}

// ---------- Aksi per donasi ----------

export function ReceiptActions({
  donationId,
  receiptNumber,
  defaultEmail,
}: {
  donationId: string;
  receiptNumber: string;
  defaultEmail?: string;
}) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [isPrinting, startPrinting] = useTransition();
  const [isEmailing, startEmailing] = useTransition();

  function handleReprint() {
    startPrinting(async () => {
      const result = await reprintReceipt(donationId);
      if (result.success) {
        downloadBase64(result.contentBase64, result.fileName, result.mime);
        toast.success(`Kwitansi ${receiptNumber} ter-download`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleEmail() {
    startEmailing(async () => {
      const result = await emailReceipt({ donationId, email });
      if (result.success) {
        toast.warning("Permintaan tercatat", {
          description: result.warning,
        });
        setEmailOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleReprint}
        disabled={isPrinting}
        title="Cetak ulang kwitansi"
      >
        {isPrinting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        <span className="sr-only">Cetak ulang {receiptNumber}</span>
      </Button>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Kirim via email"
          >
            <Mail className="h-4 w-4" />
            <span className="sr-only">Email kwitansi {receiptNumber}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kirim Kwitansi via Email</DialogTitle>
            <DialogDescription>
              Kwitansi {receiptNumber} akan dikirim ke email donatur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="donatur-email">Email Donatur</Label>
            <Input
              id="donatur-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="donatur@email.com"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEmailOpen(false)}
              disabled={isEmailing}
            >
              Batal
            </Button>
            <Button
              onClick={handleEmail}
              disabled={isEmailing || !email.includes("@")}
            >
              {isEmailing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                "Kirim"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
