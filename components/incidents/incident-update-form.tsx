"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus } from "lucide-react";

import { addIncidentUpdate } from "@/lib/actions/incident";
import { Button } from "@/components/ui/button";
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


export function IncidentUpdateForm({
  incidentId,
  currentStatus,
}: {
  incidentId: string;
  currentStatus: string;
}) {
  const { tr, locale } = useI18n();

  const [notes, setNotes] = useState("");
  const [newStatus, setNewStatus] = useState<string>("KEEP");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await addIncidentUpdate({
        incidentId,
        notes,
        newStatus:
          newStatus === "KEEP"
            ? undefined
            : (newStatus as "OPEN" | "IN_PROGRESS" | "RESOLVED"),
      });
      if (result.success) {
        toast.success(tr("Update penanganan tersimpan"));
        setNotes("");
        setNewStatus("KEEP");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-3 md:p-4">
      <Label htmlFor="update-notes" className="text-base">
        {tr("Tambah Update Penanganan")}</Label>
      <Textarea
        id="update-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={tr("Tindakan yang dilakukan / perkembangan kondisi...")}
        rows={3}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Select value={newStatus} onValueChange={setNewStatus}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="KEEP">{tr("Status tetap")}</SelectItem>
            {currentStatus !== "IN_PROGRESS" && (
              <SelectItem value="IN_PROGRESS">{tr("→ Ditangani")}</SelectItem>
            )}
            {currentStatus !== "RESOLVED" && (
              <SelectItem value="RESOLVED">{tr("→ Selesai")}</SelectItem>
            )}
            {currentStatus === "RESOLVED" && (
              <SelectItem value="OPEN">{tr("→ Buka kembali")}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button
          onClick={handleSubmit}
          disabled={isPending || notes.trim().length < 5}
          className="w-full md:w-auto"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr("Menyimpan...")}</>
          ) : (
            <>
              <MessageSquarePlus className="h-4 w-4" />
              {tr("Simpan Update")}</>
          )}
        </Button>
      </div>
    </div>
  );
}
