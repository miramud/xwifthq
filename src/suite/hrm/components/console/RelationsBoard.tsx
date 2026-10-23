"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  EyeOff,
  Gavel,
  Scale,
  ShieldQuestion,
} from "lucide-react";
import { EmptyState, Pill, SectionCard } from "@/components/dashboard/ui";
import {
  hrm,
  type CaseKind,
  type RelationsCase,
  type RelationsInsights,
} from "@/lib/api/hrm-client";
import { formatDate } from "@/suite/hrm/lib/format";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import CaseWorkflow, { peopleOptions, useEmployees } from "./CaseWorkflow";
import { Dialog, ErrorNote, Field, FormActions, INPUT } from "./Dialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

type Tab = "caseload" | "warnings" | "analytics";

/**
 * Disciplinaries and grievances.
 *
 * Opens on the caseload rather than on a chart, because the thing an HR manager
 * needs from this screen is "what is running and how long has it been running".
 * A disciplinary open for four months is doing more harm to the person than any
 * outcome would, and it is the figure nobody looks at.
 *
 * Nothing here shows a league table of individuals. The analytics tab answers
 * questions about the *institution* — where cases cluster, how long they take,
 * whether the process was followed — because a per-person ranking is a list of
 * people to manage out.
 */
export default function RelationsBoard() {
  const [tab, setTab] = useState<Tab>("caseload");

  return (
    <div className="space-y-4 sm:space-y-6">
      <nav className="flex flex-wrap gap-1.5" aria-label="Employee relations">
        {(
          [
            ["caseload", "Caseload"],
            ["warnings", "Live warnings"],
            ["analytics", "Patterns"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === key
                ? "bg-primary-600 text-white"
                : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "caseload" && <Caseload />}
      {tab === "warnings" && <Warnings />}
      {tab === "analytics" && <Patterns />}
    </div>
  );
}

function Caseload() {
  const [cases, setCases] = useState<RelationsCase[] | null>(null);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    hrm.relations
      .list({ includeClosed })
      .then((result) => {
        if (!cancelled) setCases(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [includeClosed, reloadKey]);

  if (error !== null) {
    return (
      <SectionCard title="Caseload">
        <EmptyState icon={AlertTriangle} title="That did not load" hint={error} />
      </SectionCard>
    );
  }

  if (cases === null) {
    return <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />;
  }

  return (
    <SectionCard
      title="Caseload"
      subtitle="Disciplinaries and grievances, oldest concern first."
      action={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIncludeClosed(!includeClosed)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            {includeClosed ? "Open only" : "Show closed"}
          </button>
          <button
            type="button"
            onClick={() => setOpening(true)}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
          >
            Open a case
          </button>
        </div>
      }
      bodyClassName={cases.length === 0 ? "p-5" : "p-0"}
    >
      {cases.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nothing running"
          hint="Open a disciplinary here. Grievances are raised by the person themselves, from My cases."
          action={
            <button
              type="button"
              onClick={() => setOpening(true)}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
            >
              Open a case
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {cases.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelected(selected === row.id ? null : row.id)}
                aria-expanded={selected === row.id}
                className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-neutral-50"
              >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  row.kind === "disciplinary"
                    ? "bg-warning-500/10 text-warning-700"
                    : "bg-info-500/10 text-info-700"
                }`}
              >
                {row.kind === "disciplinary" ? (
                  <Gavel size={15} />
                ) : (
                  <ShieldQuestion size={15} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {row.reference} · {row.summary}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {row.kind === "disciplinary"
                    ? (row.subjectName ?? "Unnamed")
                    : /*
                        Anonymity is a state and saying so is the point of it.
                        A blank would read as missing data and invite somebody
                        to go and find out who.
                      */
                      (row.raisedByName ?? "—")}
                  {" · opened "}
                  {formatDate(row.openedOn)}
                </p>
              </div>

              {/*
                The figure nobody looks at. A disciplinary open for four months
                is doing more harm to the person than any outcome would.
              */}
              {row.ageInDays > 90 && (
                <Pill tone="error">
                  <Clock size={11} className="mr-1 inline" />
                  {row.ageInDays}d
                </Pill>
              )}

              {row.outcomeLabel !== null ? (
                <Pill tone={row.hasLiveWarning ? "warning" : "neutral"}>
                  {row.outcomeLabel}
                </Pill>
              ) : (
                <Pill tone="neutral">{row.statusLabel}</Pill>
              )}
              </button>

              {/*
                Loaded on expand rather than with the list. The detail carries
                the findings and the event trail, and fetching those for a
                caseload of forty would pull a great deal of confidential
                material nobody asked to see.
              */}
              {selected === row.id && (
                <CaseWorkflow
                  caseId={row.id}
                  onChanged={() => setReloadKey((k) => k + 1)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {opening && (
        <OpenCaseDialog
          onClose={() => setOpening(false)}
          onOpened={(id) => {
            setOpening(false);
            setSelected(id);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </SectionCard>
  );
}

/**
 * Opening a case.
 *
 * Defaults to a disciplinary, and says why a grievance is the unusual choice
 * here: a grievance is by definition brought by the person with the
 * complaint, and they have their own route to it. HR opening one on somebody's
 * behalf is a real thing — a complaint arriving by letter, or on behalf of
 * somebody who cannot use the system — but it is the exception, and doing it
 * silently would mean a grievance whose author nobody can identify.
 */
function OpenCaseDialog({
  onClose,
  onOpened,
}: {
  onClose: () => void;
  onOpened: (id: string) => void;
}) {
  const [kind, setKind] = useState<CaseKind>("disciplinary");
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [raisedById, setRaisedById] = useState("");
  const people = useEmployees();

  /*
    Not `useSubmit`: this is the one form whose caller needs the id of the
    thing it created, so that the new case opens expanded rather than making
    somebody find it in the list.
  */
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailure(null);

    try {
      const created = await hrm.relations.open({
        kind,
        summary,
        detail: detail === "" ? null : detail,
        subjectId: subjectId === "" ? null : subjectId,
        raisedById: raisedById === "" ? null : raisedById,
      });

      onOpened(created.id);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "That did not open.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Open a case"
      subtitle="Formally, with a record from this moment on."
      onClose={onClose}
    >
      <form onSubmit={send} className="space-y-3">
        <Field
          id="case-kind"
          label="Kind"
          hint="A grievance is normally raised by the person themselves from My cases. Open one here only when it arrived some other way."
        >
          <SearchableSelect
            id="case-kind"
            aria-describedby="case-kind-hint"
            value={kind}
            onChange={(v) => setKind(v as CaseKind)}
            options={[
              { value: "disciplinary", label: "Disciplinary" },
              { value: "grievance", label: "Grievance" },
            ]}
          />
        </Field>

        <Field
          id="case-subject"
          label={kind === "disciplinary" ? "Who it concerns" : "Who it is about"}
          hint={
            kind === "disciplinary"
              ? "Required. A disciplinary with nobody named is not a case."
              : "Optional, and an allegation rather than a finding — the process is what tests it."
          }
        >
          <SearchableSelect
            id="case-subject"
            aria-describedby="case-subject-hint"
            value={subjectId}
            onChange={setSubjectId}
            required={kind === "disciplinary"}
            options={[{ value: "", label: "Nobody named" }, ...peopleOptions(people)]}
          />
        </Field>

        {kind === "grievance" && (
          <Field
            id="case-raised-by"
            label="Raised by"
            hint="Leave blank to record it anonymously. HR will see the grievance but not who brought it."
          >
            <SearchableSelect
              id="case-raised-by"
              aria-describedby="case-raised-by-hint"
              value={raisedById}
              onChange={setRaisedById}
              options={[{ value: "", label: "Anonymously" }, ...peopleOptions(people)]}
            />
          </Field>
        )}

        <Field id="case-summary" label="What it is about" hint="One line.">
          <input
            id="case-summary"
            aria-describedby="case-summary-hint"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={2000}
            required
            className={INPUT}
          />
        </Field>

        <Field id="case-detail" label="Detail">
          <RichTextEditor id="case-detail" variant="full" value={detail} onChange={setDetail} />
        </Field>

        <ErrorNote error={failure} />
        <FormActions
          onCancel={onClose}
          submitLabel="Open it"
          saving={busy}
          disabled={
            summary.trim() === "" || (kind === "disciplinary" && subjectId === "")
          }
        />
      </form>
    </Dialog>
  );
}

/**
 * Warnings still standing across the institution.
 *
 * Derived from cases rather than read from a register, which is why an expired
 * one simply stops appearing — no job has to run for a warning to lapse.
 */
function Warnings() {
  const [cases, setCases] = useState<RelationsCase[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.relations
      .list({ includeClosed: true })
      .then((result) => {
        if (!cancelled) setCases(result.filter((c) => c.hasLiveWarning));
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (cases === null) {
    return <div className="h-48 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />;
  }

  return (
    <SectionCard
      title="Live warnings"
      subtitle="A warning stops counting on its expiry date. Nothing has to run for that to happen."
      bodyClassName={cases.length === 0 ? "p-5" : "p-0"}
    >
      {cases.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No live warnings"
          hint="Warnings appear here until the date they lapse."
        />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {cases.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {row.subjectName ?? "Unnamed"}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {row.reference} · issued {formatDate(row.outcomeOn)}
                </p>
              </div>

              <Pill tone="warning">{row.outcomeLabel}</Pill>

              <span className="w-28 shrink-0 text-right text-[11px] text-neutral-500">
                {row.warningExpiresOn === null
                  ? "No expiry"
                  : `lapses ${formatDate(row.warningExpiresOn)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/**
 * What the casework says about the institution.
 *
 * Deliberately not a league table. The useful findings are "cases here cluster
 * in one department" and "we decide warnings without investigating", because
 * both are actionable by the institution; a ranking of individuals is a list of
 * people to manage out.
 */
function Patterns() {
  const [data, setData] = useState<RelationsInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.relations
      .analytics()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null) {
    return (
      <SectionCard title="Patterns">
        <EmptyState icon={AlertTriangle} title="That did not load" hint={error} />
      </SectionCard>
    );
  }

  if (data === null) {
    return <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />;
  }

  const gaps = Object.entries({
    "Hearings with no record that a companion was offered":
      data.procedure.hearingsWithoutCompanionOffer,
    "Decisions with no reasons recorded": data.procedure.decisionsWithoutReasons,
    "Warnings issued with no investigation recorded":
      data.procedure.decidedWithoutInvestigation,
    "Appeals still outstanding": data.procedure.appealsOutstanding,
  }).filter(([, count]) => count > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Open" value={String(data.volume.open)} />
        <Figure
          label="Running over 90 days"
          value={String(data.volume.runningOverNinetyDays)}
          tone={data.volume.runningOverNinetyDays > 0 ? "warning" : undefined}
        />
        <Figure
          label="Median to resolve"
          value={
            data.resolution.medianDays === null
              ? "—"
              : `${data.resolution.medianDays}d`
          }
        />
        <Figure label="Live warnings" value={String(data.liveWarnings.total)} />
      </div>

      {/*
        Gaps rather than a compliance percentage. "94% compliant" is a
        comfortable number that hides the six cases that will be the ones
        litigated.
      */}
      <SectionCard
        title="Where the process has gaps"
        subtitle="Counted as cases, not as a percentage."
      >
        {gaps.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing missing on the cases recorded so far.
          </p>
        ) : (
          <ul className="space-y-2">
            {gaps.map(([label, count]) => (
              <li
                key={label}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 text-neutral-700">{label}</span>
                <span className="tnum shrink-0 font-semibold text-warning-700">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Where cases cluster"
          subtitle="By department."
          bodyClassName={data.hotspots.departments.length === 0 ? "p-5" : "p-0"}
        >
          {data.hotspots.departments.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nothing large enough to report.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.hotspots.departments.map((row) => (
                <li
                  key={row.department}
                  className="flex items-center gap-3 px-5 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                    {row.department}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {row.disciplinaries} disc · {row.grievances} griev
                  </span>
                  <span className="tnum text-sm font-medium text-neutral-900">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/*
            Said out loud rather than silently dropped. A category that
            vanishes reads as zero, and somebody would conclude the quiet
            departments are the healthy ones.
          */}
          {data.hotspots.withheldGroups > 0 && (
            <p className="flex items-start gap-2 px-5 py-3 text-[11px] text-neutral-500">
              <EyeOff size={12} className="mt-0.5 shrink-0" />
              {data.hotspots.withheldGroups}{" "}
              {data.hotspots.withheldGroups === 1 ? "group is" : "groups are"}{" "}
              withheld for being smaller than{" "}
              {data.hotspots.minimumGroupSize} cases — in a group that small a
              count names the person.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Where cases land"
          subtitle="Including no case to answer."
          bodyClassName={data.outcomes.length === 0 ? "p-5" : "p-0"}
        >
          {data.outcomes.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing decided yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.outcomes.map((row) => (
                <li key={row.outcome} className="px-5 py-2.5">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-neutral-700">
                      {row.label}
                    </span>
                    <span className="tnum shrink-0 text-sm text-neutral-900">
                      {row.count}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${row.sharePercent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p
        className={`tnum mt-1 text-xl font-semibold ${
          tone === "warning" ? "text-warning-600" : "text-neutral-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
