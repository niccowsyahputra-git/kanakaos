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

export const dynamic = "force-dynamic";

function toDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

const statusClass: Record<string, string> = {
  TETAP: "border-transparent bg-green-100 text-green-800",
  KONTRAK: "border-transparent bg-blue-100 text-blue-800",
  HARIAN: "border-transparent bg-amber-100 text-amber-800",
};

export default async function EmployeesPage() {
  const session = await requireSuperAdminSession();
  if (!session) redirect("/dashboard");

  const employees = await prisma.employee.findMany({
    orderBy: { employeeCode: "asc" },
    include: {
      user: { select: { email: true, role: true, isActive: true } },
    },
  });

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
      entityLocation: e.entityLocation,
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
          <h2 className="text-2xl font-bold tracking-tight">Data Pegawai</h2>
          <p className="text-sm text-muted-foreground">
            {employees.length} pegawai yayasan terdaftar. Data gaji &amp; pajak
            bersifat rahasia.
          </p>
        </div>
        <AddEmployeeDialog />
      </div>

      {employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada data pegawai. Tambahkan pegawai pertama.
          </CardContent>
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
                        {e.position ? ` · ${e.position}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <EditEmployeeDialog employee={toFormData(e)} />
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
                      {employmentStatusLabel[e.employmentStatus]}
                    </Badge>
                    {e.department && (
                      <Badge variant="secondary">{e.department}</Badge>
                    )}
                    {e.basicSalary != null && (
                      <Badge variant="outline">
                        {formatRupiah(e.basicSalary)}
                      </Badge>
                    )}
                  </div>
                  {(e.phone || e.email) && (
                    <p className="text-xs text-muted-foreground">
                      {[e.phone, e.email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="border-t pt-2">
                    {e.user ? (
                      <EmployeeAccountBadge
                        email={e.user.email}
                        role={e.user.role}
                        isActive={e.user.isActive}
                      />
                    ) : (
                      <CreateAccountDialog
                        employeeId={e.id}
                        employeeName={fullName(e)}
                        employeeEmail={e.email}
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
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Akun Login</TableHead>
                  <TableHead className="text-right">Gaji Pokok</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
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
                    <TableCell>{e.department ?? "-"}</TableCell>
                    <TableCell>{e.position ?? "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusClass[e.employmentStatus]}
                      >
                        {employmentStatusLabel[e.employmentStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {e.user ? (
                        <EmployeeAccountBadge
                          email={e.user.email}
                          role={e.user.role}
                          isActive={e.user.isActive}
                        />
                      ) : (
                        <CreateAccountDialog
                          employeeId={e.id}
                          employeeName={fullName(e)}
                          employeeEmail={e.email}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {e.basicSalary != null
                        ? formatRupiah(e.basicSalary)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <EditEmployeeDialog employee={toFormData(e)} />
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
