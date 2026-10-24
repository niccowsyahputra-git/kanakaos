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

type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const FORBIDDEN_ERROR = "Hanya Super Admin yang boleh mengelola user";

export async function createUser(
  values: CreateUserInput
): Promise<ActionResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Email sudah terdaftar" };
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: await bcrypt.hash(parsed.data.password, 10),
        role: parsed.data.role,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      detail: `Membuat user ${user.name} (${user.email}) role ${user.role}`,
    });

    revalidatePath("/dashboard/admin/users");
    return { success: true, id: user.id };
  } catch (error) {
    console.error("createUser error:", error);
    return { success: false, error: "Gagal membuat user" };
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
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(employeeId);
  if (!idParsed.success) {
    return { success: false, error: "ID pegawai tidak valid" };
  }

  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: idParsed.data },
      select: { id: true, firstName: true, lastName: true, userId: true },
    });
    if (!employee) {
      return { success: false, error: "Data pegawai tidak ditemukan" };
    }
    if (employee.userId) {
      return { success: false, error: "Pegawai ini sudah punya akun login" };
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Email sudah terdaftar" };
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: await bcrypt.hash(parsed.data.password, 10),
        role: parsed.data.role,
      },
    });
    await prisma.employee.update({
      where: { id: employee.id },
      data: { userId: user.id },
    });

    const employeeName = `${employee.firstName} ${employee.lastName ?? ""}`.trim();
    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      detail: `Membuat akun login ${user.email} (${user.role}) untuk pegawai ${employeeName}`,
    });

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/admin/settings");
    return { success: true, id: user.id };
  } catch (error) {
    console.error("createUserForEmployee error:", error);
    return { success: false, error: "Gagal membuat akun untuk pegawai" };
  }
}

export async function updateUser(
  values: UpdateUserInput
): Promise<ActionResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const parsed = updateUserSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, role: true, name: true },
    });
    if (!target) return { success: false, error: "User tidak ditemukan" };

    // Cegah menurunkan role SUPER_ADMIN terakhir agar sistem tidak terkunci
    if (target.role === "SUPER_ADMIN" && parsed.data.role !== "SUPER_ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "SUPER_ADMIN", isActive: true },
      });
      if (adminCount <= 1) {
        return {
          success: false,
          error: "Tidak bisa mengubah role Super Admin terakhir",
        };
      }
    }

    await prisma.user.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        ...(parsed.data.password && {
          password: await bcrypt.hash(parsed.data.password, 10),
        }),
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "User",
      entityId: parsed.data.id,
      detail: `Mengubah user ${parsed.data.name} (role ${parsed.data.role}${
        parsed.data.password ? ", reset password" : ""
      })`,
    });

    revalidatePath("/dashboard/admin/users");
    return { success: true, id: parsed.data.id };
  } catch (error) {
    console.error("updateUser error:", error);
    return { success: false, error: "Gagal memperbarui user" };
  }
}

export async function toggleUserActive(id: string): Promise<ActionResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID user tidak valid" };
  }

  if (idParsed.data === session.user.id) {
    return { success: false, error: "Tidak bisa menonaktifkan akun sendiri" };
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: idParsed.data },
      select: { id: true, name: true, role: true, isActive: true },
    });
    if (!target) return { success: false, error: "User tidak ditemukan" };

    // Cegah menonaktifkan SUPER_ADMIN aktif terakhir
    if (target.role === "SUPER_ADMIN" && target.isActive) {
      const activeAdminCount = await prisma.user.count({
        where: { role: "SUPER_ADMIN", isActive: true },
      });
      if (activeAdminCount <= 1) {
        return {
          success: false,
          error: "Tidak bisa menonaktifkan Super Admin terakhir",
        };
      }
    }

    const updated = await prisma.user.update({
      where: { id: idParsed.data },
      data: { isActive: !target.isActive },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "UPDATE",
      entity: "User",
      entityId: target.id,
      detail: `${updated.isActive ? "Mengaktifkan" : "Menonaktifkan"} user ${target.name}`,
    });

    revalidatePath("/dashboard/admin/users");
    return { success: true, id: target.id };
  } catch (error) {
    console.error("toggleUserActive error:", error);
    return { success: false, error: "Gagal mengubah status user" };
  }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const session = await requireSuperAdminSession();
  if (!session) return { success: false, error: FORBIDDEN_ERROR };

  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) {
    return { success: false, error: "ID user tidak valid" };
  }

  if (idParsed.data === session.user.id) {
    return { success: false, error: "Tidak bisa menghapus akun sendiri" };
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: idParsed.data },
      select: {
        id: true,
        name: true,
        role: true,
        _count: { select: { dailyLogs: true, assignedCases: true } },
      },
    });
    if (!target) return { success: false, error: "User tidak ditemukan" };

    if (target.role === "SUPER_ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "SUPER_ADMIN" },
      });
      if (adminCount <= 1) {
        return {
          success: false,
          error: "Tidak bisa menghapus Super Admin terakhir",
        };
      }
    }

    // User dengan riwayat data tidak dihapus (jaga integritas log & kasus),
    // arahkan admin untuk menonaktifkan saja.
    if (target._count.dailyLogs > 0 || target._count.assignedCases > 0) {
      return {
        success: false,
        error:
          "User memiliki riwayat log/kasus. Nonaktifkan saja agar data audit tetap utuh",
      };
    }

    await prisma.user.delete({ where: { id: idParsed.data } });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "DELETE",
      entity: "User",
      entityId: target.id,
      detail: `Menghapus user ${target.name}`,
    });

    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (error) {
    console.error("deleteUser error:", error);
    return { success: false, error: "Gagal menghapus user" };
  }
}
