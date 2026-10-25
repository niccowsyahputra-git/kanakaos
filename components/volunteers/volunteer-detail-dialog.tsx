"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, FileText, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/client";
import { VOLUNTEER_FIELDS, VOLUNTEER_AVAILABILITY, catalogLabel, readVolunteerSkills } from "@/lib/option-catalogs";
import { volunteerAttachmentUrl, type AttachmentSummary } from "@/lib/volunteer-upload-contract";


type VolunteerDetail = {
  name: string;
  phone: string | null;
  skill: string | null;
  skillsJson: string | null;
  highestEducation: string | null;
  major: string | null;
  attachments: AttachmentSummary[];
  status: string;
  hasSafeguardingCert: boolean;
  redFlagNotes: string | null;
  email: string | null;
  dobLabel: string | null;
  address: string | null;
  occupation: string | null;
  availability: string | null;
  motivation: string | null;
  ktpUrl: string | null;
  skckUrl: string | null;
  needTitle: string | null;
  createdAtLabel: string;
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const { tr, locale } = useI18n();

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-muted-foreground">{tr(label)}</dt>
      <dd className="font-medium sm:text-right">{value ?? "-"}</dd>
    </div>
  );
}

export function VolunteerDetailDialog({
  volunteer,
}: {
  volunteer: VolunteerDetail;
}) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={tr("Lihat detail pendaftaran")}
        >
          <Eye className="h-4 w-4" />
          <span className="sr-only">{tr("Detail ")}{volunteer.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{volunteer.name}</DialogTitle>
          <DialogDescription>
            {tr("Mendaftar ")}{volunteer.createdAtLabel}
          </DialogDescription>
        </DialogHeader>

        {volunteer.attachments.filter(a => a.kind === "PHOTO").map(photo => <Image key={photo.id} src={volunteerAttachmentUrl(photo)} alt={tr("Foto relawan")} width={160} height={160} unoptimized className="h-40 w-40 rounded-lg object-cover" />)}
        <dl className="space-y-2 text-sm">
          <DetailRow label={tr("Email")} value={volunteer.email} />
          <DetailRow label={tr("No. HP")} value={volunteer.phone} />
          <DetailRow label={tr("Tanggal Lahir")} value={volunteer.dobLabel} />
          <DetailRow label={tr("Pekerjaan")} value={volunteer.occupation} />
          <DetailRow label={tr("Alamat")} value={volunteer.address} />
          <DetailRow label={tr("Keahlian")} value={readVolunteerSkills(volunteer.skillsJson).map(code => tr(VOLUNTEER_FIELDS[code])).join(", ") || null} />
          {volunteer.skill && <DetailRow label={tr("Keahlian data lama")} value={volunteer.skill} />}
          <DetailRow label={tr("Pendidikan Terakhir")} value={volunteer.highestEducation ? tr(volunteer.highestEducation) : null} />
          <DetailRow label={tr("Jurusan")} value={volunteer.major} />
          <DetailRow label={tr("Status")} value={tr(({ PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", SUSPENDED: "Suspended" } as Record<string, string>)[volunteer.status] ?? volunteer.status)} />
          <DetailRow label={tr("Safeguarding")} value={tr(volunteer.hasSafeguardingCert ? "Sudah diverifikasi" : "Belum diverifikasi")} />
          <DetailRow label={tr("Ketersediaan")} value={volunteer.availability?.split(", ").map(value => catalogLabel(value, VOLUNTEER_AVAILABILITY, tr)).join(", ") ?? null} />
          <DetailRow label={tr("Kebutuhan Relawan")} value={volunteer.needTitle} />
        </dl>

        {volunteer.redFlagNotes && <p className="whitespace-pre-line rounded border border-destructive p-3 text-sm text-destructive">{volunteer.redFlagNotes}</p>}
        {volunteer.attachments.some(a => a.kind === "CERTIFICATE") && <section className="space-y-2"><h3 className="text-sm font-semibold">{tr("Sertifikat")}</h3>{volunteer.attachments.filter(a => a.kind === "CERTIFICATE").map(a => <a key={a.id} href={volunteerAttachmentUrl(a)} target="_blank" rel="noreferrer" className="block break-all text-sm underline">{a.filename}</a>)}</section>}
        {volunteer.motivation && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">
              {tr("Motivasi")}</p>
            <p className="whitespace-pre-line text-sm">
              {volunteer.motivation}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {tr("Dokumen Screening")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {volunteer.ktpUrl ? (
              <Button asChild variant="outline" size="sm" className="gap-1">
                <a
                  href={volunteer.ktpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  KTP
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">
                {tr("KTP: belum di-upload")}</span>
            )}
            {volunteer.skckUrl ? (
              <Button asChild variant="outline" size="sm" className="gap-1">
                <a
                  href={volunteer.skckUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  SKCK
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">
                {tr("SKCK: belum di-upload")}</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
