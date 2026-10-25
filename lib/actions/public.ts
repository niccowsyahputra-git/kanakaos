"use server";

import { notificationMessage } from "@/lib/i18n/notification";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import {
  donationPledgeSchema,
  volunteerApplySchema,
  type DonationPledgeInput,
} from "@/lib/validations";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { UploadBundle } from "@/lib/volunteer-upload-contract";
import { persistVolunteerProfile } from "@/lib/volunteer-profile.server";
import { volunteerStorage, VolunteerSaveError } from "@/lib/volunteer-uploads.server";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


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
  const { tr, locale } = await getT();
  const { donationPledgeSchema } = getSchemas(locale);

  const parsed = donationPledgeSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
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
        error: tr("Terlalu banyak percobaan. Silakan coba lagi besok"),
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
      description: notificationMessage("{0} — Rp{1} ({2})", { 0: parsed.data.name, 1: parsed.data.amount.toLocaleString("id-ID"), 2: parsed.data.method }),
      link: "/dashboard/finance/donations",
    });

    return { success: true, id: pledge.id };
  } catch (error) {
    console.error("createDonationPledge error:", error);
    return { success: false, error: tr("Gagal mengirim formulir donasi") };
  }
}

export async function applyVolunteer(values: z.input<typeof volunteerApplySchema>, uploads: UploadBundle): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const parsed = getSchemas(locale).volunteerApplySchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  try {
    const saved = await persistVolunteerProfile(prisma, volunteerStorage(), {
      ...parsed.data, availability: parsed.data.availability.join(", "), hasSafeguardingCert: false,
    }, uploads, { id: "public", name: "PUBLIK", public: true });
    // Side-effect failures must not turn a committed registration into a failed submission.
    try {
      if (saved.created) await notifyRoles(["SUPER_ADMIN", "SOCIAL_WORKER"], {
        title: "🙋 Pendaftar relawan baru",
        description: notificationMessage("{0} ({1}) menunggu screening", { 0: parsed.data.name, 1: parsed.data.occupation }),
        link: "/dashboard/volunteers",
      });
    } catch (error) { console.error("Registration saved; notification failed", error); }
    try {
      revalidatePath("/dashboard/volunteers");
      revalidatePath("/dashboard/volunteers/needs");
      revalidatePath("/volunteer/apply");
    } catch (error) { console.error("Registration saved; refresh failed", error); }
    return { success: true, id: saved.id };
  } catch (error) {
    console.error("applyVolunteer error:", error);
    return { success: false, error: tr(error instanceof VolunteerSaveError ? error.message : "Gagal mengirim pendaftaran") };
  }
}
