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

function EmployeeFormDialog({
  mode,
  employee,
}: {
  mode: "create" | "edit";
  employee?: EmployeeData;
}) {
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
    entityLocation: employee?.entityLocation ?? "",
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
      toast.error("Nama depan minimal 2 karakter");
      return;
    }
    if (!form.gender) {
      toast.error("Pilih jenis kelamin");
      return;
    }
    if (form.employeeCode.trim().length < 2) {
      toast.error("Kode karyawan wajib diisi");
      return;
    }
    if (form.nik && !/^\d{16}$/.test(form.nik)) {
      toast.error("No. KTP harus 16 digit angka");
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
        entityLocation: form.entityLocation,
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
            ? `Pegawai ${form.firstName} berhasil ditambahkan`
            : `Data pegawai ${form.firstName} diperbarui`
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Tambah Pegawai
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit {employee?.firstName}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah Pegawai Baru" : "Edit Pegawai"}
          </DialogTitle>
          <DialogDescription>
            Lengkapi data pegawai yayasan di bawah ini.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 1. Data Pribadi */}
          <SectionTitle>Data Pribadi</SectionTitle>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-firstname">Nama Depan *</Label>
              <Input
                id="emp-firstname"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                placeholder="mis. Budi"
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-lastname">Nama Belakang</Label>
              <Input
                id="emp-lastname"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                placeholder="mis. Santoso"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label>Jenis Kelamin *</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => set("gender", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Laki-laki</SelectItem>
                  <SelectItem value="FEMALE">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-dob">Tanggal Lahir</Label>
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
              <Label htmlFor="emp-nik">No. KTP (NIK)</Label>
              <Input
                id="emp-nik"
                value={form.nik}
                onChange={(e) => set("nik", e.target.value.replace(/\D/g, ""))}
                placeholder="16 digit"
                inputMode="numeric"
                maxLength={16}
              />
            </div>
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
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-phone">No. Telp</Label>
              <Input
                id="emp-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="08xxxxxxxxxx"
                inputMode="tel"
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-email">Email</Label>
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
          <SectionTitle>Kepegawaian</SectionTitle>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-code">Kode Karyawan *</Label>
              <Input
                id="emp-code"
                value={form.employeeCode}
                onChange={(e) => set("employeeCode", e.target.value)}
                placeholder="mis. KNK-001"
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-join">Tanggal Bergabung</Label>
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
              <Label htmlFor="emp-dept">Department</Label>
              <Input
                id="emp-dept"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                placeholder="mis. Pengasuhan / Keuangan / Umum"
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-position">Jabatan</Label>
              <Input
                id="emp-position"
                value={form.position}
                onChange={(e) => set("position", e.target.value)}
                placeholder="mis. Pengasuh Senior"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-grade">Grade</Label>
              <Input
                id="emp-grade"
                value={form.grade}
                onChange={(e) => set("grade", e.target.value)}
                placeholder="mis. G3"
              />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label>Status Kepegawaian *</Label>
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
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label>Status PTKP</Label>
              <Select
                value={form.ptkpStatus}
                onValueChange={(v) => set("ptkpStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih PTKP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Belum ditentukan</SelectItem>
                  {PTKP_OPTIONS.map((ptkp) => (
                    <SelectItem key={ptkp} value={ptkp}>
                      {ptkp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-entity">Entitas Lokasi</Label>
              <Input
                id="emp-entity"
                value={form.entityLocation}
                onChange={(e) => set("entityLocation", e.target.value)}
                placeholder="mis. Yayasan Kanaka - Denpasar"
              />
            </div>
          </div>

          {/* 3. Gaji & Pajak */}
          <SectionTitle>Gaji &amp; Pajak</SectionTitle>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-salary">Gaji Pokok (Rp)</Label>
              <Input
                id="emp-salary"
                type="number"
                min={0}
                step={100000}
                inputMode="numeric"
                value={form.basicSalary}
                onChange={(e) => set("basicSalary", e.target.value)}
                placeholder="mis. 3500000"
              />
              {salaryNumber > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatRupiah(salaryNumber)} / bulan
                </p>
              )}
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="emp-salary-date">Tanggal Efektif Gaji</Label>
              <Input
                id="emp-salary-date"
                type="date"
                value={form.salaryEffectiveDate}
                onChange={(e) => set("salaryEffectiveDate", e.target.value)}
              />
            </div>
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="emp-npwp">No. NPWP</Label>
            <Input
              id="emp-npwp"
              value={form.npwp}
              onChange={(e) => set("npwp", e.target.value)}
              placeholder="mis. 12.345.678.9-012.345"
            />
          </div>

          {/* 4. Alamat */}
          <SectionTitle>Alamat</SectionTitle>
          <div className="space-y-2">
            <Label htmlFor="emp-address">Alamat Lengkap</Label>
            <Textarea
              id="emp-address"
              value={form.fullAddress}
              onChange={(e) => set("fullAddress", e.target.value)}
              placeholder="Jalan, nomor, RT/RW, kelurahan, kecamatan"
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/3">
              <Label htmlFor="emp-city">Kota</Label>
              <Input
                id="emp-city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="mis. Denpasar"
              />
            </div>
            <div className="w-full space-y-2 md:w-1/3">
              <Label htmlFor="emp-province">Provinsi</Label>
              <Input
                id="emp-province"
                value={form.province}
                onChange={(e) => set("province", e.target.value)}
                placeholder="mis. Bali"
              />
            </div>
            <div className="w-full space-y-2 md:w-1/3">
              <Label htmlFor="emp-postal">Kode Pos</Label>
              <Input
                id="emp-postal"
                value={form.postalCode}
                onChange={(e) =>
                  set("postalCode", e.target.value.replace(/\D/g, ""))
                }
                placeholder="5 digit"
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
            Batal
          </Button>
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
                Menyimpan...
              </>
            ) : mode === "create" ? (
              "Simpan"
            ) : (
              "Simpan Perubahan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddEmployeeDialog() {
  return <EmployeeFormDialog mode="create" />;
}

export function EditEmployeeDialog({ employee }: { employee: EmployeeData }) {
  return <EmployeeFormDialog mode="edit" employee={employee} />;
}

export function DeleteEmployeeButton({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEmployee(employeeId);
      if (result.success) {
        toast.success(`Pegawai ${employeeName} dihapus`);
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
          <span className="sr-only">Hapus {employeeName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hapus Pegawai?</DialogTitle>
          <DialogDescription>
            Data pegawai <b>{employeeName}</b> akan dihapus permanen.
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
