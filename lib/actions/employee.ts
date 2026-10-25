"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { employeeSchema, type EmployeeInput } from "@/lib/validations";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";
import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_POSITIONS, EMPLOYEE_STATUSES } from "@/lib/option-catalogs";
import { activeAdminWhere, validEmployeeChoice } from "@/lib/employee-policy";
import type { Prisma, Employee } from "@prisma/client";


type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR =
  "Hanya Super Admin yang boleh mengelola data pegawai";

/** Bangun objek data Prisma (undefined -> null agar bisa dikosongkan) */
function buildEmployeeData(parsed: z.infer<typeof employeeSchema>) {
  return {
    firstName: parsed.firstName,
    lastName: parsed.lastName ?? null,
    gender: parsed.gender,
    dob: parsed.dob ?? null,
    nik: parsed.nik ?? null,
    religion: parsed.religion ?? null,
    phone: parsed.phone ?? null,
    email: parsed.email ?? null,
    employeeCode: parsed.employeeCode,
    joinDate: parsed.joinDate ?? null,
    department: parsed.department ?? null,
    position: parsed.position ?? null,
    grade: parsed.grade ?? null,
    employmentStatus: parsed.employmentStatus,
    ptkpStatus: parsed.ptkpStatus ?? null,
    entityLocationId: parsed.entityLocationId ?? null,
    basicSalary: parsed.basicSalary ?? null,
    salaryEffectiveDate: parsed.salaryEffectiveDate ?? null,
    npwp: parsed.npwp ?? null,
    fullAddress: parsed.fullAddress ?? null,
    city: parsed.city ?? null,
    province: parsed.province ?? null,
    postalCode: parsed.postalCode ?? null,
  };
}

async function selectionError(db: Prisma.TransactionClient, data: z.infer<typeof employeeSchema>, previous?: Employee) {
  if (!validEmployeeChoice(data.department, EMPLOYEE_DEPARTMENTS, previous?.department)) return "Pilih departemen dari daftar";
  if (!validEmployeeChoice(data.position, EMPLOYEE_POSITIONS, previous?.position)) return "Pilih jabatan dari daftar";
  if (data.entityLocationId) {
    const location = await db.employeeLocation.findUnique({ where: { id: data.entityLocationId } });
    if (!location || (!location.isActive && previous?.entityLocationId !== location.id)) return "Entitas lokasi tidak tersedia";
  }
  return null;
}

export async function createEmployee(
  values: EmployeeInput
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { employeeSchema } = getSchemas(locale);

  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const parsed = employeeSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    // Kode karyawan wajib unik
    const codeExists = await prisma.employee.findUnique({
      where: { employeeCode: parsed.data.employeeCode },
      select: { id: true },
    });
    if (codeExists) {
      return {
        success: false,
        error: tr(`Kode karyawan ${parsed.data.employeeCode} sudah dipakai`),
      };
    }

    const saved = await prisma.$transaction(async tx => {
      const error = await selectionError(tx, parsed.data);
      if (error) return { error };
      const employee = await tx.employee.create({ data: buildEmployeeData(parsed.data) });
      return { employee };
    });
    if (saved.error || !saved.employee) return { success: false, error: tr(saved.error ?? "Gagal menambah pegawai") };
    const employee = saved.employee;

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Employee",
      entityId: employee.id,
      detail: `Menambah pegawai ${parsed.data.firstName} (${parsed.data.employeeCode})`,
    });

    revalidatePath("/dashboard/employees");
    return { success: true, id: employee.id };
  } catch (error) {
    console.error("createEmployee error:", error);
    return { success: false, error: tr("Gagal menambah pegawai") };
  }
}

