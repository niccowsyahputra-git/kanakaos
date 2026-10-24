"use client";

import { useRef, useState, useTransition } from "react";
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
  programStatusOptions,
  leftoverRuleOptions,
} from "@/components/finance/finance-labels";

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

function ProgramFormDialog({
  mode,
  program,
  staffOptions,
}: {
  mode: "create" | "edit";
  program?: ProgramData;
  staffOptions: StaffOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
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

  function handleSubmit() {
    if (name.trim().length < 3) {
      toast.error("Nama program minimal 3 karakter");
      return;
    }
    if (field === NONE) {
      toast.error("Pilih kategori bidang");
      return;
    }
    if (picId === NONE) {
      toast.error("Pilih penanggung jawab");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("field", field);
      formData.set("fundraisingTarget", fundraisingTarget || "0");
      formData.set("maxBudget", maxBudget || "0");
      if (startDate) formData.set("startDate", startDate);
      formData.set("picId", picId);
      formData.set("status", status);
      formData.set("leftoverRule", leftoverRule);
      formData.set("description", description);
      const proposal = proposalRef.current?.files?.[0];
      if (proposal) formData.set("proposal", proposal);

      const result =
        mode === "create"
          ? await createProgram(formData)
          : await updateProgram(program!.id, formData);

      if (result.success) {
        toast.success(
          mode === "create" ? "Program berhasil dibuat" : "Program diperbarui"
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Buat Program
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit program {program?.name}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Buat Program Baru" : `Edit ${program?.code}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Kode program akan dibuat otomatis (PRG/TAHUN/XXX)."
              : "Perbarui detail program."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="prg-name">Nama Program *</Label>
            <Input
              id="prg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Beasiswa Anak Berprestasi 2026"
            />
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label>Kategori Bidang *</Label>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bidang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>
                    Pilih bidang
                  </SelectItem>
                  {programFieldOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label>Status Program</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {programStatusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="prg-target">Target Penggalangan Dana (Rp)</Label>
              <Input
                id="prg-target"
                type="number"
                min={0}
                value={fundraisingTarget}
                onChange={(e) => setFundraisingTarget(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="prg-budget">Anggaran Biaya Maksimal (Rp)</Label>
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
              <Label htmlFor="prg-start">Tanggal Mulai Program</Label>
              <Input
                id="prg-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label>Penanggung Jawab *</Label>
              <Select value={picId} onValueChange={setPicId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih penanggung jawab" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>
                    Pilih penanggung jawab
                  </SelectItem>
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
            <Label>Aturan Sisa Dana</Label>
            <Select value={leftoverRule} onValueChange={setLeftoverRule}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leftoverRuleOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prg-desc">Deskripsi &amp; Tujuan</Label>
            <Textarea
              id="prg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan latar belakang, tujuan, dan sasaran program..."
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prg-proposal">
              Upload Proposal{" "}
              <span className="font-normal text-muted-foreground">
                (opsional, PDF maks 10MB)
              </span>
            </Label>
            <Input
              id="prg-proposal"
              ref={proposalRef}
              type="file"
              accept="application/pdf"
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
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
              name.trim().length < 3 ||
              field === NONE ||
              picId === NONE
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : mode === "create" ? (
              "Simpan Program"
            ) : (
              "Simpan Perubahan"
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
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProgram(programId);
      if (result.success) {
        toast.success(`Program ${programName} dihapus`);
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
          title="Hapus"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Hapus program {programName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hapus Program?</DialogTitle>
          <DialogDescription>
            Program <b>{programName}</b> akan dihapus. Program yang sudah punya
            transaksi tidak bisa dihapus.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              "Ya, Hapus"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
