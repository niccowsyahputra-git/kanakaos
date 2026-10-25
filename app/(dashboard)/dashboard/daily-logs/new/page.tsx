import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { DailyLogForm } from "@/components/daily-logs/daily-log-form";
import { getT } from "@/lib/i18n/server";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SOCIAL_WORKER: "Pekerja Sosial",
  CAREGIVER: "Pengasuh",
  VOLUNTEER: "Relawan",
  FINANCE: "Bendahara",
  LOGISTICS: "Logistik",
};

export default async function NewDailyLogPage({
  searchParams,
}: {
  searchParams: { childId?: string };
}) {
  const { tr, locale } = await getT();
  const roleLabel = localizeLabels(__roleLabel, tr);

  const session = await auth();
  if (!session?.user) redirect("/login");

  const children = await prisma.child.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  // Pre-select anak jika datang dari halaman "Anak Asuhan Saya"
  const defaultChildId = children.some((c) => c.id === searchParams.childId)
    ? searchParams.childId
    : undefined;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{tr("Log Harian")}</h2>
        <p className="text-sm text-muted-foreground">
          {tr("Catat kondisi anak hari ini. Cukup beberapa ketukan saja.")}</p>
      </div>
      <DailyLogForm
        childOptions={children}
        defaultChildId={defaultChildId}
        reporterName={session.user.name ?? tr("Tanpa Nama")}
        reporterRole={roleLabel[session.user.role ?? ""] ?? "Staff"}
      />
    </div>
  );
}

const __roleLabel = roleLabel;
