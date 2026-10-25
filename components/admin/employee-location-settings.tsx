"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveEmployeeLocation } from "@/lib/actions/employee-location";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type LocationOption = { id: string; name: string; isActive: boolean };

function LocationEditor({ location }: { location?: LocationOption }) {
  const { tr } = useI18n();
  const [name, setName] = useState(location?.name ?? "");
  const [pending, startTransition] = useTransition();
  const id = `location-${location?.id ?? "new"}`;
  function save(toggle = false) {
    startTransition(async () => {
      const result = await saveEmployeeLocation({
        id: location?.id,
        name: toggle ? location!.name : name,
        isActive: toggle ? !location!.isActive : location?.isActive ?? true,
      });
      if (result.success) {
        toast.success(tr("Entitas lokasi tersimpan"));
        if (!location) setName("");
      } else toast.error(result.error);
    });
  }
  return <form onSubmit={e => { e.preventDefault(); save(); }} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end">
    <div className="flex-1 space-y-1">
      <Label htmlFor={id}>{location ? tr(location.isActive ? "Aktif" : "Tidak aktif") : tr("Entitas lokasi baru")}</Label>
      <Input id={id} value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder={tr("Kantor Pusat / Kantor Cabang")} disabled={pending} required />
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={pending}>{tr(location ? "Simpan" : "Tambah")}</Button>
      {location && <Button type="button" variant="outline" disabled={pending} onClick={() => save(true)}>{tr(location.isActive ? "Nonaktifkan" : "Aktifkan")}</Button>}
    </div>
  </form>;
}

export function EmployeeLocationSettings({ locations }: { locations: LocationOption[] }) {
  const { tr } = useI18n();
  return <Card>
    <CardHeader><CardTitle>{tr("Entitas Lokasi")}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">{tr("Kelola kantor pusat dan cabang. Lokasi nonaktif tetap tersimpan pada data pegawai lama.")}</p>
      <LocationEditor />
      {locations.map(location => <LocationEditor key={`${location.id}-${location.name}-${location.isActive}`} location={location} />)}
      {!locations.length && <p className="text-sm text-muted-foreground">{tr("Tambahkan entitas lokasi agar tersedia pada formulir pegawai.")}</p>}
    </CardContent>
  </Card>;
}
