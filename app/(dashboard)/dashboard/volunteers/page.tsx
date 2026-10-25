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
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { VOLUNTEER_FIELDS, readVolunteerSkills, needFieldLabel, dateOnlyLabel } from "@/lib/option-catalogs";
import { volunteerAttachmentUrl, normalizeVolunteerAttachments, type AttachmentSummary } from "@/lib/volunteer-upload-contract";


export const dynamic = "force-dynamic";

function formatDate(date: Date | null, locale: Locale = "id") {
  const tr = createTranslator(locale);

  if (!date) return null;
  return new Intl.DateTimeFormat((locale === "en" ? "en-US" : "id-ID"), { dateStyle: "long" }).format(date);
}

// Data pendaftaran lengkap untuk dialog detail
function toDetail(volunteer: {
  name: string;
  phone: string | null;
  skill: string | null;
  skillsJson: string | null;
  highestEducation: string | null;
  major: string | null;
  attachments: AttachmentSummary[];
  email: string | null;
  dob: Date | null;
  address: string | null;
  occupation: string | null;
  availability: string | null;
  motivation: string | null;
  ktpUrl: string | null;
  skckUrl: string | null;
  need: { title: string; field: string | null; otherField: string | null } | null;
  status: VolunteerStatus;
  hasSafeguardingCert: boolean;
  redFlagNotes: string | null;
  createdAt: Date;
}, locale: Locale) {

  return {
    name: volunteer.name,
    phone: volunteer.phone,
    skill: volunteer.skill,
    skillsJson: volunteer.skillsJson,
    highestEducation: volunteer.highestEducation,
    major: volunteer.major,
    attachments: volunteer.attachments,
    email: volunteer.email,
    dobLabel: volunteer.dob ? dateOnlyLabel(volunteer.dob, locale) : null,
    status: volunteer.status,
    hasSafeguardingCert: volunteer.hasSafeguardingCert,
    redFlagNotes: volunteer.redFlagNotes,
    address: volunteer.address,
    occupation: volunteer.occupation,
    availability: volunteer.availability,
    motivation: volunteer.motivation,
    ktpUrl: volunteer.attachments.some(a => a.kind === "KTP") ? volunteerAttachmentUrl(volunteer.attachments.find(a => a.kind === "KTP")!) : volunteer.ktpUrl,
    skckUrl: volunteer.attachments.some(a => a.kind === "SKCK") ? volunteerAttachmentUrl(volunteer.attachments.find(a => a.kind === "SKCK")!) : volunteer.skckUrl,
    needTitle: volunteer.need ? volunteer.need.field && volunteer.need.field !== "OTHER" ? createTranslator(locale)(needFieldLabel(volunteer.need.field, volunteer.need.otherField, volunteer.need.title)) : volunteer.need.title : null,
    createdAtLabel: formatDate(volunteer.createdAt, locale) ?? "-",
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
  skillsJson: string | null;
  highestEducation: string | null;
  major: string | null;
  attachments: AttachmentSummary[];
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
    skillsJson: volunteer.skillsJson,
    highestEducation: volunteer.highestEducation,
    major: volunteer.major,
    attachments: volunteer.attachments,
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

async function StatusBadge({ status }: { status: VolunteerStatus }) {
  const { tr, locale } = await getT();

  return (
    <Badge variant="outline" className={statusClass[status]}>
      {tr(statusLabel[status])}
    </Badge>
  );
}

async function CertIndicator({ hasCert }: { hasCert: boolean }) {
  const { tr, locale } = await getT();

  return hasCert ? (
    <span className="inline-flex items-center gap-1 text-xs text-green-700">
      <ShieldCheck className="h-3.5 w-3.5" /> {tr(" Bersertifikat")}</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
      <ShieldAlert className="h-3.5 w-3.5" /> {tr(" Belum")}</span>
  );
}

export default async function VolunteersPage() {
  const { tr, locale } = await getT();

  // Proteksi role lapis kedua (lapis pertama di middleware)
  const session = await requireStaffSession();
  if (!session) {
    redirect("/dashboard");
  }

  const [rawVolunteers, rawNeeds] = await Promise.all([
    prisma.volunteer.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        need: { select: { title: true, field: true, otherField: true } },
        attachments: { select: { id: true, kind: true, filename: true }, orderBy: { createdAt: "asc" } },
        managedFiles: { where: { state: "ATTACHED" }, select: { id: true, purpose: true, filename: true }, orderBy: { createdAt: "asc" } },
        user: { select: { email: true, isActive: true } },
      },
    }),
    prisma.volunteerNeed.findMany({
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, status: true, field: true, otherField: true, startDate: true, endDate: true },
    }),
  ]);

  const volunteers = rawVolunteers.map(volunteer => ({ ...volunteer, attachments: normalizeVolunteerAttachments(volunteer.attachments, volunteer.managedFiles) }));

  // Akun login hanya dibuatkan oleh Super Admin (sama seperti pegawai)
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const needs = rawNeeds.map(need => ({ ...need, startDate: need.startDate?.toISOString().slice(0, 10) ?? null, endDate: need.endDate?.toISOString().slice(0, 10) ?? null }));
  const skillsLabel = (v: { skillsJson: string | null; skill: string | null }) => readVolunteerSkills(v.skillsJson).map(code => tr(VOLUNTEER_FIELDS[code])).join(", ") || (v.skill ? `${tr("Data lama")}: ${v.skill}` : "—");
  const needLabel = (need: typeof volunteers[number]["need"]) => need ? need.field && need.field !== "OTHER" ? tr(needFieldLabel(need.field, need.otherField, need.title)) : need.title : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{tr("Relawan")}</h2>
          <p className="text-sm text-muted-foreground">
            {tr("Screening & pengawasan relawan untuk child safeguarding.")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/volunteers/needs">
              <Megaphone className="h-4 w-4" />
              {tr("Kebutuhan Relawan")}</Link>
          </Button>
          <AddVolunteerDialog needs={needs} />
        </div>
      </div>

      {volunteers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr("Belum ada relawan terdaftar.")}</CardContent>
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
                        {skillsLabel(volunteer)}
                        {volunteer.phone ? ` · ${volunteer.phone}` : ""}
                      </p>
                      {volunteer.need && (
                        <p className="text-xs text-primary">
                          {tr("Kebutuhan: ")}{needLabel(volunteer.need)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <VolunteerDetailDialog volunteer={toDetail(volunteer, locale)} />
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
                  <TableHead>{tr("Nama")}</TableHead>
                  <TableHead>{tr("Kontak")}</TableHead>
                  <TableHead>{tr("Keahlian")}</TableHead>
                  <TableHead>{tr("Kebutuhan")}</TableHead>
                  <TableHead>{tr("Akun")}</TableHead>
                  <TableHead>{tr("Safeguarding")}</TableHead>
                  <TableHead>{tr("Status")}</TableHead>
                  <TableHead className="text-right">{tr("Aksi")}</TableHead>
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
                    <TableCell>{skillsLabel(volunteer)}</TableCell>
                    <TableCell>{needLabel(volunteer.need)}</TableCell>
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
                          volunteer={toDetail(volunteer, locale)}
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
