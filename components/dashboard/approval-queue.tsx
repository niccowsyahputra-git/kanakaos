"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";

import { advanceExpenseApproval } from "@/lib/actions/financeExpense";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";
import { expenseCoaLabel } from "@/components/finance/finance-labels";
import type { ExpenseCoa } from "@prisma/client";

type ApprovalItem = {
  id: string;
  voucherNumber: string;
  amount: number;
  coa: string;
  beneficiary: string;
  programName: string | null;
};

export function ApprovalQueue({ items }: { items: ApprovalItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleApprove(id: string, voucher: string) {
    startTransition(async () => {
      const result = await advanceExpenseApproval(id);
      if (result.success) {
        toast.success(`Voucher ${voucher} disetujui — dana cair`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        Tidak ada pengajuan dana &gt; Rp 1.000.000 yang menunggu persetujuan
        Anda. 🎉
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {item.voucherNumber}
              </span>
              <span className="font-semibold text-red-600">
                {formatRupiah(item.amount)}
              </span>
            </div>
            <p className="truncate text-sm">
              {expenseCoaLabel[item.coa as ExpenseCoa]} · {item.beneficiary}
              {item.programName ? ` · ${item.programName}` : ""}
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => handleApprove(item.id, item.voucherNumber)}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Setujui &amp; Cairkan
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
