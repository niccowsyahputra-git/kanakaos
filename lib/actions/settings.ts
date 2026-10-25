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
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";
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

const MAX_LOGO_SIZE=3*1024*1024; // 3MB (upload ke Cloudinary)
const MAX_LOGO_DB_SIZE=1024*1024; // 1MB (disimpan di database)

/** Deteksi format gambar dari isi file (bukan dari MIME kiriman browser) */
function detectLogoMime(bytes: Buffer): "image/png"|"image/jpeg"|null {
  if(bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) {
    return "image/png";
  }
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff) {
    return "image/jpeg";
  }
  return null;
}

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
    // Upload logo jika ada. Tanpa Cloudinary, logo disimpan di database dan
    // disajikan lewat /api/yayasan-logo.
    const logo=formData.get("logo");
    if(logo instanceof File&&logo.size>0) {
      if(logo.size>MAX_LOGO_SIZE) {
        return { success: false,error: tr("Ukuran logo maksimal 3MB") };
      }
      const bytes=Buffer.from(await logo.arrayBuffer());
      const mime=detectLogoMime(bytes);
      if(!mime) {
        return { success: false,error: tr("Logo harus berformat JPG, JPEG, atau PNG") };
      }
      if(isCloudinaryConfigured()) {
        const logoUrl=await uploadFileToCloudinary(bytes,"yayasan/branding","logo");
        await upsertConfig("YAYASAN_LOGO_URL",logoUrl);
        await upsertConfig("YAYASAN_LOGO_DATA","");
      } else {
        if(bytes.length>MAX_LOGO_DB_SIZE) {
          return {
            success: false,
            error: tr("Ukuran logo maksimal 1MB (perkecil/kompres gambar terlebih dahulu)"),
          };
        }
        await upsertConfig(
          "YAYASAN_LOGO_DATA",
          `data:${mime};base64,${bytes.toString("base64")}`
        );
        // Parameter versi agar cache browser langsung memuat logo baru
        await upsertConfig("YAYASAN_LOGO_URL",`/api/yayasan-logo?v=${Date.now()}`);
      }
    } else if(formData.get("removeLogo")==="true") {
      await upsertConfig("YAYASAN_LOGO_URL","");
      await upsertConfig("YAYASAN_LOGO_DATA","");
    }

    await upsertConfig("YAYASAN_NAME",parsed.data.yayasanName);
    await upsertConfig("YAYASAN_ADDRESS",parsed.data.yayasanAddress??"");
    await upsertConfig("YAYASAN_PHONE",parsed.data.yayasanPhone??"");
    await upsertConfig("YAYASAN_EMAIL",parsed.data.yayasanEmail??"");
    await upsertConfig("YAYASAN_DEED_NUMBER",parsed.data.deedNumber??"");
    await upsertConfig(
      "YAYASAN_SK_KEMENKUMHAM",
      parsed.data.skKemenkumham??""
    );
    await upsertConfig("YAYASAN_NPWP",parsed.data.npwp??"");
    await upsertConfig("YAYASAN_NIB",parsed.data.nib??"");
    await upsertConfig("YAYASAN_TDY",parsed.data.tdy??"");
    await upsertConfig(
      "YAYASAN_ACTIVITY_PERMIT",
      parsed.data.activityPermit??""
    );
    await upsertConfig("YAYASAN_DOMICILE",parsed.data.domicileLetter??"");

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
    console.error("saveGeneralSettings error:",error);
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
    const [children,donations,volunteers]=await Promise.all([
      prisma.child.findMany({ include: { guardian: true } }),
      prisma.donation.findMany(),
      prisma.volunteer.findMany(),
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
      employees,employeeLocations,volunteerAttachments]=
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
      ]);

    const backup={
      exportedAt: new Date().toISOString(),
      exportedBy: session.user.name,
      data: {
        users,guardians,children,dailyLogs,
        donations: donations.map((d) => ({ ...d,amount: d.amount.toString() })),
        inventory,volunteers,volunteerNeeds,partners,systemConfig,cases,interventions,
        employees,employeeLocations,volunteerAttachments,
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
