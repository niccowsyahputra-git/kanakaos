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
  AddFamilyVisitDialog,
  EditFamilyVisitDialog,
  DeleteFamilyVisitButton,
} from "@/components/family-visits/family-visit-tools";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";


export const dynamic = "force-dynamic";

function toDateTimeInput(date: Date): string {
  // yyyy-MM-ddTHH:mm dalam waktu lokal (untuk input datetime-local)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "medium" }).format(
    date
  );
}

function formatTime(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function FamilyVisitsPage() {
  const { tr, locale } = await getT();

  const session = await auth();
  if (!session?.user) redirect("/login");

  const [visits, childrenOptions] = await Promise.all([
    prisma.familyVisit.findMany({
      orderBy: { visitDate: "desc" },
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

  const today = new Date();
  const todayCount = visits.filter(
    (v) =>
      v.visitDate.getFullYear() === today.getFullYear() &&
      v.visitDate.getMonth() === today.getMonth() &&
      v.visitDate.getDate() === today.getDate()
  ).length;

  function toFormData(visit: (typeof visits)[number]) {
    return {
      id: visit.id,
      childId: visit.childId,
      childName: visit.child.fullName,
      visitorName: visit.visitorName,
      relationship: visit.relationship,
      visitDate: toDateTimeInput(visit.visitDate),
      purpose: visit.purpose,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {tr("Kunjungan Keluarga")}</h2>
          <p className="text-sm text-muted-foreground">
            {tr("Buku tamu orang tua/wali · ")}{visits.length} {tr(" catatan · ")}{todayCount}{" "}
            {tr("kunjungan hari ini.")}</p>
        </div>
        <AddFamilyVisitDialog childrenOptions={childrenOptions} />
      </div>

      {visits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada catatan kunjungan keluarga.")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {visits.map((visit) => (
              <Card key={visit.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {visit.visitorName}
                        {visit.relationship ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            ({visit.relationship})
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tr("Mengunjungi")}{" "}
                        <span className="font-medium text-foreground">
                          {visit.child.fullName}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <EditFamilyVisitDialog
                        visit={toFormData(visit)}
                        childrenOptions={childrenOptions}
                      />
                      <DeleteFamilyVisitButton
                        visitId={visit.id}
                        visitorName={visit.visitorName}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {formatDate(visit.visitDate, locale)} ·{" "}
                      {formatTime(visit.visitDate, locale)} WIB
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {visit.purpose}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Pengunjung")}</TableHead>
                  <TableHead>{tr("Anak yang Dikunjungi")}</TableHead>
                  <TableHead>{tr("Tanggal")}</TableHead>
                  <TableHead>{tr("Jam")}</TableHead>
                  <TableHead>{tr("Urusan")}</TableHead>
                  <TableHead>{tr("Dicatat oleh")}</TableHead>
                  <TableHead className="text-right">{tr("Aksi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell>
                      <span className="font-medium">{visit.visitorName}</span>
                      {visit.relationship && (
                        <span className="block text-xs text-muted-foreground">
                          {visit.relationship}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{visit.child.fullName}</TableCell>
                    <TableCell>{formatDate(visit.visitDate, locale)}</TableCell>
                    <TableCell>{formatTime(visit.visitDate, locale)} WIB</TableCell>
                    <TableCell className="max-w-[240px]">
                      <span className="block truncate text-muted-foreground">
                        {visit.purpose}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {visit.createdBy.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <EditFamilyVisitDialog
                          visit={toFormData(visit)}
                          childrenOptions={childrenOptions}
                        />
                        <DeleteFamilyVisitButton
                          visitId={visit.id}
                          visitorName={visit.visitorName}
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
