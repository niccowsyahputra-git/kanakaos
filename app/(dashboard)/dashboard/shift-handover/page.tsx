import { redirect } from "next/navigation";
import { ShiftType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HandoverForm } from "@/components/handover/handover-form";

export const dynamic = "force-dynamic";

const shiftLabel: Record<ShiftType, string> = {
  PAGI: "🌅 Pagi",
  SIANG: "☀️ Siang",
  MALAM: "🌙 Malam",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date
  );
}

export default async function ShiftHandoverPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const handovers = await prisma.shiftHandover.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Serah Terima Shift
        </h2>
        <p className="text-sm text-muted-foreground">
          Catat kondisi akhir shift agar pengasuh berikutnya siap.
        </p>
      </div>

      <HandoverForm />

      {/* Riwayat handover */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Riwayat Handover
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (20 terakhir)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {handovers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat serah terima.
            </p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="flex flex-col gap-3 md:hidden">
                {handovers.map((handover) => (
                  <div key={handover.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {shiftLabel[handover.shift]} ·{" "}
                        {formatDate(handover.date)}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          handover.allChildrenSafe
                            ? "border-transparent bg-green-100 text-green-800"
                            : "border-transparent bg-red-100 text-red-800"
                        }
                      >
                        {handover.allChildrenSafe ? "Aman" : "Perlu Perhatian"}
                      </Badge>
                    </div>
                    {handover.sickChildrenNotes && (
                      <p className="mt-1.5 text-xs text-destructive">
                        🤒 {handover.sickChildrenNotes}
                      </p>
                    )}
                    <p className="mt-1.5 whitespace-pre-line text-sm">
                      {handover.importantNotes}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      oleh {handover.createdBy.name}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Kondisi</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead>Pengasuh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {handovers.map((handover) => (
                      <TableRow key={handover.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(handover.date)}
                        </TableCell>
                        <TableCell>{shiftLabel[handover.shift]}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              handover.allChildrenSafe
                                ? "border-transparent bg-green-100 text-green-800"
                                : "border-transparent bg-red-100 text-red-800"
                            }
                          >
                            {handover.allChildrenSafe
                              ? "Aman"
                              : "Perlu Perhatian"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          {handover.sickChildrenNotes && (
                            <p className="text-xs text-destructive">
                              🤒 {handover.sickChildrenNotes}
                            </p>
                          )}
                          <p className="whitespace-pre-line text-sm">
                            {handover.importantNotes}
                          </p>
                        </TableCell>
                        <TableCell>{handover.createdBy.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
