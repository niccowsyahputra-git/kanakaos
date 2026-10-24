"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, FolderPlus } from "lucide-react";

import { createCase } from "@/lib/actions/case";
import { Button } from "@/components/ui/button";
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

export const CASE_TYPE_OPTIONS = [
  { value: "PROTECTION", label: "Perlindungan Anak" },
  { value: "HEALTH", label: "Kesehatan" },
  { value: "EDUCATION", label: "Pendidikan" },
  { value: "PSYCHOSOCIAL", label: "Psikososial" },
  { value: "LEGAL", label: "Hukum" },
  { value: "FAMILY_REUNIFICATION", label: "Reunifikasi Keluarga" },
  { value: "OTHER", label: "Lainnya" },
];

export const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Rendah" },
  { value: "MEDIUM", label: "Sedang" },
  { value: "HIGH", label: "Tinggi" },
  { value: "CRITICAL", label: "Kritis" },
];

type ChildOption = { id: string; fullName: string };

export function NewCaseDialog({ children }: { children: ChildOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState("");
  const [caseType, setCaseType] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [handling, setHandling] = useState("");
  const [isPending, startTransition] = useTransition();

  const isFormValid = () => {
    return (
      childId.trim() !== "" &&
      caseType.trim() !== "" &&
      description.trim().length >= 10
    );
  };

  function handleSubmit() {
    if (!isFormValid()) {
      toast.error("Lengkapi semua field yang wajib diisi");
      return;
    }

    startTransition(async () => {
      const result = await createCase({
        childId,
        caseType: caseType as "OTHER",
        priority: priority as "MEDIUM",
        description,
        handling,
      });
      if (result.success) {
        toast.success("Kasus berhasil dibuka");
        setOpen(false);
        setChildId("");
        setCaseType("");
        setPriority("MEDIUM");
        setDescription("");
        if (result.id) router.push(`/dashboard/cases/${result.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <FolderPlus className="h-4 w-4" />
          Buka Kasus Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buka Kasus Baru</DialogTitle>
          <DialogDescription>
            Kasus akan otomatis di-assign ke Anda sebagai pekerja sosial
            penanggung jawab.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>Anak</Label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih anak" />
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
              <Label>Jenis Kasus</Label>
              <Select value={caseType} onValueChange={setCaseType}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis" />
                </SelectTrigger>
                <SelectContent>
                  {CASE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-2 sm:w-1/2">
              <Label>Prioritas</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih prioritas" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="case-description">Deskripsi Kasus</Label>
            <Textarea
              id="case-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan situasi/permasalahan anak (min. 10 karakter)..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="case-handling">
              Penanganan Kasus{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <Textarea
              id="case-handling"
              value={handling}
              onChange={(e) => setHandling(e.target.value)}
              placeholder="Rencana / tindakan penanganan kasus..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !isFormValid()}
            className="min-w-[120px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Membuka...
              </>
            ) : (
              "Buka Kasus"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
