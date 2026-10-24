import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { getAIConfig } from "@/lib/ai-service";
import { getSiteSettings } from "@/lib/site-settings";
import {
  SettingsTabs,
  type SettingsValues,
} from "@/components/admin/settings-tabs";
import { UsersSection } from "@/components/admin/users-section";
import {
  AuditSection,
  type AuditSearchParams,
} from "@/components/admin/audit-section";

export const dynamic = "force-dynamic";

const SETTING_KEYS = [
  "YAYASAN_NAME",
  "YAYASAN_ADDRESS",
  "YAYASAN_PHONE",
  "YAYASAN_EMAIL",
  "YAYASAN_DEED_NUMBER",
  "YAYASAN_SK_KEMENKUMHAM",
  "YAYASAN_NPWP",
  "YAYASAN_NIB",
  "YAYASAN_TDY",
  "YAYASAN_ACTIVITY_PERMIT",
  "YAYASAN_DOMICILE",
  "YAYASAN_LOGO_URL",
  "NOTIF_EMAIL",
  "NOTIF_NEW_DONATION",
  "NOTIF_RED_FLAG",
  "NOTIF_LOW_STOCK",
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: {
    tab?: string;
    q?: string;
    role?: string;
  } & AuditSearchParams;
}) {
  const session = await requireSuperAdminSession();
  if (!session) redirect("/dashboard");

  const validTabs = ["general", "landing", "notification", "users", "audit", "ai", "backup"];
  const defaultTab = validTabs.includes(searchParams.tab ?? "")
    ? searchParams.tab
    : "general";

  const rows = await prisma.systemConfig.findMany({
    where: { configKey: { in: SETTING_KEYS } },
  });
  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));

  const [aiConfig, siteSettings] = await Promise.all([
    getAIConfig(),
    getSiteSettings(),
  ]);

  const initial: SettingsValues = {
    yayasanName: map.get("YAYASAN_NAME") ?? "Yayasan Kanaka",
    yayasanAddress: map.get("YAYASAN_ADDRESS") ?? "",
    yayasanPhone: map.get("YAYASAN_PHONE") ?? "",
    yayasanEmail: map.get("YAYASAN_EMAIL") ?? "",
    deedNumber: map.get("YAYASAN_DEED_NUMBER") ?? "",
    skKemenkumham: map.get("YAYASAN_SK_KEMENKUMHAM") ?? "",
    npwp: map.get("YAYASAN_NPWP") ?? "",
    nib: map.get("YAYASAN_NIB") ?? "",
    tdy: map.get("YAYASAN_TDY") ?? "",
    activityPermit: map.get("YAYASAN_ACTIVITY_PERMIT") ?? "",
    domicileLetter: map.get("YAYASAN_DOMICILE") ?? "",
    logoUrl: map.get("YAYASAN_LOGO_URL") ?? "",
    notifEmail: map.get("NOTIF_EMAIL") ?? "",
    notifNewDonation: map.get("NOTIF_NEW_DONATION") === "true",
    notifRedFlag: map.get("NOTIF_RED_FLAG") !== "false", // default aktif
    notifLowStock: map.get("NOTIF_LOW_STOCK") === "true",
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Pengaturan Sistem
        </h2>
        <p className="text-sm text-muted-foreground">
          Identitas yayasan, halaman publik, notifikasi, manajemen user, audit log, AI, dan
          backup data.
        </p>
      </div>
      <SettingsTabs
        initial={initial}
        landing={siteSettings.landing}
        defaultTab={defaultTab}
        usersSection={
          <UsersSection
            sessionUserId={session.user.id}
            q={searchParams.q}
            role={searchParams.role}
          />
        }
        auditSection={<AuditSection searchParams={searchParams} />}
        aiConfig={
          aiConfig
            ? {
                provider: aiConfig.provider,
                baseUrl: aiConfig.baseUrl,
                modelName: aiConfig.modelName,
                hasApiKey: true,
              }
            : null
        }
      />
    </div>
  );
}
