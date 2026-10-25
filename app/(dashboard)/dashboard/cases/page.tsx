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
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "medium" }).format(
    date
  );
}

export default async function CasesPage() {
  const { tr, locale } = await getT();
  const statusClass = localizeLabels(__statusClass, tr);
  const priorityClass = localizeLabels(__priorityClass, tr);

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
          <h2 className="text-2xl font-bold tracking-tight">{tr("Kasus Anak")}</h2>
          <p className="text-sm text-muted-foreground">
            {openCount} {tr(" kasus aktif dari total ")}{cases.length} {tr(" kasus.")}</p>
        </div>
        <NewCaseDialog children={children} />
      </div>

      {cases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada kasus tercatat.")}</CardContent>
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
                        {tr(caseTypeLabel[caseItem.caseType])}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={statusClass[caseItem.status]}
                        >
                          {tr(statusLabel[caseItem.status])}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={priorityClass[caseItem.priority]}
                        >
                          {tr(priorityLabel[caseItem.priority])}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tr("PJ: ")}{caseItem.assignedTo.name} {tr(" · update")}{" "}
                        {formatDate(caseItem.updatedAt, locale)}
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
                  <TableHead>{tr("Anak")}</TableHead>
                  <TableHead>{tr("Jenis Kasus")}</TableHead>
                  <TableHead>{tr("Prioritas")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead>{tr("Penanggung Jawab")}</TableHead>
                  <TableHead>{tr("Update Terakhir")}</TableHead>
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
                    <TableCell>{tr(caseTypeLabel[caseItem.caseType])}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={priorityClass[caseItem.priority]}
                      >
                        {tr(priorityLabel[caseItem.priority])}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusClass[caseItem.status]}
                      >
                        {tr(statusLabel[caseItem.status])}
                      </Badge>
                    </TableCell>
                    <TableCell>{caseItem.assignedTo.name}</TableCell>
                    <TableCell>{formatDate(caseItem.updatedAt, locale)}</TableCell>
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

const __statusClass = statusClass;
const __priorityClass = priorityClass;
