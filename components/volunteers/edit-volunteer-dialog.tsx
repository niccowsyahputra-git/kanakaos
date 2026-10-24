"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import { updateVolunteer } from "@/lib/actions/volunteer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NeedSelect, type NeedOption } from "./need-select";

export type EditableVolunteer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** Format YYYY-MM-DD untuk input date */
  dob: string | null;
  address: string | null;
  occupation: string | null;
  skill: string | null;
  availability: string | null;
  motivation: string | null;
  hasSafeguardingCert: boolean;
  needId: string | null;
};

function toFormState(volunteer: EditableVolunteer) {
  return {
    name: volunteer.name,
    phone: volunteer.phone ?? "",
    email: volunteer.email ?? "",
    dob: volunteer.dob ?? "",
    address: volunteer.address ?? "",
    occupation: volunteer.occupation ?? "",
    skill: volunteer.skill ?? "",
    availability: volunteer.availability ?? "",
    motivation: volunteer.motivation ?? "",
    hasSafeguardingCert: volunteer.hasSafeguardingCert,
    needId: volunteer.needId ?? "",
  };
}

export function EditVolunteerDialog({
  volunteer,
  needs,
}: {
  volunteer: EditableVolunteer;
  needs: NeedOption[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toFormState(volunteer));
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    // Selalu mulai dari data terbaru saat dialog dibuka
    if (next) setForm(toFormState(volunteer));
    setOpen(next);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateVolunteer({ id: volunteer.id, ...form });
      if (result.success) {
        toast.success("Data relawan diperbarui");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          aria-label={`Edit data ${volunteer.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Data Relawan</DialogTitle>
          <DialogDescription>
            Lengkapi atau perbarui data {volunteer.name}, termasuk status
            sertifikat child safeguarding.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor={`ev-name-${volunteer.id}`}>Nama Lengkap</Label>
            <Input
              id={`ev-name-${volunteer.id}`}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`ev-phone-${volunteer.id}`}>No. HP</Label>
              <Input
                id={`ev-phone-${volunteer.id}`}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="08xxxxxxxxxx"
                inputMode="tel"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`ev-email-${volunteer.id}`}>Email</Label>
              <Input
                id={`ev-email-${volunteer.id}`}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@contoh.com"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`ev-dob-${volunteer.id}`}>Tanggal Lahir</Label>
              <Input
                id={`ev-dob-${volunteer.id}`}
                type="date"
                value={form.dob}
                onChange={(e) => set("dob", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`ev-occupation-${volunteer.id}`}>Pekerjaan</Label>
              <Input
                id={`ev-occupation-${volunteer.id}`}
                value={form.occupation}
                onChange={(e) => set("occupation", e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`ev-address-${volunteer.id}`}>Alamat</Label>
            <Textarea
              id={`ev-address-${volunteer.id}`}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`ev-skill-${volunteer.id}`}>Keahlian</Label>
            <Input
              id={`ev-skill-${volunteer.id}`}
              value={form.skill}
              onChange={(e) => set("skill", e.target.value)}
              placeholder="Contoh: Mengajar, Fotografi"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`ev-availability-${volunteer.id}`}>
              Ketersediaan Waktu
            </Label>
            <Input
              id={`ev-availability-${volunteer.id}`}
              value={form.availability}
              onChange={(e) => set("availability", e.target.value)}
              placeholder="Contoh: Sabtu, Minggu"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`ev-need-${volunteer.id}`}>Kebutuhan Relawan</Label>
            <NeedSelect
              id={`ev-need-${volunteer.id}`}
              needs={needs}
              value={form.needId}
              onChange={(v) => set("needId", v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`ev-motivation-${volunteer.id}`}>Motivasi</Label>
            <Textarea
              id={`ev-motivation-${volunteer.id}`}
              value={form.motivation}
              onChange={(e) => set("motivation", e.target.value)}
              rows={3}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              checked={form.hasSafeguardingCert}
              onChange={(e) => set("hasSafeguardingCert", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">
              Sudah memiliki sertifikat <b>child safeguarding</b> (sudah
              diverifikasi)
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || form.name.trim().length < 3}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Perubahan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
