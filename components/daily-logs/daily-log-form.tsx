"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserCircle, Check } from "lucide-react";

import { createDailyLog } from "@/lib/actions/dailyLog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const moodOptions = [
  { value: 1, emoji: "😢", label: "Sangat sedih" },
  { value: 2, emoji: "😟", label: "Sedih" },
  { value: 3, emoji: "😐", label: "Biasa" },
  { value: 4, emoji: "🙂", label: "Senang" },
  { value: 5, emoji: "😄", label: "Sangat senang" },
];

const sleepOptions = [
  { value: "GOOD", label: "😴 Nyenyak" },
  { value: "FAIR", label: "😪 Cukup" },
  { value: "POOR", label: "😫 Kurang" },
] as const;

const MEALS = [
  { key: "breakfastDone", label: "Sarapan", emoji: "🌅" },
  { key: "lunchDone", label: "Makan Siang", emoji: "☀️" },
  { key: "dinnerDone", label: "Makan Malam", emoji: "🌙" },
] as const;

const PRAYERS = [
  { key: "prayerSubuh", label: "Subuh" },
  { key: "prayerDzuhur", label: "Dzuhur" },
  { key: "prayerAshar", label: "Ashar" },
  { key: "prayerMaghrib", label: "Maghrib" },
  { key: "prayerIsya", label: "Isya" },
] as const;

const SCHOOL_OPTIONS = [
  { value: "HADIR", label: "✅ Hadir" },
  { value: "BOLOS", label: "🚫 Bolos" },
  { value: "IZIN", label: "📝 Izin" },
  { value: "SAKIT", label: "🤒 Sakit" },
] as const;

type ChildOption = { id: string; fullName: string };

type BoolKeys =
  | "breakfastDone"
  | "lunchDone"
  | "dinnerDone"
  | "prayerSubuh"
  | "prayerDzuhur"
  | "prayerAshar"
  | "prayerMaghrib"
  | "prayerIsya"
  | "piketDone";

