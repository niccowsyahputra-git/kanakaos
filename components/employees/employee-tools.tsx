"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/lib/actions/employee";
import { formatRupiah } from "@/lib/utils";
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
import { religionOptions } from "@/components/children/child-labels";
import {
  employmentStatusOptions,
  PTKP_OPTIONS,
} from "@/components/employees/employee-labels";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";
import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_POSITIONS } from "@/lib/option-catalogs";
import type { LocationOption } from "@/components/admin/employee-location-settings";
import type { EmployeeStatus } from "@prisma/client";
import Link from "next/link";


const NONE = "NONE";
const todayStr = () => new Date().toISOString().slice(0, 10);

export type EmployeeData = {
  id: string;
  firstName: string;
  lastName: string | null;
  gender: string;
  dob: string | null;
  nik: string | null;
  religion: string | null;
  phone: string | null;
  email: string | null;
  employeeCode: string;
  joinDate: string | null;
  department: string | null;
  position: string | null;
  grade: string | null;
  employmentStatus: string;
  ptkpStatus: string | null;
  entityLocation: string | null;
  entityLocationId: string | null;
  status: EmployeeStatus;
  account?: { email: string; role: string; isActive: boolean } | null;
  basicSalary: number | null;
  salaryEffectiveDate: string | null;
  npwp: string | null;
  fullAddress: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b pb-1 text-sm font-semibold text-muted-foreground">
      {children}
    </p>
  );
}

function CatalogSelect({ id, value, values, onChange }: { id: string; value: string; values: readonly string[]; onChange: (value: string) => void }) {
  const { tr } = useI18n();
  return <Select value={value || NONE} onValueChange={v => onChange(v === NONE ? "" : v)}>
    <SelectTrigger id={id} className="h-auto min-h-10 [&>span]:whitespace-normal [&>span]:text-left"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value={NONE}>{tr("Belum ditentukan")}</SelectItem>
      {value && !values.includes(value) && <SelectItem value={value} disabled>{value} ({tr("Data lama")})</SelectItem>}
      {values.map(v => <SelectItem value={v} key={v}>{tr(v)}</SelectItem>)}
    </SelectContent>
  </Select>;
}

