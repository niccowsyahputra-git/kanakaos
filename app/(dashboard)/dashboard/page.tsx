import Link from "next/link";
import { auth } from "@/auth";
import type { UserRole } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { OperationalSection } from "@/components/dashboard/operational-section";
import { FinancialSection } from "@/components/dashboard/financial-section";
import { ProgramDonorSection } from "@/components/dashboard/program-donor-section";
import { ComplianceSection } from "@/components/dashboard/compliance-section";

export const dynamic = "force-dynamic";

const OPERATIONAL_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SOCIAL_WORKER",
  "CAREGIVER",
];
const FINANCE_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE"];
const COMPLIANCE_ROLES: UserRole[] = ["SUPER_ADMIN"];

export default async function DashboardHomePage() {
  const session = await auth();
  const role = (session?.user?.role ?? "CAREGIVER") as UserRole;

  const showOperational = OPERATIONAL_ROLES.includes(role);
  const showFinancial = FINANCE_ROLES.includes(role);
  const showCompliance = COMPLIANCE_ROLES.includes(role);
  const showAny = showOperational || showFinancial || showCompliance;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Halo, {session?.user?.name?.split(" ")[0] ?? "Kawan"}! 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          Ringkasan strategis panti — dibagi per perspektif sesuai peran Anda.
        </p>
      </div>

      {showOperational && <OperationalSection />}
      {showFinancial && <FinancialSection />}
      {showFinancial && <ProgramDonorSection />}
      {showCompliance && <ComplianceSection />}

      {!showAny && (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Selamat datang di KanakaOS. Gunakan menu di samping untuk
              mengakses modul sesuai tugas Anda.
            </p>
            <Link
              href="/dashboard/profile"
              className="text-sm font-medium text-primary hover:underline"
            >
              Lihat profil saya →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
