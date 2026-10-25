"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Search, X } from "lucide-react";

import {
  createFamilyVisit,
  updateFamilyVisit,
  deleteFamilyVisit,
} from "@/lib/actions/familyVisit";
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


export type ChildOption = { id: string; fullName: string };

export type FamilyVisitData = {
  id: string;
  childId: string;
  childName: string;
  visitorName: string;
  relationship: string | null;
  visitDate: string; // yyyy-MM-ddTHH:mm (datetime-local)
  purpose: string;
};

function FamilyVisitFormDialog({
  mode,
  visit,
  childrenOptions,
}: {
  mode: "create" | "edit";
  visit?: FamilyVisitData;
  childrenOptions: ChildOption[];
}) {
  const { tr, locale } = useI18n();

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [childId, setChildId] = useState(visit?.childId ?? "");
  const [childQuery, setChildQuery] = useState("");
  const [visitorName, setVisitorName] = useState(visit?.visitorName ?? "");
  const [relationship, setRelationship] = useState(visit?.relationship ?? "");
  const [visitDate, setVisitDate] = useState(visit?.visitDate ?? "");
  const [purpose, setPurpose] = useState(visit?.purpose ?? "");

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

  function resetForm() {
    setChildId("");
    setChildQuery("");
    setVisitorName("");
    setRelationship("");
    setVisitDate("");
    setPurpose("");
  }

  function handleSubmit() {
    if (!childId) {
      toast.error(tr("Pilih anak yang dikunjungi"));
      return;
    }
    if (visitorName.trim().length < 2) {
      toast.error(tr("Nama pengunjung wajib diisi"));
      return;
    }
    if (!visitDate) {
      toast.error(tr("Tanggal & jam kunjungan wajib diisi"));
      return;
    }
    if (purpose.trim().length < 3) {
      toast.error(tr("Urusan kunjungan wajib diisi"));
      return;
    }

    startTransition(async () => {
      const values = {
        childId,
        visitorName,
        relationship,
        visitDate: new Date(visitDate),
        purpose,
      };

      const result =
        mode === "create"
          ? await createFamilyVisit(values)
          : await updateFamilyVisit(visit!.id, values);

      if (result.success) {
        toast.success(
          mode === "create"
            ? tr("Kunjungan tercatat")
            : tr("Data kunjungan diperbarui")
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
            {tr("Catat Kunjungan")}</Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" title={tr("Edit")}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">
              {tr("Edit kunjungan ")}{visit?.visitorName}
            </span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? tr("Catat Kunjungan Orang Tua / Wali")
              : tr("Edit Kunjungan")}
          </DialogTitle>
          <DialogDescription>
            {tr("Buku tamu keluarga yang datang berkunjung ke panti.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Anak yang dikunjungi: search + single select */}
          <div className="space-y-2">
            <Label htmlFor="fv-child-search">{tr("Anak yang Dikunjungi *")}</Label>
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
                    id="fv-child-search"
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
                      searchResults.map((child) => (
                        <button
                          type="button"
                          key={child.id}
                          onClick={() => {
                            setChildId(child.id);
                            setChildQuery("");
                          }}
                          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          {child.fullName}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="fv-visitor">{tr("Nama Pengunjung *")}</Label>
              <Input
                id="fv-visitor"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder={tr("Nama orang tua / wali")}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="fv-relationship">
                {tr("Hubungan dengan Anak")}{" "}
                <span className="font-normal text-muted-foreground">
                  {tr("(opsional)")}</span>
              </Label>
              <Input
                id="fv-relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder={tr("mis. Ibu kandung / Paman")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fv-date">{tr("Tanggal & Jam Kunjungan *")}</Label>
            <Input
              id="fv-date"
              type="datetime-local"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fv-purpose">{tr("Urusan / Keperluan *")}</Label>
            <Textarea
              id="fv-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={tr("mis. Menjenguk anak, membawa perlengkapan sekolah...")}
              rows={3}
              maxLength={500}
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
              isPending ||
              !childId ||
              visitorName.trim().length < 2 ||
              !visitDate ||
              purpose.trim().length < 3
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

export function AddFamilyVisitDialog({
  childrenOptions,
}: {
  childrenOptions: ChildOption[];
}) {
  return (
    <FamilyVisitFormDialog mode="create" childrenOptions={childrenOptions} />
  );
}

export function EditFamilyVisitDialog({
  visit,
  childrenOptions,
}: {
  visit: FamilyVisitData;
  childrenOptions: ChildOption[];
}) {
  return (
    <FamilyVisitFormDialog
      mode="edit"
      visit={visit}
      childrenOptions={childrenOptions}
    />
  );
}

export function DeleteFamilyVisitButton({
  visitId,
  visitorName,
}: {
  visitId: string;
  visitorName: string;
}) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteFamilyVisit(visitId);
      if (result.success) {
        toast.success(tr("Kunjungan {0} dihapus", { "0": visitorName }));
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
          <span className="sr-only">{tr("Hapus kunjungan ")}{visitorName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("Hapus Data Kunjungan?")}</DialogTitle>
          <DialogDescription>
            {tr("Catatan kunjungan ")}<b>{visitorName}</b> {tr(" akan dihapus permanen.")}</DialogDescription>
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
