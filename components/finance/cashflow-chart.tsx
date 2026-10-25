"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";


export type CashflowPoint = {
  month: string;
  masuk: number;
  keluar: number;
};

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const { tr, locale } = useI18n();

  return (
    <div className="h-64 w-full md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={70}
            tickFormatter={(value: number) =>
              value >= 1_000_000
                ? tr("{0}jt", { "0": (value / 1_000_000).toLocaleString((locale === "en" ? "en-US" : "id-ID")) })
                : value >= 1000
                  ? tr("{0}rb", { "0": (value / 1000).toLocaleString((locale === "en" ? "en-US" : "id-ID")) })
                  : String(value)
            }
          />
          <Tooltip
            formatter={(value, name) => [
              formatRupiah(Number(value), locale),
              name === "masuk" ? tr("Kas Masuk") : tr("Kas Keluar"),
            ]}
          />
          <Legend
            formatter={(value) => (value === "masuk" ? tr("Kas Masuk") : tr("Kas Keluar"))}
          />
          <Bar dataKey="masuk" fill="#16a34a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="keluar" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
