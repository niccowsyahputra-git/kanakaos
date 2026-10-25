import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { VolunteerApplyForm } from "@/components/public/volunteer-apply-form";
import { getT } from "@/lib/i18n/server";


// Daftar kebutuhan relawan (OPEN) harus selalu terbaru
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { tr, locale } = await getT();

  const { identity } = await getSiteSettings();
  return {
    title: tr("Daftar Relawan — {0}", { "0": identity.name }),
    description: tr("Bergabunglah menjadi relawan panti asuhan."),
  };
}

export default async function VolunteerApplyPage() {
  const { tr, locale } = await getT();

  const needs = await prisma.volunteerNeed.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      quantity: true,
      schedule: true,
      status: true,
      field: true,
      otherField: true,
      startDate: true,
      endDate: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {tr("Daftar Menjadi Relawan")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr("Bagikan waktu dan keahlian Anda untuk anak-anak kami. Semua relawan melewati proses screening demi keamanan anak.")}</p>
      </div>
      <VolunteerApplyForm needs={needs.map(need => ({ ...need, startDate: need.startDate?.toISOString().slice(0, 10) ?? null, endDate: need.endDate?.toISOString().slice(0, 10) ?? null }))} />
    </div>
  );
}
