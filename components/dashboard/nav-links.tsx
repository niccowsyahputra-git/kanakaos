"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ClipboardPlus,
  HeartHandshake,
  UserCheck,
  Building2,
  FolderOpen,
  BarChart3,
  Settings,
  Home,
  Baby,
  ArrowLeftRight,
  Siren,
  Wallet,
  Boxes,
  Warehouse,
  Bell,
  UserCircle,
  Contact,
  BadgeCheck,
  DoorOpen,
  CalendarClock,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Jika diisi, link hanya tampil untuk role tersebut */
  allowedRoles?: string[];
};

const STAFF_ROLES = ["SUPER_ADMIN", "SOCIAL_WORKER"];
const FINANCE_ROLES = ["SUPER_ADMIN", "FINANCE"];
const LOGISTICS_ROLES = ["SUPER_ADMIN", "LOGISTICS"];

const links: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/children", label: "Anak Asuh", icon: Users },
  {
    href: "/dashboard/guardians",
    label: "Wali Anak",
    icon: Contact,
    allowedRoles: STAFF_ROLES,
  },
  { href: "/dashboard/daily-logs/new", label: "Catat Log Harian", icon: ClipboardPlus },
  { href: "/dashboard/donations/new", label: "Catat Donasi", icon: HeartHandshake },
  {
    href: "/dashboard/my-assignments",
    label: "Anak Asuhan Saya",
    icon: Baby,
    allowedRoles: ["CAREGIVER"],
  },
  {
    href: "/dashboard/my-assignments",
    label: "Penugasan Pengasuh",
    icon: Baby,
    allowedRoles: STAFF_ROLES,
  },
  {
    href: "/dashboard/shift-handover",
    label: "Serah Terima Shift",
    icon: ArrowLeftRight,
    allowedRoles: ["CAREGIVER", ...STAFF_ROLES],
  },
  { href: "/dashboard/incidents", label: "Insiden", icon: Siren },
  { href: "/dashboard/home-leaves", label: "Kepulangan Anak", icon: DoorOpen },
  {
    href: "/dashboard/family-visits",
    label: "Kunjungan Keluarga",
    icon: CalendarClock,
  },
  {
    href: "/dashboard/cases",
    label: "Kasus Anak",
    icon: FolderOpen,
    allowedRoles: STAFF_ROLES,
  },
  {
    href: "/dashboard/home-visits",
    label: "Kunjungan Rumah",
    icon: Home,
    allowedRoles: STAFF_ROLES,
  },
  {
    href: "/dashboard/finance/overview",
    label: "Keuangan",
    icon: Wallet,
    allowedRoles: FINANCE_ROLES,
  },
  {
    href: "/dashboard/inventory",
    label: "Inventori",
    icon: Boxes,
    allowedRoles: LOGISTICS_ROLES,
  },
  {
    href: "/dashboard/assets",
    label: "Aset",
    icon: Warehouse,
    allowedRoles: LOGISTICS_ROLES,
  },
  {
    href: "/dashboard/volunteers",
    label: "Relawan",
    icon: UserCheck,
    allowedRoles: STAFF_ROLES,
  },
  {
    href: "/dashboard/volunteers/needs",
    label: "Kebutuhan Relawan",
    icon: Megaphone,
    allowedRoles: STAFF_ROLES,
  },
  {
    href: "/dashboard/partners",
    label: "Mitra",
    icon: Building2,
    allowedRoles: STAFF_ROLES,
  },
  {
    href: "/dashboard/reports",
    label: "Laporan",
    icon: BarChart3,
    allowedRoles: ["SUPER_ADMIN"],
  },
  {
    href: "/dashboard/employees",
    label: "Data Pegawai",
    icon: BadgeCheck,
    allowedRoles: ["SUPER_ADMIN"],
  },
  {
    href: "/dashboard/admin/settings",
    label: "Pengaturan Sistem",
    icon: Settings,
    allowedRoles: ["SUPER_ADMIN"],
  },
  { href: "/dashboard/notifications", label: "Notifikasi", icon: Bell },
  { href: "/dashboard/profile", label: "Profil Saya", icon: UserCircle },
];

export function NavLinks({
  role,
  onNavigate,
}: {
  role?: string;
  onNavigate?: () => void;
}) {
  const { tr, locale } = useI18n();
  const links = localizeLabels(__links, tr);

  const pathname = usePathname();

  const visibleLinks = links.filter(
    (link) => !link.allowedRoles || (role && link.allowedRoles.includes(role))
  );

  return (
    <nav className="flex flex-col gap-1">
      {visibleLinks.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {tr(link.label)}
          </Link>
        );
      })}
    </nav>
  );
}

const __links = links;
