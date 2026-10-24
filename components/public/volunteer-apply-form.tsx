"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

import { applyVolunteer } from "@/lib/actions/public";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SKILL_OPTIONS = [
  "Mengajar",
  "IT / Komputer",
  "Medis / Kesehatan",
  "Fotografi",
  "Olahraga",
  "Seni & Musik",
  "Memasak",
  "Administrasi",
];

const AVAILABILITY_OPTIONS = [
  "Hari Kerja (Senin-Jumat)",
  "Sabtu",
  "Minggu",
  "Fleksibel",
];

function CheckboxGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const isChecked = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={cn(
              "flex items-center gap-2 rounded-lg border-2 p-3 text-left text-sm transition-colors",
              isChecked
                ? "border-primary bg-primary/10"
                : "border-muted hover:bg-accent"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                isChecked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground"
              )}
            >
              {isChecked && <CheckCircle2 className="h-3 w-3" />}
            </span>
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function VolunteerApplyForm() {
  const ktpRef = useRef<HTMLInputElement>(null);
  const skckRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [motivation, setMotivation] = useState("");
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value]
    );
  }

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("email", email);
      formData.set("phone", phone);
      formData.set("dob", dob);
      formData.set("address", address);
      formData.set("occupation", occupation);
      for (const skill of skills) formData.append("skills", skill);
      for (const slot of availability) formData.append("availability", slot);
      formData.set("motivation", motivation);
      formData.set("agreePolicy", String(agreePolicy));
      const ktp = ktpRef.current?.files?.[0];
      if (ktp) formData.set("ktp", ktp);
      const skck = skckRef.current?.files?.[0];
      if (skck) formData.set("skck", skck);

      const result = await applyVolunteer(formData);
      if (result.success) {
        setSubmitted(true);
        if (result.warning) {
          toast.warning("Pendaftaran diterima", {
            description: result.warning,
          });
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  // Setelah submit sukses: tampilkan pesan konfirmasi
  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </span>
          <h2 className="text-xl font-bold">Pendaftaran Terkirim!</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Terima kasih atas niat baik Anda. Pendaftaran Anda akan kami review
            dalam <b>3 hari kerja</b>. Tim kami akan menghubungi Anda via email
            atau WhatsApp untuk tahap screening berikutnya.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-4 md:p-6">
        <div className="space-y-2">
          <Label htmlFor="vol-name">Nama Lengkap</Label>
          <Input
            id="vol-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sesuai KTP"
            autoComplete="name"
          />
        </div>

        <div className="flex flex-col gap-5 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="vol-email">Email</Label>
            <Input
              id="vol-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@anda.com"
              autoComplete="email"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="vol-phone">No. HP (WhatsApp)</Label>
            <Input
              id="vol-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="flex flex-col gap-5 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="vol-dob">Tanggal Lahir</Label>
            <Input
              id="vol-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="vol-occupation">Pekerjaan</Label>
            <Input
              id="vol-occupation"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder="Mahasiswa / Guru / Karyawan..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vol-address">Alamat Lengkap</Label>
          <Textarea
            id="vol-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Alamat domisili saat ini"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-base">Keahlian (pilih minimal 1)</Label>
          <CheckboxGroup
            options={SKILL_OPTIONS}
            selected={skills}
            onToggle={(value) => toggle(skills, setSkills, value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-base">Ketersediaan Waktu</Label>
          <CheckboxGroup
            options={AVAILABILITY_OPTIONS}
            selected={availability}
            onToggle={(value) => toggle(availability, setAvailability, value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vol-motivation">Motivasi Menjadi Relawan</Label>
          <Textarea
            id="vol-motivation"
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            placeholder="Ceritakan mengapa Anda ingin menjadi relawan di panti kami (min. 20 karakter)..."
            rows={4}
          />
        </div>

        <div className="flex flex-col gap-5 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="vol-ktp">Upload KTP (JPG/PNG/PDF, maks 5MB)</Label>
            <Input
              id="vol-ktp"
              ref={ktpRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="vol-skck">
              Upload SKCK{" "}
              <span className="font-normal text-muted-foreground">
                (opsional saat daftar)
              </span>
            </Label>
            <Input
              id="vol-skck"
              ref={skckRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            />
          </div>
        </div>

        {/* Persetujuan child safeguarding: wajib */}
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors",
            agreePolicy ? "border-primary bg-primary/5" : "border-muted"
          )}
        >
          <input
            type="checkbox"
            checked={agreePolicy}
            onChange={(e) => setAgreePolicy(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">
            Saya telah membaca dan menyetujui{" "}
            <b>Kebijakan Perlindungan Anak (Child Safeguarding Policy)</b>{" "}
            yayasan, termasuk larangan kontak pribadi dengan anak di luar
            kegiatan resmi dan kesediaan mengikuti screening latar belakang.
          </span>
        </label>

        <Button
          onClick={handleSubmit}
          disabled={
            isPending ||
            name.trim().length < 3 ||
            !email.includes("@") ||
            phone.trim().length < 8 ||
            !dob ||
            address.trim().length < 10 ||
            occupation.trim().length < 2 ||
            skills.length === 0 ||
            availability.length === 0 ||
            motivation.trim().length < 20 ||
            !agreePolicy
          }
          className="h-12 w-full text-base"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Mengirim...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Kirim Pendaftaran
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
