"use server";

import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { ReportPdf, type ReportData } from "@/lib/report-pdf";

type ReportResult =
  | { success: true; fileName: string; contentBase64: string }
  | { success: false; error: string };

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

async function buildReport(
  rangeStart: Date,
  rangeEnd: Date,
  title: string,
  periodLabel: string,
  generatedBy: string
): Promise<Buffer> {
  const yayasanName =
    (
      await prisma.systemConfig.findUnique({
        where: { configKey: "YAYASAN_NAME" },
      })
    )?.configValue ?? "Yayasan Kanaka";

  const [totalChildren, activeChildren, donations, activeVolunteers, dailyLogCount] =
    await Promise.all([
      prisma.child.count(),
      prisma.child.count({ where: { status: "ACTIVE" } }),
      prisma.donation.findMany({
        where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.volunteer.count({ where: { status: "APPROVED" } }),
      prisma.dailyLog.count({
        where: { date: { gte: rangeStart, lt: rangeEnd } },
      }),
    ]);

  const data: ReportData = {
    title,
    periodLabel,
    yayasanName,
    generatedBy,
    generatedAt: new Date(),
    stats: {
      totalChildren,
      activeChildren,
      totalDonations: donations.reduce(
        (sum, d) => sum + Number(d.amount),
        0
      ),
      donationCount: donations.length,
      activeVolunteers,
      dailyLogCount,
    },
    donations: donations.map((d) => ({
      receiptNumber: d.receiptNumber,
      donaturName: d.donaturName,
      amount: Number(d.amount),
      date: d.createdAt,
    })),
  };

  return renderToBuffer(
    createElement(ReportPdf, { data }) as ReactElement<DocumentProps>
  );
}

export async function generateMonthlyReport(
  year: number,
  month: number // 1-12
): Promise<ReportResult> {
  const session = await requireSuperAdminSession();
  if (!session) {
    return { success: false, error: "Hanya Super Admin yang boleh membuat laporan" };
  }

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { success: false, error: "Periode laporan tidak valid" };
  }

  try {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

    const buffer = await buildReport(
      start,
      end,
      "Laporan Bulanan",
      periodLabel,
      session.user.name ?? "Admin"
    );

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Report",
      detail: `Generate laporan bulanan ${periodLabel}`,
    });

    return {
      success: true,
      fileName: `laporan-bulanan-${year}-${String(month).padStart(2, "0")}.pdf`,
      contentBase64: buffer.toString("base64"),
    };
  } catch (error) {
    console.error("generateMonthlyReport error:", error);
    return { success: false, error: "Gagal membuat laporan bulanan" };
  }
}

export async function generateAnnualReport(year: number): Promise<ReportResult> {
  const session = await requireSuperAdminSession();
  if (!session) {
    return { success: false, error: "Hanya Super Admin yang boleh membuat laporan" };
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { success: false, error: "Tahun laporan tidak valid" };
  }

  try {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const buffer = await buildReport(
      start,
      end,
      "Laporan Tahunan",
      `Tahun ${year}`,
      session.user.name ?? "Admin"
    );

    await logAudit({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "CREATE",
      entity: "Report",
      detail: `Generate laporan tahunan ${year}`,
    });

    return {
      success: true,
      fileName: `laporan-tahunan-${year}.pdf`,
      contentBase64: buffer.toString("base64"),
    };
  } catch (error) {
    console.error("generateAnnualReport error:", error);
    return { success: false, error: "Gagal membuat laporan tahunan" };
  }
}
