import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { canAccessAccount } from "@/lib/employee-policy";

export async function auth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: true, isActive: true, employee: { select: { status: true } } },
  });
  if (!user || !canAccessAccount(user)) return null;
  return { ...session, user: { ...session.user, name: user.name, email: user.email, role: user.role } };
}
