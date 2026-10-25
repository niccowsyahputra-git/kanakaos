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
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


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

function formatDate(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "long" }).format(date);
}

function formatDateTime(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAge(dob: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  const diff = Date.now() - dob.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(
    (diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000)
  );
  return tr("{0} tahun {1} bulan", { "0": years, "1": months });
}

// Baris data: label + nilai (tampil "-" bila kosong)
async function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  const { tr, locale } = await getT();

  return (
    <div className="flex justify-between gap-4 sm:block">
      <dt className="text-muted-foreground">{tr(label)}</dt>
      <dd className="text-right font-medium sm:text-left">{value || "-"}</dd>
    </div>
  );
}

// Link dokumen: tampil tombol bila ada, teks abu bila kosong
async function DocLink({ label, url }: { label: string; url: string | null }) {
  const { tr, locale } = await getT();

  if (!url) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <span>{tr(label)}</span>
        <span className="text-xs">{tr("Belum diunggah")}</span>
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
      <span className="font-medium">{tr(label)}</span>
      <span className="inline-flex items-center gap-1 text-primary">
        <FileText className="h-4 w-4" />
        {tr("Lihat")}</span>
    </a>
  );
}

export default async function ChildDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tr, locale } = await getT();
  const religionLabel = localizeLabels(__religionLabel, tr);
  const occupationLabel = localizeLabels(__occupationLabel, tr);
  const parentStatusLabel = localizeLabels(__parentStatusLabel, tr);
  const siblingActivityLabel = localizeLabels(__siblingActivityLabel, tr);
  const educationLabel = localizeLabels(__educationLabel, tr);

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
            {tr("Kembali")}</Link>
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={`/dashboard/children/${child.id}/edit`}>
              <Pencil className="h-4 w-4" />
              {tr("Edit Data")}</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/dashboard/daily-logs/new?childId=${child.id}`}>
              <ClipboardPlus className="h-4 w-4" />
              {tr("Catat Log Hari Ini")}</Link>
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
                alt={tr("Foto {0}", { "0": child.fullName })}
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
                  {tr(childStatusLabel[child.status])}
                </Badge>
                {child.orphanStatus && (
                  <Badge variant="secondary">
                    {tr(orphanStatusLabel[child.orphanStatus])}
                  </Badge>
                )}
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Field
                  label={tr("Jenis Kelamin")}
                  value={child.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                />
                <Field label={tr("Usia")} value={formatAge(child.dob, locale)} />
                <Field label={tr("Tanggal Lahir")} value={formatDate(child.dob, locale)} />
                <Field label="NIK" value={child.nik} />
                <Field
                  label={tr("Agama")}
                  value={child.religion ? religionLabel[child.religion] : null}
                />
                <Field label={tr("Golongan Darah")} value={child.bloodType} />
                <Field
                  label={tr("Tinggi / Berat")}
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
          <CardTitle className="text-base">{tr("Keluarga & Alamat")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label={tr("Nama Ayah")} value={child.fatherName} />
            <Field label={tr("No. KTP (NIK) Ayah")} value={child.fatherNik} />
            <Field
              label={tr("Agama Ayah")}
              value={
                child.fatherReligion
                  ? religionLabel[child.fatherReligion]
                  : null
              }
            />
            <Field
              label={tr("Pekerjaan Ayah")}
              value={
                child.fatherOccupation
                  ? occupationLabel[child.fatherOccupation]
                  : null
              }
            />
            <Field
              label={tr("Status Ayah")}
              value={
                child.fatherStatus
                  ? parentStatusLabel[child.fatherStatus]
                  : null
              }
            />
            <Field label={tr("Nama Ibu")} value={child.motherName} />
            <Field label={tr("No. KTP (NIK) Ibu")} value={child.motherNik} />
            <Field
              label={tr("Agama Ibu")}
              value={
                child.motherReligion
                  ? religionLabel[child.motherReligion]
                  : null
              }
            />
            <Field
              label={tr("Pekerjaan Ibu")}
              value={
                child.motherOccupation
                  ? occupationLabel[child.motherOccupation]
                  : null
              }
            />
            <Field
              label={tr("Status Ibu")}
              value={
                child.motherStatus
                  ? parentStatusLabel[child.motherStatus]
                  : null
              }
            />
            <Field
              label={tr("Wali")}
              value={
                child.guardian
                  ? `${child.guardian.name}${
                      child.guardian.relationship
                        ? ` (${tr(child.guardian.relationship)})`
                        : ""
                    }`
                  : null
              }
            />
            <Field label={tr("Alamat Rumah")} value={child.homeAddress} />
          </dl>
        </CardContent>
      </Card>

      {/* Saudara Kandung */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {tr("Saudara Kandung")}{(child.birthOrder || child.siblingsCount != null) && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {child.birthOrder ? tr("Anak ke-{0}", { "0": child.birthOrder }) : ""}
                {child.birthOrder && child.siblingsCount != null ? " · " : ""}
                {child.siblingsCount != null
                  ? tr("{0} saudara", { "0": child.siblingsCount })
                  : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {child.siblings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tr("Belum ada data saudara.")}</p>
          ) : (
            <ul className="divide-y">
              {child.siblings.map((sibling) => (
                <li key={sibling.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{sibling.name}</span>
                    {sibling.relation && (
                      <Badge variant="secondary">
                        {tr(siblingRelationLabel[sibling.relation])}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[
                      sibling.gender
                        ? sibling.gender === "MALE"
                          ? tr("Laki-laki")
                          : tr("Perempuan")
                        : null,
                      sibling.dob ? formatDate(sibling.dob, locale) : null,
                      sibling.activity
                        ? siblingActivityLabel[sibling.activity]
                        : null,
                      sibling.livingWith
                        ? tr("Tinggal dengan {0}{1}", { "0": siblingLivingWithLabel[sibling.livingWith], "1": sibling.livingWith === "PANTI_ASUHAN" &&
                            sibling.pantiName
                              ? ` (${sibling.pantiName})`
                              : "" })
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
          <CardTitle className="text-base">{tr("Riwayat Penerimaan")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field
              label={tr("Tanggal Masuk")}
              value={formatDate(child.admissionDate, locale)}
            />
            <Field
              label={tr("Alasan Masuk")}
              value={child.admissionReason}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Pendidikan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr("Pendidikan")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field
              label={tr("Pendidikan Terakhir")}
              value={
                child.lastEducation ? educationLabel[child.lastEducation] : null
              }
            />
            <Field label={tr("Tingkat / Kelas Terakhir")} value={child.lastGrade} />
            <Field label={tr("Sekolah Sebelumnya")} value={child.previousSchool} />
          </dl>
          {child.achievements && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">{tr("Prestasi")}</p>
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
            <CardTitle className="text-base">{tr("Kesehatan & Catatan")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {child.medicalHistory && (
              <div>
                <p className="text-sm text-muted-foreground">
                  {tr("Riwayat Penyakit")}</p>
                <p className="whitespace-pre-line text-sm">
                  {child.medicalHistory}
                </p>
              </div>
            )}
            {child.notes && (
              <div>
                <p className="text-sm text-muted-foreground">{tr("Catatan Lain")}</p>
                <p className="whitespace-pre-line text-sm">{child.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dokumen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr("Dokumen")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!hasAnyDoc && (
            <p className="text-sm text-muted-foreground">
              {tr("Belum ada dokumen yang diunggah.")}</p>
          )}
          <DocLink label={tr("Ijazah Terakhir")} url={child.ijazahUrl} />
          <DocLink label={tr("Akta Kelahiran")} url={child.aktaLahirUrl} />
          <DocLink label={tr("Dokumen Consent")} url={child.consentUrl} />
          <DocLink
            label={tr("Dokumen Pendukung Lainnya")}
            url={child.supportingDocUrl}
          />
          <DocLink label={tr("Dokumen KK (Kartu Keluarga)")} url={child.otherDocUrl} />
        </CardContent>
      </Card>

      {/* AI Insight */}
      <AiInsightCard childId={child.id} />

      {/* Riwayat log harian */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {tr("Riwayat Log Harian")}<span className="ml-2 text-sm font-normal text-muted-foreground">
              ({child.dailyLogs.length} {tr(" catatan terakhir)")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {child.dailyLogs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {tr("Belum ada log harian untuk anak ini.")}</p>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/daily-logs/new?childId=${child.id}`}>
                  {tr("Catat log pertama")}</Link>
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
                      {formatDateTime(log.date, locale)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{tr("🍽️ Makan ")}{log.mealPercentage}%</span>
                      <span>{tr(sleepLabel[log.sleepQuality])}</span>
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
                        🧹 {log.piketDone ? tr("Piket ✓") : tr("Belum piket")}
                      </span>
                      {log.schoolAttendance && (
                        <span>
                          🏫 {tr(schoolLabel[log.schoolAttendance])}
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

const __religionLabel = religionLabel;
const __occupationLabel = occupationLabel;
const __parentStatusLabel = parentStatusLabel;
const __siblingActivityLabel = siblingActivityLabel;
const __educationLabel = educationLabel;
