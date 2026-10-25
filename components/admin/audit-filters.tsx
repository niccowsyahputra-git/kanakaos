"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


const ACTION_OPTIONS = [
  { value: "ALL", label: "Semua Aksi" },
  { value: "CREATE", label: "CREATE" },
  { value: "UPDATE", label: "UPDATE" },
  { value: "DELETE", label: "DELETE" },
  { value: "LOGIN", label: "LOGIN" },
];

export function AuditFilters({
  users,
}: {
  users: { id: string; name: string }[];
}) {
  const { tr, locale } = useI18n();
  const ACTION_OPTIONS = localizeLabels(__ACTION_OPTIONS, tr);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // reset ke halaman 1 saat filter berubah
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilter =
    searchParams.get("action") ||
    searchParams.get("userId") ||
    searchParams.get("from") ||
    searchParams.get("to");

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <Select
        value={searchParams.get("action") ?? "ALL"}
        onValueChange={(v) => setParam("action", v)}
      >
        <SelectTrigger className="w-full md:w-40">
          <SelectValue placeholder={tr("Aksi")} />
        </SelectTrigger>
        <SelectContent>
          {ACTION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {tr(option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("userId") ?? "ALL"}
        onValueChange={(v) => setParam("userId", v)}
      >
        <SelectTrigger className="w-full md:w-52">
          <SelectValue placeholder={tr("User")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{tr("Semua User")}</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="w-full md:w-40"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value || null)}
          aria-label={tr("Dari tanggal")}
        />
        <span className="text-sm text-muted-foreground">{tr("s/d")}</span>
        <Input
          type="date"
          className="w-full md:w-40"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value || null)}
          aria-label={tr("Sampai tanggal")}
        />
      </div>

      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Pertahankan tab aktif saat reset filter
            const tab = searchParams.get("tab");
            router.push(tab ? `${pathname}?tab=${tab}` : pathname);
          }}
          className="w-fit gap-1"
        >
          <X className="h-3.5 w-3.5" />
          {tr("Reset")}</Button>
      )}
    </div>
  );
}

const __ACTION_OPTIONS = ACTION_OPTIONS;
