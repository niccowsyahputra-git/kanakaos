"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  generalSettingsSchema,
  landingSettingsSchema,
  notificationSettingsSchema,
  type LandingSettingsInput,
  type NotificationSettingsInput,
} from "@/lib/validations";
import { driveStorage } from "@/lib/google-drive.server";
import { saveManagedForm } from "@/lib/managed-form.server";
import { assertStorageAccess, cleanupManagedFiles } from "@/lib/managed-storage.server";
import { MANAGED_FORM_FIELDS, StorageError, managedFileUrl, storageErrorMessage } from "@/lib/storage-contract";
import { LANDING_CONFIG_KEYS } from "@/lib/site-settings";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";
import { readVolunteerSkills,VOLUNTEER_FIELDS } from "@/lib/option-catalogs";


type ActionResult=
  |{ success: true; warning?: string }
  |{ success: false; error: string };

type ExportResult=
  |{ success: true; fileName: string; contentBase64: string; mime: string }
  |{ success: false; error: string };

const FORBIDDEN_ERROR="Hanya Super Admin yang boleh mengubah pengaturan";

// Export only durable attached-file metadata, never upload claims or request bindings.
const managedFileExportSelect = {
  id: true, driveFileId: true, purpose: true, filename: true, mime: true,
  expectedBytes: true, verifiedBytes: true, state: true, uploaderId: true,
  targetType: true, targetId: true, parentType: true, parentId: true, volunteerId: true,
  createdAt: true, verifiedAt: true, attachedAt: true, updatedAt: true,
} as const;

/** Revalidasi halaman yang menampilkan identitas & konten yayasan */
function revalidateSitePages() {
  revalidatePath("/dashboard/admin/settings");
  revalidatePath("/","layout");
}

async function upsertConfig(configKey: string,configValue: string) {
  await prisma.systemConfig.upsert({
    where: { configKey },
    update: { configValue },
    create: { configKey,configValue },
  });
}

export async function saveGeneralSettings(
  formData: FormData
): Promise<ActionResult> {
  const { tr,locale }=await getT();
  const { generalSettingsSchema }=getSchemas(locale);

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const parsed=generalSettingsSchema.safeParse({
    yayasanName: formData.get("yayasanName"),
    yayasanAddress: formData.get("yayasanAddress")??"",
    yayasanPhone: formData.get("yayasanPhone")??"",
    yayasanEmail: formData.get("yayasanEmail")??"",
    deedNumber: formData.get("deedNumber")??"",
    skKemenkumham: formData.get("skKemenkumham")??"",
    npwp: formData.get("npwp")??"",
    nib: formData.get("nib")??"",
    tdy: formData.get("tdy")??"",
    activityPermit: formData.get("activityPermit")??"",
    domicileLetter: formData.get("domicileLetter")??"",
  });
  if(!parsed.success) {
    return { success: false,error: tr(parsed.error.errors[0].message) };
  }

  try {
    await saveManagedForm(prisma, formData, { id: session.user.id }, "YAYASAN_LOGO_URL", MANAGED_FORM_FIELDS.branding, async (tx, urls) => {
      const set = (configKey: string, configValue: string) => tx.systemConfig.upsert({
        where: { configKey }, update: { configValue }, create: { configKey, configValue },
      });
      if (urls.YAYASAN_LOGO_URL) {
        if (formData.get("removeLogo") === "true") throw new StorageError("INVALID");
        await set("YAYASAN_LOGO_URL", urls.YAYASAN_LOGO_URL);
        await set("YAYASAN_LOGO_DATA", "");
      } else if (formData.get("removeLogo") === "true") {
        await set("YAYASAN_LOGO_URL", "");
        await set("YAYASAN_LOGO_DATA", "");
      }
      await set("YAYASAN_NAME", parsed.data.yayasanName);
      await set("YAYASAN_ADDRESS", parsed.data.yayasanAddress ?? "");
      await set("YAYASAN_PHONE", parsed.data.yayasanPhone ?? "");
      await set("YAYASAN_EMAIL", parsed.data.yayasanEmail ?? "");
      await set("YAYASAN_DEED_NUMBER", parsed.data.deedNumber ?? "");
      await set("YAYASAN_SK_KEMENKUMHAM", parsed.data.skKemenkumham ?? "");
      await set("YAYASAN_NPWP", parsed.data.npwp ?? "");
      await set("YAYASAN_NIB", parsed.data.nib ?? "");
      await set("YAYASAN_TDY", parsed.data.tdy ?? "");
      await set("YAYASAN_ACTIVITY_PERMIT", parsed.data.activityPermit ?? "");
      await set("YAYASAN_DOMICILE", parsed.data.domicileLetter ?? "");
      // The managed parent uses the stable configuration key, not SystemConfig's row ID.
      return { id: "YAYASAN_LOGO_URL" };
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "UPDATE",
      entity: "SystemConfig",
      detail: "Mengubah pengaturan umum yayasan",
    });

    revalidateSitePages();
    return { success: true };
  } catch(error) {
    if (error instanceof StorageError) return { success: false, error: storageErrorMessage(error.code, locale) };
    console.error("saveGeneralSettings failed");
    return { success: false,error: tr("Gagal menyimpan pengaturan umum") };
  }
}

