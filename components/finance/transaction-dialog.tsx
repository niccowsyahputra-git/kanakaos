"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, FileDown } from "lucide-react";

import { exportTransactionsCsv } from "@/lib/actions/finance";
import { downloadBase64 } from "@/lib/download";
import { Button } from "@/components/ui/button";

// Catatan: form "Tambah Transaksi Manual" sudah dihapus.
// Pencatatan kas kini lewat modul Kas Masuk (Debit) dan Kas Keluar (Kredit).

export function ExportTransactionsButton() {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const result = await exportTransactionsCsv();
      if (result.success) {
        downloadBase64(result.contentBase64, result.fileName, result.mime);
        toast.success("File CSV berhasil diunduh");
      } else {
        toast.error(result.error ?? "Gagal export");
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
          Menyiapkan...
        </>
      ) : (
        <>
          <FileDown className="h-4 w-4" />
          Export CSV
        </>
      )}
    </Button>
  );
}
