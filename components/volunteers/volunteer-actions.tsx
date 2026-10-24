"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Flag, Loader2, Check, X } from "lucide-react";

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

export function VolunteerActions({
  volunteerId,
  volunteerName,
  status,
}: {
  volunteerId: string;
  volunteerName: string;
  status: VolunteerStatus;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      const result = await approveVolunteer(volunteerId);
      if (result.success) {
        toast.success(`${volunteerName} disetujui sebagai relawan`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectVolunteer(volunteerId);
      if (result.success) {
        toast.success(`Pendaftaran ${volunteerName} ditolak`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRedFlag() {
    startTransition(async () => {
      const result = await suspendVolunteer({ volunteerId, reason });
      if (result.success) {
        toast.success(`${volunteerName} di-suspend dengan red flag`);
        setDialogOpen(false);
        setReason("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-muted-foreground"
            onClick={handleReject}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5" />
            Tolak
          </Button>
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
          Aktifkan Lagi
        </Button>
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
              Mark Red Flag
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Flag className="h-5 w-5" />
                Red Flag: {volunteerName}
              </DialogTitle>
              <DialogDescription>
                Relawan akan otomatis di-<b>SUSPEND</b> dan tidak boleh
                berinteraksi dengan anak sampai investigasi selesai. Alasan
                akan tercatat permanen untuk audit child safeguarding.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="red-flag-reason">Alasan Red Flag</Label>
              <Textarea
                id="red-flag-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Jelaskan insiden/kekhawatiran secara spesifik (min. 10 karakter)..."
                rows={4}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleRedFlag}
                disabled={isPending || reason.trim().length < 10}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Suspend & Catat Red Flag"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
