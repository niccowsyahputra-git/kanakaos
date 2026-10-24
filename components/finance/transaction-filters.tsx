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

type CategoryOption = { id: string; name: string };

export function TransactionFilters({
  categories,
}: {
  categories: CategoryOption[];
}) {
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
          <SelectValue placeholder="Tipe" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Semua Tipe</SelectItem>
          <SelectItem value="DEBIT">Kas Masuk</SelectItem>
          <SelectItem value="CREDIT">Kas Keluar</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("categoryId") ?? "ALL"}
        onValueChange={(v) => setParam("categoryId", v)}
      >
        <SelectTrigger className="w-full md:w-48">
          <SelectValue placeholder="Kategori" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Semua Kategori</SelectItem>
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
          aria-label="Dari tanggal"
        />
        <span className="text-sm text-muted-foreground">s/d</span>
        <Input
          type="date"
          className="w-full md:w-40"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value || null)}
          aria-label="Sampai tanggal"
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
          Reset
        </Button>
      )}
    </div>
  );
}
