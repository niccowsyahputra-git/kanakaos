"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";

import { createUser, updateUser } from "@/lib/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "SOCIAL_WORKER", label: "Pekerja Sosial" },
  { value: "CAREGIVER", label: "Pengasuh" },
  { value: "VOLUNTEER", label: "Relawan" },
  { value: "FINANCE", label: "Bendahara" },
  { value: "LOGISTICS", label: "Logistik" },
];

type EditableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/**
 * Dialog tambah/edit user.
 * - Tanpa prop `user`  -> mode tambah (email + password wajib)
 * - Dengan prop `user` -> mode edit (email readonly, password opsional)
 */
export function UserDialog({ user }: { user?: EditableUser }) {
  const isEdit = Boolean(user);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "");
  const [isPending, startTransition] = useTransition();

  // Reset field setiap kali dialog dibuka ulang
  useEffect(() => {
    if (open) {
      setName(user?.name ?? "");
      setEmail(user?.email ?? "");
      setPassword("");
      setRole(user?.role ?? "");
    }
  }, [open, user]);

  function handleSubmit() {
    startTransition(async () => {
      const result = isEdit
        ? await updateUser({
            id: user!.id,
            name,
            role: role as "SUPER_ADMIN",
            password,
          })
        : await createUser({
            name,
            email,
            password,
            role: role as "SUPER_ADMIN",
          });

      if (result.success) {
        toast.success(isEdit ? "User diperbarui" : "User berhasil dibuat");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  const submitDisabled =
    isPending ||
    name.trim().length < 3 ||
    !role ||
    (!isEdit && (!email || password.length < 8)) ||
    (isEdit && password.length > 0 && password.length < 8);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit {user!.name}</span>
          </Button>
        ) : (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Tambah User
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Tambah User"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ubah nama, role, atau reset password user."
              : "Buat akun untuk staff/relawan panti."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Nama Lengkap</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama user"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@kanakaos.id"
              autoComplete="off"
              disabled={isEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">
              {isEdit ? "Password Baru (opsional)" : "Password"}
            </Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isEdit ? "Kosongkan jika tidak diganti" : "Minimal 8 karakter"
              }
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitDisabled}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : isEdit ? (
              "Simpan Perubahan"
            ) : (
              "Buat User"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
