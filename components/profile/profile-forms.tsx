"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, KeyRound } from "lucide-react";

import { updateProfile, changePassword } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  user,
}: {
  user: {
    name: string;
    email: string;
    phone: string | null;
    photoUrl: string | null;
    roleLabel: string;
  };
}) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("phone", phone);
      const photo = photoRef.current?.files?.[0];
      if (photo) formData.set("photo", photo);

      const result = await updateProfile(formData);
      if (result.success) {
        if (result.warning) {
          toast.warning("Profil tersimpan", { description: result.warning });
        } else {
          toast.success("Profil berhasil diperbarui");
        }
        if (photoRef.current) photoRef.current.value = "";
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Data Profil</CardTitle>
        <CardDescription>
          Nama & email dikelola oleh Super Admin. Anda bisa mengubah nomor HP
          dan foto profil.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {user.photoUrl ? (
            <Image
              src={user.photoUrl}
              alt={user.name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {user.name[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.roleLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="profile-name">Nama</Label>
            <Input id="profile-name" value={user.name} disabled readOnly />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user.email} disabled readOnly />
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="profile-phone">Nomor HP</Label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              inputMode="tel"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="profile-photo">Foto Profil (maks 3MB)</Label>
            <Input
              id="profile-photo"
              ref={photoRef}
              type="file"
              accept="image/*"
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full md:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan Perubahan
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await changePassword({
        oldPassword,
        newPassword,
        confirmPassword,
      });
      if (result.success) {
        toast.success("Password berhasil diganti");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          Ubah Password
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="old-password">Password Lama</Label>
          <Input
            id="old-password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="new-password">Password Baru</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              autoComplete="new-password"
            />
          </div>
          <div className="w-full space-y-2 md:w-1/2">
            <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <p className="text-xs text-destructive">
            Konfirmasi password tidak sama.
          </p>
        )}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleSubmit}
            disabled={
              isPending ||
              !oldPassword ||
              newPassword.length < 8 ||
              newPassword !== confirmPassword
            }
            className="w-full md:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mengganti...
              </>
            ) : (
              "Ganti Password"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
