"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, FileDown } from "lucide-react";

import { exportTransactionsCsv } from "@/lib/actions/finance";
import { downloadBase64 } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";


// Catatan: form "Tambah Transaksi Manual" sudah dihapus.
// Pencatatan kas kini lewat modul Kas Masuk (Debit) dan Kas Keluar (Kredit).

export function ExportTransactionsButton() {
  const { tr, locale } = useI18n();

  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const result = await exportTransactionsCsv();
      if (result.success) {
        downloadBase64(result.contentBase64, result.fileName, result.mime);
        toast.success(tr("File CSV berhasil diunduh"));
      } else {
        toast.error(result.error ?? tr("Gagal export"));
      }
    });
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isPending}
      className="w-full sm:w-auto"
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Menyiapkan...")}</>
      ) : (
        <>
          <FileDown className="h-4 w-4" />
          {tr("Export CSV")}</>
      )}
    </Button>
  );
}
