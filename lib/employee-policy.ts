import type { Prisma } from "@prisma/client";

export function canAccessAccount(user: { isActive: boolean; employee?: { status: string } | null } | null | undefined): boolean {
  return Boolean(user?.isActive && (!user.employee || user.employee.status === "ACTIVE"));
}

export const activeAdminWhere: Prisma.UserWhereInput = {
  role: "SUPER_ADMIN", isActive: true,
  OR: [{ employee: { is: null } }, { employee: { is: { status: "ACTIVE" } } }],
};

export function validEmployeeChoice(value: string | undefined, catalog: readonly string[], previous?: string | null) {
  return !value || catalog.includes(value) || value === previous;
}
