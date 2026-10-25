"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VolunteerProfileForm, type VolunteerProfileData } from "./volunteer-profile-form";
import type { NeedOption } from "./need-select";

export type EditableVolunteer = VolunteerProfileData;
export function EditVolunteerDialog({ volunteer, needs }: { volunteer: EditableVolunteer; needs: NeedOption[] }) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="h-8 gap-1" aria-label={tr("Edit data {0}", { 0: volunteer.name })}><Pencil className="h-3.5 w-3.5" />{tr("Edit")}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{tr("Edit Data Relawan")}</DialogTitle><DialogDescription>{tr("Lengkapi atau perbarui data ")}{volunteer.name}{tr(", termasuk status sertifikat child safeguarding.")}</DialogDescription></DialogHeader>
      <VolunteerProfileForm mode="staff" volunteer={volunteer} needs={needs} onSuccess={() => { setBusy(false); setOpen(false); }} onBusyChange={setBusy} />
    </DialogContent>
  </Dialog>;
}
