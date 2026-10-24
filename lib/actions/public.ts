"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import {
  donationPledgeSchema,
  volunteerApplySchema,
  type DonationPledgeInput,
} from "@/lib/validations";
import {
  uploadFileToCloudinary,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

type ActionResult =
  | { success: true; id?: string; warning?: string }
  | { success: false; error: string };

/**
 * Terima niat donasi dari form publik. Tidak membuat kwitansi —
 * kwitansi resmi dibuat bendahara setelah dana benar-benar diterima.
 */
export async function createDonationPledge(
  values: DonationPledgeInput
): Promise<ActionResult> {
  const parsed = donationPledgeSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    // Rate limit sederhana: maks 5 pledge per email per hari (anti-spam dasar)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.donationPledge.count({
      where: { email: parsed.data.email, createdAt: { gte: dayAgo } },
    });
    if (recentCount >= 5) {
      return {
        success: false,
        error: "Terlalu banyak percobaan. Silakan coba lagi besok",
      };
    }

    const pledge = await prisma.donationPledge.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        amount: parsed.data.amount,
        purpose: parsed.data.purpose,
        method: parsed.data.method,
        message: parsed.data.message ?? null,
      },
    });

    await logAudit({
      userName: "PUBLIK",
      action: "CREATE",
      entity: "DonationPledge",
      entityId: pledge.id,
      detail: `Niat donasi dari ${parsed.data.name} sebesar Rp${parsed.data.amount.toLocaleString("id-ID")}`,
    });

    await notifyRoles(["SUPER_ADMIN", "FINANCE"], {
      title: "💝 Niat donasi baru",
      description: `${parsed.data.name} — Rp${parsed.data.amount.toLocaleString("id-ID")} (${parsed.data.method})`,
      link: "/dashboard/finance/donations",
    });

    return { success: true, id: pledge.id };
  } catch (error) {
    console.error("createDonationPledge error:", error);
    return { success: false, error: "Gagal mengirim formulir donasi" };
  }
}

const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

/** Upload dokumen pendaftaran relawan (KTP/SKCK). */
async function uploadApplicationDoc(
  file: File,
  label: string
): Promise<{ url: string | null; error?: string }> {
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    return { url: null, error: `${label} harus JPG, PNG, WebP, atau PDF` };
  }
  if (file.size > MAX_DOC_SIZE) {
    return { url: null, error: `Ukuran ${label} maksimal 5MB` };
  }
  if (!isCloudinaryConfigured()) {
    // Storage belum siap: pendaftaran tetap diterima tanpa dokumen
    return { url: null };
  }
  try {
    const isPdf = file.type === "application/pdf";
    const url = await uploadFileToCloudinary(
      Buffer.from(await file.arrayBuffer()),
      "yayasan/volunteer-docs",
      isPdf ? `${Date.now()}-${label}.pdf` : undefined,
      isPdf ? "raw" : "image"
    );
    return { url };
  } catch (error) {
    console.error(`uploadApplicationDoc ${label} error:`, error);
    return { url: null, error: `Gagal meng-upload ${label}` };
  }
}

export async function applyVolunteer(
  formData: FormData
): Promise<ActionResult> {
  const parsed = volunteerApplySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    dob: formData.get("dob"),
    address: formData.get("address"),
    occupation: formData.get("occupation"),
    skills: formData.getAll("skills"),
    availability: formData.getAll("availability"),
    motivation: formData.get("motivation"),
    agreePolicy: formData.get("agreePolicy") === "true",
    needId: formData.get("needId") ?? undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    // Kebutuhan yang dipilih harus masih dibuka (OPEN)
    if (parsed.data.needId) {
      const need = await prisma.volunteerNeed.findUnique({
        where: { id: parsed.data.needId },
        select: { status: true },
      });
      if (!need || need.status !== "OPEN") {
        return {
          success: false,
          error: "Kebutuhan relawan yang dipilih sudah ditutup. Silakan pilih yang lain",
        };
      }
    }

    // Cegah pendaftaran ganda dengan email yang sama & masih pending
    const existing = await prisma.volunteer.findFirst({
      where: { email: parsed.data.email, status: "PENDING" },
      select: { id: true },
    });
    if (existing) {
      return {
        success: false,
        error:
          "Pendaftaran dengan email ini sedang kami review. Mohon tunggu 3 hari kerja",
      };
    }

    // Upload dokumen (opsional gagal-gracefully jika storage belum siap)
    let warning: string | undefined;
    let ktpUrl: string | null = null;
    let skckUrl: string | null = null;

    const ktp = formData.get("ktp");
    if (ktp instanceof File && ktp.size > 0) {
      const uploaded = await uploadApplicationDoc(ktp, "KTP");
      if (uploaded.error) return { success: false, error: uploaded.error };
      ktpUrl = uploaded.url;
    }
    const skck = formData.get("skck");
    if (skck instanceof File && skck.size > 0) {
      const uploaded = await uploadApplicationDoc(skck, "SKCK");
      if (uploaded.error) return { success: false, error: uploaded.error };
      skckUrl = uploaded.url;
    }
    if ((ktp instanceof File && ktp.size > 0 && !ktpUrl) ||
        (skck instanceof File && skck.size > 0 && !skckUrl)) {
      warning = "Dokumen belum tersimpan (storage belum aktif) — tim kami akan menghubungi Anda";
    }

    const volunteer = await prisma.volunteer.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        dob: new Date(parsed.data.dob),
        address: parsed.data.address,
        occupation: parsed.data.occupation,
        skill: parsed.data.skills.join(", "),
        availability: parsed.data.availability.join(", "),
        motivation: parsed.data.motivation,
        ktpUrl,
        skckUrl,
        needId: parsed.data.needId ?? null,
        // status default PENDING -> masuk antrean screening staff
      },
    });

    await logAudit({
      userName: "PUBLIK",
      action: "CREATE",
      entity: "Volunteer",
      entityId: volunteer.id,
      detail: `Pendaftaran relawan publik: ${parsed.data.name} (${parsed.data.email})`,
    });

    await notifyRoles(["SUPER_ADMIN", "SOCIAL_WORKER"], {
      title: "🙋 Pendaftar relawan baru",
      description: `${parsed.data.name} (${parsed.data.occupation}) menunggu screening`,
      link: "/dashboard/volunteers",
    });

    return { success: true, id: volunteer.id, warning };
  } catch (error) {
    console.error("applyVolunteer error:", error);
    return { success: false, error: "Gagal mengirim pendaftaran" };
  }
}
