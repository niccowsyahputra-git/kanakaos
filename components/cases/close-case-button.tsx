"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

import { closeCase } from "@/lib/actions/case";
import { Button } from "@/components/ui/button";
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
import { useI18n } from "@/lib/i18n/client";


export function CloseCaseButton({ caseId }: { caseId: string }) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    startTransition(async () => {
      const result = await closeCase({ caseId, closeReason: reason });
      if (result.success) {
        toast.success(tr("Kasus ditutup"));
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full text-destructive hover:text-destructive sm:w-auto">
          <Lock className="h-4 w-4" />
          {tr("Tutup Kasus")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Tutup kasus ini?")}</DialogTitle>
          <DialogDescription>
            {tr("Kasus yang ditutup tidak bisa lagi ditambah intervensi/dokumen. Pastikan seluruh tindak lanjut sudah selesai.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="close-reason">{tr("Alasan / Resolusi Penutupan")}</Label>
          <Textarea
            id="close-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tr("Contoh: Anak sudah mendapat penanganan medis lengkap dan kondisi stabil (min. 10 karakter)...")}
            rows={4}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {tr("Batal")}</Button>
          <Button
            variant="destructive"
            onClick={handleClose}
            disabled={isPending || reason.trim().length < 10}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menutup...")}</>
            ) : (
              tr("Ya, Tutup Kasus")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