export async function saveLandingSettings(
  values: LandingSettingsInput
): Promise<ActionResult> {
  const { tr,locale }=await getT();
  const { landingSettingsSchema }=getSchemas(locale);

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const parsed=landingSettingsSchema.safeParse(values);
  if(!parsed.success) {
    return { success: false,error: tr(parsed.error.errors[0].message) };
  }

  try {
    const { programs,...texts }=parsed.data;
    for(const [field,value] of Object.entries(texts)) {
      await upsertConfig(
        LANDING_CONFIG_KEYS[field as keyof typeof texts],
        value
      );
    }
    await upsertConfig(LANDING_CONFIG_KEYS.programs,JSON.stringify(programs));

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "UPDATE",
      entity: "SystemConfig",
      detail: "Mengubah konten halaman publik",
    });

    revalidateSitePages();
    return { success: true };
  } catch(error) {
    console.error("saveLandingSettings error:",error);
    return { success: false,error: tr("Gagal menyimpan konten halaman publik") };
  }
}

export async function saveNotificationSettings(
  values: NotificationSettingsInput
): Promise<ActionResult> {
  const { tr,locale }=await getT();
  const { notificationSettingsSchema }=getSchemas(locale);

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const parsed=notificationSettingsSchema.safeParse(values);
  if(!parsed.success) {
    return { success: false,error: tr(parsed.error.errors[0].message) };
  }

  try {
    await upsertConfig("NOTIF_EMAIL",parsed.data.notifEmail??"");
    await upsertConfig(
      "NOTIF_NEW_DONATION",
      String(parsed.data.notifNewDonation)
    );
    await upsertConfig("NOTIF_RED_FLAG",String(parsed.data.notifRedFlag));
    await upsertConfig("NOTIF_LOW_STOCK",String(parsed.data.notifLowStock));

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "UPDATE",
      entity: "SystemConfig",
      detail: "Mengubah pengaturan notifikasi",
    });

    revalidatePath("/dashboard/admin/settings");
    return { success: true };
  } catch(error) {
    console.error("saveNotificationSettings error:",error);
    return { success: false,error: tr("Gagal menyimpan pengaturan notifikasi") };
  }
}

export async function cleanUnclaimedStorage(): Promise<ActionResult> {
  const { locale, tr } = await getT();
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };
  try {
    await assertStorageAccess(prisma, { id: session.user.id }, "FOUNDATION_LOGO", "YAYASAN_LOGO_URL");
    const checked = await cleanupManagedFiles(prisma, driveStorage(), Date.now(), 20);
    await logAudit({ userId: session.user.id, userName: session.user.name ?? "Unknown", action: "DELETE", entity: "ManagedFile", detail: `Checked ${checked} unclaimed uploads; attached files retained` });
    return { success: true };
  } catch (error) {
    return { success: false, error: storageErrorMessage(error instanceof StorageError ? error.code : "UNAVAILABLE", locale) };
  }
}

