"use client";

import React, { useRef, useState, useTransition } from "react";
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
  programFundingSourceOptions,
  expenseCoaOptions,
  expenseCoaHint,
  formatRupiah,
} from "@/components/finance/finance-labels";
import type { ExpenseCoa, ProgramExpenseSource } from "@prisma/client";
import type { ProgramBalance } from "@/lib/finance-balance";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


const NONE = "NONE";

export type AccountWithBalance = { id: string; name: string; balance: number };
export type ProgramWithBalance = Pick<ProgramBalance, "id" | "code" | "name" | "balance" | "sumberDana" | "fundraising" | "internal">;
export type ChildOption = { id: string; fullName: string };

export function ProgramExpenseSourceSelect({ program, value, onChange, disabled = false }: {
  program: ProgramWithBalance;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { tr, locale } = useI18n();
  const options = programFundingSourceOptions.filter(option => option.value !== "CAMPURAN" &&
    (program.sumberDana === "CAMPURAN" || option.value === program.sumberDana));
  return (
    <div className="space-y-2">
      <Label htmlFor="ex-funding-source">{tr("Sumber Dana Pengeluaran *")}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="ex-funding-source" aria-required="true">
          <SelectValue placeholder={tr("Pilih sumber dana pengeluaran program")} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {tr(option.label)} — {formatRupiah(option.value === "INTERNAL" ? program.internal.balance : program.fundraising.balance, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

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
  const { tr, locale } = useI18n();
  const expensePocketOptions = localizeLabels(__expensePocketOptions, tr);
  const expenseCoaOptions = localizeLabels(__expenseCoaOptions, tr);
  const expenseCoaHint = localizeLabels(__expenseCoaHint, tr);

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const proofRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState("");
  const [accountId, setAccountId] = useState(NONE);
  const [pocket, setPocket] = useState(NONE);
  const [programId, setProgramId] = useState(NONE);
  const [sumberDana, setSumberDana] = useState<ProgramExpenseSource | "NONE">("NONE");
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
      : isRestricted && selectedProgram && sumberDana !== "NONE"
        ? (sumberDana === "INTERNAL" ? selectedProgram.internal.balance : selectedProgram.fundraising.balance)
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
    if (!date) return toast.error(tr("Tanggal pengeluaran wajib diisi"));
    if (accountId === NONE) return toast.error(tr("Pilih sumber rekening kas"));
    if (pocket === NONE) return toast.error(tr("Pilih kantong dana"));
    if (isRestricted && programId === NONE)
      return toast.error(tr("Pilih program untuk beban dana terikat"));
    if (isRestricted && sumberDana === "NONE")
      return toast.error(tr("Pilih sumber dana pengeluaran program"));
    if (coa === NONE) return toast.error(tr("Pilih kategori biaya (COA)"));
    if (coa === "BEBAN_PROGRAM" && !childId && beneficiaryName.trim() === "")
      return toast.error(
        tr("Penerima manfaat wajib untuk Beban Program & Penyaluran")
      );
    if (amountNum <= 0)
      return toast.error(tr("Nilai pencairan harus lebih dari 0"));
    if (insufficient) return toast.error(tr("Saldo tidak cukup"));
    const proof = proofRef.current?.files?.[0];
    if (!proof) return toast.error(tr("Bukti dokumen wajib diunggah"));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("date", date);
      formData.set("accountId", accountId);
      formData.set("pocket", pocket);
      if (isRestricted) {
        formData.set("programId", programId);
        formData.set("sumberDana", sumberDana);
      }
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
        toast.success(tr("Voucher dibuat — {0} (Draft)", { "0": result.voucherNumber }));
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
          {tr("Formulir Kas Keluar (Kredit)")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {tr("Nomor voucher dibuat otomatis (PV/YYS/TAHUN/BULAN/XXX). Voucher baru berstatus Draft dan harus melewati alur persetujuan.")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="ex-date">{tr("Tanggal Pengeluaran *")}</Label>
            <Input
              id="ex-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>{tr("Sumber Rekening Kas *")}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={tr("Pilih rekening")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  {tr("Pilih rekening")}</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} {tr(" (Saldo: ")}{formatRupiah(a.balance, locale)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{tr("Dipotong Dari Kantong Dana *")}</Label>
          <Select
            value={pocket}
            onValueChange={(v) => {
              setPocket(v);
              setSumberDana("NONE");
              if (v !== "TERIKAT") setProgramId(NONE);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={tr("Pilih kantong dana")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                {tr("Pilih kantong dana")}</SelectItem>
              {expensePocketOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.value === "TERIKAT" ? tr("Saldo Dana Program") : tr(o.label)}
                  {o.value === "TIDAK_TERIKAT"
                    ? ` — ${formatRupiah(unrestrictedBalance, locale)}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Beban program terikat — kondisional */}
        <div className="space-y-2">
          <Label className={isRestricted ? "" : "text-muted-foreground"}>
            {tr("Program Tujuan Pengeluaran")}{" "}
            {isRestricted ? "*" : tr("(pilih kantong program terlebih dahulu)")}
          </Label>
          <Select
            value={programId}
            onValueChange={value => { setProgramId(value); setSumberDana("NONE"); }}
            disabled={!isRestricted}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isRestricted
                    ? tr("Pilih program")
                    : tr("Pilih kantong program terlebih dahulu")
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                {tr("Pilih program")}</SelectItem>
              {programs.length === 0 ? (
                <SelectItem value="EMPTY" disabled>
                  {tr("Belum ada program dengan saldo")}</SelectItem>
              ) : (
                programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {tr(" (Sisa Saldo: ")}{formatRupiah(p.balance, locale)})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {isRestricted && selectedProgram && (
          <ProgramExpenseSourceSelect program={selectedProgram} value={sumberDana} disabled={isPending}
            onChange={value => { if (value === "INTERNAL" || value === "PENGGALANGAN") setSumberDana(value); }} />
        )}

        <div className="space-y-2">
          <Label>{tr("Kategori Biaya (COA) *")}</Label>
          <Select value={coa} onValueChange={setCoa}>
            <SelectTrigger>
              <SelectValue placeholder={tr("Pilih kategori biaya")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                {tr("Pilih kategori biaya")}</SelectItem>
              {expenseCoaOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {tr(o.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {coa !== NONE && (
            <p className="text-xs text-muted-foreground">
              {tr("Contoh: ")}{expenseCoaHint[coa as ExpenseCoa]}
            </p>
          )}
        </div>

        {/* Penerima manfaat */}
        <div className="space-y-2">
          <Label>
            {tr("Nama Penerima Manfaat")}{" "}
            <span className="font-normal text-muted-foreground">
              {tr("(wajib untuk Beban Program & Penyaluran)")}</span>
          </Label>
          {selectedChild ? (
            <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 px-3 py-2.5">
              <span className="text-sm font-medium">
                {selectedChild.fullName}{" "}
                <span className="text-xs text-muted-foreground">
                  {tr("(anak asuh)")}</span>
              </span>
              <button
                type="button"
                onClick={() => setChildId("")}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={tr("Ganti penerima")}
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
                placeholder={tr("Ketik nama anak asuh, atau nama vendor/pihak ketiga")}
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
                        {tr("(anak asuh)")}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ex-amount">{tr("Nilai Pencairan (Rp) *")}</Label>
          <Input
            id="ex-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={tr("mis. 250000")}
          />
          {pocketBalance !== null && (
            <p className="text-xs text-muted-foreground">
              {tr("Sisa saldo kantong terpilih: ")}{formatRupiah(pocketBalance, locale)}
            </p>
          )}
          {insufficient && (
            <p className="flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tr("Saldo tidak cukup — tombol simpan dikunci")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ex-proof">
            {tr("Unggah Bukti Dokumen *")}{" "}
            <span className="font-normal text-muted-foreground">
              {tr("(PDF/JPG/PNG maks 5MB — nota, kuitansi, foto penyerahan)")}</span>
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
          {tr("Alur persetujuan: ")}<b>{tr("Draft")}</b> {tr(" (staf admin) → ")}<b>{tr("Menunggu Review")}</b>{" "}
          {tr("(Bendahara) → ")}<b>{tr("Menunggu Approval")}</b> {tr(" (Ketua/Dewan Pembina) →")}{" "}
          <b>{tr("Selesai / Dana Cair")}</b>.
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/finance/expense")}
            disabled={isPending}
          >
            {tr("Batal")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !date ||
              accountId === NONE ||
              pocket === NONE ||
              (isRestricted && (programId === NONE || sumberDana === "NONE")) ||
              coa === NONE ||
              amountNum <= 0 ||
              insufficient ||
              !hasProof
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menyimpan...")}</>
            ) : (
              tr("Buat Voucher (Draft)")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const __expensePocketOptions = expensePocketOptions;
const __expenseCoaOptions = expenseCoaOptions;
const __expenseCoaHint = expenseCoaHint;