function EmployeeFormDialog({
  mode,
  employee,
  locations,
}: {
  mode: "create" | "edit";
  employee?: EmployeeData;
  locations: LocationOption[];
}) {
  const { tr, locale } = useI18n();
  const religionOptions = localizeLabels(__religionOptions, tr);
  const employmentStatusOptions = localizeLabels(__employmentStatusOptions, tr);
  const PTKP_OPTIONS = localizeLabels(__PTKP_OPTIONS, tr);

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initialForm = {
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    gender: employee?.gender ?? "",
    dob: employee?.dob ?? "",
    nik: employee?.nik ?? "",
    religion: employee?.religion ?? NONE,
    phone: employee?.phone ?? "",
    email: employee?.email ?? "",
    employeeCode: employee?.employeeCode ?? "",
    joinDate: employee?.joinDate ?? "",
    department: employee?.department ?? "",
    position: employee?.position ?? "",
    grade: employee?.grade ?? "",
    employmentStatus: employee?.employmentStatus ?? "TETAP",
    ptkpStatus: employee?.ptkpStatus ?? NONE,
    entityLocationId: employee?.entityLocationId ?? "",
    basicSalary:
      employee?.basicSalary != null ? String(employee.basicSalary) : "",
    salaryEffectiveDate: employee?.salaryEffectiveDate ?? "",
    npwp: employee?.npwp ?? "",
    fullAddress: employee?.fullAddress ?? "",
    city: employee?.city ?? "",
    province: employee?.province ?? "",
    postalCode: employee?.postalCode ?? "",
  };

  const [form, setForm] = useState(initialForm);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const salaryNumber = Number(form.basicSalary) || 0;

  function handleSubmit() {
    if (form.firstName.trim().length < 2) {
      toast.error(tr("Nama depan minimal 2 karakter"));
      return;
    }
    if (!form.gender) {
      toast.error(tr("Pilih jenis kelamin"));
      return;
    }
    if (form.employeeCode.trim().length < 2) {
      toast.error(tr("Kode karyawan wajib diisi"));
      return;
    }
    if (form.nik && !/^\d{16}$/.test(form.nik)) {
      toast.error(tr("No. KTP harus 16 digit angka"));
      return;
    }

    startTransition(async () => {
      const values = {
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender as "MALE",
        dob: form.dob ? new Date(form.dob) : undefined,
        nik: form.nik,
        religion: (form.religion === NONE ? "" : form.religion) as "ISLAM",
        phone: form.phone,
        email: form.email,
        employeeCode: form.employeeCode,
        joinDate: form.joinDate ? new Date(form.joinDate) : undefined,
        department: form.department,
        position: form.position,
        grade: form.grade,
        employmentStatus: form.employmentStatus as "TETAP",
        ptkpStatus: (form.ptkpStatus === NONE ? "" : form.ptkpStatus) as "TK/0",
        entityLocationId: form.entityLocationId,
        basicSalary: form.basicSalary,
        salaryEffectiveDate: form.salaryEffectiveDate
          ? new Date(form.salaryEffectiveDate)
          : undefined,
        npwp: form.npwp,
        fullAddress: form.fullAddress,
        city: form.city,
        province: form.province,
        postalCode: form.postalCode,
      };

      const result =
        mode === "create"
          ? await createEmployee(values)
          : await updateEmployee(employee!.id, values);

      if (result.success) {
        toast.success(
          mode === "create"
            ? tr("Pegawai {0} berhasil ditambahkan", { "0": form.firstName })
            : tr("Data pegawai {0} diperbarui", { "0": form.firstName })
        );
        if (mode === "create") setForm(initialForm);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (next) setForm(initialForm); setOpen(next); }}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {tr("Tambah Pegawai")}</Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" title={tr("Edit")}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{tr("Edit ")}{employee?.firstName}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? tr("Tambah Pegawai Baru") : tr("Edit Pegawai")}
          </DialogTitle>
          <DialogDescription>
            {tr("Lengkapi data pegawai yayasan di bawah ini.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 1. Data Pribadi */}
          <SectionTitle>{tr("Data Pribadi")}</SectionTitle>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-firstname">{tr("Nama Depan *")}</Label>
              <Input
                id="emp-firstname"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                placeholder={tr("mis. Budi")}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-lastname">{tr("Nama Belakang")}</Label>
              <Input
                id="emp-lastname"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                placeholder={tr("mis. Santoso")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label>{tr("Jenis Kelamin *")}</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => set("gender", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">{tr("Laki-laki")}</SelectItem>
                  <SelectItem value="FEMALE">{tr("Perempuan")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-dob">{tr("Tanggal Lahir")}</Label>
              <Input
                id="emp-dob"
                type="date"
                value={form.dob}
                onChange={(e) => set("dob", e.target.value)}
                max={todayStr()}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-nik">{tr("No. KTP (NIK)")}</Label>
              <Input
                id="emp-nik"
                value={form.nik}
                onChange={(e) => set("nik", e.target.value.replace(/\D/g, ""))}
                placeholder={tr("16 digit")}
                inputMode="numeric"
                maxLength={16}
              />
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
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-phone">{tr("No. Telp")}</Label>
              <Input
                id="emp-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder={tr("08xxxxxxxxxx")}
                inputMode="tel"
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-email">{tr("Email")}</Label>
              <Input
                id="emp-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="nama@email.com"
              />
            </div>
          </div>

          {/* 2. Kepegawaian */}
          <SectionTitle>{tr("Kepegawaian")}</SectionTitle>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-code">{tr("Kode Karyawan *")}</Label>
              <Input
                id="emp-code"
                value={form.employeeCode}
                onChange={(e) => set("employeeCode", e.target.value)}
                placeholder={tr("mis. KNK-001")}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-join">{tr("Tanggal Bergabung")}</Label>
              <Input
                id="emp-join"
                type="date"
                value={form.joinDate}
                onChange={(e) => set("joinDate", e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-dept">{tr("Department")}</Label>
              <CatalogSelect id="emp-dept" value={form.department} values={EMPLOYEE_DEPARTMENTS} onChange={v => set("department", v)} />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-position">{tr("Jabatan")}</Label>
              <CatalogSelect id="emp-position" value={form.position} values={EMPLOYEE_POSITIONS} onChange={v => set("position", v)} />
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-grade">{tr("Grade")}</Label>
              <Input
                id="emp-grade"
                value={form.grade}
                onChange={(e) => set("grade", e.target.value)}
                placeholder={tr("mis. G3")}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label>{tr("Status Kepegawaian *")}</Label>
              <Select
                value={form.employmentStatus}
                onValueChange={(v) => set("employmentStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employmentStatusOptions.map((o) => (
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
              <Label>{tr("Status PTKP")}</Label>
              <Select
                value={form.ptkpStatus}
                onValueChange={(v) => set("ptkpStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih PTKP")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{tr("Belum ditentukan")}</SelectItem>
                  {PTKP_OPTIONS.map((ptkp) => (
                    <SelectItem key={ptkp} value={ptkp}>
                      {ptkp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-entity">{tr("Entitas Lokasi")}</Label>
              <Select value={form.entityLocationId || NONE} onValueChange={v => set("entityLocationId", v === NONE ? "" : v)}>
                <SelectTrigger id="emp-entity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{tr("Belum ditentukan")}</SelectItem>
                  {locations.filter(location => location.isActive || location.id === employee?.entityLocationId).map(location => (
                    <SelectItem key={location.id} value={location.id} disabled={!location.isActive}>
                      {location.name}{!location.isActive && ` (${tr("Tidak aktif")})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!locations.some(location => location.isActive) && <Link className="text-xs text-primary underline" href="/dashboard/admin/settings?tab=locations">{tr("Atur entitas lokasi di Pengaturan Sistem")}</Link>}
            </div>
          </div>

          {/* 3. Gaji & Pajak */}
          <SectionTitle>{tr("Gaji & Pajak")}</SectionTitle>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-salary">{tr("Gaji Pokok (Rp)")}</Label>
              <Input
                id="emp-salary"
                type="number"
                min={0}
                step={100000}
                inputMode="numeric"
                value={form.basicSalary}
                onChange={(e) => set("basicSalary", e.target.value)}
                placeholder={tr("mis. 3500000")}
              />
              {salaryNumber > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatRupiah(salaryNumber, locale)} {tr(" / bulan")}</p>
              )}
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-salary-date">{tr("Tanggal Efektif Gaji")}</Label>
              <Input
                id="emp-salary-date"
                type="date"
                value={form.salaryEffectiveDate}
                onChange={(e) => set("salaryEffectiveDate", e.target.value)}
              />
            </div>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="emp-npwp">{tr("No. NPWP")}</Label>
            <Input
              id="emp-npwp"
              value={form.npwp}
              onChange={(e) => set("npwp", e.target.value)}
              placeholder={tr("mis. 12.345.678.9-012.345")}
            />
          </div>

          {/* 4. Alamat */}
          <SectionTitle>{tr("Alamat")}</SectionTitle>
          <div className="space-y-2">
            <Label htmlFor="emp-address">{tr("Alamat Lengkap")}</Label>
            <Textarea
              id="emp-address"
              value={form.fullAddress}
              onChange={(e) => set("fullAddress", e.target.value)}
              placeholder={tr("Jalan, nomor, RT/RW, kelurahan, kecamatan")}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/3">
              <Label htmlFor="emp-city">{tr("Kota")}</Label>
              <Input
                id="emp-city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder={tr("mis. Denpasar")}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/3">
              <Label htmlFor="emp-province">{tr("Provinsi")}</Label>
              <Input
                id="emp-province"
                value={form.province}
                onChange={(e) => set("province", e.target.value)}
                placeholder={tr("mis. Bali")}
              />
            </div>
            <div className="w-full space-y-2 md:w-1/3">
              <Label htmlFor="emp-postal">{tr("Kode Pos")}</Label>
              <Input
                id="emp-postal"
                value={form.postalCode}
                onChange={(e) =>
                  set("postalCode", e.target.value.replace(/\D/g, ""))
                }
                placeholder={tr("5 digit")}
                inputMode="numeric"
                maxLength={5}
              />
            </div>
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
              form.firstName.trim().length < 2 ||
              form.employeeCode.trim().length < 2 ||
              !form.gender
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

export function AddEmployeeDialog({ locations }: { locations: LocationOption[] }) {
  return <EmployeeFormDialog mode="create" locations={locations} />;
}

export function EditEmployeeDialog({ employee, locations }: { employee: EmployeeData; locations: LocationOption[] }) {
  return <EmployeeFormDialog mode="edit" employee={employee} locations={locations} />;
}

export function DeleteEmployeeButton({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEmployee(employeeId);
      if (result.success) {
        toast.success(tr("Pegawai {0} dihapus", { "0": employeeName }));
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
          <span className="sr-only">{tr("Hapus ")}{employeeName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("Hapus Pegawai?")}</DialogTitle>
          <DialogDescription>
            {tr("Data pegawai ")}<b>{employeeName}</b> {tr(" akan dihapus permanen.")}</DialogDescription>
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
const __employmentStatusOptions = employmentStatusOptions;
const __PTKP_OPTIONS = PTKP_OPTIONS;
