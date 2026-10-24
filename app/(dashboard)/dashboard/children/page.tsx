import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
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
import { Plus, ChevronRight } from "lucide-react";
import { ChildStatus } from "@prisma/client";
import { DeleteChildButton } from "@/components/children/delete-child-button";

export const dynamic = "force-dynamic";

const statusLabel: Record<ChildStatus, string> = {
  ACTIVE: "Aktif",
  REINTEGRATED: "Reintegrasi",
  GRADUATED: "Lulus",
};

const statusVariant: Record<
  ChildStatus,
  "default" | "secondary" | "outline"
> = {
  ACTIVE: "default",
  REINTEGRATED: "secondary",
  GRADUATED: "outline",
};

function formatAge(dob: Date) {
  const diff = Date.now() - dob.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return `${years} tahun`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function ChildrenPage() {
  const children = await prisma.child.findMany({
    include: { guardian: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Anak Asuh</h2>
          <p className="text-sm text-muted-foreground">
            Total {children.length} anak terdaftar.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/children/new">
            <Plus className="h-4 w-4" />
            Tambah Anak
          </Link>
        </Button>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-muted-foreground">Belum ada data anak asuh.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/children/new">Tambah anak pertama</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {children.map((child) => (
              <Card key={child.id}>
                <CardContent className="p-4">
                  <Link
                    href={`/dashboard/children/${child.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold">
                        {child.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {child.gender === "MALE" ? "Laki-laki" : "Perempuan"}{" "}
                        · {formatAge(child.dob)}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge variant={statusVariant[child.status]}>
                          {statusLabel[child.status]}
                        </Badge>
                        {child.guardian && (
                          <span className="truncate text-xs text-muted-foreground">
                            Wali: {child.guardian.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
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
                  <TableHead>Jenis Kelamin</TableHead>
                  <TableHead>Usia</TableHead>
                  <TableHead>Masuk</TableHead>
                  <TableHead>Wali</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {children.map((child) => (
                  <TableRow key={child.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/children/${child.id}`}
                        className="hover:underline"
                      >
                        {child.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {child.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                    </TableCell>
                    <TableCell>{formatAge(child.dob)}</TableCell>
                    <TableCell>{formatDate(child.admissionDate)}</TableCell>
                    <TableCell>{child.guardian?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[child.status]}>
                        {statusLabel[child.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/children/${child.id}`}>
                            Detail
                          </Link>
                        </Button>
                        <DeleteChildButton
                          childId={child.id}
                          childName={child.fullName}
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
