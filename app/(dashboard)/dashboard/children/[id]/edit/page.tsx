import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ChildForm } from "@/components/children/child-form";
import { ArrowLeft } from "lucide-react";
import { getT } from "@/lib/i18n/server";


export const dynamic = "force-dynamic";

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function ChildEditPage({
  params,
}: {
  params: { id: string };
}) {
  const { tr, locale } = await getT();

  const [child, guardians] = await Promise.all([
    prisma.child.findUnique({
      where: { id: params.id },
      include: { siblings: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.guardian.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, relationship: true },
    }),
  ]);
  if (!child) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/dashboard/children/${child.id}`}>
          <ArrowLeft className="h-4 w-4" />
          {tr("Kembali ke Profil Anak")}</Link>
      </Button>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">{tr("Edit Data Anak")}</h2>
        <p className="text-sm text-muted-foreground">{child.fullName}</p>
      </div>

      <ChildForm
        mode="edit"
        guardians={guardians}
        child={{
          id: child.id,
          fullName: child.fullName,
          nik: child.nik,
          dob: toDateInput(child.dob),
          gender: child.gender,
          religion: child.religion,
          bloodType: child.bloodType,
          heightCm: child.heightCm,
          weightKg: child.weightKg,
          status: child.status,
          orphanStatus: child.orphanStatus,
          lastEducation: child.lastEducation,
          admissionDate: toDateInput(child.admissionDate),
          admissionReason: child.admissionReason,
          homeAddress: child.homeAddress,
          fatherName: child.fatherName,
          fatherNik: child.fatherNik,
          fatherReligion: child.fatherReligion,
          fatherOccupation: child.fatherOccupation,
          fatherStatus: child.fatherStatus,
          motherName: child.motherName,
          motherNik: child.motherNik,
          motherReligion: child.motherReligion,
          motherOccupation: child.motherOccupation,
          motherStatus: child.motherStatus,
          lastGrade: child.lastGrade,
          birthOrder: child.birthOrder,
          siblingsCount: child.siblingsCount,
          siblings: child.siblings.map((s) => ({
            name: s.name,
            gender: s.gender,
            dob: toDateInput(s.dob),
            activity: s.activity,
            livingWith: s.livingWith,
            pantiName: s.pantiName,
            relation: s.relation,
          })),
          previousSchool: child.previousSchool,
          achievements: child.achievements,
          medicalHistory: child.medicalHistory,
          notes: child.notes,
          guardianId: child.guardianId,
          photoUrl: child.photoUrl,
          ijazahUrl: child.ijazahUrl,
          aktaLahirUrl: child.aktaLahirUrl,
          consentUrl: child.consentUrl,
          supportingDocUrl: child.supportingDocUrl,
          otherDocUrl: child.otherDocUrl,
        }}
      />
    </div>
  );
}
