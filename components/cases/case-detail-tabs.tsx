"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  FileText,
  Paperclip,
  Upload,
  StickyNote,
  ExternalLink,
} from "lucide-react";

import {
  addIntervention,
  addCaseNote,
  uploadCaseDocument,
} from "@/lib/actions/case";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Intervention = {
  id: string;
  date: string;
  interventionType: string;
  notes: string;
  attachmentUrl: string | null;
  createdByName: string;
};

type CaseDoc = {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedByName: string;
  createdAt: string;
};

type Note = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
};

export function CaseDetailTabs({
  caseId,
  isClosed,
  interventions,
  documents,
  notes,
}: {
  caseId: string;
  isClosed: boolean;
  interventions: Intervention[];
  documents: CaseDoc[];
  notes: Note[];
}) {
  // --- Dialog tambah intervensi ---
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [interventionDate, setInterventionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [interventionType, setInterventionType] = useState("");
  const [interventionNotes, setInterventionNotes] = useState("");
  const attachmentRef = useRef<HTMLInputElement>(null);
  const [isSavingIntervention, startSavingIntervention] = useTransition();

  // --- Upload dokumen ---
  const documentRef = useRef<HTMLInputElement>(null);
  const [isUploadingDoc, startUploadingDoc] = useTransition();

  // --- Catatan ---
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, startSavingNote] = useTransition();

  function handleAddIntervention() {
    startSavingIntervention(async () => {
      const formData = new FormData();
      formData.set("caseId", caseId);
      formData.set("date", interventionDate);
      formData.set("interventionType", interventionType);
      formData.set("notes", interventionNotes);
      const file = attachmentRef.current?.files?.[0];
      if (file) formData.set("attachment", file);

      const result = await addIntervention(formData);
      if (result.success) {
        if (result.warning) {
          toast.warning("Intervensi tersimpan", {
            description: result.warning,
          });
        } else {
          toast.success("Intervensi tersimpan");
        }
        setInterventionOpen(false);
        setInterventionType("");
        setInterventionNotes("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleUploadDocument() {
    const file = documentRef.current?.files?.[0];
    if (!file) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }
    startUploadingDoc(async () => {
      const formData = new FormData();
      formData.set("caseId", caseId);
      formData.set("file", file);
      const result = await uploadCaseDocument(formData);
      if (result.success) {
        toast.success("Dokumen ter-upload");
        if (documentRef.current) documentRef.current.value = "";
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleAddNote() {
    startSavingNote(async () => {
      const result = await addCaseNote({ caseId, content: noteContent });
      if (result.success) {
        toast.success("Catatan tersimpan");
        setNoteContent("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Tabs defaultValue="timeline" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="timeline">
          Timeline ({interventions.length})
        </TabsTrigger>
        <TabsTrigger value="documents">
          Dokumen ({documents.length})
        </TabsTrigger>
        <TabsTrigger value="notes">Catatan ({notes.length})</TabsTrigger>
      </TabsList>

      {/* ============ TAB TIMELINE ============ */}
      <TabsContent value="timeline">
        <Card>
          <CardContent className="space-y-4 p-4 md:p-6">
            {!isClosed && (
              <Dialog
                open={interventionOpen}
                onOpenChange={setInterventionOpen}
              >
                <DialogTrigger asChild>
                  <Button className="w-full md:w-auto">
                    <Plus className="h-4 w-4" />
                    Tambah Intervensi
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tambah Intervensi</DialogTitle>
                    <DialogDescription>
                      Catat tindakan yang sudah dilakukan untuk kasus ini.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="w-full space-y-2 sm:w-1/2">
                        <Label htmlFor="int-date">Tanggal</Label>
                        <Input
                          id="int-date"
                          type="date"
                          value={interventionDate}
                          onChange={(e) => setInterventionDate(e.target.value)}
                        />
                      </div>
                      <div className="w-full space-y-2 sm:w-1/2">
                        <Label htmlFor="int-type">Jenis Intervensi</Label>
                        <Input
                          id="int-type"
                          value={interventionType}
                          onChange={(e) => setInterventionType(e.target.value)}
                          placeholder="Konseling, kunjungan, rujukan..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="int-notes">Catatan</Label>
                      <Textarea
                        id="int-notes"
                        value={interventionNotes}
                        onChange={(e) => setInterventionNotes(e.target.value)}
                        placeholder="Hasil/temuan intervensi..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="int-file">
                        Lampiran (opsional, JPG/PNG/PDF maks 5MB)
                      </Label>
                      <Input
                        id="int-file"
                        ref={attachmentRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setInterventionOpen(false)}
                      disabled={isSavingIntervention}
                    >
                      Batal
                    </Button>
                    <Button
                      onClick={handleAddIntervention}
                      disabled={
                        isSavingIntervention ||
                        interventionType.trim().length < 3 ||
                        interventionNotes.trim().length < 5
                      }
                    >
                      {isSavingIntervention ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        "Simpan Intervensi"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {interventions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada intervensi tercatat.
              </p>
            ) : (
              <ol className="relative border-l border-border pl-6">
                {interventions.map((intervention) => (
                  <li key={intervention.id} className="relative pb-6 last:pb-0">
                    <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        {intervention.interventionType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {intervention.date} · oleh {intervention.createdByName}
                      </p>
                      <p className="whitespace-pre-line text-sm">
                        {intervention.notes}
                      </p>
                      {intervention.attachmentUrl && (
                        <a
                          href={intervention.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Paperclip className="h-3 w-3" />
                          Lihat lampiran
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ============ TAB DOKUMEN ============ */}
      <TabsContent value="documents">
        <Card>
          <CardContent className="space-y-4 p-4 md:p-6">
            {!isClosed && (
              <div className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center">
                <Input
                  ref={documentRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="flex-1 cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
                />
                <Button
                  onClick={handleUploadDocument}
                  disabled={isUploadingDoc}
                  className="w-full md:w-auto"
                >
                  {isUploadingDoc ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Meng-upload...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Dokumen
                    </>
                  )}
                </Button>
              </div>
            )}

            {documents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada dokumen ter-upload.
              </p>
            ) : (
              <ul className="divide-y">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.createdAt} · {doc.uploadedByName}
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Buka
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ============ TAB CATATAN ============ */}
      <TabsContent value="notes">
        <Card>
          <CardContent className="space-y-4 p-4 md:p-6">
            {!isClosed && (
              <div className="space-y-2">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Tulis catatan pribadi terkait kasus ini..."
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={isSavingNote || noteContent.trim().length < 3}
                  >
                    {isSavingNote ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <StickyNote className="h-4 w-4" />
                        Simpan Catatan
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {notes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada catatan.
              </p>
            ) : (
              <ul className="space-y-3">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-md bg-muted/60 p-3">
                    <p className="whitespace-pre-line text-sm">
                      {note.content}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {note.authorName} · {note.createdAt}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
