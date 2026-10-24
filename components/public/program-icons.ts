import {
  Baby,
  BookOpen,
  GraduationCap,
  HandHeart,
  Heart,
  Home,
  Shield,
  Smile,
  Sparkles,
  Stethoscope,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { ProgramIconKey } from "@/lib/site-content";

export const PROGRAM_ICONS: Record<
  ProgramIconKey,
  { icon: LucideIcon; label: string }
> = {
  graduation: { icon: GraduationCap, label: "Pendidikan" },
  health: { icon: Stethoscope, label: "Kesehatan" },
  home: { icon: Home, label: "Rumah" },
  handHeart: { icon: HandHeart, label: "Tangan & Hati" },
  heart: { icon: Heart, label: "Hati" },
  users: { icon: Users, label: "Komunitas" },
  book: { icon: BookOpen, label: "Buku" },
  food: { icon: Utensils, label: "Makanan" },
  baby: { icon: Baby, label: "Anak" },
  shield: { icon: Shield, label: "Perlindungan" },
  smile: { icon: Smile, label: "Keceriaan" },
  sparkles: { icon: Sparkles, label: "Kreativitas" },
};
