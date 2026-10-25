"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

import { completeMaintenance } from "@/lib/actions/asset";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";


export function MaintenanceDoneButton({
  maintenanceId,
  assetName,
}: {
  maintenanceId: string;
  assetName: string;
}) {
  const { tr, locale } = useI18n();

  const [isPending, startTransition] = useTransition();

  function handleDone() {
    startTransition(async () => {
      const result = await completeMaintenance(maintenanceId);
      if (result.success) {
        toast.success(tr("Maintenance {0} ditandai selesai", { "0": assetName }));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDone}
      disabled={isPending}
      className="h-8 gap-1"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {tr("Selesai")}</Button>
  );
}
