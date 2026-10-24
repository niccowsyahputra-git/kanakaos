"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { createVolunteer } from "@/lib/actions/volunteer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddVolunteerDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [skill, setSkill] = useState("");
  const [hasCert, setHasCert] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await createVolunteer({
        name,
        phone,
        skill,
        hasSafeguardingCert: hasCert,
      });
      if (result.success) {
        toast.success("Berhasil disimpan", {
          description: "Relawan terdaftar dengan status PENDING.",
        });
        setOpen(false);
        setName("");
        setPhone("");
        setSkill("");
        setHasCert(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Tambah Relawan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Relawan</DialogTitle>
          <DialogDescription>
            Relawan baru berstatus PENDING sampai lolos screening safeguarding.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="vol-name">Nama Lengkap</Label>
            <Input
              id="vol-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama relawan"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vol-phone">No. HP</Label>
            <Input
              id="vol-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              inputMode="tel"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vol-skill">Keahlian</Label>
            <Input
              id="vol-skill"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="Contoh: Mengajar matematika, psikolog"
              autoComplete="off"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              checked={hasCert}
              onChange={(e) => setHasCert(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">
              Sudah memiliki sertifikat <b>child safeguarding</b>
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
            disabled={isPending || name.trim().length < 3}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Relawan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