export async function updateEmployee(
  id: string,
  values: EmployeeInput
): Promise<ActionResult> {
  const { tr, locale } = await getT();
  const { employeeSchema } = getSchemas(locale);

  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID pegawai tidak valid") };
  }

  const parsed = employeeSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: tr(parsed.error.errors[0].message) };
  }

  try {
    const existing = await prisma.employee.findUnique({
      where: { id: idParsed.data },
    });
    if (!existing) return { success: false, error: tr("Pegawai tidak ditemukan") };

    // Kode karyawan unik (kecuali milik pegawai ini sendiri)
    const codeOwner = await prisma.employee.findUnique({
      where: { employeeCode: parsed.data.employeeCode },
      select: { id: true },
    });
    if (codeOwner && codeOwner.id !== idParsed.data) {
      return {
        success: false,
        error: tr(`Kode karyawan ${parsed.data.employeeCode} sudah dipakai pegawai lain`),
      };
    }

    const selectionFailure = await prisma.$transaction(async tx => {
      const current = await tx.employee.findUnique({ where: { id: idParsed.data } });
      if (!current) return "Pegawai tidak ditemukan";
      const error = await selectionError(tx, parsed.data, current);
      if (error) return error;
      await tx.employee.update({ where: { id: current.id }, data: {
        ...buildEmployeeData(parsed.data),
        entityLocation: (parsed.data.entityLocationId ?? null) === current.entityLocationId ? current.entityLocation : null,
      } });
      return null;
    });
    if (selectionFailure) return { success: false, error: tr(selectionFailure) };

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "Employee",
      entityId: idParsed.data,
      detail: `Memperbarui pegawai ${parsed.data.firstName} (${parsed.data.employeeCode})`,
    });

    revalidatePath("/dashboard/employees");
    return { success: true, id: idParsed.data };
  } catch (error) {
    console.error("updateEmployee error:", error);
    return { success: false, error: tr("Gagal memperbarui pegawai") };
  }
}

export async function setEmployeeStatus(id: string, status: string): Promise<ActionResult> {
  const { tr } = await getT();
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };
  const parsedStatus = z.enum(EMPLOYEE_STATUSES).safeParse(status);
  if (!z.string().cuid().safeParse(id).success || !parsedStatus.success) return { success: false, error: tr("Data tidak valid") };
  try {
    const result = await prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({ where: { id }, include: { user: true } });
      if (!employee) return { success: false as const, error: tr("Pegawai tidak ditemukan") };
      if (status !== "ACTIVE") {
        if (employee.userId === session.user.id) return { success: false as const, error: tr("Tidak bisa menonaktifkan akun sendiri") };
        if (employee.status === "ACTIVE" && employee.user?.isActive && employee.user.role === "SUPER_ADMIN" && await tx.user.count({ where: activeAdminWhere }) <= 1) {
          return { success: false as const, error: tr("Tidak bisa menonaktifkan Super Admin terakhir") };
        }
      }
      if (employee.status === status) return { success: true as const, id };
      await tx.employee.update({ where: { id }, data: { status: parsedStatus.data } });
      await tx.auditLog.create({ data: { userId: session.user.id, userName: session.user.name, action: "UPDATE", entity: "Employee", entityId: id, detail: `Employee status: ${employee.status} -> ${status}` } });
      return { success: true as const, id };
    });
    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/admin/settings");
    return result;
  } catch (error) {
    console.error("setEmployeeStatus error:", error);
    return { success: false, error: tr("Gagal mengubah status pegawai") };
  }
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const { tr, locale } = await getT();

  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: tr(FORBIDDEN_ERROR) };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: tr("ID pegawai tidak valid") };
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: idParsed.data },
      select: { id: true, firstName: true, employeeCode: true, userId: true },
    });
    if (!employee) return { success: false, error: tr("Pegawai tidak ditemukan") };

    if (employee.userId) return { success: false, error: tr("Pegawai memiliki akun login. Nonaktifkan pegawai untuk menjaga riwayat dan akses.") };
    await prisma.employee.delete({ where: { id: idParsed.data } });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "DELETE",
      entity: "Employee",
      entityId: idParsed.data,
      detail: `Menghapus pegawai ${employee.firstName} (${employee.employeeCode})`,
    });

    revalidatePath("/dashboard/employees");
    return { success: true };
  } catch (error) {
    console.error("deleteEmployee error:", error);
    return { success: false, error: tr("Gagal menghapus pegawai") };
  }
}
