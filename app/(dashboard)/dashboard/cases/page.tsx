import Link from "next/link";
import { redirect } from "next/navigation";
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
import { NewCaseDialog } from "@/components/cases/new-case-dialog";
import {
  caseTypeLabel,
  caseStatusLabel as statusLabel,
  caseStatusClass as statusClass,
  casePriorityLabel as priorityLabel,
  casePriorityClass as priorityClass,
} from "@/components/cases/case-labels";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function CasesPage() {
  const session = await requireStaffSession();
  if (!session) redirect("/dashboard");

  const [cases, children] = await Promise.all([
    prisma.case.findMany({
      include: {
        child: { select: { fullName: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.child.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const openCount = cases.filter((c) => c.status !== "CLOSED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Kasus Anak</h2>
          <p className="text-sm text-muted-foreground">
            {openCount} kasus aktif dari total {cases.length} kasus.
          </p>
        </div>
        <NewCaseDialog children={children} />
      </div>

      {cases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada kasus tercatat.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {cases.map((caseItem) => (
              <Card key={caseItem.id}>
                <CardContent className="p-4">
                  <Link
                    href={`/dashboard/cases/${caseItem.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <p className="truncate font-semibold">
                        {caseItem.child.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {caseTypeLabel[caseItem.caseType]}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={statusClass[caseItem.status]}
                        >
                          {statusLabel[caseItem.status]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={priorityClass[caseItem.priority]}
                        >
                          {priorityLabel[caseItem.priority]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PJ: {caseItem.assignedTo.name} · update{" "}
                        {formatDate(caseItem.updatedAt)}
                      </p>
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
                  <TableHead>Jenis Kasus</TableHead>
                  <TableHead>Prioritas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Penanggung Jawab</TableHead>
                  <TableHead>Update Terakhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((caseItem) => (
                  <TableRow key={caseItem.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/cases/${caseItem.id}`}
                        className="hover:underline"
                      >
                        {caseItem.child.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{caseTypeLabel[caseItem.caseType]}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={priorityClass[caseItem.priority]}
                      >
                        {priorityLabel[caseItem.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusClass[caseItem.status]}
                      >
                        {statusLabel[caseItem.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{caseItem.assignedTo.name}</TableCell>
                    <TableCell>{formatDate(caseItem.updatedAt)}</TableCell>
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
