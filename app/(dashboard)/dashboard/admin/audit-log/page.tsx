import { redirect } from "next/navigation";

// Audit Log sudah dipindah ke Pengaturan Sistem (tab "Audit Log")
export default function AuditLogPage() {
  redirect("/dashboard/admin/settings?tab=audit");
}
