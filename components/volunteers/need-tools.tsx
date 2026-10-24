"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Lock,
  LockOpen,
} from "lucide-react";

import {
  createVolunteerNeed,
  updateVolunteerNeed,
  setVolunteerNeedStatus,
  deleteVolunteerNeed,
} from "@/lib/actions/volunteer-need";
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

export type EditableNeed = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  schedule: string | null;
};

function toFormState(need?: EditableNeed) {
  return {
    title: need?.title ?? "",
    description: need?.description ?? "",
    quantity: need ? String(need.quantity) : "1",
    schedule: need?.schedule ?? "",
  };
}

/** Dialog tambah (tanpa need) atau edit (dengan need) kebutuhan relawan */
export function NeedFormDialog({ need }: { need?: EditableNeed }) {
  const isEdit = Boolean(need);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toFormState(need));
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) setForm(toFormState(need));
    setOpen(next);
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    startTransition(async () => {
      const values = { ...form, quantity: Number(form.quantity) };
      const result = need
        ? await updateVolunteerNeed(need.id, values)
        : await createVolunteerNeed(values);
      if (result.success) {
        toast.success(
          isEdit ? "Kebutuhan relawan diperbarui" : "Kebutuhan relawan dibuka"
        );
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  const fieldId = need?.id ?? "new";
  const quantity = Number(form.quantity);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Tambah Kebutuhan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Kebutuhan Relawan" : "Tambah Kebutuhan Relawan"}
          </DialogTitle>
          <DialogDescription>
            Kebutuhan berstatus OPEN tampil di halaman publik pendaftaran
            relawan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor={`need-title-${fieldId}`}>Bidang</Label>
            <Input
              id={`need-title-${fieldId}`}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Contoh: Pengajar Matematika SD"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`need-qty-${fieldId}`}>Jumlah Dibutuhkan</Label>
              <Input
                id={`need-qty-${fieldId}`}
                type="number"
                min={1}
                max={1000}
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`need-schedule-${fieldId}`}>Jadwal</Label>
              <Input
                id={`need-schedule-${fieldId}`}
                value={form.schedule}
                onChange={(e) => set("schedule", e.target.value)}
                placeholder="Contoh: Sabtu, 09.00-12.00"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`need-desc-${fieldId}`}>Deskripsi / Kriteria</Label>
            <Textarea
              id={`need-desc-${fieldId}`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Tugas, kriteria, atau keterangan tambahan"
              rows={3}
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
              form.title.trim().length < 3 ||
              !Number.isInteger(quantity) ||
              quantity < 1
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tutup kebutuhan (CLOSED) atau buka kembali (OPEN) */
export function NeedStatusButton({
  needId,
  title,
  status,
}: {
  needId: string;
  title: string;
  status: "OPEN" | "CLOSED";
}) {
  const [isPending, startTransition] = useTransition();
  const isOpen = status === "OPEN";

  function handleToggle() {
    startTransition(async () => {
      const result = await setVolunteerNeedStatus(
        needId,
        isOpen ? "CLOSED" : "OPEN"
      );
      if (result.success) {
        toast.success(
          isOpen ? `Kebutuhan ${title} ditutup` : `Kebutuhan ${title} dibuka kembali`
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className={
        isOpen
          ? "h-8 gap-1 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          : "h-8 gap-1 text-green-700 hover:bg-green-50 hover:text-green-800"
      }
      onClick={handleToggle}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isOpen ? (
        <Lock className="h-3.5 w-3.5" />
      ) : (
        <LockOpen className="h-3.5 w-3.5" />
      )}
      {isOpen ? "Tutup" : "Buka Lagi"}
    </Button>
  );
}

export function DeleteNeedButton({
  needId,
  title,
}: {
  needId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVolunteerNeed(needId);
      if (result.success) {
        toast.success(`Kebutuhan ${title} dihapus`);
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
          title="Hapus kebutuhan"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Hapus {title}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hapus Kebutuhan?</DialogTitle>
          <DialogDescription>
            Kebutuhan <b>{title}</b> akan dihapus permanen. Jika sudah ada
            pendaftar, gunakan <b>Tutup</b> agar riwayat tetap tersimpan.
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
