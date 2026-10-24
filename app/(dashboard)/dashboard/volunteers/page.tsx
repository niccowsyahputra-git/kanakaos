import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Megaphone, ShieldCheck, ShieldAlert } from "lucide-react";
import { VolunteerStatus } from "@prisma/client";
import { VolunteerActions } from "@/components/volunteers/volunteer-actions";
import { AddVolunteerDialog } from "@/components/volunteers/add-volunteer-dialog";
import { VolunteerDetailDialog } from "@/components/volunteers/volunteer-detail-dialog";
import {
  EditVolunteerDialog,
  type EditableVolunteer,
} from "@/components/volunteers/edit-volunteer-dialog";
import {
  VolunteerAccountBadge,
  CreateVolunteerAccountDialog,
} from "@/components/volunteers/volunteer-account";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(date);
}

// Data pendaftaran lengkap untuk dialog detail
function toDetail(volunteer: {
  name: string;
  phone: string | null;
  skill: string | null;
  email: string | null;
  dob: Date | null;
  address: string | null;
  occupation: string | null;
  availability: string | null;
  motivation: string | null;
  ktpUrl: string | null;
  skckUrl: string | null;
  need: { title: string } | null;
  createdAt: Date;
}) {
  return {
    name: volunteer.name,
    phone: volunteer.phone,
    skill: volunteer.skill,
    email: volunteer.email,
    dobLabel: formatDate(volunteer.dob),
    address: volunteer.address,
    occupation: volunteer.occupation,
    availability: volunteer.availability,
    motivation: volunteer.motivation,
    ktpUrl: volunteer.ktpUrl,
    skckUrl: volunteer.skckUrl,
    needTitle: volunteer.need?.title ?? null,
    createdAtLabel: formatDate(volunteer.createdAt) ?? "-",
  };
}

// Data untuk form edit / lengkapi data relawan
function toEditable(volunteer: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  dob: Date | null;
  address: string | null;
  occupation: string | null;
  skill: string | null;
  availability: string | null;
  motivation: string | null;
  hasSafeguardingCert: boolean;
  needId: string | null;
}): EditableVolunteer {
  return {
    id: volunteer.id,
    name: volunteer.name,
    phone: volunteer.phone,
    email: volunteer.email,
    dob: volunteer.dob ? volunteer.dob.toISOString().slice(0, 10) : null,
    address: volunteer.address,
    occupation: volunteer.occupation,
    skill: volunteer.skill,
    availability: volunteer.availability,
    motivation: volunteer.motivation,
    hasSafeguardingCert: volunteer.hasSafeguardingCert,
    needId: volunteer.needId,
  };
}

const statusLabel: Record<VolunteerStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

// Kuning: PENDING, Hijau: APPROVED, Merah: SUSPENDED, Abu: REJECTED
const statusClass: Record<VolunteerStatus, string> = {
  PENDING: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  APPROVED: "border-transparent bg-green-100 text-green-800 hover:bg-green-100",
  REJECTED: "border-transparent bg-gray-100 text-gray-600 hover:bg-gray-100",
  SUSPENDED: "border-transparent bg-red-100 text-red-800 hover:bg-red-100",
};

function StatusBadge({ status }: { status: VolunteerStatus }) {
  return (
    <Badge variant="outline" className={statusClass[status]}>
      {statusLabel[status]}
    </Badge>
  );
}

function CertIndicator({ hasCert }: { hasCert: boolean }) {
  return hasCert ? (
    <span className="inline-flex items-center gap-1 text-xs text-green-700">
      <ShieldCheck className="h-3.5 w-3.5" /> Bersertifikat
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
      <ShieldAlert className="h-3.5 w-3.5" /> Belum
    </span>
  );
}

