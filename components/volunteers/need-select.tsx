"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";
import { NEED_STATUS_LABELS, needFieldLabel, dateOnlyLabel } from "@/lib/option-catalogs";


export type NeedOption = {
  id: string;
  title: string;
  status: "OPEN" | "SUSPENDED" | "CLOSED";
  field?: string | null;
  otherField?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

const NONE = "__none__";

/** Pilih kebutuhan relawan (opsional). value "" = tidak terkait kebutuhan */
type NeedSelectProps = Omit<ComponentPropsWithoutRef<typeof SelectTrigger>, "value" | "onChange"> & {
  needs: NeedOption[];
  value: string;
  onChange: (value: string) => void;
};
export const NeedSelect = forwardRef<HTMLButtonElement, NeedSelectProps>(function NeedSelect({
  needs, value, onChange, disabled, ...triggerProps
}, ref) {
  const { tr, locale } = useI18n();

  return (
    <Select
      value={value || NONE}
      disabled={disabled}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
    >
      <SelectTrigger {...triggerProps} ref={ref} className="h-auto min-h-10 [&>span]:whitespace-normal [&>span]:text-left">
        <SelectValue placeholder={tr("Pilih kebutuhan")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{tr("Tidak terkait kebutuhan tertentu")}</SelectItem>
        {needs.filter(need => need.status === "OPEN" || need.id === value).map((need) => (
          <SelectItem key={need.id} value={need.id} disabled={need.status !== "OPEN"}>
            {need.field && need.field !== "OTHER" ? tr(needFieldLabel(need.field, need.otherField ?? null, need.title)) : need.title}
            {need.startDate && need.endDate ? ` · ${dateOnlyLabel(need.startDate, locale)} – ${dateOnlyLabel(need.endDate, locale)}` : ""}
            {need.status !== "OPEN" ? ` (${tr(NEED_STATUS_LABELS[need.status])})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
