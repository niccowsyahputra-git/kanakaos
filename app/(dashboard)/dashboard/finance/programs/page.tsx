import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { getProgramBalances } from "@/lib/finance-balance";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileText } from "lucide-react";
import {
  AddProgramDialog,
  EditProgramDialog,
  DeleteProgramButton,
} from "@/components/finance/program-tools";
import {
  programFieldLabel,
  programStatusLabel,
  programStatusClass,
  formatRupiah,
} from "@/components/finance/finance-labels";
import type { ProgramField, ProgramStatus } from "@prisma/client";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

function toDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "medium" }).format(
    date
  );
}

export default async function ProgramsPage() {
  const { tr, locale } = await getT();
  const programStatusClass = localizeLabels(__programStatusClass, tr);

  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const [programs, balances, staffOptions] = await Promise.all([
    prisma.program.findMany({
      orderBy: { createdAt: "desc" },
      include: { pic: { select: { name: true } } },
    }),
    getProgramBalances(),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const balanceMap = new Map(balances.map((b) => [b.id, b.balance]));

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/finance">
          <ArrowLeft className="h-4 w-4" />
          {tr("Keuangan")}</Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tr("Program")}</h2>
          <p className="text-sm text-muted-foreground">
            {programs.length} {tr(" program ·")}{" "}
            {programs.filter((p) => p.status === "AKTIF").length} {tr(" aktif.")}</p>
        </div>
        <AddProgramDialog staffOptions={staffOptions} />
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada program. Buat program untuk menampung dana terikat.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile */}
          <div className="flex flex-col gap-3 md:hidden">
            {programs.map((program) => (
              <Card key={program.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {program.code}
                      </p>
                      <Link href={`/dashboard/finance/programs/${program.id}`} className="block truncate font-semibold text-primary hover:underline">{program.name}</Link>
                      <p className="text-xs text-muted-foreground">
                        {tr(programFieldLabel[program.field as ProgramField])} {tr(" · PJ:")}{" "}
                        {program.pic?.name ?? "-"}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <EditProgramDialog
                        program={{
                          id: program.id,
                          code: program.code,
                          name: program.name,
                          field: program.field,
                          fundraisingTarget: program.fundraisingTarget,
                          maxBudget: program.maxBudget,
                          startDate: toDateInput(program.startDate),
                          picId: program.picId,
                          status: program.status,
                          leftoverRule: program.leftoverRule,
                          description: program.description,
                        }}
                        staffOptions={staffOptions}
                      />
                      <DeleteProgramButton
                        programId={program.id}
                        programName={program.name}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        programStatusClass[program.status as ProgramStatus]
                      }
                    >
                      {tr(programStatusLabel[program.status as ProgramStatus])}
                    </Badge>
                    <span className="text-xs font-medium">
                      {tr("Saldo: ")}{formatRupiah(balanceMap.get(program.id) ?? 0, locale)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr("Target ")}{formatRupiah(program.fundraisingTarget, locale)} {tr(" · Anggaran maks ")}{formatRupiah(program.maxBudget, locale)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Kode")}</TableHead>
                  <TableHead>{tr("Nama Program")}</TableHead>
                  <TableHead>{tr("Bidang")}</TableHead>
                  <TableHead>{tr("Target Dana")}</TableHead>
                  <TableHead>{tr("Sisa Saldo")}</TableHead>
                  <TableHead>{tr("Mulai")}</TableHead>
                  <TableHead>{tr("PJ")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead className="text-right">{tr("Aksi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {program.code}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/finance/programs/${program.id}`} className="font-medium text-primary hover:underline">{program.name}</Link>
                      {program.proposalUrl && (
                        <a
                          href={program.proposalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          {tr("Proposal")}</a>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {tr(programFieldLabel[program.field as ProgramField])}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatRupiah(program.fundraisingTarget, locale)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatRupiah(balanceMap.get(program.id) ?? 0, locale)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {program.startDate ? formatDate(program.startDate, locale) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {program.pic?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          programStatusClass[program.status as ProgramStatus]
                        }
                      >
                        {tr(programStatusLabel[program.status as ProgramStatus])}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <EditProgramDialog
                          program={{
                            id: program.id,
                            code: program.code,
                            name: program.name,
                            field: program.field,
                            fundraisingTarget: program.fundraisingTarget,
                            maxBudget: program.maxBudget,
                            startDate: toDateInput(program.startDate),
                            picId: program.picId,
                            status: program.status,
                            leftoverRule: program.leftoverRule,
                            description: program.description,
                          }}
                          staffOptions={staffOptions}
                        />
                        <DeleteProgramButton
                          programId={program.id}
                          programName={program.name}
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

const __programStatusClass = programStatusClass;
