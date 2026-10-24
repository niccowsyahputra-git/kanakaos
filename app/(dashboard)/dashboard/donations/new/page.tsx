import { DonationForm } from "@/components/donations/donation-form";

export default function NewDonationPage() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Catat Donasi</h2>
        <p className="text-sm text-muted-foreground">
          Simpan donasi dan kwitansi PDF akan otomatis ter-download.
        </p>
      </div>
      <DonationForm />
    </div>
  );
}
