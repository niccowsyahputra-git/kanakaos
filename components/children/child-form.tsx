"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, FileText, Copy } from "lucide-react";

import { createChild, updateChild } from "@/lib/actions/child";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bloodTypeOptions,
  residencyStatusOptions,
  orphanStatusOptions,
  educationOptions,
  religionOptions,
  fatherOccupationOptions,
  motherOccupationOptions,
  parentStatusOptions,
  gradeOptionsByEducation,
  siblingActivityOptions,
  siblingLivingWithOptions,
  siblingRelationOptions,
} from "@/components/children/child-labels";

export type GuardianOption = {
  id: string;
  name: string;
  relationship: string | null;
};

export type SiblingInitial = {
  name: string;
  gender: string | null;
  dob: string | null; // yyyy-mm-dd
  activity: string | null;
  livingWith: string | null;
  pantiName: string | null;
  relation: string | null;
};

type SiblingForm = {
  name: string;
  gender: string;
  dob: string;
  activity: string;
  livingWith: string;
  pantiName: string;
  relation: string;
};

const EMPTY_SIBLING: SiblingForm = {
  name: "",
  gender: "NONE",
  dob: "",
  activity: "NONE",
  livingWith: "NONE",
  pantiName: "",
  relation: "NONE",
};

export type ChildInitial = {
  id: string;
  fullName: string;
  nik: string | null;
  dob: string; // yyyy-mm-dd
  gender: string;
  religion: string | null;
  bloodType: string | null;
  heightCm: number | null;
  weightKg: number | null;
  status: string;
  orphanStatus: string | null;
  lastEducation: string | null;
  admissionDate: string; // yyyy-mm-dd
  admissionReason: string | null;
  homeAddress: string | null;
  fatherName: string | null;
  fatherNik: string | null;
  fatherReligion: string | null;
  fatherOccupation: string | null;
  fatherStatus: string | null;
  motherName: string | null;
  motherNik: string | null;
  motherReligion: string | null;
  motherOccupation: string | null;
  motherStatus: string | null;
  lastGrade: string | null;
  birthOrder: number | null;
  siblingsCount: number | null;
  siblings: SiblingInitial[];
  previousSchool: string | null;
  achievements: string | null;
  medicalHistory: string | null;
  notes: string | null;
  guardianId: string | null;
  photoUrl: string | null;
  ijazahUrl: string | null;
  aktaLahirUrl: string | null;
  consentUrl: string | null;
  supportingDocUrl: string | null;
  otherDocUrl: string | null;
};

const NONE = "NONE";
const todayStr = () => new Date().toISOString().slice(0, 10);

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

