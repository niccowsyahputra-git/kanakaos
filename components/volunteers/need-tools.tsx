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
import { useI18n } from "@/lib/i18n/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VOLUNTEER_FIELDS, VOLUNTEER_FIELD_CODES, NEED_STATUSES, NEED_STATUS_LABELS, type VolunteerField } from "@/lib/option-catalogs";
import { getSchemas } from "@/lib/validations";


export type EditableNeed = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  schedule: string | null;
  field: string | null;
  otherField: string | null;
  startDate: string | null;
  endDate: string | null;
};

function toFormState(need?: EditableNeed) {
  return {
    field: need?.field ?? (need ? VOLUNTEER_FIELD_CODES.find(code => VOLUNTEER_FIELDS[code] === need.title) ?? "OTHER" : ""),
    otherField: need?.otherField ?? (need && !need.field ? need.title : ""),
    startDate: need?.startDate ?? "",
    endDate: need?.endDate ?? "",
    description: need?.description ?? "",
    quantity: need ? String(need.quantity) : "1",
    schedule: need?.schedule ?? "",
  };
}

/** Dialog tambah (tanpa need) atau edit (dengan need) kebutuhan relawan */
export function NeedFormDialog({ need }: { need?: EditableNeed }) {
  const { tr, locale } = useI18n();

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
      const parsed = getSchemas(locale).volunteerNeedSchema.safeParse(form);
      if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
      const values = parsed.data;
      const result = need
        ? await updateVolunteerNeed(need.id, values)
        : await createVolunteerNeed(values);
      if (result.success) {
        toast.success(
          isEdit ? tr("Kebutuhan relawan diperbarui") : tr("Kebutuhan relawan dibuka")
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
            {tr("Edit")}</Button>
        ) : (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {tr("Tambah Kebutuhan")}</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tr("Edit Kebutuhan Relawan") : tr("Tambah Kebutuhan Relawan")}
          </DialogTitle>
          <DialogDescription>
            {tr("Kebutuhan berstatus OPEN tampil di halaman publik pendaftaran relawan.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor={`need-title-${fieldId}`}>{tr("Bidang")}</Label>
            <Select value={form.field} onValueChange={v => set("field", v)}>
              <SelectTrigger id={`need-title-${fieldId}`} className="h-auto min-h-10 [&>span]:whitespace-normal [&>span]:text-left"><SelectValue placeholder={tr("Pilih bidang")} /></SelectTrigger>
              <SelectContent>{VOLUNTEER_FIELD_CODES.map(code => <SelectItem key={code} value={code}>{tr(VOLUNTEER_FIELDS[code])}</SelectItem>)}<SelectItem value="OTHER">{tr("Lainnya")}</SelectItem></SelectContent>
            </Select>
            {form.field === "OTHER" && <div className="space-y-2"><Label htmlFor={`need-other-${fieldId}`}>{tr("Bidang lainnya")}</Label><Input id={`need-other-${fieldId}`} value={form.otherField} onChange={e => set("otherField", e.target.value)} /></div>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor={`need-start-${fieldId}`}>{tr("Tanggal Mulai")}</Label><Input id={`need-start-${fieldId}`} type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor={`need-end-${fieldId}`}>{tr("Tanggal Akhir")}</Label><Input id={`need-end-${fieldId}`} type="date" min={form.startDate} value={form.endDate} onChange={e => set("endDate", e.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`need-qty-${fieldId}`}>{tr("Jumlah Dibutuhkan")}</Label>
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
              <Label htmlFor={`need-schedule-${fieldId}`}>{tr("Jadwal")}</Label>
              <Input
                id={`need-schedule-${fieldId}`}
                value={form.schedule}
                onChange={(e) => set("schedule", e.target.value)}
                placeholder={tr("Contoh: Sabtu, 09.00-12.00")}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`need-desc-${fieldId}`}>{tr("Deskripsi / Kriteria")}</Label>
            <Textarea
              id={`need-desc-${fieldId}`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={tr("Tugas, kriteria, atau keterangan tambahan")}
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
            {tr("Batal")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menyimpan...")}</>
            ) : (
              tr("Simpan")
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
  status: typeof NEED_STATUSES[number];
}) {
  const { tr, locale } = useI18n();

  const [isPending, startTransition] = useTransition();
  function handleChange(value: typeof NEED_STATUSES[number]) {
    startTransition(async () => {
      const result = await setVolunteerNeedStatus(
        needId,
        value
      );
      if (result.success) {
        toast.success(
          tr("Status kebutuhan diperbarui")
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Select value={status} disabled={isPending} onValueChange={value => handleChange(value as typeof NEED_STATUSES[number])}>
      <SelectTrigger className="h-8 w-36" aria-label={`${tr("Status")}: ${title}`}><SelectValue /></SelectTrigger>
      <SelectContent>{NEED_STATUSES.map(value => <SelectItem value={value} key={value}>{tr(NEED_STATUS_LABELS[value])}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function DeleteNeedButton({
  needId,
  title,
}: {
  needId: string;
  title: string;
}) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVolunteerNeed(needId);
      if (result.success) {
        toast.success(tr("Kebutuhan {0} dihapus", { "0": title }));
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
          title={tr("Hapus kebutuhan")}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{tr("Hapus ")}{title}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("Hapus Kebutuhan?")}</DialogTitle>
          <DialogDescription>
            {tr("Kebutuhan ")}<b>{title}</b> {tr(" akan dihapus permanen. Jika sudah ada pendaftar, gunakan ")}<b>{tr("Tutup")}</b> {tr(" agar riwayat tetap tersimpan.")}</DialogDescription>
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
