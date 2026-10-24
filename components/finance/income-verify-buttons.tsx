"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

import { setIncomeVerification } from "@/lib/actions/financeIncome";
import { Button } from "@/components/ui/button";

export function IncomeVerifyButtons({ incomeId }: { incomeId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle(status: "VERIFIED" | "REJECTED") {
    startTransition(async () => {
      const result = await setIncomeVerification(incomeId, status);
      if (result.success) {
        toast.success(
          status === "VERIFIED"
            ? "Pemasukan diverifikasi — dana masuk riil"
            : "Pemasukan ditolak"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-green-600 hover:text-green-700"
            title="Verifikasi (dana sudah masuk riil)"
            onClick={() => handle("VERIFIED")}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="sr-only">Verifikasi</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            title="Tolak (bukti transfer palsu/gagal)"
            onClick={() => handle("REJECTED")}
          >
            <XCircle className="h-4 w-4" />
            <span className="sr-only">Tolak</span>
          </Button>
        </>
      )}
    </div>
  );
}
