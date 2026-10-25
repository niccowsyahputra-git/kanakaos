"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  volunteerNeedSchema,
  type VolunteerNeedInput,
} from "@/lib/validations";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";
import { NEED_STATUSES,needFieldLabel } from "@/lib/option-catalogs";


type ActionResult=
  |{ success: true; id?: string }
  |{ success: false; error: string };

const FORBIDDEN_ERROR=
  "Hanya Super Admin dan Pekerja Sosial yang boleh mengelola kebutuhan relawan";

const idSchema=z.string().cuid("ID kebutuhan relawan tidak valid");

function revalidateNeedPages() {
  revalidatePath("/dashboard/volunteers/needs");
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/volunteer/apply");
}

export async function createVolunteerNeed(
  values: VolunteerNeedInput
): Promise<ActionResult> {
  const { tr,locale }=await getT();
  const { volunteerNeedSchema }=getSchemas(locale);

  const session=await requireStaffSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const parsed=volunteerNeedSchema.safeParse(values);
  if(!parsed.success) {
    return { success: false,error: tr(parsed.error.errors[0].message) };
  }

  try {
    const need=await prisma.volunteerNeed.create({
      data: {
        title: needFieldLabel(parsed.data.field,parsed.data.otherField??null,""),
        field: parsed.data.field,
        otherField: parsed.data.field==="OTHER"? parsed.data.otherField:null,
        startDate: new Date(`${parsed.data.startDate}T00:00:00.000Z`),
        endDate: new Date(`${parsed.data.endDate}T00:00:00.000Z`),
        description: parsed.data.description??null,
        quantity: parsed.data.quantity,
        schedule: parsed.data.schedule??null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "CREATE",
      entity: "VolunteerNeed",
      entityId: need.id,
      detail: `Buka kebutuhan relawan ${need.title} (${need.quantity} orang)`,
    });

    revalidateNeedPages();
    return { success: true,id: need.id };
  } catch(error) {
    console.error("createVolunteerNeed error:",error);
    return { success: false,error: tr("Gagal menyimpan kebutuhan relawan") };
  }
}

export async function updateVolunteerNeed(
  id: string,
  values: VolunteerNeedInput
): Promise<ActionResult> {
  const { tr,locale }=await getT();
  const { volunteerNeedSchema }=getSchemas(locale);

  const session=await requireStaffSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const idParsed=idSchema.safeParse(id);
  if(!idParsed.success) {
    return { success: false,error: tr(idParsed.error.errors[0].message) };
  }
  const parsed=volunteerNeedSchema.safeParse(values);
  if(!parsed.success) {
    return { success: false,error: tr(parsed.error.errors[0].message) };
  }

  try {
    const existing=await prisma.volunteerNeed.findUnique({
      where: { id: idParsed.data },
      select: { id: true },
    });
    if(!existing) {
      return { success: false,error: tr("Kebutuhan relawan tidak ditemukan") };
    }

    await prisma.volunteerNeed.update({
      where: { id: idParsed.data },
      data: {
        title: needFieldLabel(parsed.data.field,parsed.data.otherField??null,""),
        field: parsed.data.field,
        otherField: parsed.data.field==="OTHER"? parsed.data.otherField:null,
        startDate: new Date(`${parsed.data.startDate}T00:00:00.000Z`),
        endDate: new Date(`${parsed.data.endDate}T00:00:00.000Z`),
        description: parsed.data.description??null,
        quantity: parsed.data.quantity,
        schedule: parsed.data.schedule??null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "UPDATE",
      entity: "VolunteerNeed",
      entityId: idParsed.data,
      detail: `Ubah kebutuhan relawan ${needFieldLabel(parsed.data.field,parsed.data.otherField??null,"")} (${parsed.data.quantity} orang)`,
    });

    revalidateNeedPages();
    return { success: true,id: idParsed.data };
  } catch(error) {
    console.error("updateVolunteerNeed error:",error);
    return { success: false,error: tr("Gagal memperbarui kebutuhan relawan") };
  }
}

/** Tutup (CLOSED) atau buka kembali (OPEN) kebutuhan relawan */
export async function setVolunteerNeedStatus(
  id: string,
  status: typeof NEED_STATUSES[number]
): Promise<ActionResult> {
  const { tr,locale }=await getT();

  const session=await requireStaffSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const idParsed=idSchema.safeParse(id);
  const statusParsed=z.enum(NEED_STATUSES).safeParse(status);
  if(!idParsed.success||!statusParsed.success) {
    return { success: false,error: tr("Data tidak valid") };
  }

  try {
    const existing=await prisma.volunteerNeed.findUnique({
      where: { id: idParsed.data },
      select: { id: true,title: true,status: true },
    });
    if(!existing) {
      return { success: false,error: tr("Kebutuhan relawan tidak ditemukan") };
    }
    if(existing.status===statusParsed.data) {
      return { success: true,id: existing.id };
    }

    const isClosing=statusParsed.data==="CLOSED";
    await prisma.volunteerNeed.update({
      where: { id: existing.id },
      data: {
        status: statusParsed.data,
        closedAt: isClosing? new Date():null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "UPDATE",
      entity: "VolunteerNeed",
      entityId: existing.id,
      detail: `Volunteer need ${existing.title}: ${existing.status} -> ${statusParsed.data}`,
    });

    revalidateNeedPages();
    return { success: true,id: existing.id };
  } catch(error) {
    console.error("setVolunteerNeedStatus error:",error);
    return { success: false,error: tr("Gagal mengubah status kebutuhan relawan") };
  }
}

/** Hapus hanya jika belum ada relawan yang terhubung (jaga riwayat) */
export async function deleteVolunteerNeed(id: string): Promise<ActionResult> {
  const { tr,locale }=await getT();

  const session=await requireStaffSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const idParsed=idSchema.safeParse(id);
  if(!idParsed.success) {
    return { success: false,error: tr(idParsed.error.errors[0].message) };
  }

  try {
    const existing=await prisma.volunteerNeed.findUnique({
      where: { id: idParsed.data },
      select: { id: true,title: true,_count: { select: { volunteers: true } } },
    });
    if(!existing) {
      return { success: false,error: tr("Kebutuhan relawan tidak ditemukan") };
    }
    if(existing._count.volunteers>0) {
      return {
        success: false,
        error:
          tr("Kebutuhan ini sudah memiliki pendaftar/relawan. Tutup (close) saja agar riwayat tetap tersimpan."),
      };
    }

    await prisma.volunteerNeed.delete({ where: { id: existing.id } });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "DELETE",
      entity: "VolunteerNeed",
      entityId: existing.id,
      detail: `Hapus kebutuhan relawan ${existing.title}`,
    });

    revalidateNeedPages();
    return { success: true };
  } catch(error) {
    console.error("deleteVolunteerNeed error:",error);
    return { success: false,error: tr("Gagal menghapus kebutuhan relawan") };
  }
}