export function DailyLogForm({
  childOptions,
  defaultChildId,
  reporterName,
  reporterRole,
}: {
  childOptions: ChildOption[];
  defaultChildId?: string;
  reporterName: string;
  reporterRole: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [childId, setChildId] = useState(defaultChildId ?? "");
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<string>("");
  const [schoolAttendance, setSchoolAttendance] = useState<string>("");
  const [evaluationNotes, setEvaluationNotes] = useState("");
  const [bools, setBools] = useState<Record<BoolKeys, boolean>>({
    breakfastDone: false,
    lunchDone: false,
    dinnerDone: false,
    prayerSubuh: false,
    prayerDzuhur: false,
    prayerAshar: false,
    prayerMaghrib: false,
    prayerIsya: false,
    piketDone: false,
  });

  function toggle(key: BoolKeys) {
    setBools((b) => ({ ...b, [key]: !b[key] }));
  }

  // Porsi makan live: habis 3 waktu = 100%
  const mealsDone = MEALS.filter((m) => bools[m.key]).length;
  const mealPercentage = Math.round((mealsDone / 3) * 100);
  const prayersDone = PRAYERS.filter((p) => bools[p.key]).length;

  function handleSubmit() {
    if (!childId) {
      toast.error("Pilih anak terlebih dahulu");
      return;
    }
    if (!moodScore) {
      toast.error("Pilih mood anak");
      return;
    }
    if (!sleepQuality) {
      toast.error("Pilih kualitas tidur");
      return;
    }

    startTransition(async () => {
      const result = await createDailyLog({
        childId,
        moodScore,
        sleepQuality: sleepQuality as "GOOD",
        breakfastDone: bools.breakfastDone,
        lunchDone: bools.lunchDone,
        dinnerDone: bools.dinnerDone,
        prayerSubuh: bools.prayerSubuh,
        prayerDzuhur: bools.prayerDzuhur,
        prayerAshar: bools.prayerAshar,
        prayerMaghrib: bools.prayerMaghrib,
        prayerIsya: bools.prayerIsya,
        piketDone: bools.piketDone,
        schoolAttendance: schoolAttendance as "HADIR" | undefined,
        evaluationNotes,
      });

      if (result.success) {
        toast.success("Log harian tersimpan");
        router.push(`/dashboard/children/${childId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-4 md:p-6">
        {/* Info pengisi log: otomatis dari user login */}
        <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3">
          <UserCircle className="h-8 w-8 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Diisi oleh</p>
            <p className="truncate text-sm font-semibold">
              {reporterName}
              <span className="ml-1 font-normal capitalize text-muted-foreground">
                ({reporterRole})
              </span>
            </p>
          </div>
        </div>

        {/* Pilih anak */}
        <div className="space-y-2">
          <Label className="text-base">Nama Anak</Label>
          <Select value={childId} onValueChange={setChildId}>
            <SelectTrigger className="h-14 text-base">
              <SelectValue placeholder="Ketuk untuk pilih anak" />
            </SelectTrigger>
            <SelectContent>
              {childOptions.length === 0 ? (
                <SelectItem value="EMPTY" disabled>
                  Belum ada anak aktif
                </SelectItem>
              ) : (
                childOptions.map((child) => (
                  <SelectItem
                    key={child.id}
                    value={child.id}
                    className="py-3 text-base"
                  >
                    {child.fullName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Mood: emoji besar */}
        <div className="space-y-2">
          <Label className="text-base">Mood Anak Hari Ini</Label>
          <div className="grid grid-cols-5 gap-2">
            {moodOptions.map((mood) => (
              <button
                key={mood.value}
                type="button"
                onClick={() => setMoodScore(mood.value)}
                className={cn(
                  "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-muted bg-background p-2 transition-colors hover:bg-accent",
                  moodScore === mood.value && "border-primary bg-primary/10"
                )}
              >
                <span className="text-2xl md:text-3xl">{mood.emoji}</span>
                <span className="hidden text-[10px] text-muted-foreground sm:block">
                  {mood.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Porsi makan: 3 waktu, habis semua = 100% */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base">Porsi Makan Hari Ini</Label>
            <span className="rounded-md bg-secondary px-2 py-1 text-sm font-semibold">
              {mealPercentage}%
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {MEALS.map((meal) => {
              const done = bools[meal.key];
              return (
                <button
                  key={meal.key}
                  type="button"
                  onClick={() => toggle(meal.key)}
                  className={cn(
                    "flex min-h-[52px] items-center justify-between rounded-lg border-2 border-muted px-4 py-2 transition-colors hover:bg-accent",
                    done && "border-green-500 bg-green-50"
                  )}
                >
                  <span className="text-sm font-medium">
                    {meal.emoji} {meal.label}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      done
                        ? "bg-green-600 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {done ? "Habis ✓" : "Tidak"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Habis dari pagi sampai malam = 100%.
          </p>
        </div>

        {/* Kualitas tidur */}
        <div className="space-y-2">
          <Label className="text-base">Kualitas Tidur</Label>
          <div className="grid grid-cols-3 gap-2">
            {sleepOptions.map((sleep) => (
              <button
                key={sleep.value}
                type="button"
                onClick={() => setSleepQuality(sleep.value)}
                className={cn(
                  "flex min-h-[48px] items-center justify-center rounded-lg border-2 border-muted bg-background px-2 py-3 text-sm transition-colors hover:bg-accent",
                  sleepQuality === sleep.value && "border-primary bg-primary/10"
                )}
              >
                {sleep.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sholat 5 waktu: checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base">Sholat 5 Waktu</Label>
            <span className="rounded-md bg-secondary px-2 py-1 text-sm font-semibold">
              {prayersDone}/5
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {PRAYERS.map((prayer) => {
              const done = bools[prayer.key];
              return (
                <button
                  key={prayer.key}
                  type="button"
                  onClick={() => toggle(prayer.key)}
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-muted px-1 py-2 transition-colors hover:bg-accent",
                    done && "border-primary bg-primary/10"
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                  )}
                  <span className="text-[11px] font-medium sm:text-xs">
                    {prayer.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Piket */}
        <div className="space-y-2">
          <Label className="text-base">Piket</Label>
          <button
            type="button"
            onClick={() => toggle("piketDone")}
            className={cn(
              "flex min-h-[52px] w-full items-center justify-between rounded-lg border-2 border-muted px-4 py-2 transition-colors hover:bg-accent",
              bools.piketDone && "border-green-500 bg-green-50"
            )}
          >
            <span className="text-sm font-medium">
              🧹 Anak sudah piket sesuai jadwal?
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                bools.piketDone
                  ? "bg-green-600 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {bools.piketDone ? "Sudah ✓" : "Belum"}
            </span>
          </button>
        </div>

        {/* Kehadiran sekolah */}
        <div className="space-y-2">
          <Label className="text-base">
            Kehadiran Sekolah{" "}
            <span className="font-normal text-muted-foreground">
              (kosongkan jika libur)
            </span>
          </Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SCHOOL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setSchoolAttendance((current) =>
                    current === option.value ? "" : option.value
                  )
                }
                className={cn(
                  "flex min-h-[48px] items-center justify-center rounded-lg border-2 border-muted px-2 py-3 text-sm transition-colors hover:bg-accent",
                  schoolAttendance === option.value &&
                    "border-primary bg-primary/10"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Catatan evaluasi */}
        <div className="space-y-2">
          <Label htmlFor="evaluationNotes" className="text-base">
            Catatan Evaluasi{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </Label>
          <Textarea
            id="evaluationNotes"
            value={evaluationNotes}
            onChange={(e) => setEvaluationNotes(e.target.value)}
            placeholder="Evaluasi perkembangan / perilaku anak hari ini..."
            rows={4}
            className="text-base"
            maxLength={2000}
          />
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="h-12 w-full text-base"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Menyimpan...
            </>
          ) : (
            "Simpan Log Harian"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
