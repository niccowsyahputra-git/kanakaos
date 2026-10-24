"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, X, AlertTriangle } from "lucide-react";

import { createFinanceExpense } from "@/lib/actions/financeExpense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  expensePocketOptions,
  expenseCoaOptions,
  expenseCoaHint,
  formatRupiah,
} from "@/components/finance/finance-labels";
import type { ExpenseCoa } from "@prisma/client";

const NONE = "NONE";

export type AccountWithBalance = { id: string; name: string; balance: number };
export type ProgramWithBalance = {
  id: string;
  code: string;
  name: string;
  balance: number;
};
export type ChildOption = { id: string; fullName: string };

export function ExpenseForm({
  accounts,
  programs,
  childrenOptions,
  unrestrictedBalance,
}: {
  accounts: AccountWithBalance[];
  programs: ProgramWithBalance[];
  childrenOptions: ChildOption[];
  unrestrictedBalance: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const proofRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState("");
  const [accountId, setAccountId] = useState(NONE);
  const [pocket, setPocket] = useState(NONE);
  const [programId, setProgramId] = useState(NONE);
  const [coa, setCoa] = useState(NONE);
  const [childId, setChildId] = useState("");
  const [childQuery, setChildQuery] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [amount, setAmount] = useState("");
  const [hasProof, setHasProof] = useState(false);

  const isRestricted = pocket === "TERIKAT";
  const selectedProgram = programs.find((p) => p.id === programId);
  const selectedChild = childrenOptions.find((c) => c.id === childId);

  // Saldo kantong yang dipilih
  const pocketBalance =
    pocket === "TIDAK_TERIKAT"
      ? unrestrictedBalance
      : isRestricted && selectedProgram
        ? selectedProgram.balance
        : null;

  const amountNum = Number(amount) || 0;
  const insufficient =
    pocketBalance !== null && amountNum > 0 && amountNum > pocketBalance;

  const childResults =
    childQuery.trim() === ""
      ? []
      : childrenOptions
          .filter(
            (c) =>
              c.id !== childId &&
              c.fullName
                .toLowerCase()
                .includes(childQuery.trim().toLowerCase())
          )
          .slice(0, 6);

  function handleSubmit() {
    if (!date) return toast.error("Tanggal pengeluaran wajib diisi");
    if (accountId === NONE) return toast.error("Pilih sumber rekening kas");
    if (pocket === NONE) return toast.error("Pilih kantong dana");
    if (isRestricted && programId === NONE)
      return toast.error("Pilih program untuk beban dana terikat");
    if (coa === NONE) return toast.error("Pilih kategori biaya (COA)");
    if (coa === "BEBAN_PROGRAM" && !childId && beneficiaryName.trim() === "")
      return toast.error(
        "Penerima manfaat wajib untuk Beban Program & Penyaluran"
      );
    if (amountNum <= 0)
      return toast.error("Nilai pencairan harus lebih dari 0");
    if (insufficient) return toast.error("Saldo tidak cukup");
    const proof = proofRef.current?.files?.[0];
    if (!proof) return toast.error("Bukti dokumen wajib diunggah");

    startTransition(async () => {
      const formData = new FormData();
      formData.set("date", date);
      formData.set("accountId", accountId);
      formData.set("pocket", pocket);
      if (isRestricted) formData.set("programId", programId);
      formData.set("coa", coa);
      if (childId) formData.set("beneficiaryChildId", childId);
      formData.set(
        "beneficiaryName",
        selectedChild ? selectedChild.fullName : beneficiaryName
      );
      formData.set("amount", amount);
      formData.set("proof", proof);

      const result = await createFinanceExpense(formData);
      if (result.success) {
        toast.success(`Voucher dibuat — ${result.voucherNumber} (Draft)`);
        if (result.warning) toast.warning(result.warning);
        router.push("/dashboard/finance/expense");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Formulir Kas Keluar (Kredit)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Nomor voucher dibuat otomatis (PV/YYS/TAHUN/BULAN/XXX). Voucher baru
          berstatus Draft dan harus melewati alur persetujuan.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="ex-date">Tanggal Pengeluaran *</Label>
            <Input
              id="ex-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Sumber Rekening Kas *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih rekening" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  Pilih rekening
                </SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} (Saldo: {formatRupiah(a.balance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Dipotong Dari Kantong Dana *</Label>
          <Select
            value={pocket}
            onValueChange={(v) => {
              setPocket(v);
              if (v !== "TERIKAT") setProgramId(NONE);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih kantong dana" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                Pilih kantong dana
              </SelectItem>
              {expensePocketOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                  {o.value === "TIDAK_TERIKAT"
                    ? ` — ${formatRupiah(unrestrictedBalance)}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Beban program terikat — kondisional */}
        <div className="space-y-2">
          <Label className={isRestricted ? "" : "text-muted-foreground"}>
            Beban Program Terikat{" "}
            {isRestricted ? "*" : "(aktif jika pilih dana terikat)"}
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
                    ? "Pilih program"
                    : "Nonaktif — pilih Saldo Dana Terikat dulu"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                Pilih program
              </SelectItem>
              {programs.length === 0 ? (
                <SelectItem value="EMPTY" disabled>
                  Belum ada program dengan saldo
                </SelectItem>
              ) : (
                programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (Sisa Saldo: {formatRupiah(p.balance)})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Kategori Biaya (COA) *</Label>
          <Select value={coa} onValueChange={setCoa}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih kategori biaya" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                Pilih kategori biaya
              </SelectItem>
              {expenseCoaOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {coa !== NONE && (
            <p className="text-xs text-muted-foreground">
              Contoh: {expenseCoaHint[coa as ExpenseCoa]}
            </p>
          )}
        </div>

        {/* Penerima manfaat */}
        <div className="space-y-2">
          <Label>
            Nama Penerima Manfaat{" "}
            <span className="font-normal text-muted-foreground">
              (wajib untuk Beban Program & Penyaluran)
            </span>
          </Label>
          {selectedChild ? (
            <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 px-3 py-2.5">
              <span className="text-sm font-medium">
                {selectedChild.fullName}{" "}
                <span className="text-xs text-muted-foreground">
                  (anak asuh)
                </span>
              </span>
              <button
                type="button"
                onClick={() => setChildId("")}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Ganti penerima"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Input
                value={beneficiaryName}
                onChange={(e) => {
                  setBeneficiaryName(e.target.value);
                  setChildQuery(e.target.value);
                }}
                placeholder="Ketik nama anak asuh, atau nama vendor/pihak ketiga"
                autoComplete="off"
              />
              {childQuery.trim() !== "" && childResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {childResults.map((child) => (
                    <button
                      type="button"
                      key={child.id}
                      onClick={() => {
                        setChildId(child.id);
                        setChildQuery("");
                        setBeneficiaryName("");
                      }}
                      className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      {child.fullName}{" "}
                      <span className="text-xs text-muted-foreground">
                        (anak asuh)
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ex-amount">Nilai Pencairan (Rp) *</Label>
          <Input
            id="ex-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="mis. 250000"
          />
          {pocketBalance !== null && (
            <p className="text-xs text-muted-foreground">
              Sisa saldo kantong terpilih: {formatRupiah(pocketBalance)}
            </p>
          )}
          {insufficient && (
            <p className="flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Saldo tidak cukup — tombol simpan dikunci
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ex-proof">
            Unggah Bukti Dokumen *{" "}
            <span className="font-normal text-muted-foreground">
              (PDF/JPG/PNG maks 5MB — nota, kuitansi, foto penyerahan)
            </span>
          </Label>
          <Input
            id="ex-proof"
            ref={proofRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setHasProof(!!e.target.files?.length)}
            className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
          />
        </div>

        <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
          Alur persetujuan: <b>Draft</b> (staf admin) → <b>Menunggu Review</b>{" "}
          (Bendahara) → <b>Menunggu Approval</b> (Ketua/Dewan Pembina) →{" "}
          <b>Selesai / Dana Cair</b>.
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/finance/expense")}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !date ||
              accountId === NONE ||
              pocket === NONE ||
              (isRestricted && programId === NONE) ||
              coa === NONE ||
              amountNum <= 0 ||
              insufficient ||
              !hasProof
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Buat Voucher (Draft)"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
