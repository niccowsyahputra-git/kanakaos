import { redirect } from "next/navigation";

// Manajemen User sudah dipindah ke Pengaturan Sistem (tab "Pengguna")
export default function UsersPage() {
  redirect("/dashboard/admin/settings?tab=users");
}
