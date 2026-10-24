"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  PlugZap,
  CheckCircle2,
  XCircle,
  KeyRound,
} from "lucide-react";

import { saveAIConfig, testAIConnection } from "@/lib/actions/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  provider: z.enum(["QWEN", "OPENAI", "CUSTOM"], {
    errorMap: () => ({ message: "Pilih provider AI" }),
  }),
  apiKey: z.string().trim().max(300, "API Key terlalu panjang"),
  baseUrl: z
    .string()
    .trim()
    .url("Base URL harus berupa URL valid")
    .max(300, "Base URL terlalu panjang"),
  modelName: z
    .string()
    .trim()
    .min(2, "Nama model wajib diisi")
    .max(100, "Nama model terlalu panjang"),
});

type FormValues = z.infer<typeof formSchema>;

// Preset default per provider agar admin tinggal pilih
const PROVIDER_PRESETS: Record<
  string,
  { baseUrl: string; modelName: string }
> = {
  QWEN: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelName: "qwen-max",
  },
  OPENAI: {
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4o-mini",
  },
  CUSTOM: {
    baseUrl: "",
    modelName: "",
  },
};

type TestResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string }
  | null;

export function AISettingsForm({
  initialConfig,
}: {
  initialConfig: {
    provider: string;
    baseUrl: string;
    modelName: string;
    hasApiKey: boolean;
  } | null;
}) {
  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [testResult, setTestResult] = useState<TestResult>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider:
        (initialConfig?.provider as FormValues["provider"]) ?? "QWEN",
      apiKey: "",
      baseUrl: initialConfig?.baseUrl ?? PROVIDER_PRESETS.QWEN.baseUrl,
      modelName: initialConfig?.modelName ?? PROVIDER_PRESETS.QWEN.modelName,
    },
  });

  function handleProviderChange(provider: string) {
    form.setValue("provider", provider as FormValues["provider"]);
    const preset = PROVIDER_PRESETS[provider];
    // Isi otomatis preset hanya jika field belum diubah manual utk provider lain
    if (preset && provider !== "CUSTOM") {
      form.setValue("baseUrl", preset.baseUrl);
      form.setValue("modelName", preset.modelName);
    }
  }

  function onSubmit(values: FormValues) {
    // Wajib isi API key saat setup pertama kali
    if (!values.apiKey && !initialConfig?.hasApiKey) {
      form.setError("apiKey", { message: "API Key wajib diisi" });
      return;
    }

    startSaving(async () => {
      const result = await saveAIConfig({
        provider: values.provider,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        modelName: values.modelName,
      });

      if (result.success) {
        toast.success("Konfigurasi AI berhasil disimpan");
        setTestResult(null);
        form.setValue("apiKey", "");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleTestConnection() {
    setTestResult(null);
    startTesting(async () => {
      const result = await testAIConnection();
      if (result.success) {
        setTestResult({
          status: "success",
          message: `AI merespons: "${result.text}"`,
        });
      } else {
        setTestResult({ status: "error", message: result.error });
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select
                    onValueChange={handleProviderChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih provider AI" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="QWEN">
                        Qwen / Alibaba Cloud
                      </SelectItem>
                      <SelectItem value="OPENAI">OpenAI</SelectItem>
                      <SelectItem value="CUSTOM">
                        Custom (OpenAI-compatible)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Memilih provider akan mengisi Base URL & model default.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    API Key
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder={
                        initialConfig?.hasApiKey
                          ? "••••••••  (sudah tersimpan — isi hanya jika ingin ganti)"
                          : "sk-..."
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
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
              name="modelName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="qwen-max"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Hasil Test Connection */}
            {testResult && (
              <Alert
                variant={
                  testResult.status === "success" ? "success" : "destructive"
                }
              >
                {testResult.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {testResult.status === "success"
                    ? "Koneksi Berhasil"
                    : "Koneksi Gagal"}
                </AlertTitle>
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3 pt-2 md:flex-row md:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting || isSaving || !initialConfig?.hasApiKey}
                className="w-full md:w-auto"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menguji koneksi...
                  </>
                ) : (
                  <>
                    <PlugZap className="h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
              <Button
                type="submit"
                disabled={isSaving || isTesting}
                className="w-full md:w-auto"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan Konfigurasi
                  </>
                )}
              </Button>
            </div>
            {!initialConfig?.hasApiKey && (
              <p className="text-xs text-muted-foreground">
                Simpan konfigurasi terlebih dahulu sebelum melakukan Test
                Connection.
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
