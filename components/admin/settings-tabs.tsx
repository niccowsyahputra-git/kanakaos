"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Save, FileDown, DatabaseBackup, Trash2 } from "lucide-react";

import {
  saveGeneralSettings,
  saveNotificationSettings,
  exportDataCsv,
  backupDatabase,
} from "@/lib/actions/settings";
import { downloadBase64 } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AISettingsForm } from "@/components/admin/ai-settings-form";
import { LandingSettingsForm } from "@/components/admin/landing-settings-form";
import type { LandingContent } from "@/lib/site-content";
import { useI18n } from "@/lib/i18n/client";


export type SettingsValues = {
  yayasanName: string;
  yayasanAddress: string;
  yayasanPhone: string;
  yayasanEmail: string;
  deedNumber: string;
  skKemenkumham: string;
  npwp: string;
  nib: string;
  tdy: string;
  activityPermit: string;
  domicileLetter: string;
  logoUrl: string;
  notifEmail: string;
  notifNewDonation: boolean;
  notifRedFlag: boolean;
  notifLowStock: boolean;
};

export type AIConfigView = {
  provider: string;
  baseUrl: string;
  modelName: string;
  hasApiKey: boolean;
} | null;

export function SettingsTabs({
  initial,
  landing,
  aiConfig,
  defaultTab = "general",
  usersSection,
  auditSection,
  locationsSection,
}: {
  initial: SettingsValues;
  landing: LandingContent;
  aiConfig: AIConfigView;
  defaultTab?: string;
  usersSection: React.ReactNode;
  auditSection: React.ReactNode;
  locationsSection: React.ReactNode;
}) {
  const { tr, locale } = useI18n();

  // --- Tab 1: General ---
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [yayasanName, setYayasanName] = useState(initial.yayasanName);
  const [yayasanAddress, setYayasanAddress] = useState(initial.yayasanAddress);
  const [yayasanPhone, setYayasanPhone] = useState(initial.yayasanPhone);
  const [yayasanEmail, setYayasanEmail] = useState(initial.yayasanEmail);
  const [logoPreview, setLogoPreview] = useState(initial.logoUrl);
  const [logoDirty, setLogoDirty] = useState(false);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [deedNumber, setDeedNumber] = useState(initial.deedNumber);
  const [skKemenkumham, setSkKemenkumham] = useState(initial.skKemenkumham);
  const [npwp, setNpwp] = useState(initial.npwp);
  const [nib, setNib] = useState(initial.nib);
  const [tdy, setTdy] = useState(initial.tdy);
  const [activityPermit, setActivityPermit] = useState(initial.activityPermit);
  const [domicileLetter, setDomicileLetter] = useState(initial.domicileLetter);
  const [isSavingGeneral, startSavingGeneral] = useTransition();

  // --- Tab 2: Notification ---
  const [notifEmail, setNotifEmail] = useState(initial.notifEmail);
  const [notifNewDonation, setNotifNewDonation] = useState(initial.notifNewDonation);
  const [notifRedFlag, setNotifRedFlag] = useState(initial.notifRedFlag);
  const [notifLowStock, setNotifLowStock] = useState(initial.notifLowStock);
  const [isSavingNotif, startSavingNotif] = useTransition();

  // --- Tab 3: Backup ---
  const [isExporting, startExporting] = useTransition();
  const [isBackingUp, startBackingUp] = useTransition();

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setLogoDirty(true);
    setRemoveLogo(false);
  }

  function handleRemoveLogo() {
    if (logoInputRef.current) logoInputRef.current.value = "";
    setLogoPreview("");
    setLogoDirty(true);
    setRemoveLogo(true);
  }

  function handleSaveGeneral() {
    startSavingGeneral(async () => {
      const formData = new FormData();
      formData.set("yayasanName", yayasanName);
      formData.set("yayasanAddress", yayasanAddress);
      formData.set("yayasanPhone", yayasanPhone);
      formData.set("yayasanEmail", yayasanEmail);
      formData.set("deedNumber", deedNumber);
      formData.set("skKemenkumham", skKemenkumham);
      formData.set("npwp", npwp);
      formData.set("nib", nib);
      formData.set("tdy", tdy);
      formData.set("activityPermit", activityPermit);
      formData.set("domicileLetter", domicileLetter);
      const logoFile = logoInputRef.current?.files?.[0];
      if (logoFile) formData.set("logo", logoFile);
      else if (removeLogo) formData.set("removeLogo", "true");

      const result = await saveGeneralSettings(formData);
      if (result.success) {
        toast.success(tr("Pengaturan umum tersimpan"));
        if (logoInputRef.current) logoInputRef.current.value = "";
        setLogoDirty(false);
        setRemoveLogo(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSaveNotif() {
    startSavingNotif(async () => {
      const result = await saveNotificationSettings({
        notifEmail,
        notifNewDonation,
        notifRedFlag,
        notifLowStock,
      });
      if (result.success) {
        toast.success(tr("Pengaturan notifikasi tersimpan"));
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleExportCsv() {
    startExporting(async () => {
      const result = await exportDataCsv();
      if (result.success) {
        downloadBase64(result.contentBase64, result.fileName, result.mime);
        toast.success(tr("Export CSV berhasil di-download"));
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleBackup() {
    startBackingUp(async () => {
      const result = await backupDatabase();
      if (result.success) {
        downloadBase64(result.contentBase64, result.fileName, result.mime);
        toast.success(tr("Backup database berhasil di-download"));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
        <TabsTrigger value="general">{tr("Umum")}</TabsTrigger>
        <TabsTrigger value="locations">{tr("Entitas Lokasi")}</TabsTrigger>
        <TabsTrigger value="landing">{tr("Halaman Publik")}</TabsTrigger>
        <TabsTrigger value="notification">{tr("Notifikasi")}</TabsTrigger>
        <TabsTrigger value="users">{tr("Pengguna")}</TabsTrigger>
        <TabsTrigger value="audit">{tr("Audit Log")}</TabsTrigger>
        <TabsTrigger value="ai">AI</TabsTrigger>
        <TabsTrigger value="backup">{tr("Backup")}</TabsTrigger>
      </TabsList>
      <TabsContent value="locations">{locationsSection}</TabsContent>

      {/* ============ TAB 1: GENERAL ============ */}
      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tr("Pengaturan Umum")}</CardTitle>
            <CardDescription>
              {tr("Identitas yayasan yang tampil di website, kwitansi & laporan.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="yayasan-name">{tr("Nama Yayasan")}</Label>
              <Input
                id="yayasan-name"
                value={yayasanName}
                onChange={(e) => setYayasanName(e.target.value)}
                placeholder="Yayasan Kanaka"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yayasan-address">{tr("Alamat")}</Label>
              <Textarea
                id="yayasan-address"
                value={yayasanAddress}
                onChange={(e) => setYayasanAddress(e.target.value)}
                placeholder={tr("Alamat lengkap yayasan")}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="yayasan-phone">{tr("No. Telp / WhatsApp")}</Label>
                <Input
                  id="yayasan-phone"
                  type="tel"
                  value={yayasanPhone}
                  onChange={(e) => setYayasanPhone(e.target.value)}
                  placeholder={tr("mis. 0812-3456-7890")}
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-email">{tr("Email Yayasan")}</Label>
                <Input
                  id="yayasan-email"
                  type="email"
                  value={yayasanEmail}
                  onChange={(e) => setYayasanEmail(e.target.value)}
                  placeholder="halo@yayasan.org"
                  maxLength={150}
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold">{tr("Legalitas & Dokumen")}</p>
              <p className="text-xs text-muted-foreground">
                {tr("Nomor dokumen resmi yayasan.")}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="yayasan-deed">{tr("No. Akta Pendirian")}</Label>
                <Input
                  id="yayasan-deed"
                  value={deedNumber}
                  onChange={(e) => setDeedNumber(e.target.value)}
                  placeholder={tr("mis. 12 tanggal 01-01-2020")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-sk">{tr("SK KEMENKUMHAM")}</Label>
                <Input
                  id="yayasan-sk"
                  value={skKemenkumham}
                  onChange={(e) => setSkKemenkumham(e.target.value)}
                  placeholder={tr("mis. AHU-0001234.AH.01.04")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-npwp">{tr("NPWP Yayasan")}</Label>
                <Input
                  id="yayasan-npwp"
                  value={npwp}
                  onChange={(e) => setNpwp(e.target.value)}
                  placeholder="00.000.000.0-000.000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-nib">NIB</Label>
                <Input
                  id="yayasan-nib"
                  value={nib}
                  onChange={(e) => setNib(e.target.value)}
                  placeholder={tr("Nomor Induk Berusaha")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-tdy">{tr("Tanda Daftar Yayasan")}</Label>
                <Input
                  id="yayasan-tdy"
                  value={tdy}
                  onChange={(e) => setTdy(e.target.value)}
                  placeholder={tr("Nomor tanda daftar yayasan")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-permit">{tr("Izin Kegiatan Yayasan")}</Label>
                <Input
                  id="yayasan-permit"
                  value={activityPermit}
                  onChange={(e) => setActivityPermit(e.target.value)}
                  placeholder={tr("Nomor izin kegiatan")}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="yayasan-domicile">{tr("Surat Domisili")}</Label>
                <Input
                  id="yayasan-domicile"
                  value={domicileLetter}
                  onChange={(e) => setDomicileLetter(e.target.value)}
                  placeholder={tr("Nomor surat keterangan domisili")}
                />
              </div>
            </div>

            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="yayasan-logo">
                {tr("Logo Yayasan")}{" "}
                <span className="font-normal text-muted-foreground">
                  {tr("(JPG, JPEG, PNG — maks 1MB)")}</span>
              </Label>
              <Input
                id="yayasan-logo"
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleLogoChange}
                className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
              />
            </div>
            {logoPreview && (
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Image
                  src={logoPreview}
                  alt={tr("Logo yayasan")}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 rounded object-contain"
                />
                <span className="flex-1 text-sm text-muted-foreground">
                  {logoDirty ? tr("Logo baru (belum disimpan)") : tr("Logo saat ini")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleRemoveLogo}
                >
                  <Trash2 className="h-4 w-4" /> {tr(" Hapus")}</Button>
              </div>
            )}
            {removeLogo && (
              <p className="text-xs text-muted-foreground">
                {tr("Logo akan dihapus setelah pengaturan disimpan.")}</p>
            )}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveGeneral}
                disabled={isSavingGeneral || yayasanName.trim().length < 3}
                className="w-full md:w-auto"
              >
                {isSavingGeneral ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {tr(" Menyimpan...")}</>
                ) : (
                  <><Save className="h-4 w-4" /> {tr(" Simpan Pengaturan")}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ============ TAB: HALAMAN PUBLIK ============ */}
      <TabsContent value="landing">
        <LandingSettingsForm initial={landing} />
      </TabsContent>

      {/* ============ TAB 2: NOTIFICATION ============ */}
      <TabsContent value="notification">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tr("Pengaturan Notifikasi")}</CardTitle>
            <CardDescription>
              {tr("Email tujuan notifikasi untuk kejadian penting. (Pengiriman email diaktifkan saat integrasi SMTP tersedia.)")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="notif-email">{tr("Email Penerima Notifikasi")}</Label>
              <Input
                id="notif-email"
                type="email"
                value={notifEmail}
                onChange={(e) => setNotifEmail(e.target.value)}
                placeholder="admin@yayasan.org"
              />
            </div>

            {[
              {
                label: tr("Donasi baru masuk"),
                desc: tr("Kirim email setiap ada donasi tercatat"),
                checked: notifNewDonation,
                onChange: setNotifNewDonation,
              },
              {
                label: tr("Red flag relawan"),
                desc: tr("Kirim email saat relawan di-suspend dengan red flag"),
                checked: notifRedFlag,
                onChange: setNotifRedFlag,
              },
              {
                label: tr("Stok menipis"),
                desc: tr("Kirim email saat stok inventory di bawah minimum"),
                checked: notifLowStock,
                onChange: setNotifLowStock,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{tr(item.label)}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={item.checked}
                  onCheckedChange={item.onChange}
                />
              </div>
            ))}

            <div className="flex justify-end">
              <Button
                onClick={handleSaveNotif}
                disabled={isSavingNotif}
                className="w-full md:w-auto"
              >
                {isSavingNotif ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {tr(" Menyimpan...")}</>
                ) : (
                  <><Save className="h-4 w-4" /> {tr(" Simpan Notifikasi")}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ============ TAB 3: MANAJEMEN USER ============ */}
      <TabsContent value="users">{usersSection}</TabsContent>

      {/* ============ TAB 4: AUDIT LOG ============ */}
      <TabsContent value="audit">{auditSection}</TabsContent>

      {/* ============ TAB 5: PENGATURAN AI ============ */}
      <TabsContent value="ai">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {tr("Konfigurasi provider AI untuk fitur analisis kondisi anak. API key disimpan di database, tidak pernah dikirim ke browser.")}</p>
          <AISettingsForm initialConfig={aiConfig} />
        </div>
      </TabsContent>

      {/* ============ TAB 6: BACKUP & EXPORT ============ */}
      <TabsContent value="backup">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tr("Backup & Export")}</CardTitle>
            <CardDescription>
              {tr("Unduh salinan data untuk arsip offline atau pindah sistem.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col items-start justify-between gap-3 rounded-md border p-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-medium">{tr("Export Semua Data ke CSV")}</p>
                <p className="text-xs text-muted-foreground">
                  {tr("Anak asuh, donasi, dan relawan dalam satu file CSV (bisa dibuka di Excel).")}</p>
              </div>
              <Button
                variant="outline"
                onClick={handleExportCsv}
                disabled={isExporting}
                className="w-full md:w-auto"
              >
                {isExporting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {tr(" Menyiapkan...")}</>
                ) : (
                  <><FileDown className="h-4 w-4" /> {tr(" Export CSV")}</>
                )}
              </Button>
            </div>

            <div className="flex flex-col items-start justify-between gap-3 rounded-md border p-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-medium">{tr("Backup Database")}</p>
                <p className="text-xs text-muted-foreground">
                  {tr("Dump semua tabel dalam format JSON (tanpa password & API key).")}</p>
              </div>
              <Button
                variant="outline"
                onClick={handleBackup}
                disabled={isBackingUp}
                className="w-full md:w-auto"
              >
                {isBackingUp ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {tr(" Menyiapkan...")}</>
                ) : (
                  <><DatabaseBackup className="h-4 w-4" /> {tr(" Backup Database")}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
