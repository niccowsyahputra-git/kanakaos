"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { deleteChild } from "@/lib/actions/child";
import { useI18n } from "@/lib/i18n/client";


export function DeleteChildButton({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const { tr, locale } = useI18n();

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteChild(childId);
      if (result.success) {
        toast.success(tr("Data anak berhasil dihapus"));
        setOpen(false);
        router.push("/dashboard/children");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{tr("Hapus ")}{childName}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-lg">
        <SheetHeader>
          <SheetTitle>{tr("Hapus data anak?")}</SheetTitle>
          <SheetDescription>
            {tr("Data ")}<span className="font-semibold">{childName}</span> {tr(" beserta seluruh riwayat log hariannya akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.")}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-4 gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {tr("Batal")}</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menghapus...")}</>
            ) : (
              tr("Ya, hapus")
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
