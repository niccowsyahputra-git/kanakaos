import { VolunteerApplyForm } from "@/components/public/volunteer-apply-form";

export const metadata = {
  title: "Daftar Relawan — Yayasan Kanaka",
  description: "Bergabunglah menjadi relawan panti asuhan.",
};

export default function VolunteerApplyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Daftar Menjadi Relawan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bagikan waktu dan keahlian Anda untuk anak-anak kami. Semua relawan
          melewati proses screening demi keamanan anak.
        </p>
      </div>
      <VolunteerApplyForm />
    </div>
  );
}
