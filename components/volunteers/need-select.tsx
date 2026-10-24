"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type NeedOption = {
  id: string;
  title: string;
  status: "OPEN" | "CLOSED";
};

const NONE = "__none__";

/** Pilih kebutuhan relawan (opsional). value "" = tidak terkait kebutuhan */
export function NeedSelect({
  id,
  needs,
  value,
  onChange,
}: {
  id?: string;
  needs: NeedOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || NONE}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Pilih kebutuhan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Tidak terkait kebutuhan tertentu</SelectItem>
        {needs.map((need) => (
          <SelectItem key={need.id} value={need.id}>
            {need.title}
            {need.status === "CLOSED" ? " (ditutup)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
