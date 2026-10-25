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
import {
  AddHomeLeaveDialog,
  EditHomeLeaveDialog,
  DeleteHomeLeaveButton,
} from "@/components/home-leaves/home-leave-tools";
import {
  homeLeaveReasonLabel,
  returnStatusLabel,
  returnStatusClass,
} from "@/components/home-leaves/home-leave-labels";
import type { HomeLeaveReason } from "@prisma/client";
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

const reasonClass: Record<HomeLeaveReason, string> = {
  LIBURAN_SEKOLAH: "border-transparent bg-blue-100 text-blue-800",
  LIBURAN_HARI_RAYA: "border-transparent bg-green-100 text-green-800",
  ORANG_TUA_SAKIT: "border-transparent bg-amber-100 text-amber-800",
  SAKIT: "border-transparent bg-orange-100 text-orange-800",
  SKORSING: "border-transparent bg-red-100 text-red-800",
};

export default async function HomeLeavesPage() {
  const { tr, locale } = await getT();
  const returnStatusClass = localizeLabels(__returnStatusClass, tr);

  const session = await auth();
  if (!session?.user) redirect("/login");

  const [leaves, childrenOptions] = await Promise.all([
    prisma.homeLeave.findMany({
      orderBy: { leaveDate: "desc" },
      take: 100,
      include: {
        child: { select: { fullName: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.child.findMany({
      where: { status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  // Anak yang sedang pulang: tidak boleh dibuatkan kepulangan baru
  const activeChildIds = leaves
    .filter((l) => l.returnStatus === "BELUM_KEMBALI")
    .map((l) => l.childId);

  function toFormData(leave: (typeof leaves)[number]) {
    return {
      id: leave.id,
      childId: leave.childId,
      childName: leave.child.fullName,
      leaveDate: toDateInput(leave.leaveDate)!,
      plannedReturnDate: toDateInput(leave.plannedReturnDate),
      actualReturnDate: toDateInput(leave.actualReturnDate),
      reason: leave.reason,
      description: leave.description,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {tr("Kepulangan Anak")}</h2>
          <p className="text-sm text-muted-foreground">
            {leaves.length} {tr(" catatan · ")}{activeChildIds.length} {tr(" anak belum kembali ke panti.")}</p>
        </div>
        <AddHomeLeaveDialog
          childrenOptions={childrenOptions}
          activeChildIds={activeChildIds}
        />
      </div>

      {leaves.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada catatan kepulangan anak.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {leaves.map((leave) => (
              <Card key={leave.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {leave.child.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tr("Pulang ")}{formatDate(leave.leaveDate, locale)}
                        {leave.plannedReturnDate
                          ? tr(" · rencana kembali {0}", { "0": formatDate(leave.plannedReturnDate) })
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <EditHomeLeaveDialog
                        leave={toFormData(leave)}
                        childrenOptions={childrenOptions}
                        activeChildIds={activeChildIds}
                      />
                      <DeleteHomeLeaveButton
                        leaveId={leave.id}
                        childName={leave.child.fullName}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={reasonClass[leave.reason]}
                    >
                      {tr(homeLeaveReasonLabel[leave.reason])}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={returnStatusClass[leave.returnStatus]}
                    >
                      {tr(returnStatusLabel[leave.returnStatus])}
                      {leave.actualReturnDate
                        ? ` (${formatDate(leave.actualReturnDate, locale)})`
                        : ""}
                    </Badge>
                  </div>
                  {leave.description && (
                    <p className="text-xs text-muted-foreground">
                      {leave.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Nama Anak")}</TableHead>
                  <TableHead>{tr("Tujuan Kepulangan")}</TableHead>
                  <TableHead>{tr("Tgl Kepulangan")}</TableHead>
                  <TableHead>{tr("Rencana Kembali")}</TableHead>
                  <TableHead>{tr("Status Kembali")}</TableHead>
                  <TableHead>{tr("Dicatat oleh")}</TableHead>
                  <TableHead className="text-right">{tr("Aksi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell>
                      <span className="font-medium">
                        {leave.child.fullName}
                      </span>
                      {leave.description && (
                        <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
                          {leave.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={reasonClass[leave.reason]}
                      >
                        {tr(homeLeaveReasonLabel[leave.reason])}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(leave.leaveDate, locale)}</TableCell>
                    <TableCell>
                      {leave.plannedReturnDate
                        ? formatDate(leave.plannedReturnDate, locale)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={returnStatusClass[leave.returnStatus]}
                      >
                        {tr(returnStatusLabel[leave.returnStatus])}
                      </Badge>
                      {leave.actualReturnDate && (
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(leave.actualReturnDate, locale)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {leave.createdBy.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <EditHomeLeaveDialog
                          leave={toFormData(leave)}
                          childrenOptions={childrenOptions}
                          activeChildIds={activeChildIds}
                        />
                        <DeleteHomeLeaveButton
                          leaveId={leave.id}
                          childName={leave.child.fullName}
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

const __returnStatusClass = returnStatusClass;
