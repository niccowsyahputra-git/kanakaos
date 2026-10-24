import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
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
import { ReportIncidentDialog } from "@/components/incidents/report-incident-dialog";
import {
  incidentTypeLabel,
  incidentStatusLabel,
  incidentStatusClass,
  incidentUrgencyLabel,
  incidentUrgencyClass,
} from "@/components/incidents/incident-labels";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function IncidentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [incidents, children] = await Promise.all([
    prisma.incident.findMany({
      include: {
        child: { select: { fullName: true } },
        reportedBy: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.child.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const openCount = incidents.filter((i) => i.status !== "RESOLVED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Laporan Insiden
          </h2>
          <p className="text-sm text-muted-foreground">
            {openCount} insiden belum selesai dari total {incidents.length}.
          </p>
        </div>
        <ReportIncidentDialog children={children} />
      </div>

      {incidents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada laporan insiden. Semoga selalu begitu. 🙏
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {incidents.map((incident) => (
              <Card key={incident.id}>
                <CardContent className="p-4">
                  <Link
                    href={`/dashboard/incidents/${incident.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <p className="truncate font-semibold">
                        {incident.child.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {incidentTypeLabel[incident.incidentType]} ·{" "}
                        {formatDate(incident.createdAt)}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={incidentStatusClass[incident.status]}
                        >
                          {incidentStatusLabel[incident.status]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={incidentUrgencyClass[incident.urgency]}
                        >
                          {incidentUrgencyLabel[incident.urgency]}
                        </Badge>
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
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Anak</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Urgensi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pelapor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(incident.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/incidents/${incident.id}`}
                        className="hover:underline"
                      >
                        {incident.child.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {incidentTypeLabel[incident.incidentType]}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={incidentUrgencyClass[incident.urgency]}
                      >
                        {incidentUrgencyLabel[incident.urgency]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={incidentStatusClass[incident.status]}
                      >
                        {incidentStatusLabel[incident.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{incident.reportedBy.name}</TableCell>
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
