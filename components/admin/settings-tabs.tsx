"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Save, FileDown, DatabaseBackup } from "lucide-react";

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

export type SettingsValues = {
  yayasanName: string;
  yayasanAddress: string;
  vision: string;
  mission: string;
  description: string;
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
  aiConfig,
  defaultTab = "general",
  usersSection,
  auditSection,
}: {
  initial: SettingsValues;
  aiConfig: AIConfigView;
  defaultTab?: string;
  usersSection: React.ReactNode;
  auditSection: React.ReactNode;
}) {
  // --- Tab 1: General ---
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [yayasanName, setYayasanName] = useState(initial.yayasanName);
  const [yayasanAddress, setYayasanAddress] = useState(initial.yayasanAddress);
  const [vision, setVision] = useState(initial.vision);
  const [mission, setMission] = useState(initial.mission);
  const [description, setDescription] = useState(initial.description);
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

  function handleSaveGeneral() {
    startSavingGeneral(async () => {
      const formData = new FormData();
      formData.set("yayasanName", yayasanName);
      formData.set("yayasanAddress", yayasanAddress);
      formData.set("vision", vision);
      formData.set("mission", mission);
      formData.set("description", description);
      formData.set("deedNumber", deedNumber);
      formData.set("skKemenkumham", skKemenkumham);
      formData.set("npwp", npwp);
      formData.set("nib", nib);
      formData.set("tdy", tdy);
      formData.set("activityPermit", activityPermit);
      formData.set("domicileLetter", domicileLetter);
      const logoFile = logoInputRef.current?.files?.[0];
      if (logoFile) formData.set("logo", logoFile);

      const result = await saveGeneralSettings(formData);
      if (result.success) {
        if (result.warning) {
          toast.warning("Pengaturan tersimpan", { description: result.warning });
        } else {
          toast.success("Pengaturan umum tersimpan");
        }
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
        toast.success("Pengaturan notifikasi tersimpan");
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
        toast.success("Export CSV berhasil di-download");
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
        toast.success("Backup database berhasil di-download");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-3 sm:grid-cols-6">
        <TabsTrigger value="general">Umum</TabsTrigger>
        <TabsTrigger value="notification">Notifikasi</TabsTrigger>
        <TabsTrigger value="users">Pengguna</TabsTrigger>
        <TabsTrigger value="audit">Audit Log</TabsTrigger>
        <TabsTrigger value="ai">AI</TabsTrigger>
        <TabsTrigger value="backup">Backup</TabsTrigger>
      </TabsList>

      {/* ============ TAB 1: GENERAL ============ */}
      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pengaturan Umum</CardTitle>
            <CardDescription>
              Identitas yayasan yang tampil di kwitansi & laporan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="yayasan-name">Nama Yayasan</Label>
              <Input
                id="yayasan-name"
                value={yayasanName}
                onChange={(e) => setYayasanName(e.target.value)}
                placeholder="Yayasan Kanaka"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yayasan-address">Alamat</Label>
              <Textarea
                id="yayasan-address"
                value={yayasanAddress}
                onChange={(e) => setYayasanAddress(e.target.value)}
                placeholder="Alamat lengkap yayasan"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yayasan-desc">Deskripsi Yayasan</Label>
              <Textarea
                id="yayasan-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Gambaran singkat tentang yayasan"
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="w-full space-y-2 md:w-1/2">
                <Label htmlFor="yayasan-vision">Visi</Label>
                <Textarea
                  id="yayasan-vision"
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  placeholder="Visi yayasan"
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div className="w-full space-y-2 md:w-1/2">
                <Label htmlFor="yayasan-mission">Misi</Label>
                <Textarea
                  id="yayasan-mission"
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  placeholder="Misi yayasan (bisa poin per baris)"
                  rows={3}
                  maxLength={2000}
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold">Legalitas &amp; Dokumen</p>
              <p className="text-xs text-muted-foreground">
                Nomor dokumen resmi yayasan.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="yayasan-deed">No. Akta Pendirian</Label>
                <Input
                  id="yayasan-deed"
                  value={deedNumber}
                  onChange={(e) => setDeedNumber(e.target.value)}
                  placeholder="mis. 12 tanggal 01-01-2020"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-sk">SK KEMENKUMHAM</Label>
                <Input
                  id="yayasan-sk"
                  value={skKemenkumham}
                  onChange={(e) => setSkKemenkumham(e.target.value)}
                  placeholder="mis. AHU-0001234.AH.01.04"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-npwp">NPWP Yayasan</Label>
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
                  placeholder="Nomor Induk Berusaha"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-tdy">Tanda Daftar Yayasan</Label>
                <Input
                  id="yayasan-tdy"
                  value={tdy}
                  onChange={(e) => setTdy(e.target.value)}
                  placeholder="Nomor tanda daftar yayasan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yayasan-permit">Izin Kegiatan Yayasan</Label>
                <Input
                  id="yayasan-permit"
                  value={activityPermit}
                  onChange={(e) => setActivityPermit(e.target.value)}
                  placeholder="Nomor izin kegiatan"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="yayasan-domicile">Surat Domisili</Label>
                <Input
                  id="yayasan-domicile"
                  value={domicileLetter}
                  onChange={(e) => setDomicileLetter(e.target.value)}
                  placeholder="Nomor surat keterangan domisili"
                />
              </div>
            </div>

            <div className="w-full space-y-2 md:w-1/2">
              <Label htmlFor="yayasan-logo">
                Logo Yayasan{" "}
                <span className="font-normal text-muted-foreground">
                  (JPG, JPEG, PNG — maks 5MB)
                </span>
              </Label>
              <Input
                id="yayasan-logo"
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
              />
            </div>
            {initial.logoUrl && (
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Image
                  src={initial.logoUrl}
                  alt="Logo yayasan"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded object-contain"
                />
                <span className="text-sm text-muted-foreground">
                  Logo saat ini
                </span>
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveGeneral}
                disabled={isSavingGeneral || yayasanName.trim().length < 3}
                className="w-full md:w-auto"
              >
                {isSavingGeneral ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Save className="h-4 w-4" /> Simpan Pengaturan</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ============ TAB 2: NOTIFICATION ============ */}
      <TabsContent value="notification">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pengaturan Notifikasi</CardTitle>
            <CardDescription>
              Email tujuan notifikasi untuk kejadian penting. (Pengiriman email
              diaktifkan saat integrasi SMTP tersedia.)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="notif-email">Email Penerima Notifikasi</Label>
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
                label: "Donasi baru masuk",
                desc: "Kirim email setiap ada donasi tercatat",
                checked: notifNewDonation,
                onChange: setNotifNewDonation,
              },
              {
                label: "Red flag relawan",
                desc: "Kirim email saat relawan di-suspend dengan red flag",
                checked: notifRedFlag,
                onChange: setNotifRedFlag,
              },
              {
                label: "Stok menipis",
                desc: "Kirim email saat stok inventory di bawah minimum",
                checked: notifLowStock,
                onChange: setNotifLowStock,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
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
                  <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Save className="h-4 w-4" /> Simpan Notifikasi</>
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
            Konfigurasi provider AI untuk fitur analisis kondisi anak. API key
            disimpan di database, tidak pernah dikirim ke browser.
          </p>
          <AISettingsForm initialConfig={aiConfig} />
        </div>
      </TabsContent>

      {/* ============ TAB 6: BACKUP & EXPORT ============ */}
      <TabsContent value="backup">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Backup & Export</CardTitle>
            <CardDescription>
              Unduh salinan data untuk arsip offline atau pindah sistem.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col items-start justify-between gap-3 rounded-md border p-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-medium">Export Semua Data ke CSV</p>
                <p className="text-xs text-muted-foreground">
                  Anak asuh, donasi, dan relawan dalam satu file CSV (bisa
                  dibuka di Excel).
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleExportCsv}
                disabled={isExporting}
                className="w-full md:w-auto"
              >
                {isExporting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan...</>
                ) : (
                  <><FileDown className="h-4 w-4" /> Export CSV</>
                )}
              </Button>
            </div>

            <div className="flex flex-col items-start justify-between gap-3 rounded-md border p-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-medium">Backup Database</p>
                <p className="text-xs text-muted-foreground">
                  Dump semua tabel dalam format JSON (tanpa password &
                  API key).
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleBackup}
                disabled={isBackingUp}
                className="w-full md:w-auto"
              >
                {isBackingUp ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan...</>
                ) : (
                  <><DatabaseBackup className="h-4 w-4" /> Backup Database</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
