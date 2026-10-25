"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

import { createUserForEmployee } from "@/lib/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";
import { localizeLabels } from "@/lib/i18n/translate";


const NONE = "NONE";

const roleOptions = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "SOCIAL_WORKER", label: "Pekerja Sosial" },
  { value: "CAREGIVER", label: "Pengasuh" },
  { value: "FINANCE", label: "Bendahara" },
  { value: "LOGISTICS", label: "Logistik" },
  { value: "VOLUNTEER", label: "Relawan" },
];

const roleLabel: Record<string, string> = Object.fromEntries(
  roleOptions.map((o) => [o.value, o.label])
);

/** Badge status akun pegawai yang sudah tertaut */
export function EmployeeAccountBadge({
  email,
  role,
  isActive,
}: {
  email: string;
  role: string;
  isActive: boolean;
}) {
  const { tr, locale } = useI18n();
  const roleLabel = localizeLabels(__roleLabel, tr);

  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        variant="outline"
        className={
          isActive
            ? "w-fit border-transparent bg-green-100 text-green-800"
            : "w-fit border-transparent bg-gray-100 text-gray-500"
        }
      >
        {roleLabel[role] ?? role}
        {!isActive && tr(" (nonaktif)")}
      </Badge>
      <span className="text-xs text-muted-foreground">{email}</span>
    </div>
  );
}

/** Tombol + dialog buat akun login untuk pegawai yang belum punya */
export function CreateAccountDialog({
  employeeId,
  employeeName,
  employeeEmail,
  disabled = false,
}: {
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  disabled?: boolean;
}) {
  const { tr, locale } = useI18n();
  const roleOptions = localizeLabels(__roleOptions, tr);

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(employeeName);
  const [email, setEmail] = useState(employeeEmail ?? "");
  const [role, setRole] = useState(NONE);
  const [password, setPassword] = useState("");

  function handleSubmit() {
    if (role === NONE) {
      toast.error(tr("Pilih role akses"));
      return;
    }
    startTransition(async () => {
      const result = await createUserForEmployee(employeeId, {
        name,
        email,
        role: role as "CAREGIVER",
        password,
      });
      if (result.success) {
        toast.success(tr("Akun login untuk {0} berhasil dibuat", { "0": name }));
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8" disabled={disabled} title={disabled ? tr("Aktifkan pegawai sebelum membuat akun login") : undefined}>
          <KeyRound className="h-3.5 w-3.5" />
          {tr("Buatkan Akun")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Buat Akun Login")}</DialogTitle>
          <DialogDescription>
            {tr("Akun ini akan tertaut ke pegawai ")}<b>{employeeName}</b> {tr(" dan bisa dipakai untuk login ke sistem.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="acc-name">{tr("Nama Tampilan")}</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-email">{tr("Email Login")}</Label>
            <Input
              id="acc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@yayasan.id"
            />
          </div>
          <div className="space-y-2">
            <Label>{tr("Role Akses")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder={tr("Pilih role")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  {tr("Pilih role")}</SelectItem>
                {roleOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {tr(o.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-password">{tr("Password Awal")}</Label>
            <Input
              id="acc-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tr("Minimal 8 karakter")}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {tr("Batal")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              name.trim().length < 2 ||
              !email.includes("@") ||
              role === NONE ||
              password.length < 8
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Membuat...")}</>
            ) : (
              tr("Buat Akun")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const __roleLabel = roleLabel;
const __roleOptions = roleOptions;
