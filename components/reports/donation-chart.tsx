"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/utils";

export type MonthlyDonationPoint = {
  month: string;
  total: number;
};

export function DonationChart({ data }: { data: MonthlyDonationPoint[] }) {
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
            formatter={(value) => [formatRupiah(Number(value)), "Donasi"]}
            labelClassName="font-medium"
          />
          <Bar
            dataKey="total"
            fill="hsl(221.2 83.2% 53.3%)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
