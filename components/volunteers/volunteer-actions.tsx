"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Flag, Loader2, Check, X, ShieldCheck } from "lucide-react";

import {
  approveVolunteer,
  rejectVolunteer,
  suspendVolunteer,
} from "@/lib/actions/volunteer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import type { VolunteerStatus } from "@prisma/client";
import { useI18n } from "@/lib/i18n/client";


export function VolunteerActions({
  volunteerId,
  volunteerName,
  status,
  hasSafeguardingCert,
}: {
  volunteerId: string;
  volunteerName: string;
  status: VolunteerStatus;
  hasSafeguardingCert: boolean;
}) {
  const { tr, locale } = useI18n();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [certConfirmed, setCertConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function approve(confirmCertificate: boolean) {
    startTransition(async () => {
      const result = await approveVolunteer(volunteerId, {
        confirmCertificate,
      });
      if (result.success) {
        toast.success(tr("{0} disetujui sebagai relawan", { "0": volunteerName }));
        setApproveOpen(false);
        setCertConfirmed(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  // Sertifikat belum tercatat: minta konfirmasi verifikasi dulu
  function handleApprove() {
    if (hasSafeguardingCert) {
      approve(false);
    } else {
      setCertConfirmed(false);
      setApproveOpen(true);
    }
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectVolunteer(volunteerId);
      if (result.success) {
        toast.success(tr("Pendaftaran {0} ditolak", { "0": volunteerName }));
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRedFlag() {
    startTransition(async () => {
      const result = await suspendVolunteer({ volunteerId, reason });
      if (result.success) {
        toast.success(tr("{0} di-suspend dengan red flag", { "0": volunteerName }));
        setDialogOpen(false);
        setReason("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-700" />
              {tr("Approve ")}{volunteerName}
            </DialogTitle>
            <DialogDescription>
              {tr("Sertifikat ")}<b>{tr("child safeguarding")}</b> {tr(" relawan ini belum tercatat. Sesuai kebijakan perlindungan anak, relawan hanya boleh di-approve setelah sertifikatnya diverifikasi.")}</DialogDescription>
          </DialogHeader>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              checked={certConfirmed}
              onChange={(e) => setCertConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="text-sm">
              {tr("Saya sudah memverifikasi sertifikat child safeguarding relawan ini. Status sertifikat akan dicatat sebagai ")}<b>{tr("Bersertifikat")}</b>.
            </span>
          </label>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setApproveOpen(false)}
              disabled={isPending}
            >
              {tr("Batal")}</Button>
            <Button
              onClick={() => approve(true)}
              disabled={isPending || !certConfirmed}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr("Memproses...")}</>
              ) : (
                tr("Verifikasi & Approve")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {status === "PENDING" && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-green-700 hover:bg-green-50 hover:text-green-800"
            onClick={handleApprove}
            disabled={isPending}
          >
            <Check className="h-3.5 w-3.5" />
            {tr("Approve")}</Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-muted-foreground"
            onClick={handleReject}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5" />
            {tr("Tolak")}</Button>
        </>
      )}

      {status === "SUSPENDED" && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-green-700 hover:bg-green-50 hover:text-green-800"
          onClick={handleApprove}
          disabled={isPending}
        >
          <Check className="h-3.5 w-3.5" />
          {tr("Aktifkan Lagi")}</Button>
      )}

      {status !== "SUSPENDED" && status !== "REJECTED" && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isPending}
            >
              <Flag className="h-3.5 w-3.5" />
              {tr("Mark Red Flag")}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Flag className="h-5 w-5" />
                {tr("Red Flag: ")}{volunteerName}
              </DialogTitle>
              <DialogDescription>
                {tr("Relawan akan otomatis di-")}<b>{tr("SUSPEND")}</b> {tr(" dan tidak boleh berinteraksi dengan anak sampai investigasi selesai. Alasan akan tercatat permanen untuk audit child safeguarding.")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="red-flag-reason">{tr("Alasan Red Flag")}</Label>
              <Textarea
                id="red-flag-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tr("Jelaskan insiden/kekhawatiran secara spesifik (min. 10 karakter)...")}
                rows={4}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                {tr("Batal")}</Button>
              <Button
                variant="destructive"
                onClick={handleRedFlag}
                disabled={isPending || reason.trim().length < 10}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tr("Memproses...")}</>
                ) : (
                  tr("Suspend & Catat Red Flag")
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
