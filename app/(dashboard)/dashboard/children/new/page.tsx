import { prisma } from "@/lib/prisma";
import { ChildForm } from "@/components/children/child-form";

export const dynamic = "force-dynamic";

export default async function NewChildPage() {
  const guardians = await prisma.guardian.findMany({
    select: { id: true, name: true, relationship: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tambah Anak Asuh</h2>
        <p className="text-sm text-muted-foreground">
          Lengkapi data anak di bawah ini.
        </p>
      </div>
      <ChildForm guardians={guardians} mode="create" />
    </div>
  );
}
