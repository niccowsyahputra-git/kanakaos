"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VolunteerProfileForm } from "./volunteer-profile-form";
import type { NeedOption } from "./need-select";

export function AddVolunteerDialog({ needs }: { needs: NeedOption[] }) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="h-4 w-4" />{tr("Tambah Relawan")}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{tr("Tambah Relawan")}</DialogTitle><DialogDescription>{tr("Relawan baru berstatus PENDING sampai lolos screening safeguarding.")}</DialogDescription></DialogHeader>
      <VolunteerProfileForm mode="staff" needs={needs} onSuccess={() => { setBusy(false); setOpen(false); }} onBusyChange={setBusy} />
    </DialogContent>
  </Dialog>;
}
