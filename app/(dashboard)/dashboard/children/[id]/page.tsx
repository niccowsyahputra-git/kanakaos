import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClipboardPlus, ArrowLeft, Pencil, FileText } from "lucide-react";
import { SleepQuality } from "@prisma/client";
import { AiInsightCard } from "@/components/ai/ai-insight-card";
import {
  childStatusLabel,
  orphanStatusLabel,
  educationLabel,
  religionLabel,
  occupationLabel,
  parentStatusLabel,
  siblingActivityLabel,
  siblingLivingWithLabel,
  siblingRelationLabel,
} from "@/components/children/child-labels";

export const dynamic = "force-dynamic";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  REINTEGRATED: "secondary",
  GRADUATED: "outline",
};

const sleepLabel: Record<SleepQuality, string> = {
  GOOD: "😴 Nyenyak",
  FAIR: "😪 Cukup",
  POOR: "😫 Kurang",
};

const moodEmoji: Record<number, string> = {
  1: "😢",
  2: "😟",
  3: "😐",
  4: "🙂",
  5: "😄",
};

const schoolLabel: Record<string, string> = {
  HADIR: "Hadir",
  BOLOS: "Bolos",
  IZIN: "Izin",
  SAKIT: "Sakit",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAge(dob: Date) {
  const diff = Date.now() - dob.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(
    (diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000)
  );
  return `${years} tahun ${months} bulan`;
}

// Baris data: label + nilai (tampil "-" bila kosong)
function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium sm:text-left">{value || "-"}</dd>
    </div>
  );
}

// Link dokumen: tampil tombol bila ada, teks abu bila kosong
function DocLink({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <span>{label}</span>
        <span className="text-xs">Belum diunggah</span>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
    >
      <span className="font-medium">{label}</span>
      <span className="inline-flex items-center gap-1 text-primary">
        <FileText className="h-4 w-4" />
        Lihat
      </span>
    </a>
  );
}

