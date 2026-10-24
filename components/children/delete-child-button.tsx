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

export function DeleteChildButton({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteChild(childId);
      if (result.success) {
        toast.success("Data anak berhasil dihapus");
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
          <span className="sr-only">Hapus {childName}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-lg">
        <SheetHeader>
          <SheetTitle>Hapus data anak?</SheetTitle>
          <SheetDescription>
            Data <span className="font-semibold">{childName}</span> beserta
            seluruh riwayat log hariannya akan dihapus permanen. Tindakan ini
            tidak bisa dibatalkan.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-4 gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              "Ya, hapus"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
