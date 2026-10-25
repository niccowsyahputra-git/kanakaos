"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";


const DONUT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

function rupiahTick(value: number, locale: Locale = "id") {
  const tr = createTranslator(locale);

  return value >= 1_000_000
    ? tr("{0}jt", { "0": (value / 1_000_000).toLocaleString(locale === "en" ? "en-US" : "id-ID") })
    : value >= 1000
      ? tr("{0}rb", { "0": (value / 1000).toLocaleString(locale === "en" ? "en-US" : "id-ID") })
      : String(value);
}

/** Donut distribusi tingkat pendidikan */
export function EducationDonut({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  const { tr, locale } = useI18n();

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        {tr("Belum ada data pendidikan.")}</div>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [tr("{0} anak", { "0": String(v) }), n]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Pie alokasi dompet dana: terikat vs tidak terikat */
export function FundAllocationPie({
  restricted,
  unrestricted,
}: {
  restricted: number;
  unrestricted: number;
}) {
  const { tr, locale } = useI18n();

  const data = [
    { label: tr("Dana Tidak Terikat (Operasional)"), value: unrestricted },
    { label: tr("Dana Terikat (Program)"), value: restricted },
  ];
  if (restricted + unrestricted === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        {tr("Belum ada saldo dana.")}</div>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={80}
            paddingAngle={2}
          >
            <Cell fill="#16a34a" />
            <Cell fill="#2563eb" />
          </Pie>
          <Tooltip formatter={(v, n) => [formatRupiah(Number(v), locale), n]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Line chart tren arus kas: pemasukan vs pengeluaran */
export function CashflowTrendChart({
  data,
}: {
  data: { month: string; masuk: number; keluar: number }[];
}) {
  const { tr, locale } = useI18n();

  return (
    <div className="h-64 w-full md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value) => rupiahTick(value, locale)}
          />
          <Tooltip
            formatter={(value, name) => [
              formatRupiah(Number(value), locale),
              name === "masuk" ? tr("Pemasukan") : tr("Pengeluaran"),
            ]}
          />
          <Legend
            formatter={(v) => (v === "masuk" ? tr("Pemasukan") : tr("Pengeluaran"))}
          />
          <Line
            type="monotone"
            dataKey="masuk"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="keluar"
            stroke="#dc2626"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bar akuisisi donatur baru per bulan */
export function DonorAcquisitionChart({
  data,
}: {
  data: { month: string; count: number }[];
}) {
  const { tr, locale } = useI18n();

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip formatter={(v) => [tr("{0} donatur", { "0": String(v) }), tr("Donatur Baru")]} />
          <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Area tren emosional mingguan (rata-rata mood 1-5) */
export function MoodTrendChart({
  data,
}: {
  data: { day: string; avg: number }[];
}) {
  const { tr, locale } = useI18n();

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 5]}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={24}
          />
          <Tooltip
            formatter={(v) => [`${v} / 5`, tr("Rata-rata mood")]}
          />
          <Area
            type="monotone"
            dataKey="avg"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#moodFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
