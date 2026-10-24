"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, X, UserPlus } from "lucide-react";

import { createFinanceIncome } from "@/lib/actions/financeIncome";
import { createDonor } from "@/lib/actions/donor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  donorCategoryOptions,
  fundRestrictionOptions,
  fundRestrictionHint,
  incomeFundCategoryOptions,
  incomeMethodOptions,
} from "@/components/finance/finance-labels";
import type { FundRestriction } from "@prisma/client";

const NONE = "NONE";

export type DonorOption = { id: string; name: string };
export type ProgramOption = { id: string; code: string; name: string };
export type AccountOption = { id: string; name: string };

const educationOptions = [
  { value: "SD", label: "SD" },
  { value: "SMP", label: "SMP" },
  { value: "SMA_SMK", label: "SMA/SMK" },
  { value: "PERGURUAN_TINGGI", label: "Perguruan Tinggi" },
];

export function IncomeForm({
  donorOptions,
  programOptions,
  accountOptions,
}: {
  donorOptions: DonorOption[];
  programOptions: ProgramOption[];
  accountOptions: AccountOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [date, setDate] = useState("");
  const [contactCategory, setContactCategory] = useState(NONE);
  const [donorId, setDonorId] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [donorQuery, setDonorQuery] = useState("");
  const [restriction, setRestriction] = useState(NONE);
  const [fundCategory, setFundCategory] = useState(NONE);
  const [programId, setProgramId] = useState(NONE);
  const [method, setMethod] = useState(NONE);
  const [accountId, setAccountId] = useState(NONE);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  // Sub-form: buat profil donatur baru
  const [showDonorForm, setShowDonorForm] = useState(false);
  const [donorSaving, setDonorSaving] = useState(false);
  const [dName, setDName] = useState("");
  const [dAddress, setDAddress] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dEmail, setDEmail] = useState("");
  const [dDob, setDDob] = useState("");
  const [dSince, setDSince] = useState("");
  const [dOccupation, setDOccupation] = useState("");
  const [dIncome, setDIncome] = useState("");
  const [dEducation, setDEducation] = useState(NONE);

  const isRestricted = restriction !== NONE && restriction !== "TIDAK_TERIKAT";
  const selectedDonor = donorOptions.find((d) => d.id === donorId);
  const donorResults =
    donorQuery.trim() === ""
      ? []
      : donorOptions
          .filter((d) =>
            d.name.toLowerCase().includes(donorQuery.trim().toLowerCase())
          )
          .slice(0, 8);

  async function handleCreateDonor() {
    if (dName.trim().length < 2) {
      toast.error("Nama lengkap donatur wajib diisi");
      return;
    }
    setDonorSaving(true);
    const result = await createDonor({
      name: dName,
      category: (contactCategory === NONE
        ? "PERORANGAN"
        : contactCategory) as "PERORANGAN",
      address: dAddress,
      phone: dPhone,
      email: dEmail,
      dob: dDob ? new Date(dDob) : undefined,
      donorSince: dSince ? new Date(dSince) : undefined,
      occupation: dOccupation,
      monthlyIncome: dIncome ? Number(dIncome) : undefined,
      lastEducation:
        dEducation === NONE ? undefined : (dEducation as "SD"),
    });
    setDonorSaving(false);
    if (result.success) {
      toast.success(`Profil donatur ${result.donor.name} dibuat`);
      setDonorId(result.donor.id);
      setSourceName(result.donor.name);
      setShowDonorForm(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleSubmit() {
    if (!date) return toast.error("Tanggal transaksi wajib diisi");
    if (contactCategory === NONE) return toast.error("Pilih kategori kontak");
    if (sourceName.trim().length < 2)
      return toast.error("Nama donatur/sumber wajib diisi");
    if (restriction === NONE)
      return toast.error("Pilih sifat keterikatan dana");
    if (isRestricted && programId === NONE)
      return toast.error("Alokasi program wajib untuk dana terikat");
    if (fundCategory === NONE) return toast.error("Pilih jenis kategori dana");
    if (method === NONE) return toast.error("Pilih metode pembayaran");
    if (!amount || Number(amount) <= 0)
      return toast.error("Jumlah transaksi harus lebih dari 0");

    startTransition(async () => {
      const result = await createFinanceIncome({
        date: new Date(date),
        contactCategory: contactCategory as "PERORANGAN",
        donorId: donorId || undefined,
        sourceName,
        restriction: restriction as FundRestriction,
        fundCategory: fundCategory as "INFAQ_SEDEKAH",
        programId: isRestricted ? programId : undefined,
        method: method as "TUNAI",
        amount: Number(amount),
        accountId: accountId === NONE ? undefined : accountId,
        memo,
      });
      if (result.success) {
        toast.success(`Kas masuk tercatat — No. Ref ${result.refNumber}`);
        router.push("/dashboard/finance/income");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Formulir Kas Masuk (Debit)</CardTitle>
        <p className="text-sm text-muted-foreground">
          No. Ref/Kuitansi dibuat otomatis (KM/YYS/TAHUN/BULAN/XXX) saat
          disimpan.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="in-date">Tanggal Transaksi *</Label>
            <Input
              id="in-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Kategori Kontak *</Label>
            <Select value={contactCategory} onValueChange={setContactCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori kontak" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  Pilih kategori kontak
                </SelectItem>
                {donorCategoryOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Nama donatur / sumber */}
        <div className="space-y-2">
          <Label htmlFor="in-source">Nama Donatur / Sumber *</Label>
          {selectedDonor ? (
            <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 px-3 py-2.5">
              <span className="text-sm font-medium">
                {selectedDonor.name}{" "}
                <span className="text-xs text-muted-foreground">
                  (profil terdaftar)
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setDonorId("");
                  setSourceName("");
                }}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Ganti donatur"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Input
                id="in-source"
                value={sourceName}
                onChange={(e) => {
                  setSourceName(e.target.value);
                  setDonorQuery(e.target.value);
                }}
                placeholder="Ketik nama — pilih dari profil donatur atau isi manual"
                autoComplete="off"
              />
              {donorQuery.trim() !== "" && donorResults.length > 0 && (
                <div className="max-h-44 overflow-y-auto rounded-md border">
                  {donorResults.map((donor) => (
                    <button
                      type="button"
                      key={donor.id}
                      onClick={() => {
                        setDonorId(donor.id);
                        setSourceName(donor.name);
                        setDonorQuery("");
                      }}
                      className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      {donor.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowDonorForm((v) => !v);
                  setDName(sourceName);
                }}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {showDonorForm
                  ? "Tutup form profil donatur"
                  : "Donatur belum terdaftar? Buat profil baru"}
              </button>
            </>
          )}
        </div>

        {/* Sub-form profil donatur */}
        {showDonorForm && !selectedDonor && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-semibold">Profil Donatur Baru</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Lengkap *</Label>
                <Input value={dName} onChange={(e) => setDName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">No. Telp</Label>
                <Input value={dPhone} onChange={(e) => setDPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Alamat</Label>
                <Input
                  value={dAddress}
                  onChange={(e) => setDAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={dEmail}
                  onChange={(e) => setDEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tanggal Lahir</Label>
                <Input
                  type="date"
                  value={dDob}
                  onChange={(e) => setDDob(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Terdaftar Sebagai Donatur Sejak</Label>
                <Input
                  type="date"
                  value={dSince}
                  onChange={(e) => setDSince(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pekerjaan</Label>
                <Input
                  value={dOccupation}
                  onChange={(e) => setDOccupation(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Penghasilan per Bulan (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  value={dIncome}
                  onChange={(e) => setDIncome(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pendidikan Terakhir</Label>
                <Select value={dEducation} onValueChange={setDEducation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE} disabled>
                      Pilih
                    </SelectItem>
                    {educationOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateDonor}
              disabled={donorSaving || dName.trim().length < 2}
            >
              {donorSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Profil Donatur"
              )}
            </Button>
          </div>
        )}

        {/* Keterikatan dana */}
        <div className="space-y-2">
          <Label>Sifat Keterikatan Dana *</Label>
          <Select
            value={restriction}
            onValueChange={(v) => {
              setRestriction(v);
              if (v === "TIDAK_TERIKAT") setProgramId(NONE);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih sifat keterikatan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                Pilih sifat keterikatan
              </SelectItem>
              {fundRestrictionOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {restriction !== NONE && (
            <p className="text-xs text-muted-foreground">
              {fundRestrictionHint[restriction as FundRestriction]}
            </p>
          )}
        </div>

        {/* Alokasi program — hanya aktif jika terikat */}
        <div className="space-y-2">
          <Label className={isRestricted ? "" : "text-muted-foreground"}>
            Alokasi Program {isRestricted ? "*" : "(khusus dana terikat)"}
          </Label>
          <Select
            value={programId}
            onValueChange={setProgramId}
            disabled={!isRestricted}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isRestricted
                    ? "Pilih program tujuan dana"
                    : "Nonaktif — pilih dana terikat dulu"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                Pilih program
              </SelectItem>
              {programOptions.length === 0 ? (
                <SelectItem value="EMPTY" disabled>
                  Belum ada program — buat di menu Program
                </SelectItem>
              ) : (
                programOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Jenis Kategori Dana *</Label>
            <Select value={fundCategory} onValueChange={setFundCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori dana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  Pilih kategori dana
                </SelectItem>
                {incomeFundCategoryOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Metode Pembayaran *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih metode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  Pilih metode
                </SelectItem>
                {incomeMethodOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {method !== NONE && (
              <p className="text-xs text-muted-foreground">
                Status verifikasi otomatis:{" "}
                {method === "TRANSFER_BANK"
                  ? "Pending (menunggu cek mutasi bank)"
                  : "Verified (dana tunai langsung diterima)"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="in-amount">Jumlah Transaksi (Rp) *</Label>
            <Input
              id="in-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="mis. 500000"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>
              Rekening Tujuan{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih rekening" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Tidak ditentukan</SelectItem>
                {accountOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="in-memo">
            Memo{" "}
            <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Textarea
            id="in-memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Catatan tambahan..."
            rows={2}
            maxLength={1000}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/finance/income")}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Kas Masuk"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
