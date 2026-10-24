"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

import { completeHomeVisit, cancelHomeVisit } from "@/lib/actions/homeVisit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

const CHECKLIST_ITEMS = [
  { key: "sanitationOk", label: "Sanitasi layak", desc: "MCK berfungsi & bersih" },
  { key: "safetyOk", label: "Keamanan rumah", desc: "Struktur aman, bebas bahaya" },
  { key: "cleanWaterOk", label: "Air bersih", desc: "Akses air minum layak" },
  { key: "childSpaceOk", label: "Ruang untuk anak", desc: "Tempat tidur & belajar" },
  { key: "foodSecurityOk", label: "Ketahanan pangan", desc: "Makanan cukup & rutin" },
] as const;

type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]["key"];

export function CompleteVisitForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>({
    sanitationOk: false,
    safetyOk: false,
    cleanWaterOk: false,
    childSpaceOk: false,
    foodSecurityOk: false,
  });
  const [score, setScore] = useState(5);
  const [notes, setNotes] = useState("");
  const [isCompleting, startCompleting] = useTransition();
  const [isCancelling, startCancelling] = useTransition();

  function toggle(key: ChecklistKey) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleComplete() {
    startCompleting(async () => {
      const formData = new FormData();
      formData.set("visitId", visitId);
      for (const item of CHECKLIST_ITEMS) {
        formData.set(item.key, String(checklist[item.key]));
      }
      formData.set("vulnerabilityScore", String(score));
      formData.set("visitNotes", notes);
      const photo = photoRef.current?.files?.[0];
      if (photo) formData.set("photo", photo);

      const result = await completeHomeVisit(formData);
      if (result.success) {
        if (result.warning) {
          toast.warning("Kunjungan selesai", { description: result.warning });
        } else {
          toast.success("Kunjungan selesai dicatat");
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCancel() {
    startCancelling(async () => {
      const result = await cancelHomeVisit(visitId);
      if (result.success) {
        toast.success("Kunjungan dibatalkan");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Hasil Kunjungan</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Checklist kelayakan rumah: kartu besar, mudah ditekan di HP */}
        <div className="space-y-2">
          <Label className="text-base">Checklist Kelayakan Rumah</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => {
              const checked = checklist[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggle(item.key)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors",
                    checked
                      ? "border-green-500 bg-green-50"
                      : "border-muted bg-background hover:bg-accent"
                  )}
                >
                  {checked ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <span>
                    <span className="block text-sm font-medium">
                      {item.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Skor kerentanan */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base">Skor Kerentanan Keluarga</Label>
            <span
              className={cn(
                "rounded-md px-2 py-1 text-sm font-semibold",
                score <= 3
                  ? "bg-green-100 text-green-800"
                  : score <= 6
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              )}
            >
              {score}/10
            </span>
          </div>
          <Slider
            min={0}
            max={10}
            step={1}
            value={[score]}
            onValueChange={(vals) => setScore(vals[0])}
            className="py-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Aman (0)</span>
            <span>Sangat rentan (10)</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="visit-notes">
            Hasil Kunjungan{" "}
            <span className="font-normal text-muted-foreground">(wajib)</span>
          </Label>
          <Textarea
            id="visit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tuliskan hasil & temuan penting selama kunjungan (min. 10 karakter)..."
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="visit-photo">
            Foto Rumah{" "}
            <span className="font-normal text-muted-foreground">
              (opsional, maks 5MB)
            </span>
          </Label>
          <Input
            id="visit-photo"
            ref={photoRef}
            type="file"
            accept="image/*"
            className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isCompleting || isCancelling}
            className="w-full text-destructive hover:text-destructive md:w-auto"
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Membatalkan...
              </>
            ) : (
              "Batalkan Kunjungan"
            )}
          </Button>
          <Button
            onClick={handleComplete}
            disabled={
              isCompleting || isCancelling || notes.trim().length < 10
            }
            className="h-11 w-full md:w-auto"
          >
            {isCompleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Selesaikan Kunjungan"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
