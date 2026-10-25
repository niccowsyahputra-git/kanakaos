"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client";
import { discardVolunteerUploads } from "@/lib/actions/volunteer-upload";
import { receiptSchema, validateFile, type AttachmentKind, type SignedUpload, type UploadBundle, type UploadClaim, type UploadReceipt } from "@/lib/volunteer-upload-contract";

export class VolunteerUploadError extends Error {}
type PendingFile = { id: string; kind: AttachmentKind; file: File; progress: number; claim?: UploadClaim; receipt?: UploadReceipt; expiresAt?: number };
export function useVolunteerUploads(mode: "public" | "staff", volunteerId?: string) {
  const { tr } = useI18n();
  const translate = useRef(tr);
  translate.current = tr;
  const [removing, setRemoving] = useState(false);
  const nonce = useRef<string>();
  const files = useRef<PendingFile[]>([]);
  const [items, setItems] = useState<PendingFile[]>([]);
  const sync = () => setItems(files.current.map(item => ({ ...item })));
  async function discard(uploads: UploadClaim[]) {
    if (!uploads.length || !nonce.current) return;
    const result = await discardVolunteerUploads({ mode, volunteerId, nonce: nonce.current, uploads });
    if (!result.success) throw new VolunteerUploadError(result.error);
  }
  useEffect(() => () => {
    const uploads = files.current.flatMap(item => item.claim ? [item.claim] : []);
    if (uploads.length && nonce.current) void discardVolunteerUploads({ mode, volunteerId, nonce: nonce.current, uploads }).then(result => {
      if (!result.success) toast.warning(result.error);
    }).catch(() => toast.warning(translate.current("Gagal membersihkan unggahan. Hubungi pengelola.")));
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
      if (item?.claim) await discard([item.claim]);
      files.current = files.current.filter(item => item.id !== id); sync();
    } catch (error) { toast.warning(translate.current(error instanceof VolunteerUploadError ? error.message : "Gagal membersihkan unggahan. Hubungi pengelola.")); }
    finally { setRemoving(false); }
  }
  async function upload(removeIds: string[]): Promise<UploadBundle> {
    nonce.current ??= crypto.randomUUID();
    const pending = files.current.filter(item => !item.receipt || (item.expiresAt ?? 0) <= Date.now() / 1000 + 30);
    if (pending.length) {
      await discard(pending.flatMap(item => item.claim ? [item.claim] : []));
      for (const item of pending) { item.claim = undefined; item.receipt = undefined; item.progress = 0; }
      const response = await fetch("/api/volunteer-uploads/sign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, volunteerId, nonce: nonce.current, files: pending.map(item => ({ kind: item.kind, filename: item.file.name, mime: item.file.type, bytes: item.file.size })) }),
      }).catch(() => { throw new VolunteerUploadError("Gagal menyiapkan unggahan"); });
      const signed = await response.json().catch(() => { throw new VolunteerUploadError("Gagal menyiapkan unggahan"); }) as { error?: string; uploads?: SignedUpload[] };
      if (!response.ok || !signed.uploads || signed.uploads.length !== pending.length) throw new VolunteerUploadError(signed.error ?? "Gagal menyiapkan unggahan");
      for (let index = 0; index < pending.length; index++) {
        const item = pending[index];
        const ticket = signed.uploads[index];
        item.claim = { ticket: ticket.ticket, publicId: ticket.publicId };
        item.expiresAt = ticket.expiresAt;
        item.receipt = await directUpload(item.file, ticket, progress => { item.progress = progress; sync(); });
        sync();
      }
    }
    return { nonce: nonce.current, receipts: files.current.map(item => item.receipt!), removeIds };
  }
  return { items, add, remove, upload, removing };
}
function directUpload(file: File, ticket: SignedUpload, progress: (value: number) => void): Promise<UploadReceipt> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", ticket.url);
    xhr.timeout = 120000;
    xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = xhr.ontimeout = () => reject(new VolunteerUploadError("Unggahan gagal. Periksa koneksi lalu coba lagi."));
    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) throw new VolunteerUploadError();
        const response = JSON.parse(xhr.responseText);
        const receipt = receiptSchema.parse({ ticket: ticket.ticket, publicId: response.public_id, version: response.version, signature: response.signature });
        if (receipt.publicId !== ticket.publicId) throw new VolunteerUploadError();
        progress(100);
        resolve(receipt);
      } catch { reject(new VolunteerUploadError("Unggahan gagal. Periksa koneksi lalu coba lagi.")); }
    };
    const body = new FormData();
    for (const [key, value] of Object.entries(ticket.params)) body.append(key, value);
    body.append("file", file);
    xhr.send(body);
  });
}