export default async function ChildDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const child = await prisma.child.findUnique({
    where: { id: params.id },
    include: {
      guardian: true,
      siblings: { orderBy: { createdAt: "asc" } },
      dailyLogs: {
        orderBy: { date: "desc" },
        take: 30,
        include: { caregiver: { select: { name: true } } },
      },
    },
  });

  if (!child) {
    notFound();
  }

  const hasAnyDoc =
    child.ijazahUrl ||
    child.aktaLahirUrl ||
    child.consentUrl ||
    child.supportingDocUrl ||
    child.otherDocUrl;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header aksi */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" size="sm" className="w-fit -ml-2">
          <Link href="/dashboard/children">
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={`/dashboard/children/${child.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit Data
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/dashboard/daily-logs/new?childId=${child.id}`}>
              <ClipboardPlus className="h-4 w-4" />
              Catat Log Hari Ini
            </Link>
          </Button>
        </div>
      </div>

      {/* Identitas ringkas */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            {child.photoUrl ? (
              <Image
                src={child.photoUrl}
                alt={`Foto ${child.fullName}`}
                width={80}
                height={80}
                className="h-20 w-20 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                {child.fullName
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                  {child.fullName}
                </h2>
                <Badge variant={statusVariant[child.status] ?? "default"}>
                  {childStatusLabel[child.status]}
                </Badge>
                {child.orphanStatus && (
                  <Badge variant="secondary">
                    {orphanStatusLabel[child.orphanStatus]}
                  </Badge>
                )}
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Field
                  label="Jenis Kelamin"
                  value={child.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                />
                <Field label="Usia" value={formatAge(child.dob)} />
                <Field label="Tanggal Lahir" value={formatDate(child.dob)} />
                <Field label="NIK" value={child.nik} />
                <Field
                  label="Agama"
                  value={child.religion ? religionLabel[child.religion] : null}
                />
                <Field label="Golongan Darah" value={child.bloodType} />
                <Field
                  label="Tinggi / Berat"
                  value={
                    child.heightCm || child.weightKg
                      ? `${child.heightCm ? `${child.heightCm} cm` : "-"} / ${
                          child.weightKg ? `${child.weightKg} kg` : "-"
                        }`
                      : null
                  }
                />
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keluarga & Alamat */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Keluarga & Alamat</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Nama Ayah" value={child.fatherName} />
            <Field label="No. KTP (NIK) Ayah" value={child.fatherNik} />
            <Field
              label="Agama Ayah"
              value={
                child.fatherReligion
                  ? religionLabel[child.fatherReligion]
                  : null
              }
            />
            <Field
              label="Pekerjaan Ayah"
              value={
                child.fatherOccupation
                  ? occupationLabel[child.fatherOccupation]
                  : null
              }
            />
            <Field
              label="Status Ayah"
              value={
                child.fatherStatus
                  ? parentStatusLabel[child.fatherStatus]
                  : null
              }
            />
            <Field label="Nama Ibu" value={child.motherName} />
            <Field label="No. KTP (NIK) Ibu" value={child.motherNik} />
            <Field
              label="Agama Ibu"
              value={
                child.motherReligion
                  ? religionLabel[child.motherReligion]
                  : null
              }
            />
            <Field
              label="Pekerjaan Ibu"
              value={
                child.motherOccupation
                  ? occupationLabel[child.motherOccupation]
                  : null
              }
            />
            <Field
              label="Status Ibu"
              value={
                child.motherStatus
                  ? parentStatusLabel[child.motherStatus]
                  : null
              }
            />
            <Field
              label="Wali"
              value={
                child.guardian
                  ? `${child.guardian.name}${
                      child.guardian.relationship
                        ? ` (${child.guardian.relationship})`
                        : ""
                    }`
                  : null
              }
            />
            <Field label="Alamat Rumah" value={child.homeAddress} />
          </dl>
        </CardContent>
      </Card>

      {/* Saudara Kandung */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Saudara Kandung
            {(child.birthOrder || child.siblingsCount != null) && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {child.birthOrder ? `Anak ke-${child.birthOrder}` : ""}
                {child.birthOrder && child.siblingsCount != null ? " · " : ""}
                {child.siblingsCount != null
                  ? `${child.siblingsCount} saudara`
                  : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {child.siblings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada data saudara.
            </p>
          ) : (
            <ul className="divide-y">
              {child.siblings.map((sibling) => (
                <li key={sibling.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{sibling.name}</span>
                    {sibling.relation && (
                      <Badge variant="secondary">
                        {siblingRelationLabel[sibling.relation]}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[
                      sibling.gender
                        ? sibling.gender === "MALE"
                          ? "Laki-laki"
                          : "Perempuan"
                        : null,
                      sibling.dob ? formatDate(sibling.dob) : null,
                      sibling.activity
                        ? siblingActivityLabel[sibling.activity]
                        : null,
                      sibling.livingWith
                        ? `Tinggal dengan ${siblingLivingWithLabel[sibling.livingWith]}${
                            sibling.livingWith === "PANTI_ASUHAN" &&
                            sibling.pantiName
                              ? ` (${sibling.pantiName})`
                              : ""
                          }`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Penerimaan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Riwayat Penerimaan</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field
              label="Tanggal Masuk"
              value={formatDate(child.admissionDate)}
            />
            <Field
              label="Alasan Masuk"
              value={child.admissionReason}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Pendidikan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pendidikan</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field
              label="Pendidikan Terakhir"
              value={
                child.lastEducation ? educationLabel[child.lastEducation] : null
              }
            />
            <Field label="Tingkat / Kelas Terakhir" value={child.lastGrade} />
            <Field label="Sekolah Sebelumnya" value={child.previousSchool} />
          </dl>
          {child.achievements && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Prestasi</p>
              <p className="whitespace-pre-line text-sm">
                {child.achievements}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kesehatan & Catatan */}
      {(child.medicalHistory || child.notes) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kesehatan & Catatan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {child.medicalHistory && (
              <div>
                <p className="text-sm text-muted-foreground">
                  Riwayat Penyakit
                </p>
                <p className="whitespace-pre-line text-sm">
                  {child.medicalHistory}
                </p>
              </div>
            )}
            {child.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Catatan Lain</p>
                <p className="whitespace-pre-line text-sm">{child.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dokumen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dokumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!hasAnyDoc && (
            <p className="text-sm text-muted-foreground">
              Belum ada dokumen yang diunggah.
            </p>
          )}
          <DocLink label="Ijazah Terakhir" url={child.ijazahUrl} />
          <DocLink label="Akta Kelahiran" url={child.aktaLahirUrl} />
          <DocLink label="Dokumen Consent" url={child.consentUrl} />
          <DocLink
            label="Dokumen Pendukung Lainnya"
            url={child.supportingDocUrl}
          />
          <DocLink label="Dokumen KK (Kartu Keluarga)" url={child.otherDocUrl} />
        </CardContent>
      </Card>

      {/* AI Insight */}
      <AiInsightCard childId={child.id} />

      {/* Riwayat log harian */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Riwayat Log Harian
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({child.dailyLogs.length} catatan terakhir)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {child.dailyLogs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Belum ada log harian untuk anak ini.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/daily-logs/new?childId=${child.id}`}>
                  Catat log pertama
                </Link>
              </Button>
            </div>
          ) : (
            <ol className="relative space-y-0 border-l border-border pl-6">
              {child.dailyLogs.map((log, index) => (
                <li key={log.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[35px] flex h-7 w-7 items-center justify-center rounded-full border bg-background text-base">
                    {moodEmoji[log.moodScore] ?? "😐"}
                  </span>

                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold">
                      {formatDateTime(log.date)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>🍽️ Makan {log.mealPercentage}%</span>
                      <span>{sleepLabel[log.sleepQuality]}</span>
                      <span>
                        🕌{" "}
                        {
                          [
                            log.prayerSubuh,
                            log.prayerDzuhur,
                            log.prayerAshar,
                            log.prayerMaghrib,
                            log.prayerIsya,
                          ].filter(Boolean).length
                        }
                        /5
                      </span>
                      <span>
                        🧹 {log.piketDone ? "Piket ✓" : "Belum piket"}
                      </span>
                      {log.schoolAttendance && (
                        <span>
                          🏫 {schoolLabel[log.schoolAttendance]}
                        </span>
                      )}
                      <span>✍️ {log.caregiver.name}</span>
                    </div>
                    {log.evaluationNotes && (
                      <p className="mt-1 rounded-md bg-secondary px-3 py-2 text-sm">
                        📝 {log.evaluationNotes}
                      </p>
                    )}
                  </div>

                  {index < child.dailyLogs.length - 1 && (
                    <Separator className="mt-6 md:hidden" />
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
