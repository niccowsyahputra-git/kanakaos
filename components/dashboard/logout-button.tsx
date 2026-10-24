"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full justify-start gap-2 md:w-auto md:justify-center"
    >
      <LogOut className="h-4 w-4" />
      <span>Keluar</span>
    </Button>
  );
}
