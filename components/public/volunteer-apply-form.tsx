"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { VolunteerProfileForm } from "@/components/volunteers/volunteer-profile-form";
import type { NeedOption } from "@/components/volunteers/need-select";
import { dateOnlyLabel, needFieldLabel } from "@/lib/option-catalogs";

export type OpenVolunteerNeed = NeedOption & { description: string | null; quantity: number; schedule: string | null };
export function VolunteerApplyForm({ needs }: { needs: OpenVolunteerNeed[] }) {
  const { tr, locale } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  if (submitted) return <Card><CardContent className="flex flex-col items-center gap-4 p-8 text-center">
    <CheckCircle2 className="h-12 w-12 text-green-600" />
    <h2 className="text-xl font-bold">{tr("Pendaftaran Terkirim!")}</h2>
    <p className="text-sm text-muted-foreground">{tr("Terima kasih atas niat baik Anda. Pendaftaran Anda akan kami review dalam ")}<b>{tr("3 hari kerja")}</b>{tr(". Tim kami akan menghubungi Anda via email atau WhatsApp untuk tahap screening berikutnya.")}</p>
  </CardContent></Card>;
  return <Card><CardContent className="space-y-5 p-4 md:p-6">
    {needs.length > 0 && <section className="space-y-2"><h2 className="font-semibold">{tr("Bidang Relawan yang Dibutuhkan")}</h2>{needs.map(need => <details key={need.id} className="rounded border p-3 text-sm">
      <summary className="cursor-pointer">{need.field && need.field !== "OTHER" ? tr(needFieldLabel(need.field, need.otherField ?? null, need.title)) : need.title} · {need.quantity} {tr("orang")}</summary>
      {need.description && <p className="mt-2 whitespace-pre-line">{need.description}</p>}
      <p className="mt-1 text-muted-foreground">{need.startDate && need.endDate ? `${dateOnlyLabel(need.startDate, locale)} – ${dateOnlyLabel(need.endDate, locale)}` : tr("Tanggal belum ditentukan")}</p>
      {need.schedule && <p>{need.schedule}</p>}
    </details>)}</section>}
    <VolunteerProfileForm mode="public" needs={needs} onSuccess={() => setSubmitted(true)} />
  </CardContent></Card>;
}
