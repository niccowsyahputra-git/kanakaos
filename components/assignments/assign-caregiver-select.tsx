"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { assignCaregiver } from "@/lib/actions/assignment";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";


type CaregiverOption = { id: string; name: string };

export function AssignCaregiverSelect({
  childId,
  currentCaregiverId,
  caregivers,
}: {
  childId: string;
  currentCaregiverId: string | null;
  caregivers: CaregiverOption[];
}) {
  const { tr, locale } = useI18n();

  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      const result = await assignCaregiver(
        childId,
        value === "NONE" ? null : value
      );
      if (result.success) {
        toast.success(tr("Penugasan diperbarui"));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Select
      value={currentCaregiverId ?? "NONE"}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="h-9 w-full md:w-52">
        <SelectValue placeholder={tr("Pilih pengasuh")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NONE">{tr("— Belum ditugaskan —")}</SelectItem>
        {caregivers.map((caregiver) => (
          <SelectItem key={caregiver.id} value={caregiver.id}>
            {caregiver.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
