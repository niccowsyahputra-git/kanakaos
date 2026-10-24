import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
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
import { ChevronRight } from "lucide-react";
import { ScheduleVisitDialog } from "@/components/home-visits/schedule-visit-dialog";

export const dynamic = "force-dynamic";

const statusLabel: Record<VisitStatus, string> = {
  PLANNED: "Terjadwal",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

const statusClass: Record<VisitStatus, string> = {
  PLANNED: "border-transparent bg-yellow-100 text-yellow-800",
  DONE: "border-transparent bg-green-100 text-green-800",
  CANCELLED: "border-transparent bg-gray-100 text-gray-600",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function HomeVisitsPage() {
  const session = await requireStaffSession();
  if (!session) redirect("/dashboard");

  const [visits, children, staffOptions] = await Promise.all([
    prisma.homeVisit.findMany({
      include: {
        child: {
          select: { fullName: true, guardian: { select: { name: true } } },
        },
        officer: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { scheduledDate: "desc" }],
    }),
    prisma.child.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        fullName: true,
        guardian: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    // Petugas kunjungan: staff aktif (pekerja sosial & super admin)
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["SUPER_ADMIN", "SOCIAL_WORKER"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const plannedCount = visits.filter((v) => v.status === "PLANNED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Kunjungan Rumah
          </h2>
          <p className="text-sm text-muted-foreground">
            {plannedCount} kunjungan terjadwal dari total {visits.length}.
          </p>
        </div>
        <ScheduleVisitDialog
          children={children.map((child) => ({
            id: child.id,
            fullName: child.fullName,
            guardianName: child.guardian?.name ?? null,
          }))}
          staffOptions={staffOptions}
        />
      </div>

      {visits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada kunjungan rumah.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {visits.map((visit) => (
              <Card key={visit.id}>
                <CardContent className="p-4">
                  <Link
                    href={`/dashboard/home-visits/${visit.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold">
                        {visit.child.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Wali: {visit.child.guardian?.name ?? "-"} ·{" "}
                        {formatDate(visit.scheduledDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Petugas: {visit.officer?.name ?? "-"}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={statusClass[visit.status]}
                        >
                          {statusLabel[visit.status]}
                        </Badge>
                        {visit.vulnerabilityScore !== null && (
                          <span className="text-xs text-muted-foreground">
                            Skor: {visit.vulnerabilityScore}/10
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
                  <TableHead>Anak</TableHead>
                  <TableHead>Wali</TableHead>
                  <TableHead>Petugas</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Skor Kerentanan</TableHead>
                  <TableHead>Tujuan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/home-visits/${visit.id}`}
                        className="hover:underline"
                      >
                        {visit.child.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{visit.child.guardian?.name ?? "-"}</TableCell>
                    <TableCell>{visit.officer?.name ?? "-"}</TableCell>
                    <TableCell>{formatDate(visit.scheduledDate)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusClass[visit.status]}
                      >
                        {statusLabel[visit.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {visit.vulnerabilityScore !== null
                        ? `${visit.vulnerabilityScore}/10`
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {visit.purpose}
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
