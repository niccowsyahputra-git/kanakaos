"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { employeeSchema, type EmployeeInput } from "@/lib/validations";

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
    entityLocation: parsed.entityLocation ?? null,
    basicSalary: parsed.basicSalary ?? null,
    salaryEffectiveDate: parsed.salaryEffectiveDate ?? null,
    npwp: parsed.npwp ?? null,
    fullAddress: parsed.fullAddress ?? null,
    city: parsed.city ?? null,
    province: parsed.province ?? null,
    postalCode: parsed.postalCode ?? null,
  };
}

export async function createEmployee(
  values: EmployeeInput
): Promise<ActionResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = employeeSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
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
        error: `Kode karyawan ${parsed.data.employeeCode} sudah dipakai`,
      };
    }

    const employee = await prisma.employee.create({
      data: buildEmployeeData(parsed.data),
    });

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
    return { success: false, error: "Gagal menambah pegawai" };
  }
}

export async function updateEmployee(
  id: string,
  values: EmployeeInput
): Promise<ActionResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID pegawai tidak valid" };
  }

  const parsed = employeeSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const existing = await prisma.employee.findUnique({
      where: { id: idParsed.data },
      select: { id: true },
    });
    if (!existing) return { success: false, error: "Pegawai tidak ditemukan" };

    // Kode karyawan unik (kecuali milik pegawai ini sendiri)
    const codeOwner = await prisma.employee.findUnique({
      where: { employeeCode: parsed.data.employeeCode },
      select: { id: true },
    });
    if (codeOwner && codeOwner.id !== idParsed.data) {
      return {
        success: false,
        error: `Kode karyawan ${parsed.data.employeeCode} sudah dipakai pegawai lain`,
      };
    }

    await prisma.employee.update({
      where: { id: idParsed.data },
      data: buildEmployeeData(parsed.data),
    });

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
    return { success: false, error: "Gagal memperbarui pegawai" };
  }
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID pegawai tidak valid" };
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: idParsed.data },
      select: { id: true, firstName: true, employeeCode: true },
    });
    if (!employee) return { success: false, error: "Pegawai tidak ditemukan" };

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
    return { success: false, error: "Gagal menghapus pegawai" };
  }
}
