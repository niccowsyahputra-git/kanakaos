"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


const ROLE_FILTER_OPTIONS = [
  { value: "ALL", label: "Semua Role" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "SOCIAL_WORKER", label: "Pekerja Sosial" },
  { value: "CAREGIVER", label: "Pengasuh" },
  { value: "VOLUNTEER", label: "Relawan" },
  { value: "FINANCE", label: "Bendahara" },
  { value: "LOGISTICS", label: "Logistik" },
];

export function UserFilters() {
  const { tr, locale } = useI18n();
  const ROLE_FILTER_OPTIONS = localizeLabels(__ROLE_FILTER_OPTIONS, tr);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function applyFilter(nextQuery: string, nextRole: string) {
    const params = new URLSearchParams();
    // Pertahankan tab aktif (dipakai saat dirender di Pengaturan Sistem)
    const tab = searchParams.get("tab");
    if (tab) params.set("tab", tab);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextRole && nextRole !== "ALL") params.set("role", nextRole);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <form
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilter(query, searchParams.get("role") ?? "ALL");
        }}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Cari nama atau email... (Enter)")}
          className="pl-9"
        />
      </form>
      <Select
        value={searchParams.get("role") ?? "ALL"}
        onValueChange={(role) => applyFilter(query, role)}
      >
        <SelectTrigger className="w-full md:w-52">
          <SelectValue placeholder={tr("Filter role")} />
        </SelectTrigger>
        <SelectContent>
          {ROLE_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {tr(option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const __ROLE_FILTER_OPTIONS = ROLE_FILTER_OPTIONS;
