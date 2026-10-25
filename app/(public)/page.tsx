import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { fillPlaceholders } from "@/lib/site-content";
import { PROGRAM_ICONS } from "@/components/public/program-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Users, MapPin, Phone, Mail } from "lucide-react";
import { getT } from "@/lib/i18n/server";


export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { tr, locale } = await getT();

  const [{ identity, landing }, childrenCount, volunteersCount] =
    await Promise.all([
      getSiteSettings(),
      prisma.child.count({ where: { status: "ACTIVE" } }),
      prisma.volunteer.count({ where: { status: "APPROVED" } }),
    ]);
  const fill = (text: string) => fillPlaceholders(text, identity.name);

  const hasAbout = Boolean(landing.about || landing.vision || landing.mission);
  const hasContact = Boolean(
    identity.address || identity.phone || identity.email
  );

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/10 to-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="flex flex-col items-center gap-6 text-center">
            {landing.heroBadge && (
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Heart className="h-4 w-4" />
                {fill(landing.heroBadge)}
              </span>
            )}
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">
              {fill(landing.heroTitle)}
            </h1>
            {landing.heroSubtitle && (
              <p className="max-w-2xl whitespace-pre-line text-base text-muted-foreground md:text-lg">
                {fill(landing.heroSubtitle)}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href="/donate">
                  <Heart className="h-5 w-5" />
                  {tr("Donasi Sekarang")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
              >
                <Link href="/volunteer/apply">
                  <Users className="h-5 w-5" />
                  {tr("Jadi Relawan")}</Link>
              </Button>
            </div>
          </div>

          {/* Statistik ringkas */}
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-4 text-center">
              <p className="text-2xl font-bold text-primary md:text-3xl">
                {childrenCount}
              </p>
              <p className="text-sm text-muted-foreground">{tr("Anak Asuh Aktif")}</p>
            </div>
            <div className="rounded-lg border bg-background p-4 text-center">
              <p className="text-2xl font-bold text-primary md:text-3xl">
                {volunteersCount}
              </p>
              <p className="text-sm text-muted-foreground">{tr("Relawan Aktif")}</p>
            </div>
            <div className="col-span-2 rounded-lg border bg-background p-4 text-center md:col-span-1">
              <p className="text-2xl font-bold text-primary md:text-3xl">
                100%
              </p>
              <p className="text-sm text-muted-foreground">
                {tr("Donasi Transparan")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tentang Kami */}
      {hasAbout && (
        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            {landing.aboutTitle && (
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                {fill(landing.aboutTitle)}
              </h2>
            )}
            {landing.about && (
              <p className="mt-4 whitespace-pre-line text-muted-foreground">
                {fill(landing.about)}
              </p>
            )}
            {landing.vision && (
              <p className="mt-4 whitespace-pre-line text-muted-foreground">
                <span className="font-semibold text-foreground">{tr("Visi:")}</span>{" "}
                {fill(landing.vision)}
              </p>
            )}
            {landing.mission && (
              <p className="mt-3 whitespace-pre-line text-muted-foreground">
                <span className="font-semibold text-foreground">{tr("Misi:")}</span>{" "}
                {fill(landing.mission)}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Program Kami */}
      {landing.programs.length > 0 && (
        <section className="bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            {landing.programsTitle && (
              <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
                {fill(landing.programsTitle)}
              </h2>
            )}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {landing.programs.map((program, index) => {
                const Icon = PROGRAM_ICONS[program.icon].icon;
                return (
                  <Card key={`${index}-${program.title}`}>
                    <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </span>
                      <h3 className="font-semibold">{fill(program.title)}</h3>
                      {program.description && (
                        <p className="text-sm text-muted-foreground">
                          {fill(program.description)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA Donasi */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
        <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground md:py-16">
          {landing.ctaTitle && (
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {fill(landing.ctaTitle)}
            </h2>
          )}
          {landing.ctaSubtitle && (
            <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-primary-foreground/90">
              {fill(landing.ctaSubtitle)}
            </p>
          )}
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-6 h-12 px-8 text-base"
          >
            <Link href="/donate">
              <Heart className="h-5 w-5" />
              {tr("Donasi Sekarang")}</Link>
          </Button>
        </div>
      </section>

      {/* Kontak */}
      {hasContact && (
        <section id="kontak" className="bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
              {tr("Hubungi Kami")}</h2>
            <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-6 sm:flex-row sm:justify-center sm:gap-12">
              {identity.address && (
                <div className="flex flex-col items-center gap-2 text-center">
                  <MapPin className="h-6 w-6 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {identity.address}
                  </p>
                </div>
              )}
              {identity.phone && (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Phone className="h-6 w-6 text-primary" />
                  <a
                    href={`tel:${identity.phone.replace(/[^0-9+]/g, "")}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {identity.phone}
                  </a>
                </div>
              )}
              {identity.email && (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Mail className="h-6 w-6 text-primary" />
                  <a
                    href={`mailto:${identity.email}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {identity.email}
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
