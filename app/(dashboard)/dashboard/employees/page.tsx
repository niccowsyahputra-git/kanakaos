import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AddEmployeeDialog,
  EditEmployeeDialog,
  DeleteEmployeeButton,
  type EmployeeData,
} from "@/components/employees/employee-tools";
import {
  CreateAccountDialog,
  EmployeeAccountBadge,
} from "@/components/employees/employee-account";
import { employmentStatusLabel } from "@/components/employees/employee-labels";
import { getT } from "@/lib/i18n/server";
import { EmployeeDetailDialog, EmployeeStatusControl, EmployeeStatusFilter } from "@/components/employees/employee-detail";
import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS, EMPLOYEE_DEPARTMENTS, EMPLOYEE_POSITIONS, catalogLabel } from "@/lib/option-catalogs";
import type { EmployeeStatus } from "@prisma/client";


export const dynamic = "force-dynamic";

function toDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

const statusClass: Record<string, string> = {
  TETAP: "border-transparent bg-green-100 text-green-800",
  KONTRAK: "border-transparent bg-blue-100 text-blue-800",
  HARIAN: "border-transparent bg-amber-100 text-amber-800",
};

export default async function EmployeesPage({ searchParams }: { searchParams: { status?: string } }) {
  const { tr, locale } = await getT();

  const session = await requireSuperAdminSession();
  if (!session) redirect("/dashboard");

  const status = EMPLOYEE_STATUSES.includes(searchParams.status as EmployeeStatus) ? searchParams.status as EmployeeStatus : undefined;
  const [employees, locations] = await Promise.all([
    prisma.employee.findMany({
      where: { status },
      orderBy: { employeeCode: "asc" },
      include: { location: true, user: { select: { email: true, role: true, isActive: true } } },
    }),
    prisma.employeeLocation.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
  ]);

  // Map ke tipe form (Date -> string yyyy-mm-dd) untuk dialog edit
  function toFormData(e: (typeof employees)[number]): EmployeeData {
    return {
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      gender: e.gender,
      dob: toDateInput(e.dob),
      nik: e.nik,
      religion: e.religion,
      phone: e.phone,
      email: e.email,
      employeeCode: e.employeeCode,
      joinDate: toDateInput(e.joinDate),
      department: e.department,
      position: e.position,
      grade: e.grade,
      employmentStatus: e.employmentStatus,
      ptkpStatus: e.ptkpStatus,
      entityLocation: e.location?.name ?? e.entityLocation,
      entityLocationId: e.entityLocationId,
      status: e.status,
      account: e.user ? { ...e.user, isActive: e.user.isActive && e.status === "ACTIVE" } : null,
      basicSalary: e.basicSalary,
      salaryEffectiveDate: toDateInput(e.salaryEffectiveDate),
      npwp: e.npwp,
      fullAddress: e.fullAddress,
      city: e.city,
      province: e.province,
      postalCode: e.postalCode,
    };
  }

  const fullName = (e: (typeof employees)[number]) =>
    `${e.firstName}${e.lastName ? ` ${e.lastName}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tr("Data Pegawai")}</h2>
          <p className="text-sm text-muted-foreground">
            {employees.length} {tr(" pegawai yayasan terdaftar. Data gaji & pajak bersifat rahasia.")}</p>
        </div>
        <AddEmployeeDialog locations={locations} />
      </div>

      <EmployeeStatusFilter />
      {employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada data pegawai. Tambahkan pegawai pertama.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {employees.map((e) => (
              <Card key={e.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{fullName(e)}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.employeeCode}
                        {e.position ? ` · ${catalogLabel(e.position, EMPLOYEE_POSITIONS, tr)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <EmployeeDetailDialog employee={toFormData(e)} />
                                            <EditEmployeeDialog employee={toFormData(e)} locations={locations} />
                      <DeleteEmployeeButton
                        employeeId={e.id}
                        employeeName={fullName(e)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={statusClass[e.employmentStatus]}
                    >
                      {tr(employmentStatusLabel[e.employmentStatus])}
                    </Badge>
                    {e.department && (
                      <Badge variant="secondary">{catalogLabel(e.department, EMPLOYEE_DEPARTMENTS, tr)}</Badge>
                    )}
                    {e.basicSalary != null && (
                      <Badge variant="outline">
                        {formatRupiah(e.basicSalary, locale)}
                      </Badge>
                    )}
                  </div>
                  {(e.phone || e.email) && (
                    <p className="text-xs text-muted-foreground">
                      {[e.phone, e.email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2"><Badge variant={e.status === "ACTIVE" ? "secondary" : "outline"}>{tr(EMPLOYEE_STATUS_LABELS[e.status])}</Badge><EmployeeStatusControl id={e.id} status={e.status} /></div>
                  <div className="border-t pt-2">
                    {e.user ? (
                      <EmployeeAccountBadge
                        email={e.user.email}
                        role={e.user.role}
                        isActive={e.user.isActive && e.status === "ACTIVE"}
                      />
                    ) : (
                      <CreateAccountDialog
                        employeeId={e.id}
                        employeeName={fullName(e)}
                        employeeEmail={e.email}
                                                disabled={e.status !== "ACTIVE"}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Kode")}</TableHead>
                  <TableHead>{tr("Nama")}</TableHead>
                  <TableHead>{tr("Department")}</TableHead>
                  <TableHead>{tr("Jabatan")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead>{tr("Akun Login")}</TableHead>
                  <TableHead className="text-right">{tr("Gaji Pokok")}</TableHead>
                  <TableHead className="text-right">{tr("Aksi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">
                      {e.employeeCode}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{fullName(e)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[e.phone, e.email].filter(Boolean).join(" · ") || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{catalogLabel(e.department, EMPLOYEE_DEPARTMENTS, tr) ?? "-"}</TableCell>
                    <TableCell>{catalogLabel(e.position, EMPLOYEE_POSITIONS, tr) ?? "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusClass[e.employmentStatus]}
                      >
                        {tr(employmentStatusLabel[e.employmentStatus])}
                      </Badge>
                      <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{tr(EMPLOYEE_STATUS_LABELS[e.status])}</Badge><EmployeeStatusControl id={e.id} status={e.status} /></div>
                    </TableCell>
                    <TableCell>
                      {e.user ? (
                        <EmployeeAccountBadge
                          email={e.user.email}
                          role={e.user.role}
                          isActive={e.user.isActive && e.status === "ACTIVE"}
                        />
                      ) : (
                        <CreateAccountDialog
                          employeeId={e.id}
                          employeeName={fullName(e)}
                          employeeEmail={e.email}
                                                  disabled={e.status !== "ACTIVE"}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {e.basicSalary != null
                        ? formatRupiah(e.basicSalary, locale)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <EmployeeDetailDialog employee={toFormData(e)} />
                                              <EditEmployeeDialog employee={toFormData(e)} locations={locations} />
                        <DeleteEmployeeButton
                          employeeId={e.id}
                          employeeName={fullName(e)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
