import type { IncidentType, IncidentUrgency, IncidentStatus } from "@prisma/client";

export const incidentTypeLabel: Record<IncidentType, string> = {
  HEALTH: "Kesehatan",
  BEHAVIOR: "Perilaku",
  ACCIDENT: "Kecelakaan",
  OTHER: "Lainnya",
};

export const incidentStatusLabel: Record<IncidentStatus, string> = {
  OPEN: "Baru",
  IN_PROGRESS: "Masih Berjalan",
  RESOLVED: "Selesai",
};

export const incidentStatusClass: Record<IncidentStatus, string> = {
  OPEN: "border-transparent bg-red-100 text-red-800",
  IN_PROGRESS: "border-transparent bg-blue-100 text-blue-800",
  RESOLVED: "border-transparent bg-green-100 text-green-800",
};

export const incidentUrgencyLabel: Record<IncidentUrgency, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
};

export const incidentUrgencyClass: Record<IncidentUrgency, string> = {
  LOW: "border-transparent bg-gray-100 text-gray-600",
  MEDIUM: "border-transparent bg-yellow-100 text-yellow-800",
  HIGH: "border-transparent bg-orange-100 text-orange-800",
  CRITICAL: "border-transparent bg-red-100 text-red-800",
};
