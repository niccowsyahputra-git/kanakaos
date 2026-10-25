"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations";
import { getT } from "@/lib/i18n/server";
import { getSchemas } from "@/lib/validations";
import { activeAdminWhere,canAccessAccount } from "@/lib/employee-policy";


type ActionResult=
  |{ success: true; id?: string }
  |{ success: false; error: string };

const FORBIDDEN_ERROR="Hanya Super Admin yang boleh mengelola user";

export async function createUser(
  values: CreateUserInput
): Promise<ActionResult> {
  const { tr,locale }=await getT();
  const { createUserSchema }=getSchemas(locale);

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const parsed=createUserSchema.safeParse(values);
  if(!parsed.success) {
    return { success: false,error: tr(parsed.error.errors[0].message) };
  }

  try {
    const existing=await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if(existing) {
      return { success: false,error: tr("Email sudah terdaftar") };
    }

    const user=await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: await bcrypt.hash(parsed.data.password,10),
        role: parsed.data.role,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      detail: `Membuat user ${user.name} (${user.email}) role ${user.role}`,
    });

    revalidatePath("/dashboard/admin/users");
    return { success: true,id: user.id };
  } catch(error) {
    console.error("createUser error:",error);
    return { success: false,error: tr("Gagal membuat user") };
  }
}

/**
 * Buatkan akun login untuk pegawai yang sudah terdaftar di Data Pegawai.
 * User baru otomatis tertaut ke pegawai tersebut (1 pegawai : 1 akun).
 */
export async function createUserForEmployee(
  employeeId: string,
  values: CreateUserInput
): Promise<ActionResult> {
  const { tr,locale }=await getT();
  const { createUserSchema }=getSchemas(locale);

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const idParsed=z.string().cuid().safeParse(employeeId);
  if(!idParsed.success) {
    return { success: false,error: tr("ID pegawai tidak valid") };
  }

  const parsed=createUserSchema.safeParse(values);
  if(!parsed.success) {
    return { success: false,error: tr(parsed.error.errors[0].message) };
  }

  try {
    const employee=await prisma.employee.findUnique({
      where: { id: idParsed.data },
      select: { id: true,firstName: true,lastName: true,userId: true,status: true },
    });
    if(!employee) {
      return { success: false,error: tr("Data pegawai tidak ditemukan") };
    }
    if(employee.userId) {
      return { success: false,error: tr("Pegawai ini sudah punya akun login") };
    }
    if(employee.status!=="ACTIVE") return { success: false,error: tr("Aktifkan pegawai sebelum membuat akun login") };

    const existing=await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if(existing) {
      return { success: false,error: tr("Email sudah terdaftar") };
    }

    const password=await bcrypt.hash(parsed.data.password,10);
    const user=await prisma.$transaction(async tx => {
      const current=await tx.employee.findUnique({ where: { id: employee.id } });
      if(!current||current.userId||current.status!=="ACTIVE") throw new Error("Employee is no longer available for account creation");
      const account=await tx.user.create({ data: { name: parsed.data.name,email: parsed.data.email,password,role: parsed.data.role } });
      await tx.employee.update({ where: { id: current.id },data: { userId: account.id } });
      return account;
    });

    const employeeName=`${employee.firstName} ${employee.lastName??""}`.trim();
    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      detail: `Membuat akun login ${user.email} (${user.role}) untuk pegawai ${employeeName}`,
    });

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/admin/settings");
    return { success: true,id: user.id };
  } catch(error) {
    console.error("createUserForEmployee error:",error);
    return { success: false,error: tr("Gagal membuat akun untuk pegawai") };
  }
}

export async function updateUser(
  values: UpdateUserInput
): Promise<ActionResult> {
  const { tr,locale }=await getT();
  const { updateUserSchema }=getSchemas(locale);

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const parsed=updateUserSchema.safeParse(values);
  if(!parsed.success) {
    return { success: false,error: tr(parsed.error.errors[0].message) };
  }

  try {
    const password=parsed.data.password? await bcrypt.hash(parsed.data.password,10):undefined;
    const failure=await prisma.$transaction(async tx => {
      const target=await tx.user.findUnique({
        where: { id: parsed.data.id },
        select: { id: true,role: true,name: true,isActive: true,employee: { select: { status: true } } },
      });
      if(!target) return { success: false,error: tr("User tidak ditemukan") };

      // Cegah menurunkan role SUPER_ADMIN terakhir agar sistem tidak terkunci
      if(target.role==="SUPER_ADMIN"&&canAccessAccount(target)&&parsed.data.role!=="SUPER_ADMIN") {
        const adminCount=await tx.user.count({
          where: activeAdminWhere,
        });
        if(adminCount<=1) {
          return {
            success: false,
            error: tr("Tidak bisa mengubah role Super Admin terakhir"),
          };
        }
      }

      await tx.user.update({
        where: { id: parsed.data.id },
        data: { name: parsed.data.name,role: parsed.data.role,...(password&&{ password }) },
      });
      return null;
    });
    if(failure) return { success: false,error: failure.error };

    await logAudit({
      userId: session.user.id,
      userName: session.user.name??"Unknown",
      action: "UPDATE",
      entity: "User",
      entityId: parsed.data.id,
      detail: `Mengubah user ${parsed.data.name} (role ${parsed.data.role}${parsed.data.password? ", reset password":""
        })`,
    });

    revalidatePath("/dashboard/admin/users");
    return { success: true,id: parsed.data.id };
  } catch(error) {
    console.error("updateUser error:",error);
    return { success: false,error: tr("Gagal memperbarui user") };
  }
}

