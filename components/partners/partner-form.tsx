"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createPartner } from "@/lib/actions/partner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";
import { PARTNER_TYPES, PARTNER_LABELS } from "@/lib/option-catalogs";
import type { Translator } from "@/lib/i18n/translate";


const getFormSchema = (tr: Translator) => z.object({
  name: z
    .string()
    .trim()
    .min(3, tr("Nama mitra minimal 3 karakter"))
    .max(150, tr("Nama mitra maksimal 150 karakter")),
  type: z.enum(PARTNER_TYPES, {
    errorMap: () => ({ message: tr("Pilih jenis mitra") }),
  }),
  picName: z.string().trim().max(100, tr("Nama PIC maksimal 100 karakter")),
  picPhone: z.string().trim().max(20, tr("No. HP PIC maksimal 20 karakter")),
  mouExpiryDate: z.string(),
});

type FormValues = z.infer<ReturnType<typeof getFormSchema>>;

export function PartnerForm() {
  const { tr, locale } = useI18n();
  const formSchema = getFormSchema(tr);

  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: undefined,
      picName: "",
      picPhone: "",
      mouExpiryDate: "",
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createPartner({
        name: values.name,
        type: values.type,
        picName: values.picName,
        picPhone: values.picPhone,
        mouExpiryDate: values.mouExpiryDate
          ? new Date(values.mouExpiryDate)
          : undefined,
      });

      if (result.success) {
        toast.success(tr("Berhasil disimpan"));
        form.reset();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{tr("Tambah Mitra")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-4 md:flex-row">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="w-full md:w-2/3">
                    <FormLabel>{tr("Nama Mitra")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tr("Contoh: RSUD Wangaya")}
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="w-full md:w-1/3">
                    <FormLabel>{tr("Jenis")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={tr("Pilih jenis")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PARTNER_TYPES.map(type => <SelectItem key={type} value={type}>{tr(PARTNER_LABELS[type])}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-4 md:flex-row">
              <FormField
                control={form.control}
                name="picName"
                render={({ field }) => (
                  <FormItem className="w-full md:w-1/3">
                    <FormLabel>
                      {tr("Nama PIC")}{" "}
                      <span className="font-normal text-muted-foreground">
                        {tr("(opsional)")}</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tr("Nama penanggung jawab")}
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="picPhone"
                render={({ field }) => (
                  <FormItem className="w-full md:w-1/3">
                    <FormLabel>
                      {tr("No. HP PIC")}{" "}
                      <span className="font-normal text-muted-foreground">
                        {tr("(opsional)")}</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tr("08xxxxxxxxxx")}
                        inputMode="tel"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mouExpiryDate"
                render={({ field }) => (
                  <FormItem className="w-full md:w-1/3">
                    <FormLabel>
                      {tr("MoU Berlaku Sampai")}{" "}
                      <span className="font-normal text-muted-foreground">
                        {tr("(opsional)")}</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      {tr("Sistem akan mengingatkan 30 hari sebelum habis.")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full md:w-auto"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tr("Menyimpan...")}</>
                ) : (
                  tr("Simpan Mitra")
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
