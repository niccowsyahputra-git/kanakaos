"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Wrench } from "lucide-react";

import { updateIncidentHandling } from "@/lib/actions/incident";
import { updateCaseHandling } from "@/lib/actions/case";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUS_OPTIONS = [
  { value: "BERJALAN", label: "🔄 Masih Berjalan" },
  { value: "SELESAI", label: "✅ Selesai" },
] as const;

/**
 * Form penanganan + status sederhana (Masih Berjalan / Selesai).
 * Dipakai di detail Insiden dan detail Kasus Anak.
 */
export function HandlingForm({
  entity,
  entityId,
  initialHandling,
  initialDone,
}: {
  entity: "incident" | "case";
  entityId: string;
  initialHandling: string | null;
  initialDone: boolean;
}) {
  const router = useRouter();
  const [handling, setHandling] = useState(initialHandling ?? "");
  const [status, setStatus] = useState<"BERJALAN" | "SELESAI">(
    initialDone ? "SELESAI" : "BERJALAN"
  );
  const [isPending, startTransition] = useTransition();

  const labels =
    entity === "incident"
      ? { title: "Penanganan Insiden", status: "Status Insiden" }
      : { title: "Penanganan Kasus", status: "Status Kasus" };

  function handleSubmit() {
    startTransition(async () => {
      const result =
        entity === "incident"
          ? await updateIncidentHandling({
              incidentId: entityId,
              handling,
              status,
            })
          : await updateCaseHandling({ caseId: entityId, handling, status });

      if (result.success) {
        toast.success(`${labels.title} tersimpan`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wrench className="h-5 w-5 text-muted-foreground" />
          {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor={`handling-${entityId}`}>{labels.title}</Label>
          <Textarea
            id={`handling-${entityId}`}
            value={handling}
            onChange={(e) => setHandling(e.target.value)}
            placeholder="Tuliskan tindakan penanganan yang dilakukan..."
            rows={3}
            maxLength={2000}
          />
        </div>

        <div className="space-y-2">
          <Label>{labels.status}</Label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={cn(
                  "flex min-h-[48px] items-center justify-center rounded-lg border-2 border-muted px-2 py-3 text-sm font-medium transition-colors hover:bg-accent",
                  status === option.value &&
                    (option.value === "SELESAI"
                      ? "border-green-500 bg-green-50"
                      : "border-primary bg-primary/10")
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full md:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan Penanganan
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
