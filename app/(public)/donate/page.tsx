import { PublicDonateForm } from "@/components/public/donate-form";

export const metadata = {
  title: "Donasi — Yayasan Kanaka",
  description: "Salurkan donasi Anda untuk anak-anak panti asuhan.",
};

export default function DonatePage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 md:py-16">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Donasi Sekarang
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Setiap rupiah yang Anda berikan langsung membantu kebutuhan
          anak-anak asuh kami.
        </p>
      </div>
      <PublicDonateForm />
    </div>
  );
}
