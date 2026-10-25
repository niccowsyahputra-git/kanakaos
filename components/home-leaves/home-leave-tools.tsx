"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Search, X } from "lucide-react";

import {
  createHomeLeave,
  updateHomeLeave,
  deleteHomeLeave,
} from "@/lib/actions/homeLeave";
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
import { homeLeaveReasonOptions } from "@/components/home-leaves/home-leave-labels";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


const NONE = "NONE";

export type ChildOption = { id: string; fullName: string };

export type HomeLeaveData = {
  id: string;
  childId: string;
  childName: string;
  leaveDate: string; // yyyy-mm-dd
  plannedReturnDate: string | null;
  actualReturnDate: string | null;
  reason: string;
  description: string | null;
};

function HomeLeaveFormDialog({
  mode,
  leave,
  childrenOptions,
  activeChildIds,
}: {
  mode: "create" | "edit";
  leave?: HomeLeaveData;
  childrenOptions: ChildOption[];
  /** Anak yang sedang pulang (belum kembali) — tidak boleh dicatat lagi */
  activeChildIds: string[];
}) {
  const { tr, locale } = useI18n();
  const homeLeaveReasonOptions = localizeLabels(__homeLeaveReasonOptions, tr);

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [childId, setChildId] = useState(leave?.childId ?? "");
  const [childQuery, setChildQuery] = useState("");
  const [leaveDate, setLeaveDate] = useState(leave?.leaveDate ?? "");
  const [plannedReturnDate, setPlannedReturnDate] = useState(
    leave?.plannedReturnDate ?? ""
  );
  const [actualReturnDate, setActualReturnDate] = useState(
    leave?.actualReturnDate ?? ""
  );
  const [reason, setReason] = useState(leave?.reason ?? NONE);
  const [description, setDescription] = useState(leave?.description ?? "");

  const selectedChild = childrenOptions.find((c) => c.id === childId);
  const searchResults =
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
          .slice(0, 8);

  function isChildOnLeave(id: string) {
    // Anak di catatan yang sedang diedit tidak dihitung bentrok dgn dirinya
    return activeChildIds.includes(id) && id !== leave?.childId;
  }

  function resetForm() {
    setChildId("");
    setChildQuery("");
    setLeaveDate("");
    setPlannedReturnDate("");
    setActualReturnDate("");
    setReason(NONE);
    setDescription("");
  }

  function handleSubmit() {
    if (!childId) {
      toast.error(tr("Pilih anak terlebih dahulu"));
      return;
    }
    if (!leaveDate) {
      toast.error(tr("Tanggal kepulangan wajib diisi"));
      return;
    }
    if (reason === NONE) {
      toast.error(tr("Pilih tujuan kepulangan"));
      return;
    }
    if (plannedReturnDate && plannedReturnDate < leaveDate) {
      toast.error(tr("Rencana kembali tidak boleh sebelum tanggal kepulangan"));
      return;
    }
    if (actualReturnDate && actualReturnDate < leaveDate) {
      toast.error(
        tr("Tanggal aktual kembali tidak boleh sebelum tanggal kepulangan")
      );
      return;
    }

    startTransition(async () => {
      const values = {
        childId,
        leaveDate: new Date(leaveDate),
        plannedReturnDate: plannedReturnDate
          ? new Date(plannedReturnDate)
          : undefined,
        actualReturnDate: actualReturnDate
          ? new Date(actualReturnDate)
          : undefined,
        reason: reason as "SAKIT",
        description,
      };

      const result =
        mode === "create"
          ? await createHomeLeave(values)
          : await updateHomeLeave(leave!.id, values);

      if (result.success) {
        toast.success(
          mode === "create"
            ? tr("Kepulangan anak tercatat")
            : tr("Data kepulangan diperbarui")
        );
        if (mode === "create") resetForm();
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
            {tr("Catat Kepulangan")}</Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" title={tr("Edit")}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{tr("Edit kepulangan ")}{leave?.childName}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? tr("Catat Kepulangan Anak") : tr("Edit Kepulangan")}
          </DialogTitle>
          <DialogDescription>
            {tr("Anak yang belum kembali tidak bisa dicatat pulang lagi. Status kembali dihitung otomatis dari rencana vs tanggal aktual.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Pilih anak: search + single select */}
          <div className="space-y-2">
            <Label htmlFor="hl-child-search">{tr("Nama Anak *")}</Label>
            {selectedChild ? (
              <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 px-3 py-2.5">
                <span className="text-sm font-medium">
                  {selectedChild.fullName}
                </span>
                <button
                  type="button"
                  onClick={() => setChildId("")}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={tr("Ganti anak")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="hl-child-search"
                    value={childQuery}
                    onChange={(e) => setChildQuery(e.target.value)}
                    placeholder={
                      childrenOptions.length === 0
                        ? tr("Belum ada data anak")
                        : tr("Ketik nama anak untuk mencari...")
                    }
                    autoComplete="off"
                    disabled={childrenOptions.length === 0}
                    className="pl-9"
                  />
                </div>
                {childQuery.trim() !== "" && (
                  <div className="max-h-44 overflow-y-auto rounded-md border">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        {tr("Tidak ada anak yang cocok.")}</p>
                    ) : (
                      searchResults.map((child) => {
                        const onLeave = isChildOnLeave(child.id);
                        return (
                          <button
                            type="button"
                            key={child.id}
                            disabled={onLeave}
                            onClick={() => {
                              setChildId(child.id);
                              setChildQuery("");
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                              {child.fullName}
                            </span>
                            {onLeave && (
                              <span className="shrink-0 text-xs text-amber-600">
                                {tr("sedang pulang — belum kembali")}</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="hl-leave-date">{tr("Tanggal Kepulangan *")}</Label>
              <Input
                id="hl-leave-date"
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="hl-planned-date">
                {tr("Rencana Tanggal Kembali")}{" "}
                <span className="font-normal text-muted-foreground">
                  {tr("(opsional)")}</span>
              </Label>
              <Input
                id="hl-planned-date"
                type="date"
                value={plannedReturnDate}
                onChange={(e) => setPlannedReturnDate(e.target.value)}
                min={leaveDate || undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hl-actual-date">
              {tr("Tanggal Aktual Kembali")}{" "}
              <span className="font-normal text-muted-foreground">
                {tr("(isi saat anak sudah tiba di panti)")}</span>
            </Label>
            <Input
              id="hl-actual-date"
              type="date"
              value={actualReturnDate}
              onChange={(e) => setActualReturnDate(e.target.value)}
              min={leaveDate || undefined}
              className="md:w-1/2"
            />
            <p className="text-xs text-muted-foreground">
              {tr("Lebih cepat dari rencana → \"Kembali Lebih Cepat\"; lewat dari rencana → \"Kembali Terlambat\".")}</p>
          </div>

          <div className="space-y-2">
            <Label>{tr("Tujuan Kepulangan *")}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder={tr("Pilih tujuan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  {tr("Pilih tujuan")}</SelectItem>
                {homeLeaveReasonOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {tr(o.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hl-description">
              {tr("Deskripsi Detail")}{" "}
              <span className="font-normal text-muted-foreground">
                {tr("(opsional)")}</span>
            </Label>
            <Textarea
              id="hl-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr("Alamat tujuan, penjemput, kontak yang bisa dihubungi, dll.")}
              rows={3}
              maxLength={1000}
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
            disabled={
              isPending || !childId || !leaveDate || reason === NONE
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menyimpan...")}</>
            ) : mode === "create" ? (
              tr("Simpan")
            ) : (
              tr("Simpan Perubahan")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddHomeLeaveDialog({
  childrenOptions,
  activeChildIds,
}: {
  childrenOptions: ChildOption[];
  activeChildIds: string[];
}) {
  return (
    <HomeLeaveFormDialog
      mode="create"
      childrenOptions={childrenOptions}
      activeChildIds={activeChildIds}
    />
  );
}

export function EditHomeLeaveDialog({
  leave,
  childrenOptions,
  activeChildIds,
}: {
  leave: HomeLeaveData;
  childrenOptions: ChildOption[];
  activeChildIds: string[];
}) {
  return (
    <HomeLeaveFormDialog
      mode="edit"
      leave={leave}
      childrenOptions={childrenOptions}
      activeChildIds={activeChildIds}
    />
  );
}

export function DeleteHomeLeaveButton({
  leaveId,
  childName,
}: {
  leaveId: string;
  childName: string;
}) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteHomeLeave(leaveId);
      if (result.success) {
        toast.success(tr("Data kepulangan {0} dihapus", { "0": childName }));
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
          <span className="sr-only">{tr("Hapus kepulangan ")}{childName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("Hapus Data Kepulangan?")}</DialogTitle>
          <DialogDescription>
            {tr("Catatan kepulangan ")}<b>{childName}</b> {tr(" akan dihapus permanen.")}</DialogDescription>
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

const __homeLeaveReasonOptions = homeLeaveReasonOptions;
