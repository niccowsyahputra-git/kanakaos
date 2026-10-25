"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { getSchemas } from "@/lib/validations";
import { applyVolunteer } from "@/lib/actions/public";
import { createVolunteer, updateVolunteer } from "@/lib/actions/volunteer";
import { VOLUNTEER_FIELDS, VOLUNTEER_FIELD_CODES, VOLUNTEER_EDUCATION, VOLUNTEER_AVAILABILITY, readVolunteerSkills } from "@/lib/option-catalogs";
import { ATTACHMENT_KINDS, ATTACHMENT_LABELS, UPLOAD_LIMITS, attachmentUrl, type AttachmentSummary } from "@/lib/volunteer-upload-contract";
import { useVolunteerUploads, VolunteerUploadError } from "./use-volunteer-uploads";
import { NeedSelect, type NeedOption } from "./need-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Root as DropdownMenu, Trigger as DropdownMenuTrigger, Content as DropdownMenuContent, CheckboxItem as DropdownMenuCheckboxItem, Portal as DropdownMenuPortal, ItemIndicator } from "@radix-ui/react-dropdown-menu";

export type VolunteerProfileData = {
  id: string; name: string; phone: string | null; email: string | null; dob: string | null;
  address: string | null; occupation: string | null; skill: string | null; skillsJson: string | null;
  highestEducation: string | null; major: string | null; availability: string | null; motivation: string | null;
  hasSafeguardingCert: boolean; needId: string | null; attachments: AttachmentSummary[];
};
export function VolunteerProfileForm({ mode, volunteer, needs, onSuccess, onBusyChange }: {
  mode: "public" | "staff"; volunteer?: VolunteerProfileData; needs: NeedOption[];
  onSuccess: () => void; onBusyChange?: (value: boolean) => void;
}) {
  const { tr, locale } = useI18n();
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const isPublic = mode === "public";
  const schemas = getSchemas(locale);
  const schema = schemas.volunteerSchema.extend({
    agreePolicy: z.boolean().default(false),
    photoPresent: z.boolean().refine(Boolean, tr("Foto relawan wajib diunggah")),
  }).superRefine((values, ctx) => {
    if (isPublic) {
      const parsed = schemas.volunteerApplySchema.safeParse({ ...values, availability: (values.availability ?? "").split(", ").filter(Boolean) });
      if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue(issue);
    }
  });
  type Values = z.input<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: {
    name: volunteer?.name ?? "", phone: volunteer?.phone ?? "", email: volunteer?.email ?? "", dob: volunteer?.dob ?? "",
    address: volunteer?.address ?? "", occupation: volunteer?.occupation ?? "", skills: readVolunteerSkills(volunteer?.skillsJson),
    highestEducation: (volunteer?.highestEducation ?? "") as Values["highestEducation"], major: volunteer?.major ?? "",
    availability: volunteer?.availability ?? "", motivation: volunteer?.motivation ?? "", hasSafeguardingCert: volunteer?.hasSafeguardingCert ?? false,
    needId: volunteer?.needId ?? "", agreePolicy: false, photoPresent: Boolean(volunteer?.attachments.some(a => a.kind === "PHOTO")),
  } });
  const uploads = useVolunteerUploads(mode, volunteer?.id);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [serverError, setServerError] = useState("");
  const [phase, setPhase] = useState<"upload" | "save" | null>(null);
  const busy = form.formState.isSubmitting || uploads.removing;
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const hasPhoto = uploads.items.some(a => a.kind === "PHOTO") || Boolean(volunteer?.attachments.some(a => a.kind === "PHOTO"));
  useEffect(() => { form.setValue("photoPresent", hasPhoto, { shouldValidate: form.formState.isSubmitted }); }, [hasPhoto, form]);
  const errors = Object.entries(form.formState.errors).map(([field, error]) => ({ field, message: error?.message as string | undefined })).filter(e => e.message);
  function focusInvalid() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }
  async function submit(values: Values) {
    if (uploads.removing) return;
    setServerError("");
    try {
      setPhase("upload");
      const bundle = await uploads.upload(removeIds);
      setPhase("save");
      const result = isPublic
        ? await applyVolunteer(schemas.volunteerApplySchema.parse({ ...values, availability: (values.availability ?? "").split(", ").filter(Boolean) }), bundle)
        : volunteer ? await updateVolunteer({ ...schemas.volunteerSchema.parse(values), id: volunteer.id }, bundle)
          : await createVolunteer(schemas.volunteerSchema.parse(values), bundle);
      if (!result.success) { setServerError(result.error); return; }
      toast.success(tr(isPublic ? "Pendaftaran diterima" : "Data relawan diperbarui"));
      onSuccess();
      router.refresh();
    } catch (error) {
      setServerError(tr(error instanceof VolunteerUploadError ? error.message : "Gagal menyimpan data relawan"));
    } finally { setPhase(null); }
  }
  const textFields = [
    ["name", "Nama Lengkap", "text"], ["email", "Email", "email"], ["phone", "No. HP", "tel"],
    ["dob", "Tanggal Lahir", "date"], ["occupation", "Pekerjaan", "text"], ["address", "Alamat Lengkap", "textarea"],
  ] as const;
  return <Form {...form}><form ref={formRef} noValidate onSubmit={form.handleSubmit(submit, focusInvalid)} className="space-y-5">
    {(errors.length > 0 || serverError) && <div role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
      {serverError || tr("Periksa kolom berikut sebelum mengirim:")}
      {errors.length > 0 && <ul className="list-disc pl-5">{errors.map(error => <li key={error.field}>{error.message}</li>)}</ul>}
    </div>}
    <fieldset disabled={busy} className="min-w-0 space-y-5">
      <FormField control={form.control} name="needId" render={({ field }) => <FormItem><FormLabel>{tr("Kebutuhan Relawan")}</FormLabel><FormControl><NeedSelect needs={needs} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} disabled={busy} /></FormControl><FormMessage /></FormItem>} />
      <div className="grid gap-4 sm:grid-cols-2">{textFields.map(([name, label, type]) => <FormField key={name} control={form.control} name={name} render={({ field }) => <FormItem className={type === "textarea" ? "sm:col-span-2" : ""}>
        <FormLabel>{tr(label)}{(isPublic || name === "name") && " *"}</FormLabel><FormControl>{type === "textarea" ? <Textarea {...field} value={field.value ?? ""} rows={2} /> : <Input {...field} value={field.value ?? ""} type={type} />}</FormControl><FormMessage />
      </FormItem>} />)}</div>
      <FormField control={form.control} name="skills" render={({ field }) => <FormItem><FormLabel>{tr("Keahlian (pilih minimal 1)")} *</FormLabel>
        <DropdownMenu><DropdownMenuTrigger asChild><FormControl><Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-start whitespace-normal text-left" disabled={busy} ref={field.ref}>{field.value.length ? field.value.map(code => tr(VOLUNTEER_FIELDS[code])).join(", ") : tr("Pilih keahlian")}</Button></FormControl></DropdownMenuTrigger>
          <DropdownMenuPortal><DropdownMenuContent align="start" sideOffset={4} className="z-50 max-h-72 max-w-[90vw] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">{VOLUNTEER_FIELD_CODES.map(code => <DropdownMenuCheckboxItem className="relative cursor-pointer rounded-sm py-2 pl-7 pr-2 text-sm outline-none focus:bg-accent" key={code} checked={field.value.includes(code)} onSelect={event => event.preventDefault()} onCheckedChange={checked => field.onChange(checked ? [...field.value, code] : field.value.filter(v => v !== code))}><ItemIndicator className="absolute left-2">✓</ItemIndicator>{tr(VOLUNTEER_FIELDS[code])}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenuPortal>
        </DropdownMenu><FormMessage />
      </FormItem>} />
      {volunteer?.skill && <p className="text-sm text-muted-foreground">{tr("Keahlian data lama")}: {volunteer.skill}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={form.control} name="highestEducation" render={({ field }) => <FormItem><FormLabel>{tr("Pendidikan Terakhir")}</FormLabel><Select value={field.value || "NONE"} onValueChange={v => field.onChange(v === "NONE" ? "" : v)} disabled={busy}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="NONE">{tr("Belum ditentukan")}</SelectItem>{VOLUNTEER_EDUCATION.map(value => <SelectItem key={value} value={value}>{tr(value)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
        <FormField control={form.control} name="major" render={({ field }) => <FormItem><FormLabel>{tr("Jurusan")}</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>} />
      </div>
      <FormField control={form.control} name="availability" render={({ field }) => <FormItem><FormLabel>{tr("Ketersediaan Waktu")}{isPublic && " *"}</FormLabel>
        {isPublic ? <div className="grid gap-2 sm:grid-cols-2">{VOLUNTEER_AVAILABILITY.map((value, index) => <label key={value} className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" ref={index === 0 ? field.ref : undefined} aria-invalid={Boolean(form.formState.errors.availability)} checked={(field.value ?? "").split(", ").includes(value)} onChange={e => { const list = (field.value ?? "").split(", ").filter(Boolean); field.onChange((e.target.checked ? [...list, value] : list.filter(v => v !== value)).join(", ")); }} />{tr(value)}</label>)}</div> : <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>}<FormMessage />
      </FormItem>} />
      <FormField control={form.control} name="motivation" render={({ field }) => <FormItem><FormLabel>{tr("Motivasi Menjadi Relawan")}{isPublic && " *"}</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} rows={3} /></FormControl><FormMessage /></FormItem>} />
      <section className="space-y-3"><p className="text-sm text-muted-foreground">{tr("Foto wajib. Maksimal 5 sertifikat opsional. JPG/PNG/WebP; dokumen juga boleh PDF. Maksimal 5 MB per file.")}</p>
        {ATTACHMENT_KINDS.map(kind => {
          const existing = (volunteer?.attachments ?? []).filter(a => a.kind === kind);
          const selected = uploads.items.filter(a => a.kind === kind);
          return <div key={kind} className="space-y-2 rounded-md border p-3">
            <Label htmlFor={`${id}-${kind}`}>{tr(ATTACHMENT_LABELS[kind])}{kind === "PHOTO" && " *"}</Label>
            {existing.map(a => <div key={a.id} className="flex items-center justify-between gap-2 text-sm"><a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer" className="break-all underline">{a.filename}</a>{kind !== "PHOTO" && <Button type="button" size="sm" variant="ghost" onClick={() => setRemoveIds(list => list.includes(a.id) ? list.filter(v => v !== a.id) : [...list, a.id])}>{tr(removeIds.includes(a.id) ? "Batalkan penghapusan" : "Hapus")}</Button>}</div>)}
            <Input id={`${id}-${kind}`} type="file" multiple={kind === "CERTIFICATE"} accept={kind === "PHOTO" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"} aria-invalid={kind === "PHOTO" && Boolean(form.formState.errors.photoPresent)} onChange={event => {
              const files = Array.from(event.target.files ?? []);
              try {
                const retained = kind === "CERTIFICATE" ? existing.filter(a => !removeIds.includes(a.id)).length : 0;
                if (selected.length + files.length + retained > UPLOAD_LIMITS[kind]) throw new Error("Jumlah lampiran tidak valid");
                uploads.add(kind, files); setServerError("");
              } catch (error) { setServerError(tr((error as Error).message)); }
              event.target.value = "";
            }} />
            {selected.map(item => <div key={item.id} className="space-y-1 text-sm"><div className="flex items-center justify-between gap-2"><span className="break-all">{item.file.name} {item.progress > 0 && `(${item.progress}%)`}</span><Button type="button" variant="ghost" size="sm" onClick={() => uploads.remove(item.id)}>{tr("Hapus")}</Button></div>{item.progress > 0 && <progress value={item.progress} max={100} aria-label={item.file.name} className="w-full" />}</div>)}
            {kind === "PHOTO" && form.formState.errors.photoPresent && <p className="text-sm text-destructive">{form.formState.errors.photoPresent.message}</p>}
          </div>;
        })}
      </section>
      {isPublic ? <FormField control={form.control} name="agreePolicy" render={({ field }) => <FormItem><label className="flex items-start gap-3 rounded border p-3 text-sm"><FormControl><input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)} ref={field.ref} className="mt-1" /></FormControl><span>{tr("Saya telah membaca dan menyetujui")} <b>{tr("Kebijakan Perlindungan Anak (Child Safeguarding Policy)")}</b> {tr("yayasan, termasuk larangan kontak pribadi dengan anak di luar kegiatan resmi dan kesediaan mengikuti screening latar belakang.")}</span></label><FormMessage /></FormItem>} />
        : <FormField control={form.control} name="hasSafeguardingCert" render={({ field }) => <FormItem><label className="flex items-center gap-3 rounded border p-3 text-sm"><FormControl><input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)} ref={field.ref} /></FormControl><span>{tr("Sertifikat child safeguarding sudah diverifikasi oleh staf")}</span></label><FormMessage /></FormItem>} />}
    </fieldset>
    <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr(busy ? phase === "upload" ? "Mengunggah..." : "Menyimpan..." : isPublic ? "Kirim Pendaftaran" : "Simpan Relawan")}</Button>
  </form></Form>;
}
