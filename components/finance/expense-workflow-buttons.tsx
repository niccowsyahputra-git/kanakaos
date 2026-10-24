"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowRightCircle, Trash2 } from "lucide-react";

import {
  advanceExpenseApproval,
  deleteFinanceExpense,
} from "@/lib/actions/financeExpense";
import { Button } from "@/components/ui/button";

const nextActionLabel: Record<string, string> = {
  DRAFT: "Ajukan Review",
  REVIEW: "Review OK",
  APPROVAL: "Setujui & Cairkan",
};

export function ExpenseWorkflowButtons({
  expenseId,
  approval,
  isSuperAdmin,
}: {
  expenseId: string;
  approval: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Tahap final hanya untuk Ketua (Super Admin)
  const canAdvance =
    approval === "DRAFT" ||
    approval === "REVIEW" ||
    (approval === "APPROVAL" && isSuperAdmin);

  function handleAdvance() {
    startTransition(async () => {
      const result = await advanceExpenseApproval(expenseId);
      if (result.success) {
        toast.success("Status voucher diperbarui");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteFinanceExpense(expenseId);
      if (result.success) {
        toast.success("Voucher draft dihapus");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (approval === "SELESAI") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          {canAdvance && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleAdvance}
            >
              <ArrowRightCircle className="h-3.5 w-3.5" />
              {nextActionLabel[approval]}
            </Button>
          )}
          {approval === "APPROVAL" && !isSuperAdmin && (
            <span className="text-xs text-muted-foreground">
              Menunggu Ketua
            </span>
          )}
          {approval === "DRAFT" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Hapus draft"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Hapus draft</span>
            </Button>
          )}
        </>
      )}
    </div>
  );
}
