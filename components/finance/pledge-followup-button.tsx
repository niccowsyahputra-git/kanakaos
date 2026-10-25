"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, CheckCheck } from "lucide-react";

import { markPledgeFollowedUp } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";


export function PledgeFollowUpButton({
  pledgeId,
  pledgeName,
}: {
  pledgeId: string;
  pledgeName: string;
}) {
  const { tr, locale } = useI18n();

  const [isPending, startTransition] = useTransition();

  function handleFollowUp() {
    startTransition(async () => {
      const result = await markPledgeFollowedUp(pledgeId);
      if (result.success) {
        toast.success(tr("Niat donasi {0} ditandai ditindaklanjuti", { "0": pledgeName }));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleFollowUp}
      disabled={isPending}
      className="h-8 gap-1"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCheck className="h-3.5 w-3.5" />
      )}
      {tr("Ditindaklanjuti")}</Button>
  );
}
