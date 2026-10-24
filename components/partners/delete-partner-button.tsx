"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { deletePartner } from "@/lib/actions/partner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeletePartnerButton({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePartner(partnerId);
      if (result.success) {
        toast.success(`Mitra ${partnerName} dihapus`);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          title="Hapus mitra"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Hapus {partnerName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hapus Mitra?</DialogTitle>
          <DialogDescription>
            Mitra <b>{partnerName}</b> akan dihapus permanen dari daftar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              "Ya, Hapus"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
