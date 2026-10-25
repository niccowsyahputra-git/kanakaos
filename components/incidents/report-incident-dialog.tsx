"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Siren } from "lucide-react";

import { reportIncident } from "@/lib/actions/incident";
import { useManagedFormUploads } from "@/components/shared/use-managed-form-uploads";
import { MANAGED_FORM_FIELDS } from "@/lib/storage-contract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


const TYPE_OPTIONS = [
  { value: "HEALTH", label: "Kesehatan" },
  { value: "BEHAVIOR", label: "Perilaku" },
  { value: "ACCIDENT", label: "Kecelakaan" },
  { value: "OTHER", label: "Lainnya" },
];

const URGENCY_OPTIONS = [
  { value: "LOW", label: "Rendah" },
  { value: "MEDIUM", label: "Sedang" },
  { value: "HIGH", label: "Tinggi" },
  { value: "CRITICAL", label: "Kritis — butuh tindakan segera" },
];

type ChildOption = { id: string; fullName: string };

export function ReportIncidentDialog({
  children,
}: {
  children: ChildOption[];
}) {
  const { tr, locale } = useI18n();
  const TYPE_OPTIONS = localizeLabels(__TYPE_OPTIONS, tr);
  const URGENCY_OPTIONS = localizeLabels(__URGENCY_OPTIONS, tr);

  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [urgency, setUrgency] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [handling, setHandling] = useState("");
  const [isTransitionPending, startTransition] = useTransition();
  const uploads = useManagedFormUploads(MANAGED_FORM_FIELDS.incident);
  const isPending = isTransitionPending || uploads.isPending;

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("childId", childId);
      formData.set("incidentType", incidentType);
      formData.set("urgency", urgency);
      formData.set("description", description);
      formData.set("handling", handling);
      const photo = photoRef.current?.files?.[0];
      if (photo) formData.set("photo", photo);

      const result = await uploads.submit(formData, reportIncident);
      if (result.success) {
        if (result.warning) {
          toast.warning(tr("Insiden dilaporkan"), { description: result.warning });
        } else {
          toast.success(tr("Insiden berhasil dilaporkan"));
        }
        setOpen(false);
        setChildId("");
        setIncidentType("");
        setUrgency("MEDIUM");
        setDescription("");
        if (result.id) router.push(`/dashboard/incidents/${result.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!isPending) { setOpen(value); if (!value) uploads.reset(); } }}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Siren className="h-4 w-4" />
          {tr("Lapor Insiden")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Lapor Insiden")}</DialogTitle>
          <DialogDescription>
            {tr("Laporkan kejadian penting yang menimpa anak sesegera mungkin.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{tr("Anak yang Terlibat")}</Label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger>
                <SelectValue placeholder={tr("Pilih anak")} />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full space-y-2 sm:w-1/2">
              <Label>{tr("Jenis Insiden")}</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih jenis")} />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {tr(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label>{tr("Tingkat Urgensi")}</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Pilih urgensi")} />
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {tr(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-desc">{tr("Deskripsi Kejadian")}</Label>
            <Textarea
              id="incident-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr("Apa yang terjadi, kapan, di mana, tindakan awal yang sudah dilakukan...")}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-handling">
              {tr("Penanganan Insiden")}{" "}
              <span className="font-normal text-muted-foreground">
                {tr("(opsional)")}</span>
            </Label>
            <Textarea
              id="incident-handling"
              value={handling}
              onChange={(e) => setHandling(e.target.value)}
              placeholder={tr("Tindakan penanganan yang sudah/akan dilakukan...")}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-photo">
              {tr("Foto Pendukung")}{" "}
              <span className="font-normal text-muted-foreground">
                {tr("(opsional, maks 5MB)")}</span>
            </Label>
            <Input
              id="incident-photo"
              ref={photoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={isPending}
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            />
          </div>
        </div>

        {uploads.progress !== null && <progress className="w-full" max={100} value={uploads.progress} aria-label={locale === "en" ? "Upload progress" : "Progres unggahan"} />}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {tr("Batal")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !childId ||
              !incidentType ||
              description.trim().length < 10
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Melaporkan...")}</>
            ) : (
              tr("Kirim Laporan")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const __TYPE_OPTIONS = TYPE_OPTIONS;
const __URGENCY_OPTIONS = URGENCY_OPTIONS;
