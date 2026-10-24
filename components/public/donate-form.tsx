"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Heart } from "lucide-react";

import { createDonationPledge } from "@/lib/actions/public";
import { cn, formatRupiah, numberToWords } from "@/lib/utils";
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

const PRESET_AMOUNTS = [
  { value: 50000, label: "Rp 50rb" },
  { value: 100000, label: "Rp 100rb" },
  { value: 500000, label: "Rp 500rb" },
  { value: 1000000, label: "Rp 1jt" },
];

const PURPOSE_OPTIONS = [
  { value: "UNRESTRICTED", label: "Kebutuhan Umum (Unrestricted)" },
  { value: "PENDIDIKAN", label: "Pendidikan" },
  { value: "KESEHATAN", label: "Kesehatan" },
  { value: "MAKANAN", label: "Makanan & Gizi" },
  { value: "RENOVASI", label: "Renovasi Asrama" },
];

const METHOD_OPTIONS = [
  { value: "TRANSFER_BANK", label: "Transfer Bank" },
  { value: "QRIS", label: "QRIS" },
  { value: "E_WALLET", label: "E-Wallet (OVO/GoPay/Dana)" },
];

export function PublicDonateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState("");
  const [purpose, setPurpose] = useState("UNRESTRICTED");
  const [method, setMethod] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const effectiveAmount = customAmount ? Number(customAmount) || 0 : amount;

  function handleSubmit() {
    startTransition(async () => {
      const result = await createDonationPledge({
        name,
        email,
        phone,
        amount: effectiveAmount,
        purpose: purpose as "UNRESTRICTED",
        method: method as "TRANSFER_BANK",
        message,
      });
      if (result.success) {
        router.push(`/donate/thanks?method=${method}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-4 md:p-6">
        <div className="space-y-2">
          <Label htmlFor="donor-name">Nama Donatur</Label>
          <Input
            id="donor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama lengkap Anda"
            autoComplete="name"
          />
        </div>

        <div className="flex flex-col gap-5 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="donor-email">Email</Label>
            <Input
              id="donor-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@anda.com"
              autoComplete="email"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="donor-phone">
              No. HP{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <Input
              id="donor-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
        </div>

        {/* Nominal: preset buttons besar + custom */}
        <div className="space-y-2">
          <Label className="text-base">Jumlah Donasi</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  setAmount(preset.value);
                  setCustomAmount("");
                }}
                className={cn(
                  "min-h-[52px] rounded-lg border-2 text-sm font-semibold transition-colors",
                  amount === preset.value && !customAmount
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted hover:bg-accent"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={10000}
            step={10000}
            inputMode="numeric"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Atau masukkan nominal lain (min Rp 10.000)"
            className="h-11"
          />
          {effectiveAmount >= 10000 && (
            <p className="text-xs text-muted-foreground">
              {formatRupiah(effectiveAmount)} —{" "}
              <span className="italic">{numberToWords(effectiveAmount)}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Tujuan Donasi</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PURPOSE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Metode Pembayaran</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih metode" />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="donor-message">
            Pesan / Doa{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </Label>
          <Textarea
            id="donor-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tulis pesan atau doa untuk anak-anak..."
            rows={3}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={
            isPending ||
            name.trim().length < 3 ||
            !email.includes("@") ||
            effectiveAmount < 10000 ||
            !method
          }
          className="h-12 w-full text-base"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              <Heart className="h-5 w-5" />
              Lanjutkan Donasi
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Setelah submit, Anda akan menerima instruksi pembayaran. Kwitansi
          resmi diterbitkan setelah dana kami terima.
        </p>
      </CardContent>
    </Card>
  );
}
