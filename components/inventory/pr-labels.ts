import type { PRStatus } from "@prisma/client";

export const prStatusLabel: Record<PRStatus, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  ORDERED: "Dipesan",
  RECEIVED: "Diterima",
};

export const prStatusClass: Record<PRStatus, string> = {
  PENDING: "border-transparent bg-yellow-100 text-yellow-800",
  APPROVED: "border-transparent bg-blue-100 text-blue-800",
  REJECTED: "border-transparent bg-red-100 text-red-800",
  ORDERED: "border-transparent bg-purple-100 text-purple-800",
  RECEIVED: "border-transparent bg-green-100 text-green-800",
};
