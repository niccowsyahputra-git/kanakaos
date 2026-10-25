"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { saveLandingSettings } from "@/lib/actions/settings";
import {
  MAX_PROGRAMS,
  PROGRAM_ICON_KEYS,
  type LandingContent,
  type ProgramIconKey,
  type ProgramItem,
} from "@/lib/site-content";
import { PROGRAM_ICONS } from "@/components/public/program-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";


type TextField = Exclude<keyof LandingContent, "programs">;
type EditableProgram = ProgramItem & { key: number };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function LandingSettingsForm({ initial }: { initial: LandingContent }) {
  const { tr, locale } = useI18n();

  const { programs: initialPrograms, ...initialTexts } = initial;
  const [texts, setTexts] = useState<Record<TextField, string>>(initialTexts);
  const nextKey = useRef(initialPrograms.length);
  const [programs, setPrograms] = useState<EditableProgram[]>(
    initialPrograms.map((program, index) => ({ ...program, key: index }))
  );
  const [isSaving, startSaving] = useTransition();

  function textInput(field: TextField) {
    return {
      id: `landing-${field}`,
      value: texts[field],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => setTexts((prev) => ({ ...prev, [field]: e.target.value })),
    };
  }

  function updateProgram(key: number, patch: Partial<ProgramItem>) {
    setPrograms((prev) =>
      prev.map((program) =>
        program.key === key ? { ...program, ...patch } : program
      )
    );
  }

  function moveProgram(index: number, direction: -1 | 1) {
    setPrograms((prev) => {
      const next = [...prev];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }

  function addProgram() {
    setPrograms((prev) => [
      ...prev,
      { key: nextKey.current++, icon: "heart", title: "", description: "" },
    ]);
  }

  function handleSave() {
    startSaving(async () => {
      const result = await saveLandingSettings({
        ...texts,
        programs: programs.map(({ icon, title, description }) => ({
          icon,
          title,
          description,
        })),
      });
      if (result.success) {
        toast.success(tr("Konten halaman publik tersimpan"));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{tr("Halaman Publik")}</CardTitle>
        <CardDescription>
          {tr("Konten beranda website yang dilihat pengunjung & donatur. Gunakan")}{" "}
          <code className="rounded bg-muted px-1">{"{nama}"}</code> {tr(" untuk nama yayasan dan")}{" "}
          <code className="rounded bg-muted px-1">{"{tahun}"}</code> {tr(" untuk tahun berjalan.")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Section title={tr("Bagian Atas (Hero)")}>
          <div className="space-y-2">
            <Label htmlFor="landing-heroBadge">{tr("Label di Atas Judul")}</Label>
            <Input {...textInput("heroBadge")} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="landing-heroTitle">{tr("Judul")}</Label>
            <Input {...textInput("heroTitle")} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="landing-heroSubtitle">{tr("Sub Judul")}</Label>
            <Textarea {...textInput("heroSubtitle")} rows={3} maxLength={500} />
          </div>
        </Section>

        <Section
          title={tr("Tentang Kami")}
          description={tr("Kosongkan bagian yang tidak ingin ditampilkan.")}
        >
          <div className="space-y-2">
            <Label htmlFor="landing-aboutTitle">{tr("Judul Bagian")}</Label>
            <Input {...textInput("aboutTitle")} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="landing-about">{tr("Deskripsi Yayasan")}</Label>
            <Textarea
              {...textInput("about")}
              rows={4}
              maxLength={2000}
              placeholder={tr("Gambaran singkat tentang yayasan")}
            />
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="landing-vision">{tr("Visi")}</Label>
              <Textarea {...textInput("vision")} rows={4} maxLength={1000} />
            </div>
            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="landing-mission">{tr("Misi")}</Label>
              <Textarea
                {...textInput("mission")}
                rows={4}
                maxLength={2000}
                placeholder={tr("Bisa ditulis poin per baris")}
              />
            </div>
          </div>
        </Section>

        <Section
          title={tr("Program Kami")}
          description={tr("Maksimal {0} program. Kosongkan semua program untuk menyembunyikan bagian ini.", { "0": MAX_PROGRAMS })}
        >
          <div className="space-y-2">
            <Label htmlFor="landing-programsTitle">{tr("Judul Bagian")}</Label>
            <Input {...textInput("programsTitle")} maxLength={100} />
          </div>
          {programs.map((program, index) => (
            <div
              key={program.key}
              className="space-y-3 rounded-md border bg-muted/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{tr("Program ")}{index + 1}</p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => moveProgram(index, -1)}
                    aria-label={tr("Naikkan urutan")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === programs.length - 1}
                    onClick={() => moveProgram(index, 1)}
                    aria-label={tr("Turunkan urutan")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() =>
                      setPrograms((prev) =>
                        prev.filter((item) => item.key !== program.key)
                      )
                    }
                    aria-label={tr("Hapus program")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
                <div className="space-y-2">
                  <Label>{tr("Ikon")}</Label>
                  <Select
                    value={program.icon}
                    onValueChange={(value) =>
                      updateProgram(program.key, { icon: value as ProgramIconKey })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROGRAM_ICON_KEYS.map((key) => {
                        const { icon: Icon, label } = PROGRAM_ICONS[key];
                        return (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {tr(label)}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`program-title-${program.key}`}>
                    {tr("Nama Program")}</Label>
                  <Input
                    id={`program-title-${program.key}`}
                    value={program.title}
                    onChange={(e) =>
                      updateProgram(program.key, { title: e.target.value })
                    }
                    maxLength={80}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`program-desc-${program.key}`}>{tr("Deskripsi")}</Label>
                <Textarea
                  id={`program-desc-${program.key}`}
                  value={program.description}
                  onChange={(e) =>
                    updateProgram(program.key, { description: e.target.value })
                  }
                  rows={2}
                  maxLength={300}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addProgram}
            disabled={programs.length >= MAX_PROGRAMS}
            className="w-full md:w-auto"
          >
            <Plus className="h-4 w-4" /> {tr(" Tambah Program")}</Button>
        </Section>

        <Section title={tr("Ajakan Donasi")}>
          <div className="space-y-2">
            <Label htmlFor="landing-ctaTitle">{tr("Judul")}</Label>
            <Input {...textInput("ctaTitle")} maxLength={150} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="landing-ctaSubtitle">{tr("Teks")}</Label>
            <Textarea {...textInput("ctaSubtitle")} rows={3} maxLength={500} />
          </div>
        </Section>

        <Section title="Footer">
          <div className="space-y-2">
            <Label htmlFor="landing-copyright">{tr("Teks Copyright")}</Label>
            <Input {...textInput("copyright")} maxLength={200} />
          </div>
        </Section>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || texts.heroTitle.trim().length < 3}
            className="w-full md:w-auto"
          >
            {isSaving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {tr(" Menyimpan...")}</>
            ) : (
              <><Save className="h-4 w-4" /> {tr(" Simpan Halaman Publik")}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
