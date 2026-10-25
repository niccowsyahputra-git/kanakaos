import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireLogisticsSession } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { PRWorkflowActions } from "@/components/inventory/pr-tools";
import {
  prStatusLabel,
  prStatusClass,
} from "@/components/inventory/pr-labels";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

function formatDateTime(date: Date, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

// Urutan langkah workflow untuk indikator progress
const WORKFLOW_STEPS = ["PENDING", "APPROVED", "ORDERED", "RECEIVED"] as const;

export default async function PurchaseRequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tr, locale } = await getT();
  const prStatusClass = localizeLabels(__prStatusClass, tr);

  const session = await requireLogisticsSession();
  if (!session) redirect("/dashboard");

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: params.id },
    include: {
      inventory: { select: { itemName: true, unit: true, quantity: true } },
      requestedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
    },
  });

  if (!pr) notFound();

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const isRejected = pr.status === "REJECTED";
  const currentStepIndex = WORKFLOW_STEPS.indexOf(
    pr.status as (typeof WORKFLOW_STEPS)[number]
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard/inventory/purchase-requests">
          <ArrowLeft className="h-4 w-4" />
          {tr("Semua PR")}</Link>
      </Button>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">
              {pr.inventory.itemName} × {pr.quantity} {pr.inventory.unit}
            </h2>
            <Badge variant="outline" className={prStatusClass[pr.status]}>
              {tr(prStatusLabel[pr.status])}
            </Badge>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Pemohon")}</dt>
              <dd className="font-medium">{pr.requestedBy.name}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Diajukan")}</dt>
              <dd className="font-medium">{formatDateTime(pr.createdAt, locale)}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground">{tr("Stok saat ini")}</dt>
              <dd className="font-medium">
                {pr.inventory.quantity} {pr.inventory.unit}
              </dd>
            </div>
            {pr.decidedBy && (
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">{tr("Diputuskan oleh")}</dt>
                <dd className="font-medium">{pr.decidedBy.name}</dd>
              </div>
            )}
          </dl>

          {pr.notes && (
            <div className="rounded-md bg-muted/60 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {tr("Catatan Pemohon")}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{pr.notes}</p>
            </div>
          )}

          {pr.decisionNotes && (
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {tr("Catatan Keputusan")}</p>
              <p className="mt-1 whitespace-pre-line text-sm">
                {pr.decisionNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr("Status Workflow")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRejected ? (
            <Badge variant="destructive">{tr("PR Ditolak")}</Badge>
          ) : (
            <ol className="flex flex-wrap items-center gap-2">
              {WORKFLOW_STEPS.map((step, index) => {
                const done = index <= currentStepIndex;
                return (
                  <li key={step} className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                        done
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done && <CheckCircle2 className="h-3 w-3" />}
                      {tr(prStatusLabel[step])}
                    </span>
                    {index < WORKFLOW_STEPS.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <PRWorkflowActions
            prId={pr.id}
            status={pr.status}
            isSuperAdmin={isSuperAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}

const __prStatusClass = prStatusClass;
