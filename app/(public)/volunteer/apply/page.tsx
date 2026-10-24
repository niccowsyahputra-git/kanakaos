import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { VolunteerApplyForm } from "@/components/public/volunteer-apply-form";

// Daftar kebutuhan relawan (OPEN) harus selalu terbaru
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { identity } = await getSiteSettings();
  return {
    title: `Daftar Relawan — ${identity.name}`,
    description: "Bergabunglah menjadi relawan panti asuhan.",
  };
}

export default async function VolunteerApplyPage() {
  const needs = await prisma.volunteerNeed.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      quantity: true,
      schedule: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Daftar Menjadi Relawan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bagikan waktu dan keahlian Anda untuk anak-anak kami. Semua relawan
          melewati proses screening demi keamanan anak.
        </p>
      </div>
      <VolunteerApplyForm needs={needs} />
    </div>
  );
}
