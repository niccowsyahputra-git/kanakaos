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

export const dynamic = "force-dynamic";

function toDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function ProgramsPage() {
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
          Keuangan
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Program</h2>
          <p className="text-sm text-muted-foreground">
            {programs.length} program ·{" "}
            {programs.filter((p) => p.status === "AKTIF").length} aktif.
          </p>
        </div>
        <AddProgramDialog staffOptions={staffOptions} />
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada program. Buat program untuk menampung dana terikat.
          </CardContent>
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
                      <p className="truncate font-semibold">{program.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {programFieldLabel[program.field as ProgramField]} · PJ:{" "}
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
                      {programStatusLabel[program.status as ProgramStatus]}
                    </Badge>
                    <span className="text-xs font-medium">
                      Saldo: {formatRupiah(balanceMap.get(program.id) ?? 0)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target {formatRupiah(program.fundraisingTarget)} · Anggaran
                    maks {formatRupiah(program.maxBudget)}
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
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Program</TableHead>
                  <TableHead>Bidang</TableHead>
                  <TableHead>Target Dana</TableHead>
                  <TableHead>Sisa Saldo</TableHead>
                  <TableHead>Mulai</TableHead>
                  <TableHead>PJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {program.code}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{program.name}</span>
                      {program.proposalUrl && (
                        <a
                          href={program.proposalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          Proposal
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {programFieldLabel[program.field as ProgramField]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatRupiah(program.fundraisingTarget)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatRupiah(balanceMap.get(program.id) ?? 0)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {program.startDate ? formatDate(program.startDate) : "-"}
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
                        {programStatusLabel[program.status as ProgramStatus]}
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
