"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, FileText, X, Search } from "lucide-react";

import {
  createGuardian,
  updateGuardian,
  deleteGuardian,
} from "@/lib/actions/guardian";
import { formatRupiah, cn } from "@/lib/utils";
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
import { educationOptions, religionOptions } from "@/components/children/child-labels";
import {
  RELATIONSHIP_OPTIONS,
  residenceStatusOptions,
  guardianOccupationOptions,
  spouseStatusOptions,
} from "@/components/guardians/guardian-labels";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


const NONE = "NONE";
const todayStr = () => new Date().toISOString().slice(0, 10);

export type ChildOption = {
  id: string;
  fullName: string;
  guardianId: string | null;
};

export type GuardianData = {
  id: string;
  name: string;
  phone: string | null;
  dob: string | null; // yyyy-mm-dd
  relationship: string | null;
  nik: string | null;
  kkNumber: string | null;
  religion: string | null;
  spouseName: string | null;
  spouseStatus: string | null;
  spouseNik: string | null;
  occupation: string | null;
  lastEducation: string | null;
  residenceStatus: string | null;
  monthlyIncome: number | null;
  dependentsCount: number | null;
  address: string | null;
  notes: string | null;
  ktpDocUrl: string | null;
  kkDocUrl: string | null;
  selfieUrl: string | null;
  otherDocUrl: string | null;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b pb-1 text-sm font-semibold text-muted-foreground">
      {children}
    </p>
  );
}

function ExistingFileLink({ url, label }: { url: string | null; label: string }) {
  const { tr, locale } = useI18n();

  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <FileText className="h-3 w-3" />
      {tr(label)}
    </a>
  );
}

