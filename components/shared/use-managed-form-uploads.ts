"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { ManagedFormUploadController } from "@/lib/managed-upload-client";
import { StorageError, storageErrorMessage, type ManagedFormFields } from "@/lib/storage-contract";

export function useManagedFormUploads(fields: ManagedFormFields, targetId?: string) {
  const { locale } = useI18n();
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const controller = useRef<ManagedFormUploadController>();
  const active = useRef(false);
  const [isPending, setPending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => () => { void controller.current?.discardAll().catch(() => {}); }, []);

  function reset() {
    if (active.current) return;
    const previous = controller.current;
    controller.current = undefined;
    setProgress(null);
    void previous?.discardAll().catch(() => {});
  }

  async function submit<T extends { success: boolean }>(form: FormData, save: (prepared: FormData) => Promise<T>): Promise<T | { success: false; error: string }> {
    if (active.current) return { success: false, error: storageErrorMessage("UNAVAILABLE", localeRef.current) };
    active.current = true;
    setPending(true);
    setProgress(null);
    try {
      if (controller.current?.targetId !== targetId) {
        await controller.current?.discardAll();
        controller.current = undefined;
      }
      controller.current ??= new ManagedFormUploadController("staff", targetId);
      const prepared = await controller.current.prepare(form, fields, setProgress);
      const result = await save(prepared);
      if (result.success) {
        const completed = controller.current;
        controller.current = undefined;
        void completed.discardAll().catch(() => {});
      }
      return result;
    } catch (error) {
      return { success: false, error: storageErrorMessage(error instanceof StorageError ? error.code : "UNAVAILABLE", localeRef.current) };
    } finally {
      active.current = false;
      setPending(false);
    }
  }

  return { submit, reset, isPending, progress };
}
