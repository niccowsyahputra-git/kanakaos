"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { createShiftHandover } from "@/lib/actions/shiftHandover";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


const SHIFT_OPTIONS = [
  { value: "PAGI", label: "🌅 Pagi", time: "06.00–14.00" },
  { value: "SIANG", label: "☀️ Siang", time: "14.00–22.00" },
  { value: "MALAM", label: "🌙 Malam", time: "22.00–06.00" },
] as const;

export function HandoverForm() {
  const { tr, locale } = useI18n();
  const SHIFT_OPTIONS = localizeLabels(__SHIFT_OPTIONS, tr);

  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<string>("");
  const [allSafe, setAllSafe] = useState(true);
  const [sickNotes, setSickNotes] = useState("");
  const [importantNotes, setImportantNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await createShiftHandover({
        date,
        shift: shift as "PAGI",
        allChildrenSafe: allSafe,
        sickChildrenNotes: sickNotes,
        importantNotes,
      });
      if (result.success) {
        toast.success(tr("Serah terima shift tersimpan"));
        setShift("");
        setAllSafe(true);
        setSickNotes("");
        setImportantNotes("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{tr("Form Serah Terima Shift")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="space-y-2">
          <Label htmlFor="handover-date">{tr("Tanggal")}</Label>
          <Input
            id="handover-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="md:max-w-xs"
          />
        </div>

        {/* Pilihan shift: tombol besar mobile-friendly */}
        <div className="space-y-2">
          <Label className="text-base">{tr("Shift")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {SHIFT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setShift(option.value)}
                className={cn(
                  "flex min-h-[64px] flex-col items-center justify-center rounded-lg border-2 p-2 transition-colors",
                  shift === option.value
                    ? "border-primary bg-primary/10"
                    : "border-muted bg-background hover:bg-accent"
                )}
              >
                <span className="text-sm font-medium">{tr(option.label)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {option.time}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Checklist kondisi umum */}
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">{tr("Semua anak dalam kondisi aman?")}</p>
            <p className="text-xs text-muted-foreground">
              {tr("Matikan jika ada anak sakit / butuh perhatian khusus")}</p>
          </div>
          <Switch checked={allSafe} onCheckedChange={setAllSafe} />
        </div>

        {!allSafe && (
          <div className="space-y-2">
            <Label htmlFor="sick-notes">{tr("Anak yang Sakit / Perlu Perhatian")}</Label>
            <Textarea
              id="sick-notes"
              value={sickNotes}
              onChange={(e) => setSickNotes(e.target.value)}
              placeholder={tr("Sebutkan nama anak & kondisinya...")}
              rows={2}
              className="border-amber-300 bg-amber-50"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="important-notes">
            {tr("Catatan Penting untuk Shift Berikutnya")}</Label>
          <Textarea
            id="important-notes"
            value={importantNotes}
            onChange={(e) => setImportantNotes(e.target.value)}
            placeholder={tr("Contoh: Obat Andi diminum jam 20.00, stok susu tinggal 2 kaleng...")}
            rows={4}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isPending || !shift || importantNotes.trim().length < 5}
          className="h-12 w-full text-base md:w-auto"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {tr("Menyimpan...")}</>
          ) : (
            <>
              <Send className="h-5 w-5" />
              {tr("Submit Handover")}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

const __SHIFT_OPTIONS = SHIFT_OPTIONS;
