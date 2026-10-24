"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, CalendarPlus } from "lucide-react";

import { scheduleHomeVisit } from "@/lib/actions/homeVisit";
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

type ChildOption = { id: string; fullName: string; guardianName: string | null };
type StaffOption = { id: string; name: string };

export function ScheduleVisitDialog({
  children,
  staffOptions,
}: {
  children: ChildOption[];
  staffOptions: StaffOption[];
}) {
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedChild = children.find((child) => child.id === childId);

  function handleSubmit() {
    startTransition(async () => {
      const result = await scheduleHomeVisit({
        childId,
        officerId,
        scheduledDate,
        purpose,
      });
      if (result.success) {
        toast.success("Kunjungan berhasil dijadwalkan");
        setOpen(false);
        setChildId("");
        setOfficerId("");
        setScheduledDate("");
        setPurpose("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <CalendarPlus className="h-4 w-4" />
          Jadwalkan Kunjungan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Jadwalkan Kunjungan Rumah</DialogTitle>
          <DialogDescription>
            Kunjungan asesmen ke rumah wali/keluarga anak.
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
                    {child.guardianName ? ` — wali: ${child.guardianName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedChild && !selectedChild.guardianName && (
              <p className="text-xs text-destructive">
                Anak ini belum punya wali terdaftar — lengkapi dulu data wali.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Petugas Kunjungan</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih petugas yang melakukan kunjungan" />
              </SelectTrigger>
              <SelectContent>
                {staffOptions.length === 0 ? (
                  <SelectItem value="EMPTY" disabled>
                    Belum ada staff aktif
                  </SelectItem>
                ) : (
                  staffOptions.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-date">Tanggal Kunjungan</Label>
            <Input
              id="visit-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-purpose">Tujuan Kunjungan</Label>
            <Textarea
              id="visit-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Contoh: Asesmen kelayakan rumah untuk reunifikasi..."
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
            disabled={
              isPending ||
              !childId ||
              !officerId ||
              !scheduledDate ||
              purpose.trim().length < 5
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Jadwalkan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
