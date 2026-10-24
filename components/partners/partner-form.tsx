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

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama mitra minimal 3 karakter")
    .max(150, "Nama mitra maksimal 150 karakter"),
  type: z.enum(["RS", "SEKOLAH", "POLISI", "CSR"], {
    errorMap: () => ({ message: "Pilih jenis mitra" }),
  }),
  picName: z.string().trim().max(100, "Nama PIC maksimal 100 karakter"),
  picPhone: z.string().trim().max(20, "No. HP PIC maksimal 20 karakter"),
  mouExpiryDate: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export function PartnerForm() {
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
        toast.success("Berhasil disimpan");
        form.reset();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tambah Mitra</CardTitle>
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
                    <FormLabel>Nama Mitra</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: RSUD Wangaya"
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
                    <FormLabel>Jenis</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih jenis" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RS">Rumah Sakit</SelectItem>
                        <SelectItem value="SEKOLAH">Sekolah</SelectItem>
                        <SelectItem value="POLISI">Kepolisian</SelectItem>
                        <SelectItem value="CSR">CSR Perusahaan</SelectItem>
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
                      Nama PIC{" "}
                      <span className="font-normal text-muted-foreground">
                        (opsional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nama penanggung jawab"
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
                      No. HP PIC{" "}
                      <span className="font-normal text-muted-foreground">
                        (opsional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="08xxxxxxxxxx"
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
                      MoU Berlaku Sampai{" "}
                      <span className="font-normal text-muted-foreground">
                        (opsional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Sistem akan mengingatkan 30 hari sebelum habis.
                    </FormDescription>
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
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Mitra"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