function GuardianFormDialog({
  mode,
  guardian,
  childrenOptions,
}: {
  mode: "create" | "edit";
  guardian?: GuardianData;
  childrenOptions: ChildOption[];
}) {
  const { tr, locale } = useI18n();
  const religionOptions = localizeLabels(__religionOptions, tr);
  const spouseStatusOptions = localizeLabels(__spouseStatusOptions, tr);
  const guardianOccupationOptions = localizeLabels(__guardianOccupationOptions, tr);
  const educationOptions = localizeLabels(__educationOptions, tr);
  const residenceStatusOptions = localizeLabels(__residenceStatusOptions, tr);
  const RELATIONSHIP_OPTIONS = localizeLabels(__RELATIONSHIP_OPTIONS, tr);

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const ktpRef = useRef<HTMLInputElement>(null);
  const kkRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);

  const initialForm = {
    name: guardian?.name ?? "",
    phone: guardian?.phone ?? "",
    dob: guardian?.dob ?? "",
    relationship: guardian?.relationship ?? NONE,
    nik: guardian?.nik ?? "",
    kkNumber: guardian?.kkNumber ?? "",
    religion: guardian?.religion ?? NONE,
    spouseName: guardian?.spouseName ?? "",
    spouseStatus: guardian?.spouseStatus ?? NONE,
    spouseNik: guardian?.spouseNik ?? "",
    occupation: guardian?.occupation ?? NONE,
    lastEducation: guardian?.lastEducation ?? NONE,
    residenceStatus: guardian?.residenceStatus ?? NONE,
    monthlyIncome:
      guardian?.monthlyIncome != null ? String(guardian.monthlyIncome) : "",
    dependentsCount:
      guardian?.dependentsCount != null
        ? String(guardian.dependentsCount)
        : "",
    address: guardian?.address ?? "",
    notes: guardian?.notes ?? "",
  };

  const [form, setForm] = useState(initialForm);
  const [childIds, setChildIds] = useState<string[]>(
    guardian
      ? childrenOptions
          .filter((c) => c.guardianId === guardian.id)
          .map((c) => c.id)
      : []
  );
  // Pencarian anak utk multi-select (menggantikan checklist agar skalabel)
  const [childQuery, setChildQuery] = useState("");

  const selectedChildren = childrenOptions.filter((c) =>
    childIds.includes(c.id)
  );
  const searchResults =
    childQuery.trim() === ""
      ? []
      : childrenOptions
          .filter(
            (c) =>
              !childIds.includes(c.id) &&
              c.fullName
                .toLowerCase()
                .includes(childQuery.trim().toLowerCase())
          )
          .slice(0, 8);

  function addChild(id: string) {
    setChildIds((ids) => [...ids, id]);
    setChildQuery("");
  }

  function removeChild(id: string) {
    setChildIds((ids) => ids.filter((x) => x !== id));
  }

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    if (form.name.trim().length < 3) {
      toast.error(tr("Nama wali minimal 3 karakter"));
      return;
    }
    if (form.nik && !/^\d{16}$/.test(form.nik)) {
      toast.error(tr("No. KTP (NIK) harus 16 digit angka"));
      return;
    }
    if (form.kkNumber && !/^\d{16}$/.test(form.kkNumber)) {
      toast.error(tr("No. KK harus 16 digit angka"));
      return;
    }
    if (form.spouseNik && !/^\d{16}$/.test(form.spouseNik)) {
      toast.error(tr("NIK Pasangan harus 16 digit angka"));
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", form.name);
      fd.set("phone", form.phone);
      fd.set("dob", form.dob);
      fd.set(
        "relationship",
        form.relationship === NONE ? "" : form.relationship
      );
      fd.set("nik", form.nik);
      fd.set("kkNumber", form.kkNumber);
      fd.set("religion", form.religion === NONE ? "" : form.religion);
      fd.set("spouseName", form.spouseName);
      fd.set(
        "spouseStatus",
        form.spouseStatus === NONE ? "" : form.spouseStatus
      );
      fd.set("spouseNik", form.spouseNik);
      fd.set("occupation", form.occupation === NONE ? "" : form.occupation);
      fd.set(
        "lastEducation",
        form.lastEducation === NONE ? "" : form.lastEducation
      );
      fd.set(
        "residenceStatus",
        form.residenceStatus === NONE ? "" : form.residenceStatus
      );
      fd.set("monthlyIncome", form.monthlyIncome);
      fd.set("dependentsCount", form.dependentsCount);
      fd.set("address", form.address);
      fd.set("notes", form.notes);
      for (const id of childIds) fd.append("childIds", id);

      const attach = (field: string, ref: React.RefObject<HTMLInputElement>) => {
        const file = ref.current?.files?.[0];
        if (file) fd.set(field, file);
      };
      attach("ktpDoc", ktpRef);
      attach("kkDoc", kkRef);
      attach("selfie", selfieRef);
      attach("otherDoc", otherRef);

      const result =
        mode === "create"
          ? await createGuardian(fd)
          : await updateGuardian(guardian!.id, fd);

      if (result.success) {
        if (result.warning) {
          toast.warning(tr("Data wali tersimpan"), { description: result.warning });
        } else {
          toast.success(
            mode === "create"
              ? tr("Wali {0} berhasil ditambahkan", { "0": form.name })
              : tr("Data wali {0} diperbarui", { "0": form.name })
          );
        }
        if (mode === "create") {
          setForm(initialForm);
          setChildIds([]);
        }
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const incomeNumber = Number(form.monthlyIncome) || 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {tr("Tambah Wali")}</Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" title={tr("Edit")}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{tr("Edit ")}{guardian?.name}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? tr("Tambah Wali Baru") : tr("Edit Wali")}
          </DialogTitle>
          <DialogDescription>
            {tr("Lengkapi data wali. Anak yang dicentang akan terhubung ke wali ini.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Identitas */}
          <SectionTitle>{tr("Identitas")}</SectionTitle>
          <div className="space-y-2">
            <Label htmlFor="g-name">{tr("Nama Wali *")}</Label>
            <Input
              id="g-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={tr("Nama lengkap wali")}
            />
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="g-dob">{tr("Tanggal Lahir")}</Label>
              <Input
                id="g-dob"
                type="date"
                value={form.dob}
                onChange={(e) => set("dob", e.target.value)}
                max={todayStr()}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="g-phone">{tr("No. HP")}</Label>
              <Input
                id="g-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder={tr("08xxxxxxxxxx")}
                inputMode="tel"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="g-nik">{tr("No. KTP (NIK)")}</Label>
              <Input
                id="g-nik"
                value={form.nik}
                onChange={(e) => set("nik", e.target.value.replace(/\D/g, ""))}
                placeholder={tr("16 digit")}
                inputMode="numeric"
                maxLength={16}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="g-kk">{tr("No. KK")}</Label>
              <Input
                id="g-kk"
                value={form.kkNumber}
                onChange={(e) =>
                  set("kkNumber", e.target.value.replace(/\D/g, ""))
                }
                placeholder={tr("16 digit")}
                inputMode="numeric"
                maxLength={16}
              />
            </div>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>{tr("Agama")}</Label>
            <Select
              value={form.religion}
              onValueChange={(v) => set("religion", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={tr("Pilih agama")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{tr("Belum ditentukan")}</SelectItem>
                {religionOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {tr(o.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pasangan */}
          <SectionTitle>{tr("Pasangan")}</SectionTitle>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="g-spouse">{tr("Nama Pasangan")}</Label>
              <Input
                id="g-spouse"
                value={form.spouseName}
                onChange={(e) => set("spouseName", e.target.value)}
                placeholder={tr("Nama suami/istri")}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label>{tr("Status Pasangan")}</Label>
              <Select
                value={form.spouseStatus}
                onValueChange={(v) => set("spouseStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{tr("Belum ditentukan")}</SelectItem>
                  {spouseStatusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {tr(o.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="g-spouse-nik">{tr("NIK Pasangan")}</Label>
            <Input
              id="g-spouse-nik"
              value={form.spouseNik}
              onChange={(e) =>
                set("spouseNik", e.target.value.replace(/\D/g, ""))
              }
              placeholder={tr("16 digit")}
              inputMode="numeric"
              maxLength={16}
            />
          </div>

          {/* Sosial Ekonomi */}
          <SectionTitle>{tr("Sosial Ekonomi")}</SectionTitle>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label>{tr("Pekerjaan Wali")}</Label>
              <Select
                value={form.occupation}
                onValueChange={(v) => set("occupation", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih pekerjaan")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{tr("Belum ditentukan")}</SelectItem>
                  {guardianOccupationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {tr(o.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label>{tr("Pendidikan Terakhir")}</Label>
              <Select
                value={form.lastEducation}
                onValueChange={(v) => set("lastEducation", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih jenjang")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{tr("Belum ditentukan")}</SelectItem>
                  {educationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {tr(o.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label>{tr("Status Tempat Tinggal")}</Label>
              <Select
                value={form.residenceStatus}
                onValueChange={(v) => set("residenceStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{tr("Belum ditentukan")}</SelectItem>
                  {residenceStatusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {tr(o.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="g-dependents">{tr("Jumlah Tanggungan")}</Label>
              <Input
                id="g-dependents"
                type="number"
                min={0}
                max={50}
                inputMode="numeric"
                value={form.dependentsCount}
                onChange={(e) => set("dependentsCount", e.target.value)}
                placeholder={tr("mis. 3")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-income">{tr("Penghasilan Rata-rata / Bulan (Rp)")}</Label>
            <Input
              id="g-income"
              type="number"
              min={0}
              step={100000}
              inputMode="numeric"
              value={form.monthlyIncome}
              onChange={(e) => set("monthlyIncome", e.target.value)}
              placeholder={tr("mis. 1500000")}
            />
            {incomeNumber > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatRupiah(incomeNumber, locale)} {tr(" / bulan")}</p>
            )}
          </div>

          {/* Hubungan & Anak */}
          <SectionTitle>{tr("Hubungan & Anak Asuh")}</SectionTitle>
          <div className="space-y-2">
            <Label>{tr("Hubungan dengan Anak")}</Label>
            <Select
              value={form.relationship}
              onValueChange={(v) => set("relationship", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={tr("Pilih hubungan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{tr("Belum ditentukan")}</SelectItem>
                {RELATIONSHIP_OPTIONS.map((rel) => (
                  <SelectItem key={rel} value={rel}>
                    {tr(rel)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-child-search">{tr("Wali dari Anak")}</Label>
            {/* Chips anak terpilih */}
            {selectedChildren.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedChildren.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-sm font-medium text-primary"
                  >
                    {c.fullName}
                    <button
                      type="button"
                      onClick={() => removeChild(c.id)}
                      className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                      aria-label={tr("Hapus {0}", { "0": c.fullName })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Pencarian anak */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="g-child-search"
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
            {/* Hasil pencarian */}
            {childQuery.trim() !== "" && (
              <div className="max-h-44 overflow-y-auto rounded-md border">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {tr("Tidak ada anak yang cocok / semua sudah dipilih.")}</p>
                ) : (
                  searchResults.map((child) => {
                    const hasOtherGuardian =
                      child.guardianId !== null &&
                      child.guardianId !== guardian?.id;
                    return (
                      <button
                        type="button"
                        key={child.id}
                        onClick={() => addChild(child.id)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          {child.fullName}
                        </span>
                        {hasOtherGuardian && (
                          <span className="shrink-0 text-xs text-amber-600">
                            {tr("sudah punya wali — akan dipindah")}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {tr("Cari lalu klik nama anak untuk menambahkan. 1 anak hanya punya 1 wali — memilih anak yang sudah berwali akan memindahkannya ke wali ini.")}</p>
          </div>

          {/* Alamat & Catatan */}
          <SectionTitle>{tr("Alamat & Catatan")}</SectionTitle>
          <div className="space-y-2">
            <Label htmlFor="g-address">{tr("Alamat")}</Label>
            <Textarea
              id="g-address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder={tr("Alamat tempat tinggal wali")}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-notes">{tr("Catatan")}</Label>
            <Textarea
              id="g-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={tr("Kondisi keluarga, catatan sosial, dll.")}
              rows={2}
            />
          </div>

          {/* Dokumen */}
          <SectionTitle>{tr("Dokumen")}</SectionTitle>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-1.5 md:w-1/2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="g-ktp">{tr("Dokumen KTP")}</Label>
                <ExistingFileLink url={guardian?.ktpDocUrl ?? null} label={tr("Lihat")} />
              </div>
              <Input
                id="g-ktp"
                ref={ktpRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
              />
              <p className="text-xs text-muted-foreground">{tr("PDF/PNG/JPG maks 2MB")}</p>
            </div>
            <div className="w-full space-y-1.5 md:w-1/2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="g-kkdoc">{tr("Dokumen KK")}</Label>
                <ExistingFileLink url={guardian?.kkDocUrl ?? null} label={tr("Lihat")} />
              </div>
              <Input
                id="g-kkdoc"
                ref={kkRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
              />
              <p className="text-xs text-muted-foreground">{tr("PDF/PNG/JPG maks 2MB")}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="g-selfie">{tr("Foto Selfie")}</Label>
              <ExistingFileLink url={guardian?.selfieUrl ?? null} label={tr("Lihat")} />
            </div>
            <Input
              id="g-selfie"
              ref={selfieRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            />
            <p className="text-xs text-muted-foreground">{tr("JPG/PNG/WebP maks 5MB")}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="g-otherdoc">{tr("Dokumen Lainnya")}</Label>
              <ExistingFileLink
                url={guardian?.otherDocUrl ?? null}
                label={tr("Lihat")}
              />
            </div>
            <Input
              id="g-otherdoc"
              ref={otherRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            />
            <p className="text-xs text-muted-foreground">{tr("PDF/PNG/JPG maks 2MB")}</p>
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
            disabled={isPending || form.name.trim().length < 3}
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

export function AddGuardianDialog({
  childrenOptions,
}: {
  childrenOptions: ChildOption[];
}) {
  return <GuardianFormDialog mode="create" childrenOptions={childrenOptions} />;
}

export function EditGuardianDialog({
  guardian,
  childrenOptions,
}: {
  guardian: GuardianData;
  childrenOptions: ChildOption[];
}) {
  return (
    <GuardianFormDialog
      mode="edit"
      guardian={guardian}
      childrenOptions={childrenOptions}
    />
  );
}

export function DeleteGuardianButton({
  guardianId,
  guardianName,
  childrenCount,
}: {
  guardianId: string;
  guardianName: string;
  childrenCount: number;
}) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGuardian(guardianId);
      if (result.success) {
        toast.success(tr("Wali {0} dihapus", { "0": guardianName }));
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
          disabled={childrenCount > 0}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{tr("Hapus ")}{guardianName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("Hapus Wali?")}</DialogTitle>
          <DialogDescription>
            {tr("Data wali ")}<b>{guardianName}</b> {tr(" akan dihapus permanen.")}</DialogDescription>
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

const __religionOptions = religionOptions;
const __spouseStatusOptions = spouseStatusOptions;
const __guardianOccupationOptions = guardianOccupationOptions;
const __educationOptions = educationOptions;
const __residenceStatusOptions = residenceStatusOptions;
const __RELATIONSHIP_OPTIONS = RELATIONSHIP_OPTIONS;
