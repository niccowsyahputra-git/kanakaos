import { prisma } from "@/lib/prisma";
import { getT } from "@/lib/i18n/server";
import {
  getUnrestrictedBalance,
  getProgramBalances,
  fundraisingProgramWhere,
} from "@/lib/finance-balance";
import type { EducationLevel } from "@prisma/client";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Ags",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function startOfMonth(offset = 0) {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + offset, 1);
}

// ==================== 1. OPERASIONAL ANAK ====================

export type OperationalData = {
  totalActive: number;
  male: number;
  female: number;
  sickToday: number;
  education: { level: string; label: string; count: number }[];
  attendanceAlerts: {
    childName: string;
    reason: string;
  }[];
  moodTrend: { day: string; avg: number }[];
  atRiskChildren: { id: string; name: string; lowCount: number }[];
  graduatingSoon: { id: string; name: string; grade: string }[];
};

const EDUCATION_LABEL: Record<EducationLevel, string> = {
  BELUM_SEKOLAH: "Belum Sekolah",
  PAUD_TK: "PAUD/TK",
  SD: "SD",
  SMP: "SMP",
  SMA_SMK: "SMA/SMK",
  PERGURUAN_TINGGI: "Kuliah",
};

const ATTENDANCE_REASON: Record<string, string> = {
  BOLOS: "Bolos (tanpa keterangan)",
  IZIN: "Izin",
  SAKIT: "Sakit",
};

