"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NotificationDateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilter = searchParams.get("from") || searchParams.get("to");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="w-full sm:w-40"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value || null)}
          aria-label="Dari tanggal"
        />
        <span className="text-sm text-muted-foreground">s/d</span>
        <Input
          type="date"
          className="w-full sm:w-40"
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
