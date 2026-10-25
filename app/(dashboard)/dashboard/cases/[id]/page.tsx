import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { CaseDetailTabs } from "@/components/cases/case-detail-tabs";
import { CloseCaseButton } from "@/components/cases/close-case-button";
import { HandlingForm } from "@/components/shared/handling-form";
import {
  caseTypeLabel,
  caseStatusLabel,
  caseStatusClass,
  casePriorityLabel,
  casePriorityClass,
} from "@/components/cases/case-labels";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

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

export default async function CaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tr, locale } = await getT();
  const caseStatusClass = localizeLabels(__caseStatusClass, tr);
  const casePriorityClass = localizeLabels(__casePriorityClass, tr);

  const session = await requireStaffSession();
  if (!session) redirect("/dashboard");

  const caseRecord = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      child: { select: { id: true, fullName: true, dob: true, gender: true } },
      assignedTo: { select: { name: true } },
      interventions: {
        orderBy: { date: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });

  if (!caseRecord) notFound();

  const isClosed = caseRecord.status === "CLOSED";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header aksi */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/dashboard/cases">
            <ArrowLeft className="h-4 w-4" />
            {tr("Semua Kasus")}</Link>
        </Button>
        {!isClosed && <CloseCaseButton caseId={caseRecord.id} />}
      </div>

      {/* Header info kasus */}
      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">
              {tr(caseTypeLabel[caseRecord.caseType])}
            </h2>
            <Badge
              variant="outline"
              className={caseStatusClass[caseRecord.status]}
            >
              {tr(caseStatusLabel[caseRecord.status])}
            </Badge>
            <Badge
              variant="outline"
              className={casePriorityClass[caseRecord.priority]}
            >
              {tr("Prioritas ")}{tr(casePriorityLabel[caseRecord.priority])}
            </Badge>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Anak")}</dt>
              <dd className="font-medium">
                <Link
                  href={`/dashboard/children/${caseRecord.child.id}`}
                  className="text-primary hover:underline"
                >
                  {caseRecord.child.fullName}
                </Link>
              </dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Penanggung Jawab")}</dt>
              <dd className="font-medium">{caseRecord.assignedTo.name}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Dibuka")}</dt>
              <dd className="font-medium">
                {formatDate(caseRecord.createdAt, locale)}
              </dd>
            </div>
            {caseRecord.closedAt && (
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">{tr("Ditutup")}</dt>
                <dd className="font-medium">
                  {formatDate(caseRecord.closedAt, locale)}
                </dd>
              </div>
            )}
          </dl>

          <div className="rounded-md bg-muted/60 p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {tr("Deskripsi Kasus")}</p>
            <p className="mt-1 whitespace-pre-line text-sm">
              {caseRecord.description}
            </p>
          </div>

          {caseRecord.closeReason && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-medium uppercase text-green-700">
                {tr("Resolusi Penutupan")}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-green-900">
                {caseRecord.closeReason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Timeline / Dokumen / Catatan */}
      {/* Penanganan & status sederhana */}
      <HandlingForm
        entity="case"
        entityId={caseRecord.id}
        initialHandling={caseRecord.handling}
        initialDone={caseRecord.status === "CLOSED"}
      />

      <CaseDetailTabs
        caseId={caseRecord.id}
        isClosed={isClosed}
        interventions={caseRecord.interventions.map((intervention) => ({
          id: intervention.id,
          date: formatDate(intervention.date, locale),
          interventionType: intervention.interventionType,
          notes: intervention.notes,
          attachmentUrl: intervention.attachmentUrl,
          createdByName: intervention.createdBy.name,
        }))}
        documents={caseRecord.documents.map((doc) => ({
          id: doc.id,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          uploadedByName: doc.uploadedBy.name,
          createdAt: formatDateTime(doc.createdAt, locale),
        }))}
        notes={caseRecord.notes.map((note) => ({
          id: note.id,
          content: note.content,
          authorName: note.author.name,
          createdAt: formatDateTime(note.createdAt, locale),
        }))}
      />
    </div>
  );
}

const __caseStatusClass = caseStatusClass;
const __casePriorityClass = casePriorityClass;