// Input file dokumen: PDF/PNG/JPG maks 2MB, tampilkan link lama bila ada
function DocInput({
  id,
  label,
  inputRef,
  existingUrl,
}: {
  id: string;
  label: string;
  inputRef: React.RefObject<HTMLInputElement>;
  existingUrl?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {existingUrl && (
          <a
            href={existingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileText className="h-3 w-3" />
            Lihat file saat ini
          </a>
        )}
      </div>
      <Input
        id={id}
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
      />
    </div>
  );
}

export function ChildForm({
  guardians,
  mode,
  child,
}: {
  guardians: GuardianOption[];
  mode: "create" | "edit";
  child?: ChildInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Refs file
  const photoRef = useRef<HTMLInputElement>(null);
  const ijazahRef = useRef<HTMLInputElement>(null);
  const aktaRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const supportingRef = useRef<HTMLInputElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: child?.fullName ?? "",
    nik: child?.nik ?? "",
    dob: child?.dob ?? "",
    gender: child?.gender ?? "",
    religion: child?.religion ?? NONE,
    bloodType: child?.bloodType ?? "UNKNOWN",
    heightCm: child?.heightCm != null ? String(child.heightCm) : "",
    weightKg: child?.weightKg != null ? String(child.weightKg) : "",
    status: child?.status ?? "ACTIVE",
    orphanStatus: child?.orphanStatus ?? NONE,
    lastEducation: child?.lastEducation ?? NONE,
    admissionDate: child?.admissionDate ?? todayStr(),
    admissionReason: child?.admissionReason ?? "",
    homeAddress: child?.homeAddress ?? "",
    fatherName: child?.fatherName ?? "",
    fatherNik: child?.fatherNik ?? "",
    fatherReligion: child?.fatherReligion ?? NONE,
    fatherOccupation: child?.fatherOccupation ?? NONE,
    fatherStatus: child?.fatherStatus ?? NONE,
    motherName: child?.motherName ?? "",
    motherNik: child?.motherNik ?? "",
    motherReligion: child?.motherReligion ?? NONE,
    motherOccupation: child?.motherOccupation ?? NONE,
    motherStatus: child?.motherStatus ?? NONE,
    lastGrade: child?.lastGrade ?? NONE,
    birthOrder: child?.birthOrder != null ? String(child.birthOrder) : "",
    previousSchool: child?.previousSchool ?? "",
    achievements: child?.achievements ?? "",
    medicalHistory: child?.medicalHistory ?? "",
    notes: child?.notes ?? "",
    guardianId: child?.guardianId ?? NONE,
  });

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // --- Saudara kandung (baris dinamis sesuai jumlah) ---
  const [siblings, setSiblings] = useState<SiblingForm[]>(
    (child?.siblings ?? []).map((s) => ({
      name: s.name,
      gender: s.gender ?? NONE,
      dob: s.dob ?? "",
      activity: s.activity ?? NONE,
      livingWith: s.livingWith ?? NONE,
      pantiName: s.pantiName ?? "",
      relation: s.relation ?? NONE,
    }))
  );
  const [siblingsCount, setSiblingsCount] = useState(
    child?.siblingsCount != null
      ? String(child.siblingsCount)
      : child?.siblings?.length
        ? String(child.siblings.length)
        : ""
  );

  function handleSiblingsCount(value: string) {
    const cleaned = value.replace(/\D/g, "").slice(0, 2);
    setSiblingsCount(cleaned);
    const n = Math.min(parseInt(cleaned || "0", 10), 15);
    setSiblings((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push({ ...EMPTY_SIBLING });
      return next;
    });
  }

  function setSibling(index: number, key: keyof SiblingForm, value: string) {
    setSiblings((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [key]: value } : s))
    );
  }

  const selectedGuardian = guardians.find((g) => g.id === form.guardianId);

  // Opsi tingkat/kelas mengikuti jenjang pendidikan yang dipilih
  const gradeOptions =
    (gradeOptionsByEducation as Record<string, string[] | undefined>)[
      form.lastEducation
    ] ?? [];

  function handleSubmit() {
    // Validasi cepat sisi client
    if (form.fullName.trim().length < 3) {
      toast.error("Nama minimal 3 karakter");
      return;
    }
    if (!form.dob || form.dob.trim() === "") {
      toast.error("Tanggal lahir wajib diisi");
      return;
    }
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(form.dob)) {
      toast.error("Format tanggal lahir tidak valid. Gunakan format YYYY-MM-DD");
      return;
    }
    if (!form.gender || form.gender.trim() === "") {
      toast.error("Pilih jenis kelamin");
      return;
    }
    if (form.nik && !/^\d{16}$/.test(form.nik)) {
      toast.error("NIK harus 16 digit angka");
      return;
    }

    if (form.fatherNik && !/^\d{16}$/.test(form.fatherNik)) {
      toast.error("NIK Ayah harus 16 digit angka");
      return;
    }
    if (form.motherNik && !/^\d{16}$/.test(form.motherNik)) {
      toast.error("NIK Ibu harus 16 digit angka");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("fullName", form.fullName);
      fd.set("nik", form.nik);
      fd.set("dob", form.dob);
      fd.set("gender", form.gender);
      fd.set("religion", form.religion === NONE ? "" : form.religion);
      fd.set("bloodType", form.bloodType);
      fd.set("heightCm", form.heightCm);
      fd.set("weightKg", form.weightKg);
      fd.set("status", form.status);
      fd.set("orphanStatus", form.orphanStatus === NONE ? "" : form.orphanStatus);
      fd.set(
        "lastEducation",
        form.lastEducation === NONE ? "" : form.lastEducation
      );
      fd.set("admissionDate", form.admissionDate);
      fd.set("admissionReason", form.admissionReason);
      fd.set("homeAddress", form.homeAddress);
      fd.set("fatherName", form.fatherName);
      fd.set("fatherNik", form.fatherNik);
      fd.set(
        "fatherReligion",
        form.fatherReligion === NONE ? "" : form.fatherReligion
      );
      fd.set(
        "fatherOccupation",
        form.fatherOccupation === NONE ? "" : form.fatherOccupation
      );
      fd.set(
        "fatherStatus",
        form.fatherStatus === NONE ? "" : form.fatherStatus
      );
      fd.set("motherName", form.motherName);
      fd.set("motherNik", form.motherNik);
      fd.set(
        "motherReligion",
        form.motherReligion === NONE ? "" : form.motherReligion
      );
      fd.set(
        "motherOccupation",
        form.motherOccupation === NONE ? "" : form.motherOccupation
      );
      fd.set(
        "motherStatus",
        form.motherStatus === NONE ? "" : form.motherStatus
      );
      fd.set("lastGrade", form.lastGrade === NONE ? "" : form.lastGrade);
      fd.set("birthOrder", form.birthOrder);
      fd.set("siblingsCount", siblingsCount);
      // Saudara: kirim sebagai JSON, hanya baris yang diisi namanya
      const filledSiblings = siblings
        .filter((s) => s.name.trim() !== "")
        .map((s) => ({
          name: s.name.trim(),
          gender: s.gender === NONE ? "" : s.gender,
          dob: s.dob,
          activity: s.activity === NONE ? "" : s.activity,
          livingWith: s.livingWith === NONE ? "" : s.livingWith,
          pantiName: s.pantiName,
          relation: s.relation === NONE ? "" : s.relation,
        }));
      fd.set("siblings", JSON.stringify(filledSiblings));
      fd.set("previousSchool", form.previousSchool);
      fd.set("achievements", form.achievements);
      fd.set("medicalHistory", form.medicalHistory);
      fd.set("notes", form.notes);
      fd.set("guardianId", form.guardianId === NONE ? "" : form.guardianId);

      // Lampirkan file bila dipilih
      const attach = (field: string, ref: React.RefObject<HTMLInputElement>) => {
        const file = ref.current?.files?.[0];
        if (file) fd.set(field, file);
      };
      attach("photo", photoRef);
      attach("ijazah", ijazahRef);
      attach("aktaLahir", aktaRef);
      attach("consent", consentRef);
      attach("supportingDoc", supportingRef);
      attach("otherDoc", otherRef);

      const result =
        mode === "create"
          ? await createChild(fd)
          : await updateChild(child!.id, fd);

      if (result.success) {
        if (result.warning) {
          toast.warning("Data anak tersimpan", { description: result.warning });
        } else {
          toast.success(
            mode === "create" ? "Data anak berhasil disimpan" : "Perubahan tersimpan"
          );
        }
        router.push(
          mode === "create"
            ? "/dashboard/children"
            : `/dashboard/children/${child!.id}`
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Data Pribadi */}
      <SectionCard title="Data Pribadi">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nama Lengkap *</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="Nama lengkap anak"
          />
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="nik">NIK (16 digit)</Label>
            <Input
              id="nik"
              value={form.nik}
              onChange={(e) => set("nik", e.target.value.replace(/\D/g, ""))}
              placeholder="3xxxxxxxxxxxxxxx"
              inputMode="numeric"
              maxLength={16}
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="dob">Tanggal Lahir *</Label>
            <Input
              id="dob"
              type="date"
              value={form.dob}
              onChange={(e) => {
                const value = e.target.value;
                set("dob", value);
              }}
              onBlur={() => {
                // Ensure state is synced on blur
                if (!form.dob) {
                  const input = document.getElementById("dob") as HTMLInputElement;
                  if (input && input.value) {
                    set("dob", input.value);
                  }
                }
              }}
              max={todayStr()}
              required
            />
            {form.dob && (
              <p className="text-xs text-muted-foreground">
                Tanggal lahir: {new Date(form.dob).toLocaleDateString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Jenis Kelamin *</Label>
            <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis kelamin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Laki-laki</SelectItem>
                <SelectItem value="FEMALE">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Golongan Darah</Label>
            <Select
              value={form.bloodType}
              onValueChange={(v) => set("bloodType", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bloodTypeOptions.map((o) => (
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
            <Label>Agama</Label>
            <Select
              value={form.religion}
              onValueChange={(v) => set("religion", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih agama" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {religionOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="heightCm">Tinggi Badan (cm)</Label>
            <Input
              id="heightCm"
              type="number"
              min={20}
              max={250}
              step="0.1"
              inputMode="decimal"
              value={form.heightCm}
              onChange={(e) => set("heightCm", e.target.value)}
              placeholder="mis. 120"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="weightKg">Berat Badan (kg)</Label>
            <Input
              id="weightKg"
              type="number"
              min={1}
              max={200}
              step="0.1"
              inputMode="decimal"
              value={form.weightKg}
              onChange={(e) => set("weightKg", e.target.value)}
              placeholder="mis. 25"
            />
          </div>
        </div>
      </SectionCard>

      {/* 2. Status & Keluarga */}
      <SectionCard
        title="Status & Keluarga"
        description="Nama ayah/ibu bisa disalin dari data wali bila sesuai."
      >
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Status Anak</Label>
            <Select
              value={form.orphanStatus}
              onValueChange={(v) => set("orphanStatus", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {orphanStatusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Status di Panti</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {residencyStatusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Wali</Label>
          <Select
            value={form.guardianId}
            onValueChange={(v) => set("guardianId", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih wali (opsional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Tanpa wali</SelectItem>
              {guardians.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                  {g.relationship ? ` (${g.relationship})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedGuardian && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => set("fatherName", selectedGuardian.name)}
              >
                <Copy className="h-3 w-3" />
                Salin ke Nama Ayah
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => set("motherName", selectedGuardian.name)}
              >
                <Copy className="h-3 w-3" />
                Salin ke Nama Ibu
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="fatherName">Nama Ayah</Label>
            <Input
              id="fatherName"
              value={form.fatherName}
              onChange={(e) => set("fatherName", e.target.value)}
              placeholder="Nama ayah kandung"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="fatherNik">No. KTP (NIK) Ayah</Label>
            <Input
              id="fatherNik"
              value={form.fatherNik}
              onChange={(e) => set("fatherNik", e.target.value.replace(/\D/g, ""))}
              placeholder="16 digit"
              inputMode="numeric"
              maxLength={16}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="motherName">Nama Ibu</Label>
            <Input
              id="motherName"
              value={form.motherName}
              onChange={(e) => set("motherName", e.target.value)}
              placeholder="Nama ibu kandung"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="motherNik">No. KTP (NIK) Ibu</Label>
            <Input
              id="motherNik"
              value={form.motherNik}
              onChange={(e) => set("motherNik", e.target.value.replace(/\D/g, ""))}
              placeholder="16 digit"
              inputMode="numeric"
              maxLength={16}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Agama Ayah</Label>
            <Select
              value={form.fatherReligion}
              onValueChange={(v) => set("fatherReligion", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih agama" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {religionOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Agama Ibu</Label>
            <Select
              value={form.motherReligion}
              onValueChange={(v) => set("motherReligion", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih agama" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {religionOptions.map((o) => (
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
            <Label>Pekerjaan Ayah</Label>
            <Select
              value={form.fatherOccupation}
              onValueChange={(v) => set("fatherOccupation", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih pekerjaan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {fatherOccupationOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Pekerjaan Ibu</Label>
            <Select
              value={form.motherOccupation}
              onValueChange={(v) => set("motherOccupation", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih pekerjaan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {motherOccupationOptions.map((o) => (
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
            <Label>Status Ayah</Label>
            <Select
              value={form.fatherStatus}
              onValueChange={(v) => set("fatherStatus", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {parentStatusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Status Ibu</Label>
            <Select
              value={form.motherStatus}
              onValueChange={(v) => set("motherStatus", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {parentStatusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="homeAddress">Alamat Rumah Tempat Tinggal</Label>
          <Textarea
            id="homeAddress"
            value={form.homeAddress}
            onChange={(e) => set("homeAddress", e.target.value)}
            placeholder="Alamat asal / keluarga anak"
            rows={2}
          />
        </div>
      </SectionCard>

      {/* 2b. Saudara Kandung */}
      <SectionCard
        title="Saudara Kandung"
        description="Isi jumlah saudara, lalu lengkapi data tiap saudara yang muncul."
      >
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="birthOrder">Anak Ke-berapa</Label>
            <Input
              id="birthOrder"
              type="number"
              min={1}
              max={30}
              inputMode="numeric"
              value={form.birthOrder}
              onChange={(e) => set("birthOrder", e.target.value)}
              placeholder="mis. 2"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="siblingsCount">Jumlah Saudara</Label>
            <Input
              id="siblingsCount"
              inputMode="numeric"
              value={siblingsCount}
              onChange={(e) => handleSiblingsCount(e.target.value)}
              placeholder="mis. 3 (maks 15)"
            />
          </div>
        </div>

        {siblings.map((sibling, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border bg-muted/30 p-3"
          >
            <p className="text-sm font-semibold">Saudara {index + 1}</p>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="w-full space-y-1.5 md:w-1/2">
                <Label htmlFor={`sib-name-${index}`}>Nama Saudara</Label>
                <Input
                  id={`sib-name-${index}`}
                  value={sibling.name}
                  onChange={(e) => setSibling(index, "name", e.target.value)}
                  placeholder="Nama lengkap"
                />
              </div>
              <div className="w-full space-y-1.5 md:w-1/2">
                <Label>Status dengan Anak</Label>
                <Select
                  value={sibling.relation}
                  onValueChange={(v) => setSibling(index, "relation", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kakak / Adik" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                    {siblingRelationOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="w-full space-y-1.5 md:w-1/2">
                <Label>Jenis Kelamin</Label>
                <Select
                  value={sibling.gender}
                  onValueChange={(v) => setSibling(index, "gender", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                    <SelectItem value="MALE">Laki-laki</SelectItem>
                    <SelectItem value="FEMALE">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full space-y-1.5 md:w-1/2">
                <Label htmlFor={`sib-dob-${index}`}>Tanggal Lahir</Label>
                <Input
                  id={`sib-dob-${index}`}
                  type="date"
                  value={sibling.dob}
                  onChange={(e) => setSibling(index, "dob", e.target.value)}
                  max={todayStr()}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="w-full space-y-1.5 md:w-1/2">
                <Label>Pekerjaan</Label>
                <Select
                  value={sibling.activity}
                  onValueChange={(v) => setSibling(index, "activity", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                    {siblingActivityOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full space-y-1.5 md:w-1/2">
                <Label>Tinggal Dengan</Label>
                <Select
                  value={sibling.livingWith}
                  onValueChange={(v) => setSibling(index, "livingWith", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                    {siblingLivingWithOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {sibling.livingWith === "PANTI_ASUHAN" && (
              <div className="space-y-1.5">
                <Label htmlFor={`sib-panti-${index}`}>Nama Panti Asuhan</Label>
                <Input
                  id={`sib-panti-${index}`}
                  value={sibling.pantiName}
                  onChange={(e) =>
                    setSibling(index, "pantiName", e.target.value)
                  }
                  placeholder="Nama panti tempat saudara tinggal"
                />
              </div>
            )}
          </div>
        ))}
      </SectionCard>

      {/* 3. Riwayat Penerimaan */}
      <SectionCard title="Riwayat Penerimaan">
        <div className="space-y-2">
          <Label htmlFor="admissionDate">Tanggal Masuk / Diterima</Label>
          <Input
            id="admissionDate"
            type="date"
            value={form.admissionDate}
            onChange={(e) => set("admissionDate", e.target.value)}
            max={todayStr()}
            className="md:w-1/2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admissionReason">Alasan Masuk Panti Asuhan</Label>
          <Textarea
            id="admissionReason"
            value={form.admissionReason}
            onChange={(e) => set("admissionReason", e.target.value)}
            placeholder="Latar belakang / alasan anak diterima di panti"
            rows={3}
          />
        </div>
      </SectionCard>

      {/* 4. Pendidikan */}
      <SectionCard title="Pendidikan">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Pendidikan Terakhir</Label>
            <Select
              value={form.lastEducation}
              onValueChange={(v) =>
                // Ganti jenjang -> reset pilihan tingkat/kelas
                setForm((f) => ({ ...f, lastEducation: v, lastGrade: NONE }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenjang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {educationOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label>Tingkat / Kelas Terakhir</Label>
            <Select
              value={form.lastGrade}
              onValueChange={(v) => set("lastGrade", v)}
              disabled={gradeOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    gradeOptions.length === 0
                      ? "Pilih jenjang dulu"
                      : "Pilih tingkat/kelas"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                {gradeOptions.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="previousSchool">Nama Sekolah Sebelumnya</Label>
          <Input
            id="previousSchool"
            value={form.previousSchool}
            onChange={(e) => set("previousSchool", e.target.value)}
            placeholder="mis. SDN 1 Denpasar"
            className="md:w-1/2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="achievements">Prestasi</Label>
          <Textarea
            id="achievements"
            value={form.achievements}
            onChange={(e) => set("achievements", e.target.value)}
            placeholder="Prestasi akademik / non-akademik"
            rows={2}
            maxLength={1000}
          />
        </div>
      </SectionCard>

      {/* 5. Kesehatan & Catatan */}
      <SectionCard title="Kesehatan & Catatan">
        <div className="space-y-2">
          <Label htmlFor="medicalHistory">Riwayat Penyakit</Label>
          <Textarea
            id="medicalHistory"
            value={form.medicalHistory}
            onChange={(e) => set("medicalHistory", e.target.value)}
            placeholder="Alergi, penyakit bawaan, riwayat medis penting"
            rows={2}
            maxLength={1000}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="notes">Catatan Lain</Label>
            <span className="text-xs text-muted-foreground">
              {form.notes.length}/1000
            </span>
          </div>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Catatan tambahan tentang anak"
            rows={3}
            maxLength={1000}
          />
        </div>
      </SectionCard>

      {/* 6. Dokumen */}
      <SectionCard
        title="Dokumen"
        description="Foto: JPG/PNG/WebP maks 5MB. Dokumen: PDF/PNG/JPG maks 2MB."
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="photo">Foto Anak</Label>
            {child?.photoUrl && (
              <a
                href={child.photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <FileText className="h-3 w-3" />
                Lihat foto saat ini
              </a>
            )}
          </div>
          <Input
            id="photo"
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
          />
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full md:w-1/2">
            <DocInput
              id="ijazah"
              label="Ijazah Terakhir"
              inputRef={ijazahRef}
              existingUrl={child?.ijazahUrl}
            />
          </div>
          <div className="w-full md:w-1/2">
            <DocInput
              id="aktaLahir"
              label="Akta Kelahiran"
              inputRef={aktaRef}
              existingUrl={child?.aktaLahirUrl}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full md:w-1/2">
            <DocInput
              id="consent"
              label="Dokumen Consent"
              inputRef={consentRef}
              existingUrl={child?.consentUrl}
            />
          </div>
          <div className="w-full md:w-1/2">
            <DocInput
              id="supportingDoc"
              label="Dokumen Pendukung Lainnya"
              inputRef={supportingRef}
              existingUrl={child?.supportingDocUrl}
            />
          </div>
        </div>

        <DocInput
          id="otherDoc"
          label="Dokumen KK (Kartu Keluarga)"
          inputRef={otherRef}
          existingUrl={child?.otherDocUrl}
        />
      </SectionCard>

      {/* Aksi */}
      <div className="flex flex-col gap-3 md:flex-row md:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          className="w-full md:w-auto"
        >
          Batal
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full md:w-auto"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {mode === "create" ? "Simpan Data Anak" : "Simpan Perubahan"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
