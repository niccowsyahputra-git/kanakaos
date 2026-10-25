"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";


export function LogoutButton() {
  const { tr, locale } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full justify-start gap-2 md:w-auto md:justify-center"
    >
      <LogOut className="h-4 w-4" />
      <span>{tr("Keluar")}</span>
    </Button>
  );
}
