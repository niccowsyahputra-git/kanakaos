"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/shared/language-switcher";


export default function LoginPage() {
  const { tr, locale } = useI18n();

  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email atau password salah");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <LanguageSwitcher className="mb-4 self-center" />
          <CardTitle className="text-2xl">{tr("KanakaOS")}</CardTitle>
          <CardDescription>{tr("Sistem Manajemen Panti Asuhan")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{tr("Email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@kanakaos.id"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{tr("Password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{tr(error)}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tr("Masuk...")}</>
              ) : (
                tr("Masuk")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
