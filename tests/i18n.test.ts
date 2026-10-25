import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { z } from "zod";
import React, { type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { ReceiptPdf, type ReceiptData } from "../lib/receipt-pdf";
import { ReportPdf, type ReportData } from "../lib/report-pdf";
import { defaultLocale, isLocale, locales } from "../lib/i18n/config";
import { id } from "../lib/i18n/locales/id";
import { en } from "../lib/i18n/locales/en";
import { messages } from "../lib/i18n/sections/messages";
import { createTranslator, localizeLabels } from "../lib/i18n/translate";
import { notificationMessage, translateNotification } from "../lib/i18n/notification";
import { getSchemas } from "../lib/validations";
import { formatDate } from "../lib/i18n/format";
import { formatRupiah, numberToWords } from "../lib/utils";

const trId = createTranslator("id");
const trEn = createTranslator("en");
const placeholders = (value: string) => [...new Set(value.match(/\{\w+\}/g) ?? [])].sort();

test("Indonesian is the default; unsupported cookies are rejected", () => {
  assert.equal(defaultLocale, "id");
  assert.deepEqual(locales, ["id", "en"]);
  for (const value of [undefined, null, "", "fr", "EN", "__proto__"]) assert.equal(isLocale(value), false);
  assert.equal(isLocale("id"), true);
  assert.equal(isLocale("en"), true);
});

test("all dictionary keys and interpolation parameters match", () => {
  function compare(left: object, right: object) {
    assert.deepEqual(Object.keys(left).sort(), Object.keys(right).sort());
    for (const key of Object.keys(left)) {
      const a = (left as Record<string, unknown>)[key];
      const b = (right as Record<string, unknown>)[key];
      if (typeof a === "string") {
        assert.equal(typeof b, "string");
        assert.ok((b as string).length > 0, key);
        assert.deepEqual(placeholders(a), placeholders(b as string), key);
      } else compare(a as object, b as object);
    }
  }
  compare(id, en);
  compare(messages.id, messages.en);
});

test("translation preserves spacing, unknown content and interpolation values", () => {
  assert.equal(trEn("  Simpan "), "  Save ");
  assert.equal(trId("  Simpan "), "  Simpan ");
  assert.equal(trEn("Custom user text <b>{name}</b>"), "Custom user text <b>{name}</b>");
  assert.equal(trEn("Insiden baru: {0}", { 0: "Budi {1} <script>" }), "New incident: Budi {1} <script>");
  assert.equal(trId("Insiden baru: {0}", { 0: "Budi" }), "Insiden baru: Budi");
  assert.equal(trEn("Insiden baru: Budi"), "New incident: Budi");
  assert.equal(trEn("toString"), "toString");
  assert.equal(trId("Approved"), "Disetujui");
});

test("display localization never mutates enum values or option identity", () => {
  const source = [{ value: "PENDIDIKAN", id: "id-1", label: "Pendidikan", href: "/donate", allowedRoles: ["SUPER_ADMIN"] }];
  const snapshot = JSON.stringify(source);
  const localized = localizeLabels(source, trEn);
  assert.equal(localized[0].label, "Education");
  assert.equal(localized[0].value, "PENDIDIKAN");
  assert.equal(localized[0].id, "id-1");
  assert.equal(localized[0].href, "/donate");
  assert.deepEqual(localized[0].allowedRoles, ["SUPER_ADMIN"]);
  assert.deepEqual(localizeLabels(["Mengajar", "Sabtu"], trEn), ["Mengajar", "Sabtu"]);
  assert.equal(JSON.stringify(source), snapshot);
});

test("schemas have isolated localized messages and identical canonical values", async () => {
  const idSchemas = getSchemas("id");
  const enSchemas = getSchemas("en");
  const before = z.string().safeParse(undefined);
  const readErrors = (locale: "id" | "en") => {
    const parsed = getSchemas(locale).childSchema.safeParse({ fullName: "A", gender: "INVALID", dob: "invalid" });
    assert.equal(parsed.success, false);
    return parsed.success ? [] : parsed.error.issues.map(issue => issue.message);
  };
  const [idErrors, enErrors] = await Promise.all([Promise.resolve(readErrors("id")), Promise.resolve(readErrors("en"))]);
  assert.ok(idErrors.includes("Nama minimal 3 karakter"));
  assert.ok(enErrors.some(message => message.includes("3 characters")));
  assert.deepEqual(readErrors("id"), idErrors);
  const after = z.string().safeParse(undefined);
  assert.ok(!before.success && !after.success);
  if (!before.success && !after.success) assert.deepEqual(after.error.issues, before.error.issues);
  const missing = idSchemas.childSchema.safeParse({});
  assert.ok(!missing.success && missing.error.issues.some(issue => issue.message === "Kolom ini wajib diisi"));
  const input = { fullName: "Simpan", dob: "2015-01-01", gender: "MALE", religion: "ISLAM", notes: "User-authored notes stay unchanged" };
  assert.deepEqual(idSchemas.childSchema.parse(input), enSchemas.childSchema.parse(input));
  const check = (a: z.ZodTypeAny, b: z.ZodTypeAny) => {
    assert.equal(a._def.typeName, b._def.typeName);
    if (a instanceof z.ZodEnum && b instanceof z.ZodEnum) assert.deepEqual(a.options, b.options);
    if (a instanceof z.ZodObject && b instanceof z.ZodObject) for (const key of Object.keys(a.shape)) check(a.shape[key], b.shape[key]);
    if (a instanceof z.ZodEffects && b instanceof z.ZodEffects) check(a.innerType(), b.innerType());
    if (a instanceof z.ZodOptional && b instanceof z.ZodOptional) check(a.unwrap(), b.unwrap());
    if (a instanceof z.ZodDefault && b instanceof z.ZodDefault) check(a.removeDefault(), b.removeDefault());
    if (a instanceof z.ZodArray && b instanceof z.ZodArray) check(a.element, b.element);
    if (a instanceof z.ZodUnion && b instanceof z.ZodUnion) a.options.forEach((item: z.ZodTypeAny, i: number) => check(item, b.options[i]));
  };
  for (const key of Object.keys(idSchemas) as (keyof typeof idSchemas)[]) check(idSchemas[key], enSchemas[key]);
});

test("dates and numbers follow locale while currency remains IDR", () => {
  assert.match(formatDate(new Date(2026, 9, 25), "id"), /Oktober/);
  assert.match(formatDate(new Date(2026, 9, 25), "en"), /October/);
  assert.match(formatRupiah(1500000, "id"), /1\.500\.000/);
  assert.match(formatRupiah(1500000, "en"), /1,500,000/);
  assert.equal(numberToWords(1500000, "id"), "Satu Juta Lima Ratus Ribu Rupiah");
  assert.equal(numberToWords(1500000, "en"), "One Million Five Hundred Thousand Rupiah");
  assert.equal(numberToWords(0, "en"), "Zero Rupiah");
  assert.equal(numberToWords(-21, "en"), "Minus Twenty-One Rupiah");
  assert.equal(numberToWords(1e12, "en"), "One Trillion Rupiah");
});

test("each notification recipient chooses language without translating user data", () => {
  const encoded = notificationMessage("⚠️ KRITIS — {0}", { 0: "Catatan dari Budi: Simpan" });
  assert.equal(translateNotification(encoded, trId), "⚠️ KRITIS — Catatan dari Budi: Simpan");
  assert.equal(translateNotification(encoded, trEn), "⚠️ CRITICAL — Catatan dari Budi: Simpan");
  assert.equal(translateNotification(notificationMessage("{0}", { 0: "Simpan" }), trEn), "Simpan");
  assert.equal(translateNotification("Insiden baru: Budi", trEn), "New incident: Budi");
  assert.equal(translateNotification("i18n:v1:bad-json", trEn), "i18n:v1:bad-json");
});

test("every explicit source message used by UI, actions and PDFs is cataloged", () => {
  const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const file = path.join(dir, item.name);
    return item.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
  const missing: string[] = [];
  for (const file of [...files("app"), ...files("components"), ...files("lib/actions"), "lib/receipt-pdf.tsx", "lib/report-pdf.tsx", "lib/ai-service.ts"]) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["tr", "notificationMessage"].includes(node.expression.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const value = node.arguments[0].text.replace(/\s+/g, " ").trim();
        if (!Object.hasOwn(messages.id, value)) missing.push(`${file}: ${value}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(missing, []);
});

test("receipts and reports render as PDFs in both languages", async () => {
  const receipt: ReceiptData = {
    receiptNumber: "TEST-RECEIPT", donaturName: "User-authored name", amount: 1500000,
    type: "CASH", purpose: "User-authored purpose", date: new Date(2026, 9, 25),
    qrCodeDataUrl: await QRCode.toDataURL("https://example.test/verify/TEST-RECEIPT"),
    yayasan: { name: "Foundation", address: "", email: "", phone: "", logoSrc: null },
  };
  const report: ReportData = {
    title: "Report", periodLabel: "2026", yayasanName: "Foundation", generatedBy: "Test User", generatedAt: receipt.date,
    stats: { totalChildren: 1, activeChildren: 1, totalDonations: 1500000, donationCount: 1, activeVolunteers: 1, dailyLogCount: 1 },
    donations: [{ receiptNumber: receipt.receiptNumber, donaturName: receipt.donaturName, amount: receipt.amount, date: receipt.date }],
  };
  function text(node: React.ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(text).join(" ");
    if (React.isValidElement<{ children?: React.ReactNode }>(node)) return text(node.props.children);
    return "";
  }
  for (const locale of locales) {
    const receiptElement = ReceiptPdf({ data: receipt, locale });
    const content = text(receiptElement);
    assert.match(content, locale === "id" ? /KWITANSI/ : /RECEIPT/);
    assert.ok(content.includes(numberToWords(receipt.amount, locale)));
    assert.ok(content.includes(receipt.donaturName));
    assert.ok(content.includes(receipt.purpose!));
    for (const element of [receiptElement, ReportPdf({ data: report, locale })]) {
      const buffer = await renderToBuffer(element as ReactElement<DocumentProps>);
      assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
      assert.ok(buffer.length > 1000);
    }
  }
});

const baseUrl = process.env.I18N_TEST_URL;
test("HTTP rendering respects default, both locales, and unsupported-cookie fallback", { skip: !baseUrl }, async () => {
  for (const [cookie, expected] of [["", "id"], ["en", "en"], ["id", "id"], ["fr", "id"]]) {
    const response = await fetch(`${baseUrl}/login`, { headers: cookie ? { Cookie: `NEXT_LOCALE=${cookie}` } : {} });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(`<html lang="${expected}"`));
    assert.ok(html.includes(expected === "en" ? "Orphanage Management System" : "Sistem Manajemen Panti Asuhan"));
  }
  for (const locale of locales) {
    for (const route of ["/", "/donate", "/volunteer/apply", "/donate/thanks", "/verify/I18N-TEST-NOTFOUND"]) {
      const response = await fetch(`${baseUrl}${route}`, { headers: { Cookie: `NEXT_LOCALE=${locale}` } });
      assert.equal(response.status, 200, route);
      const html = await response.text();
      assert.ok(html.includes(`<html lang="${locale}"`), route);
      assert.ok(!html.includes("SQLITE_ERROR"), route);
      assert.ok(!html.includes("NEXT_HTTP_ERROR_FALLBACK"), route);
    }
  }
});
