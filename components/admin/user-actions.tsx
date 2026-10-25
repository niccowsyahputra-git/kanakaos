"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Power, Trash2 } from "lucide-react";

import { toggleUserActive, deleteUser } from "@/lib/actions/user";
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
import { UserDialog } from "./user-dialog";
import { useI18n } from "@/lib/i18n/client";


export function UserActions({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  isSelf: boolean;
}) {
  const { tr, locale } = useI18n();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleUserActive(user.id);
      if (result.success) {
        toast.success(
          user.isActive
            ? tr("{0} dinonaktifkan", { "0": user.name })
            : tr("{0} diaktifkan kembali", { "0": user.name })
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteUser(user.id);
      if (result.success) {
        toast.success(tr("User {0} dihapus", { "0": user.name }));
        setDeleteOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <UserDialog user={user} />

      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 ${user.isActive ? "text-amber-600" : "text-green-600"}`}
        onClick={handleToggle}
        disabled={isPending || isSelf}
        title={user.isActive ? tr("Nonaktifkan") : tr("Aktifkan")}
      >
        <Power className="h-4 w-4" />
        <span className="sr-only">
          {user.isActive ? tr("Nonaktifkan") : tr("Aktifkan")} {user.name}
        </span>
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={isSelf}
            title={tr("Hapus")}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{tr("Hapus ")}{user.name}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Hapus user?")}</DialogTitle>
            <DialogDescription>
              {tr("Akun ")}<b>{user.name}</b> ({user.email}{tr(") akan dihapus permanen. User yang punya riwayat log/kasus sebaiknya dinonaktifkan saja.")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              {tr("Batal")}</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr("Menghapus...")}</>
              ) : (
                tr("Ya, hapus")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
