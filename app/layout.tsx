import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { getT } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: `${t.common.brand.name} - ${t.common.brand.tagline}`,
    description: t.common.brand.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, t } = await getT();

  return (
    <html lang={locale} className="h-full">
      <body className={`${inter.className} min-h-full antialiased`}>
        <I18nProvider locale={locale} t={t}>
          <SessionProvider>{children}</SessionProvider>
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
