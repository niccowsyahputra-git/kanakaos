import { auth } from "@/auth";

/** Role yang boleh mengelola relawan & mitra (Child Safeguarding) */
export const STAFF_ROLES = ["SUPER_ADMIN", "SOCIAL_WORKER"] as const;

/**
 * Ambil session dan pastikan role termasuk staff (SUPER_ADMIN / SOCIAL_WORKER).
 * Return session jika berwenang, null jika tidak.
 */
export async function requireStaffSession() {
  const session = await auth();
  if (!session?.user) return null;
  if (!STAFF_ROLES.includes(session.user.role as (typeof STAFF_ROLES)[number])) {
    return null;
  }
  return session;
}

/**
 * Ambil session dan pastikan role SUPER_ADMIN.
 * Return session jika berwenang, null jika tidak.
 */
export async function requireSuperAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

/** Role yang boleh mengelola keuangan */
export const FINANCE_ROLES = ["SUPER_ADMIN", "FINANCE"] as const;

/**
 * Ambil session dan pastikan role bendahara (SUPER_ADMIN / FINANCE).
 * Return session jika berwenang, null jika tidak.
 */
export async function requireFinanceSession() {
  const session = await auth();
  if (!session?.user) return null;
  if (
    !FINANCE_ROLES.includes(session.user.role as (typeof FINANCE_ROLES)[number])
  ) {
    return null;
  }
  return session;
}

/** Role yang boleh mengelola logistik (inventory, PR, aset) */
export const LOGISTICS_ROLES = ["SUPER_ADMIN", "LOGISTICS"] as const;

/**
 * Ambil session dan pastikan role logistik (SUPER_ADMIN / LOGISTICS).
 * Return session jika berwenang, null jika tidak.
 */
export async function requireLogisticsSession() {
  const session = await auth();
  if (!session?.user) return null;
  if (
    !LOGISTICS_ROLES.includes(
      session.user.role as (typeof LOGISTICS_ROLES)[number]
    )
  ) {
    return null;
  }
  return session;
}
