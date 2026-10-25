import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatRupiah } from "@/lib/utils";
import { createTranslator } from "@/lib/i18n/translate";
import { intlTags, type Locale } from "@/lib/i18n/config";

export type ReportData = {
  title: string;
  periodLabel: string;
  yayasanName: string;
  generatedBy: string;
  generatedAt: Date;
  stats: {
    totalChildren: number;
    activeChildren: number;
    totalDonations: number;
    donationCount: number;
    activeVolunteers: number;
    dailyLogCount: number;
  };
  donations: {
    receiptNumber: string;
    donaturName: string;
    amount: number;
    date: Date;
  }[];
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 10,
    marginBottom: 16,
  },
  yayasan: { fontSize: 9, color: "#6b7280", marginBottom: 4 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  period: { fontSize: 11, color: "#374151", marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 8,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statBox: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 8,
  },
  statLabel: { fontSize: 8, color: "#6b7280" },
  statValue: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    borderBottomWidth: 1,
    borderBottomColor: "#bfdbfe",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  colNo: { width: "22%", fontSize: 8 },
  colName: { width: "38%", fontSize: 8 },
  colDate: { width: "18%", fontSize: 8 },
  colAmount: { width: "22%", fontSize: 8, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: "#eff6ff",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#9ca3af",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
});

function formatDateId(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTags[locale], { dateStyle: "medium" }).format(date);
}

export function ReportPdf({ data, locale = "id" }: { data: ReportData; locale?: Locale }) {
  const tr = createTranslator(locale);
  const totalAmount = data.donations.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Document title={data.title} author={data.yayasanName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.yayasan}>{data.yayasanName}</Text>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.period}>{tr("Periode:")} {data.periodLabel}</Text>
        </View>

        <Text style={styles.sectionTitle}>{tr("Ringkasan")}</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{tr("Total Anak Asuh")}</Text>
            <Text style={styles.statValue}>{data.stats.totalChildren}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{tr("Anak Aktif")}</Text>
            <Text style={styles.statValue}>{data.stats.activeChildren}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{tr("Relawan Aktif")}</Text>
            <Text style={styles.statValue}>{data.stats.activeVolunteers}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{tr("Jumlah Donasi")}</Text>
            <Text style={styles.statValue}>{data.stats.donationCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{tr("Total Donasi")}</Text>
            <Text style={styles.statValue}>
              {formatRupiah(data.stats.totalDonations, locale)}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{tr("Log Harian Tercatat")}</Text>
            <Text style={styles.statValue}>{data.stats.dailyLogCount}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {tr("Rincian Donasi")} ({data.donations.length} {tr("transaksi")})
        </Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.colNo, styles.bold]}>{tr("No. Kwitansi")}</Text>
          <Text style={[styles.colName, styles.bold]}>{tr("Donatur")}</Text>
          <Text style={[styles.colDate, styles.bold]}>{tr("Tanggal")}</Text>
          <Text style={[styles.colAmount, styles.bold]}>{tr("Jumlah")}</Text>
        </View>
        {data.donations.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={{ fontSize: 8, color: "#6b7280" }}>
              {tr("Tidak ada donasi pada periode ini.")}
            </Text>
          </View>
        ) : (
          data.donations.map((donation) => (
            <View key={donation.receiptNumber} style={styles.tableRow} wrap={false}>
              <Text style={styles.colNo}>{donation.receiptNumber}</Text>
              <Text style={styles.colName}>{donation.donaturName}</Text>
              <Text style={styles.colDate}>{formatDateId(donation.date, locale)}</Text>
              <Text style={styles.colAmount}>
                {formatRupiah(donation.amount, locale)}
              </Text>
            </View>
          ))
        )}
        <View style={styles.totalRow}>
          <Text style={[styles.colNo, styles.bold]}>TOTAL</Text>
          <Text style={styles.colName} />
          <Text style={styles.colDate} />
          <Text style={[styles.colAmount, styles.bold]}>
            {formatRupiah(totalAmount, locale)}
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          {tr("Dibuat oleh")} {data.generatedBy} {tr("pada")} {formatDateId(data.generatedAt, locale)}{" "}
          — {tr("Dokumen ini digenerate otomatis oleh sistem KanakaOS.")}
        </Text>
      </Page>
    </Document>
  );
}
