import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { numberToWords, formatRupiah } from "@/lib/utils";

export type ReceiptItem = {
  itemName: string;
  quantity: number;
  unit: string;
};

export type ReceiptData = {
  receiptNumber: string;
  donaturName: string;
  donaturContact?: string | null;
  amount: number;
  type: "CASH" | "TRANSFER" | "IN_KIND";
  /** Label kategori dana (Zakat Maal, Infaq, dll) */
  categoryLabel?: string;
  purpose?: string | null;
  date: Date;
  /** Rincian barang (khusus donasi IN_KIND) */
  items?: ReceiptItem[];
  /** Data URL QR code (digenerate dengan library `qrcode`) */
  qrCodeDataUrl: string;
};

const typeLabel: Record<ReceiptData["type"], string> = {
  CASH: "Tunai",
  TRANSFER: "Transfer Bank",
  IN_KIND: "Barang (In-Kind)",
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 12,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  yayasanName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
  },
  yayasanAddress: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
    maxWidth: 220,
  },
  receiptTitleBox: {
    alignItems: "flex-end",
  },
  receiptTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
  },
  receiptNumber: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
  },
  // Body rows
  row: {
    flexDirection: "row",
    marginBottom: 10,
  },
  label: {
    width: 110,
    color: "#6b7280",
  },
  colon: {
    width: 10,
  },
  value: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  amountBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
    padding: 12,
    marginVertical: 10,
  },
  amountValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1d4ed8",
  },
  amountWords: {
    fontSize: 9,
    fontStyle: "italic",
    color: "#374151",
    marginTop: 4,
  },
  // Footer
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 28,
  },
  qrBox: {
    alignItems: "center",
  },
  qrImage: {
    width: 72,
    height: 72,
  },
  qrCaption: {
    fontSize: 7,
    color: "#6b7280",
    marginTop: 4,
  },
  signatureBox: {
    alignItems: "center",
    width: 150,
  },
  signatureDate: {
    marginBottom: 6,
  },
  signaturePlaceholder: {
    width: 110,
    height: 50,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  signaturePlaceholderText: {
    fontSize: 7,
    color: "#9ca3af",
  },
  signatureName: {
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
  },
  signatureRole: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
  },
  thanksNote: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
});

function formatDateId(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function ReceiptPdf({ data }: { data: ReceiptData }) {
  const isInKind = data.type === "IN_KIND";

  return (
    <Document
      title={`Kwitansi ${data.receiptNumber}`}
      author="Yayasan Kanaka"
    >
      {/* A5 landscape: ukuran kwitansi umum, hemat kertas */}
      <Page size="A5" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* Logo placeholder (diganti gambar asli di Phase 6) */}
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>K</Text>
            </View>
            <View>
              <Text style={styles.yayasanName}>Yayasan Kanaka</Text>
              <Text style={styles.yayasanAddress}>
                Jl. Melati No. 10, Denpasar, Bali — Telp. (0361) 555-0101 —
                kanakaos.id
              </Text>
            </View>
          </View>
          <View style={styles.receiptTitleBox}>
            <Text style={styles.receiptTitle}>KWITANSI</Text>
            <Text style={styles.receiptNumber}>No: {data.receiptNumber}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.row}>
          <Text style={styles.label}>Telah terima dari</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>
            {data.donaturName}
            {data.donaturContact ? ` (${data.donaturContact})` : ""}
          </Text>
        </View>

        <View style={styles.amountBox}>
          {isInKind && data.items && data.items.length > 0 ? (
            <>
              <Text style={{ color: "#6b7280", fontSize: 8, marginBottom: 3 }}>
                Rincian donasi barang
              </Text>
              {data.items.map((item, index) => (
                <Text
                  key={index}
                  style={{ fontSize: 10, marginBottom: 2, color: "#111827" }}
                >
                  {index + 1}. {item.itemName} — {item.quantity} {item.unit}
                </Text>
              ))}
            </>
          ) : (
            <>
              <Text style={{ color: "#6b7280", fontSize: 8, marginBottom: 2 }}>
                {isInKind ? "Nilai taksiran donasi barang" : "Uang sejumlah"}
              </Text>
              <Text style={styles.amountValue}>{formatRupiah(data.amount)}</Text>
              <Text style={styles.amountWords}>
                Terbilang: {numberToWords(data.amount)}
              </Text>
            </>
          )}
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Untuk</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>
            {data.purpose || "Donasi operasional panti asuhan"}
          </Text>
        </View>

        {data.categoryLabel && (
          <View style={styles.row}>
            <Text style={styles.label}>Kategori Dana</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{data.categoryLabel}</Text>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>Metode</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{typeLabel[data.type]}</Text>
        </View>

        {/* Footer: QR verifikasi + tanda tangan donatur & yayasan */}
        <View style={styles.footer}>
          <View style={styles.qrBox}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={styles.qrImage} src={data.qrCodeDataUrl} />
            <Text style={styles.qrCaption}>Scan untuk verifikasi kwitansi</Text>
          </View>

          {/* Tanda tangan donatur */}
          <View style={styles.signatureBox}>
            <Text style={styles.signatureDate}> </Text>
            <View style={styles.signaturePlaceholder}>
              <Text style={styles.signaturePlaceholderText}>
                Tanda Tangan Donatur
              </Text>
            </View>
            <Text style={styles.signatureName}>{data.donaturName}</Text>
            <Text style={styles.signatureRole}>Donatur</Text>
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureDate}>
              Denpasar, {formatDateId(data.date)}
            </Text>
            {/* Placeholder tanda tangan (gambar asli di Phase 6) */}
            <View style={styles.signaturePlaceholder}>
              <Text style={styles.signaturePlaceholderText}>
                Tanda Tangan & Stempel
              </Text>
            </View>
            <Text style={styles.signatureName}>Bendahara Yayasan</Text>
            <Text style={styles.signatureRole}>Yayasan Kanaka</Text>
          </View>
        </View>

        <Text style={styles.thanksNote}>
          Terima kasih atas kepercayaan dan kebaikan Anda. Kwitansi ini sah
          dibuat secara elektronik oleh sistem KanakaOS.
        </Text>
      </Page>
    </Document>
  );
}