export async function toggleUserActive(id: string): Promise<ActionResult> {
  const { tr,locale }=await getT();

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const idParsed=z.string().cuid().safeParse(id);
  if(!idParsed.success) {
    return { success: false,error: tr("ID user tidak valid") };
  }

  if(idParsed.data===session.user.id) {
    return { success: false,error: tr("Tidak bisa menonaktifkan akun sendiri") };
  }

  try {
    const result=await prisma.$transaction(async tx => {
      const target=await tx.user.findUnique({
        where: { id: idParsed.data },
        select: { id: true,name: true,role: true,isActive: true,employee: { select: { status: true } } },
      });
      if(!target) return { success: false,error: tr("User tidak ditemukan") };

      if(!target.isActive&&target.employee&&target.employee.status!=="ACTIVE") {
        return { success: false,error: tr("Aktifkan pegawai sebelum mengaktifkan akun login") };
      }

      // Cegah menonaktifkan SUPER_ADMIN aktif terakhir
      if(target.role==="SUPER_ADMIN"&&canAccessAccount(target)) {
        const activeAdminCount=await tx.user.count({
          where: activeAdminWhere,
        });
        if(activeAdminCount<=1) {
          return {
            success: false,
            error: tr("Tidak bisa menonaktifkan Super Admin terakhir"),
          };
        }
      }

      const updated=await tx.user.update({
        where: { id: idParsed.data },
        data: { isActive: !target.isActive },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          userName: session.user.name??"Unknown",
          action: "UPDATE",
          entity: "User",
          entityId: target.id,
          detail: `${updated.isActive? "Mengaktifkan":"Menonaktifkan"} user ${target.name}`,
        }
      });
      return { success: true,id: target.id };
    });
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/employees");
    return result.success? { success: true,id: result.id }:{ success: false,error: result.error! };
  } catch(error) {
    console.error("toggleUserActive error:",error);
    return { success: false,error: tr("Gagal mengubah status user") };
  }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const { tr,locale }=await getT();

  const session=await requireSuperAdminSession();
  if(!session) return { success: false,error: tr(FORBIDDEN_ERROR) };

  const idParsed=z.string().cuid().safeParse(id);
  if(!idParsed.success) {
    return { success: false,error: tr("ID user tidak valid") };
  }

  if(idParsed.data===session.user.id) {
    return { success: false,error: tr("Tidak bisa menghapus akun sendiri") };
  }

  try {
    const result=await prisma.$transaction(async tx => {
      const target=await tx.user.findUnique({
        where: { id: idParsed.data },
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
          employee: { select: { status: true } },
          _count: { select: { dailyLogs: true,assignedCases: true } },
        },
      });
      if(!target) return { success: false,error: tr("User tidak ditemukan") };

      if(target.role==="SUPER_ADMIN"&&canAccessAccount(target)) {
        const adminCount=await tx.user.count({
          where: activeAdminWhere,
        });
        if(adminCount<=1) {
          return {
            success: false,
            error: tr("Tidak bisa menghapus Super Admin terakhir"),
          };
        }
      }

      // User dengan riwayat data tidak dihapus (jaga integritas log & kasus),
      // arahkan admin untuk menonaktifkan saja.
      if(target._count.dailyLogs>0||target._count.assignedCases>0) {
        return {
          success: false,
          error:
            tr("User memiliki riwayat log/kasus. Nonaktifkan saja agar data audit tetap utuh"),
        };
      }

      await tx.user.delete({ where: { id: idParsed.data } });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          userName: session.user.name??"Unknown",
          action: "DELETE",
          entity: "User",
          entityId: target.id,
          detail: `Menghapus user ${target.name}`,
        }
      });
      return { success: true };
    });
    revalidatePath("/dashboard/admin/settings");
    revalidatePath("/dashboard/employees");
    return result.success? { success: true }:{ success: false,error: result.error! };
  } catch(error) {
    console.error("deleteUser error:",error);
    return { success: false,error: tr("Gagal menghapus user") };
  }
}
