"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client";
import { ManagedUploadController } from "@/lib/managed-upload-client";
import { StorageError, storageErrorMessage } from "@/lib/storage-contract";
import { validateFile, type AttachmentKind, type ManagedVolunteerBundle } from "@/lib/volunteer-upload-contract";

export class VolunteerUploadError extends Error {}
type PendingFile = { id: string; kind: AttachmentKind; file: File; progress: number };
export function useVolunteerUploads(mode: "public" | "staff", volunteerId?: string) {
  const { tr, locale } = useI18n();
  const translate = useRef(tr);
  const language = useRef(locale);
  translate.current = tr;
  language.current = locale;
  const [removing, setRemoving] = useState(false);
  const controller = useRef<ManagedUploadController>();
  const files = useRef<PendingFile[]>([]);
  const [items, setItems] = useState<PendingFile[]>([]);
  const sync = () => setItems(files.current.map(item => ({ ...item })));
  useEffect(() => () => {
    void controller.current?.discardAll().catch(() => toast.warning(translate.current("Gagal membersihkan unggahan. Hubungi pengelola.")));
  }, [mode, volunteerId]);
  function add(kind: AttachmentKind, selected: File[]) {
    for (const file of selected) {
      const error = validateFile(file, kind);
      if (error) throw new VolunteerUploadError(error);
    }
    files.current = [...files.current, ...selected.map(file => ({ id: crypto.randomUUID(), kind, file, progress: 0 }))];
    sync();
  }
  async function remove(id: string) {
    setRemoving(true);
    try {
      const item = files.current.find(item => item.id === id);
      if (item) await controller.current?.discard(item.file);
      files.current = files.current.filter(item => item.id !== id); sync();
    } catch (error) { toast.warning(translate.current(error instanceof VolunteerUploadError ? error.message : "Gagal membersihkan unggahan. Hubungi pengelola.")); }
    finally { setRemoving(false); }
  }
  async function upload(removeIds: string[]): Promise<ManagedVolunteerBundle> {
    controller.current ??= new ManagedUploadController(mode, volunteerId);
    try {
      const claims = [];
      for (const item of files.current) {
        claims.push(await controller.current.upload(item.file, `VOLUNTEER_${item.kind}`, progress => { item.progress = progress; sync(); }));
      }
      return { nonce: controller.current.nonce, claims, removeIds };
    } catch (error) {
      throw new VolunteerUploadError(error instanceof StorageError ? storageErrorMessage(error.code, language.current) : translate.current("Gagal menyiapkan unggahan"));
    }
  }
  return { items, add, remove, upload, removing };
}
