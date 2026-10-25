"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";

import {
  generateMonthlyReport,
  generateAnnualReport,
} from "@/lib/actions/report";
import { downloadBase64 } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";


export function ReportButtons() {
  const { tr, locale } = useI18n();

  const [isMonthly, startMonthly] = useTransition();
  const [isAnnual, startAnnual] = useTransition();

  const now = new Date();

  function handleMonthly() {
    startMonthly(async () => {
      const result = await generateMonthlyReport(
        now.getFullYear(),
        now.getMonth() + 1
      );
      if (result.success) {
        downloadBase64(result.contentBase64, result.fileName, "application/pdf");
        toast.success(tr("Laporan bulanan ter-download"));
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleAnnual() {
    startAnnual(async () => {
      const result = await generateAnnualReport(now.getFullYear());
      if (result.success) {
        downloadBase64(result.contentBase64, result.fileName, "application/pdf");
        toast.success(tr("Laporan tahunan ter-download"));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <Button
        onClick={handleMonthly}
        disabled={isMonthly || isAnnual}
        className="w-full md:w-auto"
      >
        {isMonthly ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> {tr(" Menyiapkan...")}</>
        ) : (
          <><FileDown className="h-4 w-4" /> {tr(" Generate Laporan Bulanan")}</>
        )}
      </Button>
      <Button
        variant="outline"
        onClick={handleAnnual}
        disabled={isMonthly || isAnnual}
        className="w-full md:w-auto"
      >
        {isAnnual ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> {tr(" Menyiapkan...")}</>
        ) : (
          <><FileDown className="h-4 w-4" /> {tr(" Generate Laporan Tahunan")}</>
        )}
      </Button>
    </div>
  );
}
