import { redirect } from "next/navigation";

// Pengaturan AI sudah dipindah ke dalam Pengaturan Sistem (tab "AI")
export default function AISettingsPage() {
  redirect("/dashboard/admin/settings");
}
