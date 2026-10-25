"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { donorSchema, type DonorInput } from "@/lib/validations";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type DonorResult =
  | { success: true; donor: { id: string; name: string } }
  | { success: false; error: string };

/** Buat profil donatur baru (dipanggil dari form Kas Masuk) */
export async function createDonor(values: DonorInput): Promise<DonorResult> {
  const { tr, locale } = await getT();
  const { donorSchema } = getSchemas(locale);

  const session = await requireFinanceSession();
  if (!session) {
    return {
      success: false,
      error: tr("Hanya Super Admin dan Bendahara yang boleh menambah donatur"),
    };
  }

  const parsed = donorSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const donor = await prisma.donor.create({
      data: {
        name: parsed.data.name,
        category: parsed.data.category,
        address: parsed.data.address ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        dob: parsed.data.dob ?? null,
        donorSince: parsed.data.donorSince ?? null,
        occupation: parsed.data.occupation ?? null,
        monthlyIncome: parsed.data.monthlyIncome ?? null,
        lastEducation: parsed.data.lastEducation ?? null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Donor",
      entityId: donor.id,
      detail: `Menambah profil donatur ${donor.name}`,
    });

    revalidatePath("/dashboard/finance/income");
    return { success: true, donor: { id: donor.id, name: donor.name } };
  } catch (error) {
    console.error("createDonor error:", error);
    return { success: false, error: tr("Gagal menyimpan profil donatur") };
  }
}
