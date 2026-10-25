"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import {
  shiftHandoverSchema,
  type ShiftHandoverInput,
} from "@/lib/validations";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export async function createShiftHandover(
  values: ShiftHandoverInput
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { shiftHandoverSchema } = getSchemas(locale);

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const parsed = shiftHandoverSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  // Konsistensi: jika dicentang "semua anak aman" tapi ada catatan sakit,
  // minta pengasuh meluruskan datanya.
  if (parsed.data.allChildrenSafe === false && !parsed.data.sickChildrenNotes) {
    return {
      success: false,
      error: tr("Sebutkan anak yang sakit/bermasalah di kolom catatan anak sakit"),
    };
  }

  try {
    const handover = await prisma.shiftHandover.create({
      data: {
        date: new Date(parsed.data.date),
        shift: parsed.data.shift,
        allChildrenSafe: parsed.data.allChildrenSafe,
        sickChildrenNotes: parsed.data.sickChildrenNotes ?? null,
        importantNotes: parsed.data.importantNotes,
        createdById: session.user.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "ShiftHandover",
      entityId: handover.id,
      detail: `Serah terima shift ${parsed.data.shift} tanggal ${parsed.data.date}`,
    });

    revalidatePath("/dashboard/shift-handover");
    return { success: true, id: handover.id };
  } catch (error) {
    console.error("createShiftHandover error:", error);
    return { success: false, error: tr("Gagal menyimpan serah terima shift") };
  }
}