/** Escape nilai agar aman untuk format CSV */
function csvCell(value: unknown): string {
  const str=value===null||value===undefined? "":String(value);
  if(/[",\n]/.test(str)) return `"${str.replaceAll('"','""')}"`;
  return str;
}

function toCsv(headers: string[],rows: unknown[][]): string {
  return [
    headers.join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

export async function exportDataCsv(): Promise<ExportResult> {
  const { tr,locale }=await getT();

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  try {
    const [children,donations,volunteers,managedFiles]=await Promise.all([
      prisma.child.findMany({ include: { guardian: true } }),
      prisma.donation.findMany(),
      prisma.volunteer.findMany(),
      prisma.managedFile.findMany({ where: { state: "ATTACHED" }, select: managedFileExportSelect }),
    ]);

    const sections=[
      tr("=== ANAK ASUH ==="),
      toCsv(
        ["ID",tr("Nama"),tr("Tgl Lahir"),"Gender",tr("Gol Darah"),tr("Status"),tr("Wali"),tr("Tgl Masuk")],
        children.map((c) => [
          c.id,c.fullName,c.dob.toISOString().slice(0,10),c.gender,
          c.bloodType??"",c.status,c.guardian?.name??"",
          c.admissionDate.toISOString().slice(0,10),
        ])
      ),
      "",
      tr("=== DONASI ==="),
      toCsv(
        [tr("No Kwitansi"),tr("Donatur"),tr("Kontak"),tr("Jumlah"),tr("Metode"),tr("Peruntukan"),tr("Tanggal")],
        donations.map((d) => [
          d.receiptNumber,d.donaturName,d.donaturContact??"",
          d.amount.toString(),d.type,d.purpose??"",
          d.createdAt.toISOString().slice(0,10),
        ])
      ),
      "",
      tr("=== RELAWAN ==="),
      toCsv(
        ["ID",tr("Nama"),"HP",tr("Keahlian"),tr("Keahlian data lama"),tr("Pendidikan Terakhir"),tr("Jurusan"),tr("Status"),tr("Sertifikat Safeguarding")],
        volunteers.map((v) => [
          v.id,v.name,v.phone??"",readVolunteerSkills(v.skillsJson).map(code => tr(VOLUNTEER_FIELDS[code])).join(", "),
          v.skill??"",v.highestEducation? tr(v.highestEducation):"",v.major??"",v.status,
          v.hasSafeguardingCert? tr("Ya"):tr("Tidak"),
        ])
      ),
      "",
      locale === "en" ? "=== MANAGED FILES ===" : "=== FILE TERKELOLA ===",
      toCsv(
        ["ID", "Drive ID", "Purpose", "Filename", "MIME", "Bytes", "Parent type", "Parent ID", "URL"],
        managedFiles.map(file => [file.id, file.driveFileId, file.purpose, file.filename, file.mime, file.verifiedBytes, file.parentType, file.parentId, managedFileUrl(file.id)]),
      ),
    ].join("\n");

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "CREATE",
      entity: "Export",
      detail: "Export semua data ke CSV",
    });

    return {
      success: true,
      fileName: `kanakaos-export-${new Date().toISOString().slice(0,10)}.csv`,
      // \uFEFF = BOM agar Excel membaca UTF-8 dengan benar
      contentBase64: Buffer.from("\uFEFF"+sections,"utf-8").toString("base64"),
      mime: "text/csv",
    };
  } catch(error) {
    console.error("exportDataCsv error:",error);
    return { success: false,error: tr("Gagal meng-export data") };
  }
}

export async function backupDatabase(): Promise<ExportResult> {
  const { tr,locale }=await getT();

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  try {
    // Dump seluruh tabel sebagai JSON (password user tidak disertakan)
    const [users,guardians,children,dailyLogs,donations,inventory,
      volunteers,volunteerNeeds,partners,systemConfig,cases,interventions,
      employees,employeeLocations,volunteerAttachments,managedFiles]=
      await Promise.all([
        prisma.user.findMany({
          select: { id: true,name: true,email: true,role: true,isActive: true,createdAt: true },
        }),
        prisma.guardian.findMany(),
        prisma.child.findMany(),
        prisma.dailyLog.findMany(),
        prisma.donation.findMany(),
        prisma.inventory.findMany(),
        prisma.volunteer.findMany(),
        prisma.volunteerNeed.findMany(),
        prisma.partner.findMany(),
        prisma.systemConfig.findMany({
          // secret & data logo (base64 besar) tidak ikut backup
          where: { configKey: { notIn: ["AI_API_KEY","YAYASAN_LOGO_DATA"] } },
        }),
        prisma.case.findMany(),
        prisma.caseIntervention.findMany(),
        prisma.employee.findMany(),
        prisma.employeeLocation.findMany(),
        prisma.volunteerAttachment.findMany(),
        prisma.managedFile.findMany({ where: { state: "ATTACHED" }, select: managedFileExportSelect }),
      ]);

    const backup={
      exportedAt: new Date().toISOString(),
      exportedBy: session.user.name,
      data: {
        users,guardians,children,dailyLogs,
        donations: donations.map((d) => ({ ...d,amount: d.amount.toString() })),
        inventory,volunteers,volunteerNeeds,partners,systemConfig,cases,interventions,
        employees,employeeLocations,volunteerAttachments,managedFiles,
      },
    };

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "CREATE",
      entity: "Backup",
      detail: "Backup database (JSON)",
    });

    return {
      success: true,
      fileName: `kanakaos-backup-${new Date().toISOString().slice(0,10)}.json`,
      contentBase64: Buffer.from(
        JSON.stringify(backup,null,2),
        "utf-8"
      ).toString("base64"),
      mime: "application/json",
    };
  } catch(error) {
    console.error("backupDatabase error:",error);
    return { success: false,error: tr("Gagal membuat backup") };
  }
}
