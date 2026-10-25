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


type CategoryOption = { id: string; name: string };

export function TransactionFilters({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const { tr, locale } = useI18n();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilter =
    searchParams.get("type") ||
    searchParams.get("categoryId") ||
    searchParams.get("from") ||
    searchParams.get("to");

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <Select
        value={searchParams.get("type") ?? "ALL"}
        onValueChange={(v) => setParam("type", v)}
      >
        <SelectTrigger className="w-full md:w-40">
          <SelectValue placeholder={tr("Tipe")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{tr("Semua Tipe")}</SelectItem>
          <SelectItem value="DEBIT">{tr("Kas Masuk")}</SelectItem>
          <SelectItem value="CREDIT">{tr("Kas Keluar")}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("categoryId") ?? "ALL"}
        onValueChange={(v) => setParam("categoryId", v)}
      >
        <SelectTrigger className="w-full md:w-48">
          <SelectValue placeholder={tr("Kategori")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{tr("Semua Kategori")}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
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
          onClick={() => router.push(pathname)}
          className="w-fit gap-1"
        >
          <X className="h-3.5 w-3.5" />
          {tr("Reset")}</Button>
      )}
    </div>
  );
}
