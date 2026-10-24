import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { formatRupiah } from "@/lib/utils";
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
import { FileText } from "lucide-react";
import {
  AddGuardianDialog,
  EditGuardianDialog,
  DeleteGuardianButton,
} from "@/components/guardians/guardian-tools";
import { occupationLabel } from "@/components/children/child-labels";

export const dynamic = "force-dynamic";

function toDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function vulnerabilityBadge(score: number | null) {
  if (score === null) {
    return <Badge variant="outline">Belum dinilai</Badge>;
  }
  if (score >= 7) {
    return (
      <Badge variant="outline" className="border-transparent bg-red-100 text-red-800">
        Tinggi ({score}/10)
      </Badge>
    );
  }
  if (score >= 4) {
    return (
      <Badge variant="outline" className="border-transparent bg-yellow-100 text-yellow-800">
        Sedang ({score}/10)
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-transparent bg-green-100 text-green-800">
      Rendah ({score}/10)
    </Badge>
  );
}

function DocBadges({
  ktp,
  kk,
  selfie,
  other,
}: {
  ktp: string | null;
  kk: string | null;
  selfie: string | null;
  other: string | null;
}) {
  const docs = [
    { url: ktp, label: "KTP" },
    { url: kk, label: "KK" },
    { url: selfie, label: "Selfie" },
    { url: other, label: "Lainnya" },
  ].filter((d) => d.url);
  if (docs.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {docs.map((doc) => (
        <a
          key={doc.label}
          href={doc.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary hover:underline"
        >
          <FileText className="h-3 w-3" />
          {doc.label}
        </a>
      ))}
    </span>
  );
}

export default async function GuardiansPage() {
  const session = await requireStaffSession();
  if (!session) redirect("/dashboard");

  const [guardians, childrenOptions] = await Promise.all([
    prisma.guardian.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { children: true } },
        children: { select: { fullName: true } },
      },
    }),
    prisma.child.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, guardianId: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Wali Anak</h2>
          <p className="text-sm text-muted-foreground">
            {guardians.length} wali terdaftar. Skor kerentanan diperbarui
            otomatis dari hasil kunjungan rumah.
          </p>
        </div>
        <AddGuardianDialog childrenOptions={childrenOptions} />
      </div>

      {guardians.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada wali. Tambahkan wali pertama.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {guardians.map((guardian) => (
              <Card key={guardian.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{guardian.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {guardian.relationship ?? "Hubungan belum diisi"}
                        {guardian.occupation
                          ? ` · ${occupationLabel[guardian.occupation]}`
                          : ""}
                        {guardian.phone ? ` · ${guardian.phone}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <EditGuardianDialog
                        guardian={{
                          id: guardian.id,
                          name: guardian.name,
                          phone: guardian.phone,
                          dob: toDateInput(guardian.dob),
                          relationship: guardian.relationship,
                          nik: guardian.nik,
                          kkNumber: guardian.kkNumber,
                          religion: guardian.religion,
                          spouseName: guardian.spouseName,
                          spouseStatus: guardian.spouseStatus,
                          spouseNik: guardian.spouseNik,
                          occupation: guardian.occupation,
                          lastEducation: guardian.lastEducation,
                          residenceStatus: guardian.residenceStatus,
                          monthlyIncome: guardian.monthlyIncome,
                          dependentsCount: guardian.dependentsCount,
                          address: guardian.address,
                          notes: guardian.notes,
                          ktpDocUrl: guardian.ktpDocUrl,
                          kkDocUrl: guardian.kkDocUrl,
                          selfieUrl: guardian.selfieUrl,
                          otherDocUrl: guardian.otherDocUrl,
                        }}
                        childrenOptions={childrenOptions}
                      />
                      <DeleteGuardianButton
                        guardianId={guardian.id}
                        guardianName={guardian.name}
                        childrenCount={guardian._count.children}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {vulnerabilityBadge(guardian.vulnerabilityScore)}
                    <Badge variant="secondary">
                      {guardian._count.children} anak
                    </Badge>
                    {guardian.monthlyIncome != null && (
                      <Badge variant="outline">
                        {formatRupiah(guardian.monthlyIncome)}/bln
                      </Badge>
                    )}
                  </div>
                  {guardian.children.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Anak:{" "}
                      {guardian.children.map((c) => c.fullName).join(", ")}
                    </p>
                  )}
                  <DocBadges
                    ktp={guardian.ktpDocUrl}
                    kk={guardian.kkDocUrl}
                    selfie={guardian.selfieUrl}
                    other={guardian.otherDocUrl}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Wali</TableHead>
                  <TableHead>Hubungan</TableHead>
                  <TableHead>Pekerjaan</TableHead>
                  <TableHead>Anak Terkait</TableHead>
                  <TableHead>Skor Kerentanan</TableHead>
                  <TableHead>Dokumen</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guardians.map((guardian) => (
                  <TableRow key={guardian.id}>
                    <TableCell>
                      <span className="font-medium">{guardian.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {guardian.phone ?? "-"}
                        {guardian.monthlyIncome != null
                          ? ` · ${formatRupiah(guardian.monthlyIncome)}/bln`
                          : ""}
                      </span>
                    </TableCell>
                    <TableCell>{guardian.relationship ?? "-"}</TableCell>
                    <TableCell>
                      {guardian.occupation
                        ? occupationLabel[guardian.occupation]
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="block truncate">
                        {guardian.children.length > 0
                          ? guardian.children.map((c) => c.fullName).join(", ")
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {vulnerabilityBadge(guardian.vulnerabilityScore)}
                    </TableCell>
                    <TableCell>
                      <DocBadges
                        ktp={guardian.ktpDocUrl}
                        kk={guardian.kkDocUrl}
                        selfie={guardian.selfieUrl}
                        other={guardian.otherDocUrl}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <EditGuardianDialog
                          guardian={{
                            id: guardian.id,
                            name: guardian.name,
                            phone: guardian.phone,
                            dob: toDateInput(guardian.dob),
                            relationship: guardian.relationship,
                            nik: guardian.nik,
                            kkNumber: guardian.kkNumber,
                            religion: guardian.religion,
                            spouseName: guardian.spouseName,
                            spouseStatus: guardian.spouseStatus,
                            spouseNik: guardian.spouseNik,
                            occupation: guardian.occupation,
                            lastEducation: guardian.lastEducation,
                            residenceStatus: guardian.residenceStatus,
                            monthlyIncome: guardian.monthlyIncome,
                            dependentsCount: guardian.dependentsCount,
                            address: guardian.address,
                            notes: guardian.notes,
                            ktpDocUrl: guardian.ktpDocUrl,
                            kkDocUrl: guardian.kkDocUrl,
                            selfieUrl: guardian.selfieUrl,
                            otherDocUrl: guardian.otherDocUrl,
                          }}
                          childrenOptions={childrenOptions}
                        />
                        <DeleteGuardianButton
                          guardianId={guardian.id}
                          guardianName={guardian.name}
                          childrenCount={guardian._count.children}
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
