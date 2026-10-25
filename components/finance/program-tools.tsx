"use client";

import React, { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

import {
  createProgram,
  updateProgram,
  deleteProgram,
} from "@/lib/actions/program";
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
import {
  programFieldOptions,
  programFundingSourceOptions,
  programStatusOptions,
  leftoverRuleOptions,
} from "@/components/finance/finance-labels";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";
import { getSchemas } from "@/lib/validations";
import { useManagedFormUploads } from "@/components/shared/use-managed-form-uploads";
import { MANAGED_FORM_FIELDS } from "@/lib/storage-contract";


const NONE = "NONE";

export type StaffOption = { id: string; name: string };

export type ProgramData = {
  id: string;
  code: string;
  name: string;
  field: string;
  fundraisingTarget: number;
  maxBudget: number;
  startDate: string | null; // yyyy-mm-dd
  picId: string | null;
  status: string;
  leftoverRule: string;
  description: string | null;
};

type FundingFormValues = {
  sumberDana: string;
  fundraisingTarget: string;
  alokasiDanaInternal: string;
  porsiPenggalangan: string;
};
type FundingField = keyof FundingFormValues;
type FundingErrors = Partial<Record<FundingField, string>>;
const fundingFieldIds: Record<FundingField, string> = {
  sumberDana: "prg-funding-source",
  fundraisingTarget: "prg-target",
  alokasiDanaInternal: "prg-internal-allocation",
  porsiPenggalangan: "prg-fundraising-share",
};

export function ProgramFundingFields({
  values, onChange, errors = {}, disabled = false,
}: {
  values: FundingFormValues;
  onChange: (field: FundingField, value: string) => void;
  errors?: FundingErrors;
  disabled?: boolean;
}) {
  const { tr, locale } = useI18n();
  const mixed = values.sumberDana === "CAMPURAN";
  const showFundraising = mixed || values.sumberDana === "PENGGALANGAN";
  const showInternal = mixed || values.sumberDana === "INTERNAL";
  const share = Number(values.porsiPenggalangan);
  const validShare = values.porsiPenggalangan.trim() !== "" && Number.isFinite(share) && share >= 0 && share <= 100;
  const internalShare = new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID", {
    maximumFractionDigits: 2,
  }).format(100 - share);
  const errorProps = (field: FundingField) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${fundingFieldIds[field]}-error` : undefined,
  });
  const errorMessage = (field: FundingField) => errors[field] ? (
    <p id={`${fundingFieldIds[field]}-error`} role="alert" className="text-sm text-destructive">
      {errors[field]}
    </p>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={fundingFieldIds.sumberDana}>{tr("Sumber Pendanaan *")}</Label>
        <Select value={values.sumberDana} onValueChange={value => onChange("sumberDana", value)} disabled={disabled}>
          <SelectTrigger id={fundingFieldIds.sumberDana} aria-required="true" {...errorProps("sumberDana")}>
            <SelectValue placeholder={tr("Pilih sumber pendanaan")} />
          </SelectTrigger>
          <SelectContent>
            {programFundingSourceOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>{tr(option.label)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorMessage("sumberDana")}
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        {showFundraising && (
          <div className="flex-1 space-y-2">
            <Label htmlFor={fundingFieldIds.fundraisingTarget}>{tr("Target Penggalangan Dana (Rp)")}</Label>
            <Input id={fundingFieldIds.fundraisingTarget} name="fundraisingTarget" type="number" min={0}
              value={values.fundraisingTarget} onChange={event => onChange("fundraisingTarget", event.target.value)}
              placeholder="0" disabled={disabled} {...errorProps("fundraisingTarget")} />
            {errorMessage("fundraisingTarget")}
          </div>
        )}
        {showInternal && (
          <div className="flex-1 space-y-2">
            <Label htmlFor={fundingFieldIds.alokasiDanaInternal}>{tr("Alokasi Dana Internal (Rp)")}</Label>
            <Input id={fundingFieldIds.alokasiDanaInternal} name="alokasiDanaInternal" type="number" min={0}
              value={values.alokasiDanaInternal} onChange={event => onChange("alokasiDanaInternal", event.target.value)}
              placeholder="0" disabled={disabled} {...errorProps("alokasiDanaInternal")} />
            {errorMessage("alokasiDanaInternal")}
          </div>
        )}
      </div>
      {mixed && (
        <div className="space-y-2">
          <Label htmlFor={fundingFieldIds.porsiPenggalangan}>{tr("Porsi Penggalangan (%)")}</Label>
          <Input id={fundingFieldIds.porsiPenggalangan} name="porsiPenggalangan" type="number" min={0} max={100} step="0.01"
            value={values.porsiPenggalangan} onChange={event => onChange("porsiPenggalangan", event.target.value)}
            aria-required="true" disabled={disabled} {...errorProps("porsiPenggalangan")} />
          {errorMessage("porsiPenggalangan")}
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {validShare ? tr("Porsi dana internal: {0}%", { 0: internalShare }) : tr("Isi porsi penggalangan antara 0–100%.")}
          </p>
        </div>
      )}
      {showInternal && (
        <p className="text-sm text-muted-foreground">
          {tr("Alokasi internal dipindahkan dari saldo dana tidak terikat saat program disimpan.")}
        </p>
      )}
    </div>
  );
}

function ProgramFormDialog({
  mode,
  program,
  staffOptions,
}: {
  mode: "create" | "edit";
  program?: ProgramData;
  staffOptions: StaffOption[];
}) {
  const { tr, locale } = useI18n();
  const programFieldOptions = localizeLabels(__programFieldOptions, tr);
  const programStatusOptions = localizeLabels(__programStatusOptions, tr);
  const leftoverRuleOptions = localizeLabels(__leftoverRuleOptions, tr);

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();
  const uploads = useManagedFormUploads(MANAGED_FORM_FIELDS.program, mode === "edit" ? program?.id : undefined);
  const isPending = isTransitionPending || uploads.isPending;
  const proposalRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(program?.name ?? "");
  const [field, setField] = useState(program?.field ?? NONE);
  const [fundraisingTarget, setFundraisingTarget] = useState(
    program ? String(program.fundraisingTarget) : ""
  );
  const [maxBudget, setMaxBudget] = useState(
    program ? String(program.maxBudget) : ""
  );
  const [startDate, setStartDate] = useState(program?.startDate ?? "");
  const [picId, setPicId] = useState(program?.picId ?? NONE);
  const [status, setStatus] = useState(program?.status ?? "DRAFT");
  const [leftoverRule, setLeftoverRule] = useState(
    program?.leftoverRule ?? "KE_OPERASIONAL"
  );
  const [description, setDescription] = useState(program?.description ?? "");
  const [fundingValues, setFundingValues] = useState<FundingFormValues>({
    sumberDana: "", fundraisingTarget: "", alokasiDanaInternal: "", porsiPenggalangan: "",
  });
  const [fundingErrors, setFundingErrors] = useState<FundingErrors>({});

  function handleSubmit() {
    const funding = mode === "create"
      ? getSchemas(locale).programFundingSchema.safeParse(fundingValues)
      : null;
    if (funding && !funding.success) {
      const errors: FundingErrors = {};
      for (const issue of funding.error.issues) {
        const field = issue.path[0] as FundingField;
        errors[field] ??= issue.message;
      }
      setFundingErrors(errors);
      const first = funding.error.issues[0].path[0] as FundingField;
      document.getElementById(fundingFieldIds[first])?.focus();
      return;
    }
    setFundingErrors({});
    if (name.trim().length < 3) {
      toast.error(tr("Nama program minimal 3 karakter"));
      return;
    }
    if (field === NONE) {
      toast.error(tr("Pilih kategori bidang"));
      return;
    }
    if (picId === NONE) {
      toast.error(tr("Pilih penanggung jawab"));
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("field", field);
      formData.set("fundraisingTarget", fundraisingTarget || "0");
      if (funding?.success) {
        for (const [key, value] of Object.entries(funding.data)) {
          if (value !== null) formData.set(key, String(value));
        }
      }
      formData.set("maxBudget", maxBudget || "0");
      if (startDate) formData.set("startDate", startDate);
      formData.set("picId", picId);
      formData.set("status", status);
      formData.set("leftoverRule", leftoverRule);
      formData.set("description", description);
      const proposal = proposalRef.current?.files?.[0];
      if (proposal) formData.set("proposal", proposal);

      const result = await uploads.submit(formData, prepared =>
        mode === "create" ? createProgram(prepared) : updateProgram(program!.id, prepared));

      if (result.success) {
        toast.success(
          mode === "create" ? tr("Program berhasil dibuat") : tr("Program diperbarui")
        );
        if (result.warning) toast.warning(result.warning);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!isPending) { setOpen(value); if (!value) uploads.reset(); } }}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {tr("Buat Program")}</Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" title={tr("Edit")}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{tr("Edit program ")}{program?.name}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? tr("Buat Program Baru") : tr("Edit {0}", { "0": program?.code })}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? tr("Kode program akan dibuat otomatis (PRG/TAHUN/XXX).")
              : tr("Perbarui detail program.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {mode === "create" && (
            <ProgramFundingFields values={fundingValues} errors={fundingErrors} disabled={isPending}
              onChange={(field, value) => {
                setFundingValues(current => ({ ...current, [field]: value }));
                setFundingErrors({});
              }} />
          )}
          <div className="space-y-2">
            <Label htmlFor="prg-name">{tr("Nama Program *")}</Label>
            <Input
              id="prg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("mis. Beasiswa Anak Berprestasi 2026")}
            />
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label>{tr("Kategori Bidang *")}</Label>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih bidang")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>
                    {tr("Pilih bidang")}</SelectItem>
                  {programFieldOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {tr(o.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label>{tr("Status Program")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {programStatusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {tr(o.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            {mode === "edit" && (
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="prg-target">{tr("Target Penggalangan Dana (Rp)")}</Label>
              <Input
                id="prg-target"
                type="number"
                min={0}
                value={fundraisingTarget}
                onChange={(e) => setFundraisingTarget(e.target.value)}
                placeholder="0"
              />
            </div>
            )}
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="prg-budget">{tr("Anggaran Biaya Maksimal (Rp)")}</Label>
              <Input
                id="prg-budget"
                type="number"
                min={0}
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="prg-start">{tr("Tanggal Mulai Program")}</Label>
              <Input
                id="prg-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label>{tr("Penanggung Jawab *")}</Label>
              <Select value={picId} onValueChange={setPicId}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih penanggung jawab")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>
                    {tr("Pilih penanggung jawab")}</SelectItem>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tr("Aturan Sisa Dana")}</Label>
            <Select value={leftoverRule} onValueChange={setLeftoverRule}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leftoverRuleOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {tr(o.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prg-desc">{tr("Deskripsi & Tujuan")}</Label>
            <Textarea
              id="prg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr("Jelaskan latar belakang, tujuan, dan sasaran program...")}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prg-proposal">
              {tr("Upload Proposal")}{" "}
              <span className="font-normal text-muted-foreground">
                {tr("(opsional, PDF maks 10MB)")}</span>
            </Label>
            <Input
              id="prg-proposal"
              ref={proposalRef}
              disabled={isPending}
              type="file"
              accept="application/pdf"
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            />
          </div>
        </div>

        {uploads.progress !== null && <progress className="w-full" max={100} value={uploads.progress} aria-label={locale === "en" ? "Upload progress" : "Progres unggahan"} />}
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
              name.trim().length < 3 ||
              field === NONE ||
              picId === NONE
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menyimpan...")}</>
            ) : mode === "create" ? (
              tr("Simpan Program")
            ) : (
              tr("Simpan Perubahan")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddProgramDialog({
  staffOptions,
}: {
  staffOptions: StaffOption[];
}) {
  return <ProgramFormDialog mode="create" staffOptions={staffOptions} />;
}

export function EditProgramDialog({
  program,
  staffOptions,
}: {
  program: ProgramData;
  staffOptions: StaffOption[];
}) {
  return (
    <ProgramFormDialog
      mode="edit"
      program={program}
      staffOptions={staffOptions}
    />
  );
}

export function DeleteProgramButton({
  programId,
  programName,
}: {
  programId: string;
  programName: string;
}) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProgram(programId);
      if (result.success) {
        toast.success(tr("Program {0} dihapus", { "0": programName }));
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          title={tr("Hapus")}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{tr("Hapus program ")}{programName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("Hapus Program?")}</DialogTitle>
          <DialogDescription>
            {tr("Program ")}<b>{programName}</b> {tr(" akan dihapus. Program yang sudah punya transaksi tidak bisa dihapus.")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {tr("Batal")}</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menghapus...")}</>
            ) : (
              tr("Ya, Hapus")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const __programFieldOptions = programFieldOptions;
const __programStatusOptions = programStatusOptions;
const __leftoverRuleOptions = leftoverRuleOptions;
