import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  ProfileForm,
  ChangePasswordForm,
} from "@/components/profile/profile-forms";
import { getT } from "@/lib/i18n/server";
import { localizeLabels } from "@/lib/i18n/translate";


export const dynamic = "force-dynamic";

const roleLabel: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  SOCIAL_WORKER: "Pekerja Sosial",
  CAREGIVER: "Pengasuh",
  VOLUNTEER: "Relawan",
  FINANCE: "Bendahara",
  LOGISTICS: "Logistik",
};

export default async function ProfilePage() {
  const { tr, locale } = await getT();
  const roleLabel = localizeLabels(__roleLabel, tr);

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      photoUrl: true,
      role: true,
    },
  });
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{tr("Profil Saya")}</h2>
        <p className="text-sm text-muted-foreground">
          {tr("Kelola data akun Anda.")}</p>
      </div>

      <ProfileForm
        user={{
          id: session.user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photoUrl: user.photoUrl,
          roleLabel: roleLabel[user.role],
        }}
      />
      <ChangePasswordForm />
    </div>
  );
}

const __roleLabel = roleLabel;
