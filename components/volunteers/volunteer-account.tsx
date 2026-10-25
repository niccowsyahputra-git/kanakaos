"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

import { createUserForVolunteer } from "@/lib/actions/volunteer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/client";


/** Badge status akun relawan yang sudah tertaut */
export function VolunteerAccountBadge({
  email,
  isActive,
}: {
  email: string;
  isActive: boolean;
}) {
  const { tr, locale } = useI18n();

  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        variant="outline"
        className={
          isActive
            ? "w-fit border-transparent bg-green-100 text-green-800"
            : "w-fit border-transparent bg-gray-100 text-gray-500"
        }
      >
        {tr("Relawan")}{!isActive && tr(" (nonaktif)")}
      </Badge>
      <span className="text-xs text-muted-foreground">{email}</span>
    </div>
  );
}

/** Tombol + dialog buat akun login untuk relawan yang belum punya */
export function CreateVolunteerAccountDialog({
  volunteerId,
  volunteerName,
  volunteerEmail,
}: {
  volunteerId: string;
  volunteerName: string;
  volunteerEmail: string | null;
}) {
  const { tr, locale } = useI18n();

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(volunteerName);
  const [email, setEmail] = useState(volunteerEmail ?? "");
  const [password, setPassword] = useState("");

  function handleOpenChange(next: boolean) {
    // Mulai dari data relawan terbaru setiap kali dialog dibuka
    if (next) {
      setName(volunteerName);
      setEmail(volunteerEmail ?? "");
      setPassword("");
    }
    setOpen(next);
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createUserForVolunteer(volunteerId, {
        name,
        email,
        password,
      });
      if (result.success) {
        toast.success(tr("Akun login untuk {0} berhasil dibuat", { "0": name }), {
          description: tr("Email login: {0}", { "0": email }),
        });
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <KeyRound className="h-3.5 w-3.5" />
          {tr("Buatkan Akun")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Buat Akun Login Relawan")}</DialogTitle>
          <DialogDescription>
            {tr("Akun ini akan tertaut ke relawan ")}<b>{volunteerName}</b> {tr(" dengan role")}{" "}
            <b>{tr("Relawan")}</b> {tr(" dan bisa dipakai untuk login ke sistem.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="vacc-name">{tr("Nama Tampilan")}</Label>
            <Input
              id="vacc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vacc-email">{tr("Email Login")}</Label>
            <Input
              id="vacc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vacc-password">{tr("Password Awal")}</Label>
            <Input
              id="vacc-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tr("Minimal 8 karakter")}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {tr("Batal")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              name.trim().length < 3 ||
              !email.includes("@") ||
              password.length < 8
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Membuat...")}</>
            ) : (
              tr("Buat Akun")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
