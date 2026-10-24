import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart,
  GraduationCap,
  Stethoscope,
  Home,
  Users,
  HandHeart,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

export const dynamic = "force-dynamic";

const PROGRAMS = [
  {
    icon: GraduationCap,
    title: "Pendidikan",
    description:
      "Menjamin setiap anak asuh mendapat pendidikan formal dan bimbingan belajar.",
  },
  {
    icon: Stethoscope,
    title: "Kesehatan",
    description:
      "Pemeriksaan rutin, gizi seimbang, dan pendampingan psikologis anak.",
  },
  {
    icon: Home,
    title: "Pengasuhan",
    description:
      "Lingkungan tinggal yang aman, hangat, dan penuh kasih sayang.",
  },
  {
    icon: HandHeart,
    title: "Reintegrasi Keluarga",
    description:
      "Mendampingi anak kembali ke keluarga bila kondisi memungkinkan.",
  },
];

export default async function LandingPage() {
  const [yayasanRow, childrenCount, volunteersCount] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { configKey: "YAYASAN_NAME" } }),
    prisma.child.count({ where: { status: "ACTIVE" } }),
    prisma.volunteer.count({ where: { status: "APPROVED" } }),
  ]);
  const yayasanName = yayasanRow?.configValue || "Yayasan Kanaka";

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/10 to-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="flex flex-col items-center gap-6 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Heart className="h-4 w-4" />
              Setiap anak berhak atas masa depan
            </span>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">
              Bersama {yayasanName}, Wujudkan Harapan Anak-Anak Kita
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              Kami merawat, mendidik, dan mendampingi anak-anak asuh dengan
              penuh kasih agar mereka tumbuh sehat, cerdas, dan mandiri.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href="/donate">
                  <Heart className="h-5 w-5" />
                  Donasi Sekarang
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
              >
                <Link href="/volunteer/apply">
                  <Users className="h-5 w-5" />
                  Jadi Relawan
                </Link>
              </Button>
            </div>
          </div>

          {/* Statistik ringkas */}
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-4 text-center">
              <p className="text-2xl font-bold text-primary md:text-3xl">
                {childrenCount}
              </p>
              <p className="text-sm text-muted-foreground">Anak Asuh Aktif</p>
            </div>
            <div className="rounded-lg border bg-background p-4 text-center">
              <p className="text-2xl font-bold text-primary md:text-3xl">
                {volunteersCount}
              </p>
              <p className="text-sm text-muted-foreground">Relawan Aktif</p>
            </div>
            <div className="col-span-2 rounded-lg border bg-background p-4 text-center md:col-span-1">
              <p className="text-2xl font-bold text-primary md:text-3xl">
                100%
              </p>
              <p className="text-sm text-muted-foreground">
                Donasi Transparan
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tentang Kami */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Tentang Kami
          </h2>
          <p className="mt-4 text-muted-foreground">
            <span className="font-semibold text-foreground">Visi:</span> Menjadi
            rumah yang aman dan penuh kasih bagi anak-anak yang membutuhkan,
            tempat mereka bertumbuh menjadi pribadi yang berkarakter dan
            mandiri.
          </p>
          <p className="mt-3 text-muted-foreground">
            <span className="font-semibold text-foreground">Misi:</span>{" "}
            Menyediakan pengasuhan berkualitas, pendidikan, layanan kesehatan,
            serta pendampingan psikososial dengan mengutamakan prinsip
            perlindungan anak (child safeguarding).
          </p>
        </div>
      </section>

      {/* Program Kami */}
      <section className="bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            Program Kami
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROGRAMS.map((program) => {
              const Icon = program.icon;
              return (
                <Card key={program.title}>
                  <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="font-semibold">{program.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {program.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Donasi */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
        <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground md:py-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Uluran Tangan Anda Sangat Berarti
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">
            Donasi Anda membantu memenuhi kebutuhan makan, pendidikan, dan
            kesehatan anak-anak asuh kami setiap hari.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-6 h-12 px-8 text-base"
          >
            <Link href="/donate">
              <Heart className="h-5 w-5" />
              Donasi Sekarang
            </Link>
          </Button>
        </div>
      </section>

      {/* Kontak */}
      <section id="kontak" className="bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            Hubungi Kami
          </h2>
          <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <MapPin className="h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">
                Jl. Melati No. 10, Denpasar, Bali
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <Phone className="h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">(0361) 555-0101</p>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <Mail className="h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">
                halo@kanakaos.id
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
