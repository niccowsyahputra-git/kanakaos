"use client";

import { useState } from "react";
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

type VolunteerDetail = {
  name: string;
  phone: string | null;
  skill: string | null;
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
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium sm:text-right">{value ?? "-"}</dd>
    </div>
  );
}

export function VolunteerDetailDialog({
  volunteer,
}: {
  volunteer: VolunteerDetail;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Lihat detail pendaftaran"
        >
          <Eye className="h-4 w-4" />
          <span className="sr-only">Detail {volunteer.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{volunteer.name}</DialogTitle>
          <DialogDescription>
            Mendaftar {volunteer.createdAtLabel}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          <DetailRow label="Email" value={volunteer.email} />
          <DetailRow label="No. HP" value={volunteer.phone} />
          <DetailRow label="Tanggal Lahir" value={volunteer.dobLabel} />
          <DetailRow label="Pekerjaan" value={volunteer.occupation} />
          <DetailRow label="Alamat" value={volunteer.address} />
          <DetailRow label="Keahlian" value={volunteer.skill} />
          <DetailRow label="Ketersediaan" value={volunteer.availability} />
          <DetailRow label="Kebutuhan Relawan" value={volunteer.needTitle} />
        </dl>

        {volunteer.motivation && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">
              Motivasi
            </p>
            <p className="whitespace-pre-line text-sm">
              {volunteer.motivation}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Dokumen Screening
          </p>
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
                KTP: belum di-upload
              </span>
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
                SKCK: belum di-upload
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
