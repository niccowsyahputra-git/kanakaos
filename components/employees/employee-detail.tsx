"use client";

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { setEmployeeStatus } from "@/lib/actions/employee";
import { useI18n } from "@/lib/i18n/client";
import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS, EMPLOYEE_DEPARTMENTS, EMPLOYEE_POSITIONS, catalogLabel, dateOnlyLabel } from "@/lib/option-catalogs";
import { formatRupiah } from "@/lib/utils";
import { employmentStatusLabel } from "./employee-labels";
import type { EmployeeData } from "./employee-tools";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function EmployeeDetailDialog({ employee: e }: { employee: EmployeeData }) {
  const { tr, locale, t } = useI18n();
  const date = (v: string | null) => v ? dateOnlyLabel(v, locale) : "—";
  const groups: { title: string; rows: [string, string | null][] }[] = [
    { title: "Data Pribadi", rows: [
      ["Nama Lengkap", `${e.firstName} ${e.lastName ?? ""}`.trim()], ["Jenis Kelamin", tr(e.gender === "MALE" ? "Laki-laki" : "Perempuan")],
      ["Tanggal Lahir", date(e.dob)], ["NIK", e.nik], ["Agama", e.religion], ["No. HP", e.phone], ["Email", e.email],
    ] },
    { title: "Kepegawaian", rows: [
      ["Kode Karyawan", e.employeeCode], ["Tanggal Bergabung", date(e.joinDate)], ["Department", catalogLabel(e.department, EMPLOYEE_DEPARTMENTS, tr)],
      ["Jabatan", catalogLabel(e.position, EMPLOYEE_POSITIONS, tr)], ["Grade", e.grade], ["Status Kepegawaian", tr(employmentStatusLabel[e.employmentStatus as keyof typeof employmentStatusLabel] ?? e.employmentStatus)],
      ["Status Pegawai", tr(EMPLOYEE_STATUS_LABELS[e.status])], ["Entitas Lokasi", e.entityLocation],
    ] },
    { title: "Gaji & Pajak", rows: [
      ["Gaji Pokok", e.basicSalary == null ? null : formatRupiah(e.basicSalary, locale)], ["Tanggal Efektif Gaji", date(e.salaryEffectiveDate)], ["NPWP", e.npwp], ["Status PTKP", e.ptkpStatus],
    ] },
    { title: "Alamat", rows: [["Alamat Lengkap", e.fullAddress], ["Kota", e.city], ["Provinsi", e.province], ["Kode Pos", e.postalCode]] },
    { title: "Akun Login", rows: [["Email", e.account?.email ?? null], ["Role", e.account ? t.common.role[e.account.role as keyof typeof t.common.role] ?? e.account.role : null], ["Status", e.account ? tr(e.account.isActive ? "Aktif" : "Tidak aktif") : tr("Belum ada akun")]] },
  ];
  return <Dialog><DialogTrigger asChild><Button variant="outline" size="sm"><Eye className="h-4 w-4" />{tr("Lihat Detail")}</Button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{e.firstName} {e.lastName}</DialogTitle><DialogDescription>{tr("Detail data pegawai")}</DialogDescription></DialogHeader>
      {groups.map(group => <section key={group.title} className="space-y-2">
        <h3 className="border-b pb-1 font-semibold">{tr(group.title)}</h3>
        <dl className="space-y-2 text-sm">{group.rows.map(([label, value]) => <div key={label} className="grid gap-1 sm:grid-cols-2"><dt className="text-muted-foreground">{tr(label)}</dt><dd className="break-words whitespace-pre-wrap">{value || "—"}</dd></div>)}</dl>
      </section>)}
    </DialogContent>
  </Dialog>;
}

export function EmployeeStatusControl({ id, status }: { id: string; status: EmployeeData["status"] }) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(status);
  const [pending, startTransition] = useTransition();
  return <Dialog open={open} onOpenChange={v => { if (v) setSelected(status); setOpen(v); }}>
    <DialogTrigger asChild><Button variant="outline" size="sm">{tr("Ubah Status")}</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>{tr("Status Pegawai")}</DialogTitle><DialogDescription>{tr("Pegawai suspend atau tidak aktif tidak dapat mengakses aplikasi. Akun yang dinonaktifkan secara manual tetap nonaktif.")}</DialogDescription></DialogHeader>
      <Select value={selected} onValueChange={setSelected}><SelectTrigger aria-label={tr("Status Pegawai")}><SelectValue /></SelectTrigger><SelectContent>{EMPLOYEE_STATUSES.map(value => <SelectItem key={value} value={value}>{tr(EMPLOYEE_STATUS_LABELS[value])}</SelectItem>)}</SelectContent></Select>
      <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>{tr("Batal")}</Button>
        <Button disabled={pending || selected === status} onClick={() => startTransition(async () => {
          const result = await setEmployeeStatus(id, selected);
          if (result.success) { toast.success(tr("Status pegawai diperbarui")); setOpen(false); } else toast.error(result.error);
        })}>{tr(pending ? "Menyimpan..." : "Simpan")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function EmployeeStatusFilter() {
  const { tr } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  return <Select value={params.get("status") ?? "ALL"} onValueChange={value => {
    const next = new URLSearchParams(params.toString());
    if (value === "ALL") next.delete("status"); else next.set("status", value);
    router.push(`/dashboard/employees?${next}`);
  }}><SelectTrigger className="w-full sm:w-52" aria-label={tr("Status Pegawai")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{tr("Semua Status")}</SelectItem>{EMPLOYEE_STATUSES.map(value => <SelectItem key={value} value={value}>{tr(EMPLOYEE_STATUS_LABELS[value])}</SelectItem>)}</SelectContent></Select>;
}
