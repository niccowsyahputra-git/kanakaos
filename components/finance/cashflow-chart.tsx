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

export type CashflowPoint = {
  month: string;
  masuk: number;
  keluar: number;
};

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
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
                ? `${(value / 1_000_000).toLocaleString("id-ID")}jt`
                : value >= 1000
                  ? `${(value / 1000).toLocaleString("id-ID")}rb`
                  : String(value)
            }
          />
          <Tooltip
            formatter={(value, name) => [
              formatRupiah(Number(value)),
              name === "masuk" ? "Kas Masuk" : "Kas Keluar",
            ]}
          />
          <Legend
            formatter={(value) => (value === "masuk" ? "Kas Masuk" : "Kas Keluar")}
          />
          <Bar dataKey="masuk" fill="#16a34a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="keluar" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
