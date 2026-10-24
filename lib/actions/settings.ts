"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  generalSettingsSchema,
  notificationSettingsSchema,
  type NotificationSettingsInput,
} from "@/lib/validations";
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

type ActionResult =
  | { success: true; warning?: string }
  | { success: false; error: string };

type ExportResult =
  | { success: true; fileName: string; contentBase64: string; mime: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR = "Hanya Super Admin yang boleh mengubah pengaturan";

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB

async function upsertConfig(configKey: string, configValue: string) {
  await prisma.systemConfig.upsert({
    where: { configKey },
    update: { configValue },
    create: { configKey, configValue },
  });
}

export async function saveGeneralSettings(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = generalSettingsSchema.safeParse({
    yayasanName: formData.get("yayasanName"),
    yayasanAddress: formData.get("yayasanAddress") ?? "",
    vision: formData.get("vision") ?? "",
    mission: formData.get("mission") ?? "",
    description: formData.get("description") ?? "",
    deedNumber: formData.get("deedNumber") ?? "",
    skKemenkumham: formData.get("skKemenkumham") ?? "",
    npwp: formData.get("npwp") ?? "",
    nib: formData.get("nib") ?? "",
    tdy: formData.get("tdy") ?? "",
    activityPermit: formData.get("activityPermit") ?? "",
    domicileLetter: formData.get("domicileLetter") ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  let warning: string | undefined;

  try {
    // Upload logo jika ada
    const logo = formData.get("logo");
    if (logo instanceof File && logo.size > 0) {
      const allowedLogo = ["image/jpeg", "image/png"];
      if (!allowedLogo.includes(logo.type)) {
        return { success: false, error: "Logo harus berformat JPG, JPEG, atau PNG" };
      }
      if (logo.size > MAX_LOGO_SIZE) {
        return { success: false, error: "Ukuran logo maksimal 5MB" };
      }
      if (!isCloudinaryConfigured()) {
        warning = "Logo tidak tersimpan: Cloudinary belum dikonfigurasi";
      } else {
        const logoUrl = await uploadFileToCloudinary(
          Buffer.from(await logo.arrayBuffer()),
          "yayasan/branding",
          "logo"
        );
        await upsertConfig("YAYASAN_LOGO_URL", logoUrl);
      }
    }

    await upsertConfig("YAYASAN_NAME", parsed.data.yayasanName);
    await upsertConfig("YAYASAN_ADDRESS", parsed.data.yayasanAddress ?? "");
    await upsertConfig("YAYASAN_VISION", parsed.data.vision ?? "");
    await upsertConfig("YAYASAN_MISSION", parsed.data.mission ?? "");
    await upsertConfig("YAYASAN_DESCRIPTION", parsed.data.description ?? "");
    await upsertConfig("YAYASAN_DEED_NUMBER", parsed.data.deedNumber ?? "");
    await upsertConfig(
      "YAYASAN_SK_KEMENKUMHAM",
      parsed.data.skKemenkumham ?? ""
    );
    await upsertConfig("YAYASAN_NPWP", parsed.data.npwp ?? "");
    await upsertConfig("YAYASAN_NIB", parsed.data.nib ?? "");
    await upsertConfig("YAYASAN_TDY", parsed.data.tdy ?? "");
    await upsertConfig(
      "YAYASAN_ACTIVITY_PERMIT",
      parsed.data.activityPermit ?? ""
    );
    await upsertConfig("YAYASAN_DOMICILE", parsed.data.domicileLetter ?? "");

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "SystemConfig",
      detail: "Mengubah pengaturan umum yayasan",
    });

    revalidatePath("/dashboard/admin/settings");
    return { success: true, warning };
  } catch (error) {
    console.error("saveGeneralSettings error:", error);
    return { success: false, error: "Gagal menyimpan pengaturan umum" };
  }
}

export async function saveNotificationSettings(
  values: NotificationSettingsInput
): Promise<ActionResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = notificationSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    await upsertConfig("NOTIF_EMAIL", parsed.data.notifEmail ?? "");
    await upsertConfig(
      "NOTIF_NEW_DONATION",
      String(parsed.data.notifNewDonation)
    );
    await upsertConfig("NOTIF_RED_FLAG", String(parsed.data.notifRedFlag));
    await upsertConfig("NOTIF_LOW_STOCK", String(parsed.data.notifLowStock));

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "SystemConfig",
      detail: "Mengubah pengaturan notifikasi",
    });

    revalidatePath("/dashboard/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("saveNotificationSettings error:", error);
    return { success: false, error: "Gagal menyimpan pengaturan notifikasi" };
  }
}

