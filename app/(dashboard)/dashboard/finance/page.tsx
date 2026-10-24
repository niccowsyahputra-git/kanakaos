import { redirect } from "next/navigation";

// /dashboard/finance mengarah ke ringkasan keuangan
export default function FinancePage() {
  redirect("/dashboard/finance/overview");
}
