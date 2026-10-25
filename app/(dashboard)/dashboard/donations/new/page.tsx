import { DonationForm } from "@/components/donations/donation-form";
import { getT } from "@/lib/i18n/server";


export default async function NewDonationPage() {
  const { tr, locale } = await getT();

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{tr("Catat Donasi")}</h2>
        <p className="text-sm text-muted-foreground">
          {tr("Simpan donasi dan kwitansi PDF akan otomatis ter-download.")}</p>
      </div>
      <DonationForm />
    </div>
  );
}
