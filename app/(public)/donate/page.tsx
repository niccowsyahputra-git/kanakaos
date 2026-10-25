import { PublicDonateForm } from "@/components/public/donate-form";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata() {
  const { tr } = await getT();
  return {
    title: `${tr("Donasi")} — Yayasan Kanaka`,
    description: tr("Salurkan donasi Anda untuk anak-anak panti asuhan."),
  };
}

export default async function DonatePage() {
  const { tr, locale } = await getT();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 md:py-16">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {tr("Donasi Sekarang")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr("Setiap rupiah yang Anda berikan langsung membantu kebutuhan anak-anak asuh kami.")}</p>
      </div>
      <PublicDonateForm />
    </div>
  );
}