/** Escape nilai agar aman untuk format CSV */
function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replaceAll('"', '""')}"`;
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

export async function exportDataCsv(): Promise<ExportResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  try {
    const [children, donations, volunteers] = await Promise.all([
      prisma.child.findMany({ include: { guardian: true } }),
      prisma.donation.findMany(),
      prisma.volunteer.findMany(),
    ]);

    const sections = [
      "=== ANAK ASUH ===",
      toCsv(
        ["ID", "Nama", "Tgl Lahir", "Gender", "Gol Darah", "Status", "Wali", "Tgl Masuk"],
        children.map((c) => [
          c.id, c.fullName, c.dob.toISOString().slice(0, 10), c.gender,
          c.bloodType ?? "", c.status, c.guardian?.name ?? "", 
          c.admissionDate.toISOString().slice(0, 10),
        ])
      ),
      "",
      "=== DONASI ===",
      toCsv(
        ["No Kwitansi", "Donatur", "Kontak", "Jumlah", "Metode", "Peruntukan", "Tanggal"],
        donations.map((d) => [
          d.receiptNumber, d.donaturName, d.donaturContact ?? "",
          d.amount.toString(), d.type, d.purpose ?? "",
          d.createdAt.toISOString().slice(0, 10),
        ])
      ),
      "",
      "=== RELAWAN ===",
      toCsv(
        ["ID", "Nama", "HP", "Keahlian", "Status", "Sertifikat Safeguarding"],
        volunteers.map((v) => [
          v.id, v.name, v.phone ?? "", v.skill ?? "", v.status,
          v.hasSafeguardingCert ? "Ya" : "Tidak",
        ])
      ),
    ].join("\n");

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Export",
      detail: "Export semua data ke CSV",
    });

    return {
      success: true,
      fileName: `kanakaos-export-${new Date().toISOString().slice(0, 10)}.csv`,
      // \uFEFF = BOM agar Excel membaca UTF-8 dengan benar
      contentBase64: Buffer.from("\uFEFF" + sections, "utf-8").toString("base64"),
      mime: "text/csv",
    };
  } catch (error) {
    console.error("exportDataCsv error:", error);
    return { success: false, error: "Gagal meng-export data" };
  }
}

export async function backupDatabase(): Promise<ExportResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  try {
    // Dump seluruh tabel sebagai JSON (password user tidak disertakan)
    const [users, guardians, children, dailyLogs, donations, inventory,
      volunteers, partners, systemConfig, cases, interventions] =
      await Promise.all([
        prisma.user.findMany({
          select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        }),
        prisma.guardian.findMany(),
        prisma.child.findMany(),
        prisma.dailyLog.findMany(),
        prisma.donation.findMany(),
        prisma.inventory.findMany(),
        prisma.volunteer.findMany(),
        prisma.partner.findMany(),
        prisma.systemConfig.findMany({
          where: { NOT: { configKey: "AI_API_KEY" } }, // secret tidak ikut backup
        }),
        prisma.case.findMany(),
        prisma.caseIntervention.findMany(),
      ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: session.user.name,
      data: {
        users, guardians, children, dailyLogs,
        donations: donations.map((d) => ({ ...d, amount: d.amount.toString() })),
        inventory, volunteers, partners, systemConfig, cases, interventions,
      },
    };

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Backup",
      detail: "Backup database (JSON)",
    });

    return {
      success: true,
      fileName: `kanakaos-backup-${new Date().toISOString().slice(0, 10)}.json`,
      contentBase64: Buffer.from(
        JSON.stringify(backup, null, 2),
        "utf-8"
      ).toString("base64"),
      mime: "application/json",
    };
  } catch (error) {
    console.error("backupDatabase error:", error);
    return { success: false, error: "Gagal membuat backup" };
  }
}
