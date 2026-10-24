import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
import { UserDialog } from "@/components/admin/user-dialog";
import { UserActions } from "@/components/admin/user-actions";
import { UserFilters } from "@/components/admin/user-filters";

const roleLabel: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  SOCIAL_WORKER: "Pekerja Sosial",
  CAREGIVER: "Pengasuh",
  VOLUNTEER: "Relawan",
  FINANCE: "Bendahara",
  LOGISTICS: "Logistik",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

/** Konten Manajemen User — dirender sebagai tab di Pengaturan Sistem */
export async function UsersSection({
  sessionUserId,
  q,
  role,
}: {
  sessionUserId: string;
  q?: string;
  role?: string;
}) {
  const roleFilter = Object.values(UserRole).includes(role as UserRole)
    ? (role as UserRole)
    : undefined;

  const where: Prisma.UserWhereInput = {
    ...(roleFilter && { role: roleFilter }),
    ...(q && {
      OR: [{ name: { contains: q } }, { email: { contains: q } }],
    }),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      employee: { select: { employeeCode: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length} user ditemukan. Akun untuk pegawai bisa dibuat dari
          menu Data Pegawai.
        </p>
        <UserDialog />
      </div>

      <UserFilters />

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Tidak ada user yang cocok dengan filter.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{user.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        user.isActive
                          ? "border-transparent bg-green-100 text-green-800"
                          : "border-transparent bg-gray-100 text-gray-500"
                      }
                    >
                      {user.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {roleLabel[user.role]}
                      {user.employee
                        ? ` · Pegawai ${user.employee.employeeCode}`
                        : ""}{" "}
                      · sejak {formatDate(user.createdAt)}
                    </span>
                    <UserActions
                      user={user}
                      isSelf={user.id === sessionUserId}
                    />
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
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Pegawai</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className={user.isActive ? "" : "opacity-60"}
                  >
                    <TableCell className="font-medium">
                      {user.name}
                      {user.id === sessionUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Anda)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{roleLabel[user.role]}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {user.employee?.employeeCode ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          user.isActive
                            ? "border-transparent bg-green-100 text-green-800"
                            : "border-transparent bg-gray-100 text-gray-500"
                        }
                      >
                        {user.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <UserActions
                        user={user}
                        isSelf={user.id === sessionUserId}
                      />
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
