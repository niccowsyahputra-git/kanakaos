import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { DailyLogForm } from "@/components/daily-logs/daily-log-form";

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
        <h2 className="text-2xl font-bold tracking-tight">Log Harian</h2>
        <p className="text-sm text-muted-foreground">
          Catat kondisi anak hari ini. Cukup beberapa ketukan saja.
        </p>
      </div>
      <DailyLogForm
        childOptions={children}
        defaultChildId={defaultChildId}
        reporterName={session.user.name ?? "Tanpa Nama"}
        reporterRole={roleLabel[session.user.role ?? ""] ?? "Staff"}
      />
    </div>
  );
}