export async function getOperationalData(): Promise<OperationalData> {
  const { tr } = await getT();
  const todayStart = startOfToday();
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const [
    genderGroups,
    sickTodayLogs,
    eduGroups,
    alertLogs,
    weekLogs,
    activeChildren,
  ] = await Promise.all([
    prisma.child.groupBy({
      by: ["gender"],
      where: { status: "ACTIVE" },
      _count: true,
    }),
    prisma.dailyLog.findMany({
      where: { date: { gte: todayStart }, schoolAttendance: "SAKIT" },
      select: { childId: true },
      distinct: ["childId"],
    }),
    prisma.child.groupBy({
      by: ["lastEducation"],
      where: { status: "ACTIVE" },
      _count: true,
    }),
    prisma.dailyLog.findMany({
      where: {
        date: { gte: todayStart },
        schoolAttendance: { in: ["BOLOS", "IZIN", "SAKIT"] },
      },
      select: {
        schoolAttendance: true,
        child: { select: { fullName: true } },
      },
      orderBy: { child: { fullName: "asc" } },
    }),
    prisma.dailyLog.findMany({
      where: { date: { gte: weekAgo } },
      select: { date: true, moodScore: true, childId: true, child: { select: { fullName: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.child.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, fullName: true, lastEducation: true, lastGrade: true },
    }),
  ]);

  const male = genderGroups.find((g) => g.gender === "MALE")?._count ?? 0;
  const female = genderGroups.find((g) => g.gender === "FEMALE")?._count ?? 0;
  const totalActive = male + female;

  const education = eduGroups
    .filter((g) => g.lastEducation)
    .map((g) => ({
      level: g.lastEducation as string,
      label: tr(EDUCATION_LABEL[g.lastEducation as EducationLevel]),
      count: g._count,
    }))
    .sort((a, b) => b.count - a.count);

  const attendanceAlerts = alertLogs.map((l) => ({
    childName: l.child.fullName,
    reason: tr(ATTENDANCE_REASON[l.schoolAttendance ?? ""] ?? "-"),
  }));

  // Tren emosional mingguan: rata-rata mood per hari (7 hari terakhir)
  const dayBuckets = new Map<string, { sum: number; n: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekAgo);
    d.setDate(d.getDate() + i);
    dayBuckets.set(d.toISOString().slice(0, 10), { sum: 0, n: 0 });
  }
  for (const log of weekLogs) {
    const key = log.date.toISOString().slice(0, 10);
    const b = dayBuckets.get(key);
    if (b) {
      b.sum += log.moodScore;
      b.n += 1;
    }
  }
  const moodTrend = Array.from(dayBuckets.entries()).map(([key, b]) => {
    const d = new Date(key);
    return {
      day: `${d.getDate()}/${d.getMonth() + 1}`,
      avg: b.n > 0 ? Math.round((b.sum / b.n) * 10) / 10 : 0,
    };
  });

  // Anak berisiko: log berturut-turut moodScore <= 2 (murung/menyendiri)
  const perChild = new Map<
    string,
    { name: string; logs: { date: Date; mood: number }[] }
  >();
  for (const log of weekLogs) {
    if (!perChild.has(log.childId)) {
      perChild.set(log.childId, { name: log.child.fullName, logs: [] });
    }
    perChild.get(log.childId)!.logs.push({ date: log.date, mood: log.moodScore });
  }
  const atRiskChildren: OperationalData["atRiskChildren"] = [];
  for (const [id, data] of perChild.entries()) {
    const sorted = data.logs.sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
    let streak = 0;
    for (const l of sorted) {
      if (l.mood <= 2) streak++;
      else break;
    }
    if (streak >= 2) {
      atRiskChildren.push({ id, name: data.name, lowCount: streak });
    }
  }
  atRiskChildren.sort((a, b) => b.lowCount - a.lowCount);

  // Kandidat lulus tahun ini (heuristik dari jenjang & kelas)
  const graduatingSoon = activeChildren
    .filter((c) => {
      const grade = (c.lastGrade ?? "").toLowerCase();
      const isFinalSchool =
        c.lastEducation === "SMA_SMK" &&
        (grade.includes("12") || grade.includes("xii") || grade.includes("3"));
      const isFinalUni =
        c.lastEducation === "PERGURUAN_TINGGI" &&
        (grade.includes("akhir") || grade.includes("8") || grade.includes("7"));
      return isFinalSchool || isFinalUni;
    })
    .map((c) => ({
      id: c.id,
      name: c.fullName,
      grade: c.lastGrade ?? "-",
    }));

  return {
    totalActive,
    male,
    female,
    sickToday: sickTodayLogs.length,
    education,
    attendanceAlerts,
    moodTrend,
    atRiskChildren: atRiskChildren.slice(0, 8),
    graduatingSoon,
  };
}

// ==================== 2. FINANSIAL STRATEGIS ====================

export type FinancialData = {
  unrestrictedBalance: number;
  avgMonthlyExpense: number;
  runwayMonths: number | null; // null = tak terhingga (belum ada pengeluaran)
  restrictedTotal: number;
  unrestrictedTotal: number;
  cashflow: { month: string; masuk: number; keluar: number }[];
};

export async function getFinancialData(): Promise<FinancialData> {
  const { tr } = await getT();
  const unrestrictedBalance = await getUnrestrictedBalance();

  // Rata-rata pengeluaran operasional (tidak terikat) 6 bulan terakhir
  const sixMonthsAgo = startOfMonth(-5);
  const opExpenses = await prisma.financeExpense.aggregate({
    where: { pocket: "TIDAK_TERIKAT", programId: null, date: { gte: sixMonthsAgo } },
    _sum: { amount: true },
  });
  const avgMonthlyExpense = (opExpenses._sum.amount ?? 0) / 6;
  const runwayMonths =
    avgMonthlyExpense > 0
      ? Math.round((unrestrictedBalance / avgMonthlyExpense) * 10) / 10
      : null;

  // Alokasi dompet dana
  const programBalances = await getProgramBalances();
  const restrictedTotal = programBalances.reduce(
    (sum, p) => sum + Math.max(0, p.balance),
    0
  );
  const unrestrictedTotal = Math.max(0, unrestrictedBalance);

  // Tren arus kas tahun berjalan (Jan s/d bulan ini)
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const [incomes, expenses] = await Promise.all([
    prisma.financeIncome.findMany({
      where: { verification: "VERIFIED", date: { gte: yearStart } },
      select: { date: true, amount: true },
    }),
    prisma.financeExpense.findMany({
      where: { date: { gte: yearStart } },
      select: { date: true, amount: true },
    }),
  ]);
  const cashflow = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    const masuk = incomes
      .filter((i) => i.date.getMonth() === m)
      .reduce((s, i) => s + i.amount, 0);
    const keluar = expenses
      .filter((e) => e.date.getMonth() === m)
      .reduce((s, e) => s + e.amount, 0);
    cashflow.push({ month: tr(MONTH_LABELS[m]), masuk, keluar });
  }

  return {
    unrestrictedBalance,
    avgMonthlyExpense,
    runwayMonths,
    restrictedTotal,
    unrestrictedTotal,
    cashflow,
  };
}

