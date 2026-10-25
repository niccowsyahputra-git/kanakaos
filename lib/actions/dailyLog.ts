"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { dailyLogSchema, type DailyLogInput } from "@/lib/validations";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";


type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export async function createDailyLog(
  values: DailyLogInput
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { dailyLogSchema } = getSchemas(locale);

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: tr("Tidak terautentikasi") };
  }

  const parsed = dailyLogSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  const { childId, date, schoolAttendance, evaluationNotes, ...data } =
    parsed.data;

  // Porsi makan otomatis: habis 3 waktu = 100%
  const mealsDone = [
    parsed.data.breakfastDone,
    parsed.data.lunchDone,
    parsed.data.dinnerDone,
  ].filter(Boolean).length;
  const mealPercentage = Math.round((mealsDone / 3) * 100);

  try {
    // Pastikan anak ada dan berstatus aktif
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, status: true },
    });
    if (!child) {
      return { success: false, error: tr("Data anak tidak ditemukan") };
    }

    const log = await prisma.dailyLog.create({
      data: {
        ...data,
        mealPercentage,
        schoolAttendance: schoolAttendance ?? null,
        evaluationNotes: evaluationNotes ?? null,
        childId,
        date: date ?? new Date(),
        caregiverId: session.user.id,
      },
    });

    revalidatePath(`/dashboard/children/${childId}`);
    revalidatePath("/dashboard");
    return { success: true, id: log.id };
  } catch (error) {
    console.error("createDailyLog error:", error);
    return { success: false, error: tr("Gagal menyimpan log harian") };
  }
}
