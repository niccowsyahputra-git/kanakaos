import { prisma } from "@/lib/prisma";
import { ChildForm } from "@/components/children/child-form";
import { getT } from "@/lib/i18n/server";


export const dynamic = "force-dynamic";

export default async function NewChildPage() {
  const { tr, locale } = await getT();

  const guardians = await prisma.guardian.findMany({
    select: { id: true, name: true, relationship: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{tr("Tambah Anak Asuh")}</h2>
        <p className="text-sm text-muted-foreground">
          {tr("Lengkapi data anak di bawah ini.")}</p>
      </div>
      <ChildForm guardians={guardians} mode="create" />
    </div>
  );
}
