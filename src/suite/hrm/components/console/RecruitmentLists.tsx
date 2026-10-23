"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Briefcase, Building2, CalendarClock, FileSignature, Mail, Users } from "lucide-react";
import { Chip, Empty, PersonAvatar, SearchField } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor } from "@/components/workspace/modules";
import { hrm, type Candidate, type JobOffer } from "@/lib/api/hrm-client";
import { formatDate, nairaFromKobo } from "@/suite/hrm/lib/format";
import { IconTile, LoadError, PersonCell, ToneChip } from "../ui/recordKit";

/**
 * Everybody who has ever applied, and every offer out with somebody.
 *
 * Both endpoints existed and neither had a screen. The consequences are
 * different and both are real.
 *
 * **Candidates could only be reached through the role they applied for.** So
 * the question "have we seen this person before" — the one worth asking before
 * a third interview, and the one that finds the good applicant rejected for a
 * different job last spring — could not be asked at all.
 *
 * **Offers could only be seen one application at a time.** An offer is the
 * part of recruitment with a clock on it: it lapses, and a lapsed offer is a
 * candidate who has taken something else. A list of them is the only way to
 * see that happening.
 */

export function Candidates() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    /*
      Debounced rather than fired per keystroke: this searches every candidate
      the institution has ever had, and the list is worth waiting a beat for.
    */
    const timer = window.setTimeout(() => {
      hrm.recruitment
        .candidates(query === "" ? undefined : query)
        .then((result) => {
          if (cancelled) return;
          setRows(result);
          setError(null);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  /*
    The count is the useful part. Somebody on their fourth application is
    either very keen or has been turned down three times, and both are worth
    knowing before the interview.
  */
  const applications = (c: Candidate) =>
    c.applications !== undefined ? (
      <Chip hue={c.applications.length > 1 ? "grape" : "slate"}>
        {c.applications.length} {c.applications.length === 1 ? "application" : "applications"}
      </Chip>
    ) : null;

  const role = (c: Candidate) =>
    [c.currentTitle, c.currentEmployer ? `at ${c.currentEmployer}` : null].filter(Boolean).join(" ");

  const columns: Column<Candidate>[] = [
    {
      key: "name",
      header: "Candidate",
      primary: true,
      sortable: true,
      value: (c) => c.name,
      render: (c) => <PersonCell name={c.name} sub={c.email} />,
    },
    {
      key: "now",
      header: "Currently",
      sortable: true,
      hideOnMobile: true,
      value: (c) => role(c),
      render: (c) => (role(c) ? <span className="text-neutral-700">{role(c)}</span> : <span className="text-neutral-400">-</span>),
    },
    {
      key: "location",
      header: "Location",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.location ?? "",
    },
    {
      key: "applications",
      header: "Applications",
      sortable: true,
      value: (c) => c.applications?.length ?? 0,
      render: (c) => applications(c),
    },
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-neutral-500">Everybody who has applied for anything, not just one role.</p>
      {error !== null ? (
        <LoadError message={error} />
      ) : (
        <DataView
          rows={rows ?? []}
          columns={columns}
          rowKey={(c) => c.id}
          rowHref={(c) => `/suite/hrm/recruitment/candidates/${c.id}`}
          storageKey="hrm.recruitment.candidates"
          caption="Candidates"
          // The search goes to the API: it covers every candidate ever, not a page of them.
          searchable={false}
          toolbar={
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Name or email…"
              label="Search candidates"
              className="w-full sm:w-72"
            />
          }
          empty={
            rows === null ? (
              <div className="h-32 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />
            ) : (
              <Empty
                icon={Users}
                hue="grape"
                title={query === "" ? "Nobody yet" : "Nobody matches that"}
                hint={query === "" ? "Candidates appear here as they apply." : "Try part of a name or an email address."}
              />
            )
          }
          renderCard={(c) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <PersonAvatar name={c.name} size={48} />
                {applications(c)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-neutral-900">{c.name}</p>
                <p className="truncate text-sm text-neutral-500">{role(c) || "-"}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
                <Chip hue="slate" icon={Mail}>
                  <span className="max-w-[12rem] truncate">{c.email}</span>
                </Chip>
                {c.location && <Chip hue={hueFor(c.location)}>{c.location}</Chip>}
              </div>
            </div>
          )}
          renderListItem={(c) => (
            <div className="flex items-center gap-4 px-5 py-3.5">
              <PersonAvatar name={c.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{c.name}</p>
                <p className="truncate text-xs text-neutral-500">
                  {c.email}
                  {c.currentTitle !== null && ` · ${c.currentTitle}`}
                  {c.currentEmployer !== null && ` at ${c.currentEmployer}`}
                </p>
              </div>
              {applications(c)}
            </div>
          )}
        />
      )}
    </div>
  );
}

export function Offers() {
  const [rows, setRows] = useState<JobOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.recruitment
      .offers()
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const lapsed = (rows ?? []).filter((row) => row.hasLapsed && row.isOpen);

  /*
    Lapsed outranks the status. An offer still marked "sent" a fortnight after
    it expired is not sent, it is gone, and the status alone would keep
    somebody waiting on a reply.
  */
  const status = (offer: JobOffer) =>
    offer.hasLapsed && offer.isOpen ? (
      <ToneChip tone="error">Lapsed</ToneChip>
    ) : (
      <ToneChip tone={offer.isAccepted ? "success" : "neutral"}>{offer.statusLabel}</ToneChip>
    );

  const expiry = (offer: JobOffer) =>
    offer.expiresOn !== null ? `${offer.hasLapsed ? "expired" : "expires"} ${formatDate(offer.expiresOn)}` : null;

  const columns: Column<JobOffer>[] = [
    {
      key: "role",
      header: "Offer",
      primary: true,
      sortable: true,
      value: (o) => o.jobTitle,
      render: (o) => (
        <span className="flex min-w-0 items-center gap-3">
          <IconTile icon={FileSignature} hue={o.isAccepted ? "mint" : o.hasLapsed && o.isOpen ? "coral" : "blue"} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{o.jobTitle}</span>
            <span className="block truncate text-xs text-neutral-500">
              {o.application?.candidateName ?? "A candidate"}
              {o.department !== null && ` · ${o.department}`}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "salary",
      header: "Salary",
      sortable: true,
      align: "right",
      value: (o) => o.salaryKobo,
      render: (o) => (
        <span className="whitespace-nowrap">
          <span className="font-semibold text-neutral-900">{nairaFromKobo(o.salaryKobo)}</span>
          <span className="text-xs text-neutral-500"> per {o.salaryPeriod}</span>
        </span>
      ),
    },
    {
      key: "starts",
      header: "Starts",
      sortable: true,
      hideOnMobile: true,
      value: (o) => o.startsOn ?? "",
      render: (o) => <span className="tabular-nums">{formatDate(o.startsOn)}</span>,
    },
    {
      key: "expires",
      header: "Expiry",
      sortable: true,
      hideOnMobile: true,
      value: (o) => o.expiresOn ?? "",
      render: (o) => <span className="text-xs text-neutral-500">{expiry(o) ?? "-"}</span>,
    },
    { key: "status", header: "Status", render: (o) => status(o) },
  ];

  return (
    <div className="space-y-4">
      {/*
        A lapsed offer is usually a candidate who has taken something else.
        Nothing else in the module says so, and by the time anybody notices on
        the application itself the person has stopped answering.
      */}
      {lapsed.length > 0 && (
        <div className="flex items-start gap-3 rounded-[1.125rem] border border-coral-100 bg-coral-50/70 p-4 sm:p-5">
          <IconTile icon={AlertTriangle} hue="coral" size={36} className="bg-white" />
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              {lapsed.length} {lapsed.length === 1 ? "offer has" : "offers have"} gone past their date
            </h2>
            <p className="mt-1 text-sm text-neutral-700">
              Somebody who has not answered an offer by its expiry has usually accepted something else. Worth a call
              before it is withdrawn.
            </p>
          </div>
        </div>
      )}

      <p className="text-sm text-neutral-500">Everything out with a candidate, and everything recently settled.</p>

      {error !== null ? (
        <LoadError message={error} />
      ) : rows === null ? (
        <div className="ws-card h-32 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />
      ) : (
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(o) => o.id}
          storageKey="hrm.recruitment.offers"
          caption="Offers"
          searchPlaceholder="Search offers"
          empty={
            <Empty
              icon={FileSignature}
              title="No offers"
              hint="An offer is drafted from an application once somebody has been chosen."
            />
          }
          renderCard={(o) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <IconTile icon={FileSignature} hue={o.isAccepted ? "mint" : o.hasLapsed && o.isOpen ? "coral" : "blue"} size={44} />
                {status(o)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-neutral-900">{o.jobTitle}</p>
                <p className="truncate text-sm text-neutral-500">{o.application?.candidateName ?? "A candidate"}</p>
              </div>
              <p className="text-xl font-bold tracking-tight tabular-nums text-neutral-900">
                {nairaFromKobo(o.salaryKobo)}
                <span className="ml-1 text-xs font-medium text-neutral-500">per {o.salaryPeriod}</span>
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
                {o.department !== null && <Chip hue={hueFor(o.department)} icon={Building2}>{o.department}</Chip>}
                <Chip hue="slate" icon={Briefcase}>{o.employmentTypeLabel}</Chip>
                {o.startsOn !== null && <Chip hue="sky" icon={CalendarClock}>Starts {formatDate(o.startsOn)}</Chip>}
              </div>
            </div>
          )}
          renderListItem={(o) => (
            <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <IconTile icon={FileSignature} hue={o.isAccepted ? "mint" : o.hasLapsed && o.isOpen ? "coral" : "blue"} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {o.jobTitle}
                  {o.department !== null && <span className="text-xs font-normal text-neutral-500"> · {o.department}</span>}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {nairaFromKobo(o.salaryKobo)} per {o.salaryPeriod}
                  {o.startsOn !== null && ` · starts ${formatDate(o.startsOn)}`}
                </p>
              </div>
              {expiry(o) && <span className="text-xs text-neutral-500">{expiry(o)}</span>}
              {status(o)}
            </div>
          )}
        />
      )}
    </div>
  );
}
