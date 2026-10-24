"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  History,
  Link2,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Card, Chip, Empty, PageHeader, Panel } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hrm, type Candidate, type JobApplication } from "@/lib/api/hrm-client";
import { applicationTone, formatDate } from "@/suite/hrm/lib/format";
import { IconTile, InfoRow, InitialsAvatar, LoadError, ToneChip } from "../ui/recordKit";
import { richExcerpt } from "@/lib/richText";

/**
 * One person, and everything they have ever applied for here.
 *
 * This page is the entire reason a candidate is a separate record from an
 * application. Somebody applying for their third role should not arrive as a
 * stranger, and the fact that they were turned down for something similar last
 * year, or withdrew twice, is exactly what a recruiter wants before the first
 * call rather than after it.
 */
export default function CandidateDetail({ candidateId }: { candidateId: string }) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.recruitment
      .candidate(candidateId)
      .then((res) => {
        if (cancelled) return;
        setCandidate(res);
        setError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const back = (
    <Link
      href="/suite/hrm/recruitment"
      className="inline-flex items-center gap-1.5 normal-case tracking-normal hover:text-primary-700"
    >
      <ArrowLeft size={14} aria-hidden />
      Recruitment
    </Link>
  );

  if (error !== null) {
    return (
      <div>
        <PageHeader eyebrow={back} title="Candidate" />
        <LoadError title="That did not load" message={error} />
      </div>
    );
  }

  if (candidate === null) {
    return <div className="ws-card h-64 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />;
  }

  const applications = candidate.applications ?? [];
  const returning = applications.length > 1;

  const role = (a: JobApplication) =>
    a.requisition !== null && a.requisition !== undefined ? (
      <Link
        href={`/suite/hrm/recruitment/${a.requisitionId}`}
        className="block truncate font-semibold text-neutral-900 hover:text-primary-700"
      >
        {a.requisition.reference} · {a.requisition.jobTitle}
      </Link>
    ) : (
      <span className="block truncate font-semibold text-neutral-900">A role that no longer exists</span>
    );

  const detail = (a: JobApplication) =>
    `Applied ${formatDate(a.appliedAt)}${a.stage !== null && a.stage !== undefined ? ` · ${a.stage.name}` : ""} · ${a.sourceLabel}${
      a.daysToClose !== null ? ` · closed after ${a.daysToClose} days` : ""
    }`;

  const columns: Column<JobApplication>[] = [
    {
      key: "role",
      header: "Role",
      primary: true,
      sortable: true,
      value: (a) => a.requisition?.jobTitle ?? "",
      render: (a) => (
        <span className="flex min-w-0 items-center gap-3">
          <IconTile icon={Briefcase} hue="blue" size={34} />
          <span className="min-w-0">
            {role(a)}
            {/*
              Why it ended. The thing a recruiter most needs and most often has
              to go and ask somebody for.
            */}
            {a.rejectionReason !== null && (
              <span className="block truncate text-xs text-neutral-600">{richExcerpt(a.rejectionReason, 200)}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: "applied",
      header: "Applied",
      sortable: true,
      value: (a) => a.appliedAt,
      render: (a) => <span className="tabular-nums">{formatDate(a.appliedAt)}</span>,
    },
    { key: "stage", header: "Stage", hideOnMobile: true, value: (a) => a.stage?.name ?? "" },
    {
      key: "source",
      header: "Source",
      hideOnMobile: true,
      value: (a) => a.sourceLabel,
      render: (a) => <Chip hue="slate">{a.sourceLabel}</Chip>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (a) => a.statusLabel,
      render: (a) => <ToneChip tone={applicationTone(a.status)}>{a.statusLabel}</ToneChip>,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={back}
        title={candidate.name}
        subtitle={`${candidate.currentTitle ?? "-"}${candidate.currentEmployer !== null ? ` at ${candidate.currentEmployer}` : ""}${
          candidate.location !== null ? ` · ${candidate.location}` : ""
        }`}
        actions={
          /*
            The single most useful thing this page says. A returning candidate
            arrives with a history, and a recruiter who does not know that is
            about to have an awkward call.
          */
          returning ? <ToneChip tone="info" icon={History}>{`Applied ${applications.length} times`}</ToneChip> : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="cand-applications">
            <h2 id="cand-applications" className="text-lg font-bold tracking-tight text-neutral-900">
              Everything they have applied for
            </h2>
            <p className="mb-3 text-sm text-neutral-500">
              {returning ? "Read this before the first call." : "Their first application here."}
            </p>
            <DataView
              rows={applications}
              columns={columns}
              rowKey={(a) => a.id}
              storageKey="hrm.candidate.applications"
              caption="Applications by this candidate"
              searchable={false}
              gridCols={2}
              defaultView="list"
              empty={
                <Empty
                  icon={UserRound}
                  title="No applications"
                  hint="This person is on file but has not applied for anything."
                />
              }
              renderCard={(a) => (
                <div className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <IconTile icon={Briefcase} hue="blue" size={40} />
                    <ToneChip tone={applicationTone(a.status)}>{a.statusLabel}</ToneChip>
                  </div>
                  <div className="text-[15px]">{role(a)}</div>
                  <p className="text-xs text-neutral-500">{detail(a)}</p>
                  {a.rejectionReason !== null && (
                    <p className="mt-auto rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{richExcerpt(a.rejectionReason, 200)}</p>
                  )}
                </div>
              )}
              renderListItem={(a) => (
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <IconTile icon={Briefcase} hue="blue" size={36} />
                  <div className="min-w-0 flex-1 text-sm">
                    {role(a)}
                    <p className="truncate text-xs text-neutral-500">{detail(a)}</p>
                    {a.rejectionReason !== null && (
                      <p className="mt-0.5 truncate text-xs text-neutral-600">{richExcerpt(a.rejectionReason, 200)}</p>
                    )}
                  </div>
                  <ToneChip tone={applicationTone(a.status)}>{a.statusLabel}</ToneChip>
                </div>
              )}
            />
          </section>

          {candidate.notes !== null && (
            <Panel title="Notes" icon={NotebookPen} hue="sun">
              <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">{candidate.notes}</p>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="h-16 bg-gradient-to-r from-grape-100 via-sky-50 to-primary-50" aria-hidden />
            <div className="-mt-8 px-5 pb-5">
              <span className="inline-block rounded-full bg-white p-1 shadow-sm">
                <InitialsAvatar name={candidate.name} size={60} />
              </span>
              <h2 className="mt-2 text-[15px] font-semibold text-neutral-900">How to reach them</h2>
              <dl className="mt-1">
                <InfoRow icon={Mail} hue="blue" label="Email">
                  <a href={`mailto:${candidate.email}`} className="hover:text-primary-700">
                    {candidate.email}
                  </a>
                </InfoRow>
                {candidate.phone !== null && (
                  <InfoRow icon={Phone} hue="mint" label="Phone">
                    {candidate.phone}
                  </InfoRow>
                )}
                {candidate.linkedinUrl !== null && (
                  <InfoRow icon={Link2} hue="sky" label="LinkedIn">
                    <a
                      href={candidate.linkedinUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all hover:text-primary-700"
                    >
                      {candidate.linkedinUrl}
                    </a>
                  </InfoRow>
                )}
                {candidate.currentEmployer !== null && (
                  <InfoRow icon={Building2} hue="grape" label="Current employer">
                    {candidate.currentEmployer}
                  </InfoRow>
                )}
                {candidate.location !== null && (
                  <InfoRow icon={MapPin} hue="coral" label="Location">
                    {candidate.location}
                  </InfoRow>
                )}
                <InfoRow icon={CalendarDays} hue="slate" label="On file since">
                  {formatDate(candidate.createdAt)}
                </InfoRow>
              </dl>

              {candidate.referredBy !== null && candidate.referredBy !== undefined && (
                <p className="mt-3 flex items-center gap-2 rounded-xl bg-mint-50 px-3 py-2.5 text-xs font-medium text-mint-700">
                  <UserPlus size={14} aria-hidden />
                  Referred by {candidate.referredBy.name ?? "a colleague"}.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