// ==================== 3. PROGRAM & DONATUR ====================

export type ProgramDonorData = {
  programs: {
    id: string;
    code: string;
    name: string;
    raised: number;
    target: number;
    percent: number;
  }[];
  totalDonors: number;
  activeDonors: number;
  passiveDonors: { id: string; name: string; phone: string | null }[];
  acquisition: { month: string; count: number }[];
};

export async function getProgramDonorData(): Promise<ProgramDonorData> {
  const { tr } = await getT();
  const monthStart = startOfMonth();

  const [activePrograms, incomesByProgram, donors, monthIncomes, yearDonors] =
    await Promise.all([
      prisma.program.findMany({
        where: { ...fundraisingProgramWhere, status: { in: ["AKTIF", "PENYALURAN"] } },
        select: { id: true, code: true, name: true, fundraisingTarget: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.financeIncome.groupBy({
        by: ["programId"],
        where: { verification: "VERIFIED", programId: { not: null } },
        _sum: { amount: true },
      }),
      prisma.donor.findMany({
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
      }),
      prisma.financeIncome.findMany({
        where: {
          verification: "VERIFIED",
          donorId: { not: null },
          date: { gte: monthStart },
        },
        select: { donorId: true },
        distinct: ["donorId"],
      }),
      prisma.donor.findMany({
        where: { createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) } },
        select: { createdAt: true },
      }),
    ]);

  const raisedMap = new Map(
    incomesByProgram.map((i) => [i.programId, i._sum.amount ?? 0])
  );
  const programs = activePrograms.map((p) => {
    const raised = raisedMap.get(p.id) ?? 0;
    const target = p.fundraisingTarget;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      raised,
      target,
      percent: target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0,
    };
  });

  const activeDonorIds = new Set(monthIncomes.map((i) => i.donorId));
  const activeDonors = activeDonorIds.size;
  const passiveDonors = donors
    .filter((d) => !activeDonorIds.has(d.id))
    .map((d) => ({ id: d.id, name: d.name, phone: d.phone }));

  // Akuisisi donatur baru per bulan tahun berjalan
  const now = new Date();
  const acquisition = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    const count = yearDonors.filter(
      (d) => d.createdAt.getMonth() === m
    ).length;
    acquisition.push({ month: tr(MONTH_LABELS[m]), count });
  }

  return {
    programs,
    totalDonors: donors.length,
    activeDonors,
    passiveDonors: passiveDonors.slice(0, 10),
    acquisition,
  };
}

// ==================== 4. COMPLIANCE & APPROVAL ====================

export type ComplianceData = {
  mouReminders: {
    id: string;
    name: string;
    type: string;
    expiry: Date;
    daysLeft: number;
  }[];
  approvalQueue: {
    id: string;
    voucherNumber: string;
    amount: number;
    coa: string;
    beneficiary: string;
    programName: string | null;
  }[];
};

export async function getComplianceData(): Promise<ComplianceData> {
  const now = new Date();
  const in90Days = new Date();
  in90Days.setDate(in90Days.getDate() + 90);

  const [partners, approvals] = await Promise.all([
    prisma.partner.findMany({
      where: { mouExpiryDate: { not: null, lte: in90Days } },
      orderBy: { mouExpiryDate: "asc" },
      select: { id: true, name: true, type: true, mouExpiryDate: true },
    }),
    prisma.financeExpense.findMany({
      where: { approval: "APPROVAL", amount: { gt: 1_000_000 } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        voucherNumber: true,
        amount: true,
        coa: true,
        beneficiaryName: true,
        beneficiaryChild: { select: { fullName: true } },
        program: { select: { name: true } },
      },
    }),
  ]);

  const mouReminders = partners
    .filter((p) => p.mouExpiryDate)
    .map((p) => {
      const expiry = p.mouExpiryDate as Date;
      const daysLeft = Math.ceil(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { id: p.id, name: p.name, type: p.type, expiry, daysLeft };
    });

  const approvalQueue = approvals.map((e) => ({
    id: e.id,
    voucherNumber: e.voucherNumber,
    amount: e.amount,
    coa: e.coa,
    beneficiary: e.beneficiaryChild?.fullName ?? e.beneficiaryName ?? "-",
    programName: e.program?.name ?? null,
  }));

  return { mouReminders, approvalQueue };
}