export default async function VolunteersPage() {
  // Proteksi role lapis kedua (lapis pertama di middleware)
  const session = await requireStaffSession();
  if (!session) {
    redirect("/dashboard");
  }

  const [volunteers, needs] = await Promise.all([
    prisma.volunteer.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        need: { select: { title: true } },
        user: { select: { email: true, isActive: true } },
      },
    }),
    prisma.volunteerNeed.findMany({
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, status: true },
    }),
  ]);

  // Akun login hanya dibuatkan oleh Super Admin (sama seperti pegawai)
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Relawan</h2>
          <p className="text-sm text-muted-foreground">
            Screening & pengawasan relawan untuk child safeguarding.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/volunteers/needs">
              <Megaphone className="h-4 w-4" />
              Kebutuhan Relawan
            </Link>
          </Button>
          <AddVolunteerDialog needs={needs} />
        </div>
      </div>

      {volunteers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada relawan terdaftar.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {volunteers.map((volunteer) => (
              <Card key={volunteer.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{volunteer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {volunteer.skill ?? "-"}
                        {volunteer.phone ? ` · ${volunteer.phone}` : ""}
                      </p>
                      {volunteer.need && (
                        <p className="text-xs text-primary">
                          Kebutuhan: {volunteer.need.title}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <VolunteerDetailDialog volunteer={toDetail(volunteer)} />
                      <StatusBadge status={volunteer.status} />
                    </div>
                  </div>
                  <CertIndicator hasCert={volunteer.hasSafeguardingCert} />
                  {volunteer.user && (
                    <VolunteerAccountBadge
                      email={volunteer.user.email}
                      isActive={volunteer.user.isActive}
                    />
                  )}
                  {volunteer.redFlagNotes && (
                    <p className="whitespace-pre-line rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      🚩 {volunteer.redFlagNotes}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <EditVolunteerDialog
                      volunteer={toEditable(volunteer)}
                      needs={needs}
                    />
                    <VolunteerActions
                      volunteerId={volunteer.id}
                      volunteerName={volunteer.name}
                      status={volunteer.status}
                      hasSafeguardingCert={volunteer.hasSafeguardingCert}
                    />
                    {isSuperAdmin &&
                      volunteer.status === "APPROVED" &&
                      volunteer.hasSafeguardingCert &&
                      !volunteer.userId && (
                        <CreateVolunteerAccountDialog
                          volunteerId={volunteer.id}
                          volunteerName={volunteer.name}
                          volunteerEmail={volunteer.email}
                        />
                      )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Keahlian</TableHead>
                  <TableHead>Kebutuhan</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Safeguarding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteers.map((volunteer) => (
                  <TableRow key={volunteer.id}>
                    <TableCell className="font-medium">
                      {volunteer.name}
                      {volunteer.redFlagNotes && (
                        <p className="mt-1 max-w-xs whitespace-pre-line text-xs font-normal text-destructive">
                          🚩 {volunteer.redFlagNotes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{volunteer.phone ?? "-"}</TableCell>
                    <TableCell>{volunteer.skill ?? "-"}</TableCell>
                    <TableCell>{volunteer.need?.title ?? "-"}</TableCell>
                    <TableCell>
                      {volunteer.user ? (
                        <VolunteerAccountBadge
                          email={volunteer.user.email}
                          isActive={volunteer.user.isActive}
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <CertIndicator
                        hasCert={volunteer.hasSafeguardingCert}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={volunteer.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <VolunteerDetailDialog
                          volunteer={toDetail(volunteer)}
                        />
                        <EditVolunteerDialog
                          volunteer={toEditable(volunteer)}
                          needs={needs}
                        />
                        <VolunteerActions
                          volunteerId={volunteer.id}
                          volunteerName={volunteer.name}
                          status={volunteer.status}
                          hasSafeguardingCert={volunteer.hasSafeguardingCert}
                        />
                        {isSuperAdmin &&
                          volunteer.status === "APPROVED" &&
                          volunteer.hasSafeguardingCert &&
                          !volunteer.userId && (
                            <CreateVolunteerAccountDialog
                              volunteerId={volunteer.id}
                              volunteerName={volunteer.name}
                              volunteerEmail={volunteer.email}
                            />
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
