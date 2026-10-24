import Link from "next/link";
import { Heart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getYayasanInfo() {
  const rows = await prisma.systemConfig.findMany({
    where: { configKey: { in: ["YAYASAN_NAME", "YAYASAN_ADDRESS"] } },
  });
  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));
  return {
    name: map.get("YAYASAN_NAME") || "Yayasan Kanaka",
    address:
      map.get("YAYASAN_ADDRESS") || "Jl. Melati No. 10, Denpasar, Bali",
  };
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const yayasan = await getYayasanInfo();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header publik */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              K
            </span>
            <span className="font-bold">{yayasan.name}</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Beranda</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/volunteer/apply">Jadi Relawan</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Login Staff</Link>
            </Button>
            <Button asChild size="sm" className="ml-2">
              <Link href="/donate">
                <Heart className="h-4 w-4" />
                Donasi Sekarang
              </Link>
            </Button>
          </nav>

          {/* Mobile: tombol donasi selalu terlihat */}
          <div className="flex items-center gap-2 md:hidden">
            <Button asChild size="sm">
              <Link href="/donate">
                <Heart className="h-4 w-4" />
                Donasi
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Login</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
          <div className="flex flex-col gap-6 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <p className="font-bold">{yayasan.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {yayasan.address}
              </p>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-semibold">Tautan</p>
              <Link
                href="/donate"
                className="text-muted-foreground hover:text-foreground"
              >
                Donasi
              </Link>
              <Link
                href="/volunteer/apply"
                className="text-muted-foreground hover:text-foreground"
              >
                Jadi Relawan
              </Link>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground"
              >
                Login Staff
              </Link>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-semibold">Sosial Media</p>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                Instagram
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                Facebook
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                YouTube
              </a>
            </div>
          </div>
          <p className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} {yayasan.name}. Dikelola dengan
            KanakaOS.
          </p>
        </div>
      </footer>
    </div>
  );
}
