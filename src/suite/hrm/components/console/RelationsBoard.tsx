"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  EyeOff,
  FolderOpen,
  Gavel,
  Scale,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";
import { Button, Card, Empty, PageHeader, Panel, StatCard, StatGrid } from "@/components/workspace/kit";
import { ToneChip } from "@/suite/hrm/components/ui2/kit";
import { IconTile } from "@/suite/hrm/components/ui/recordKit";
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
 * questions about the *institution*, where cases cluster, how long they take,
 * whether the process was followed, because a per-person ranking is a list of
 * people to manage out.
 */
export default function RelationsBoard() {
  const [tab, setTab] = useState<Tab>("caseload");

  return (
    <div className="space-y-6">
      <PageHeader title="Employee relations" subtitle="Disciplinaries, grievances and the warnings still live." />
      <nav className="inline-flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-neutral-200/70" aria-label="Employee relations">
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
            className={`min-h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300 ${
              tab === key
                ? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-sm shadow-primary-600/25"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
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
      <Card>
        <Empty icon={AlertTriangle} hue="coral" title="That did not load" hint={error} />
      </Card>
    );
  }

  if (cases === null) {
    return <div className="ws-card h-64 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />;
  }

  return (
    <Panel
      title="Caseload"
      subtitle="Disciplinaries and grievances, oldest concern first."
      icon={Scale}
      hue="grape"
      actions={
        <>
          <Button size="sm" onClick={() => setIncludeClosed(!includeClosed)}>
            {includeClosed ? "Open only" : "Show closed"}
          </Button>
          <Button size="sm" variant="primary" icon={FolderOpen} onClick={() => setOpening(true)}>
            Open a case
          </Button>
        </>
      }
      bodyClassName={cases.length === 0 ? "p-5" : "pt-4"}
    >
      {cases.length === 0 ? (
        <Empty
          icon={Scale}
          hue="grape"
          title="Nothing running"
          hint="Open a disciplinary here. People raise their own grievances from My cases."
          action={
            <Button variant="primary" icon={FolderOpen} onClick={() => setOpening(true)}>
              Open a case
            </Button>
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
                className="flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5 text-left outline-none transition-colors hover:bg-neutral-50 focus-visible:bg-primary-50/60"
              >
              <IconTile
                icon={row.kind === "disciplinary" ? Gavel : ShieldQuestion}
                hue={row.kind === "disciplinary" ? "sun" : "sky"}
                size={36}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {row.reference} · {row.summary}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {row.kind === "disciplinary"
                    ? (row.subjectName ?? "Unnamed")
                    : /*
                        Anonymity is a state and saying so is the point of it.
                        A blank would read as missing data and invite somebody
                        to go and find out who.
                      */
                      (row.raisedByName ?? "-")}
                  {" · opened "}
                  {formatDate(row.openedOn)}
                </p>
              </div>

              {/*
                The figure nobody looks at. A disciplinary open for four months
                is doing more harm to the person than any outcome would.
              */}
              {row.ageInDays > 90 && (
                <ToneChip tone="error" icon={Clock}>
                  {row.ageInDays}d
                </ToneChip>
              )}

              {row.outcomeLabel !== null ? (
                <ToneChip tone={row.hasLiveWarning ? "warning" : "neutral"}>
                  {row.outcomeLabel}
                </ToneChip>
              ) : (
                <ToneChip tone="neutral">{row.statusLabel}</ToneChip>
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
    </Panel>
  );
}

/**
 * Opening a case.
 *
 * Defaults to a disciplinary, and says why a grievance is the unusual choice
 * here: a grievance is by definition brought by the person with the
 * complaint, and they have their own route to it. HR opening one on somebody's
 * behalf is a real thing, a complaint arriving by letter, or on behalf of
 * somebody who cannot use the system, but it is the exception, and doing it
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
              : "Optional, and an allegation rather than a finding; the process is what tests it."
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
 * one simply stops appearing, no job has to run for a warning to lapse.
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
    return <div className="ws-card h-48 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />;
  }

  return (
    <Panel
      title="Live warnings"
      subtitle="A warning stops counting on its expiry date, with nothing for you to do."
      icon={ShieldAlert}
      hue="sun"
      bodyClassName={cases.length === 0 ? "p-5" : "pt-4"}
    >
      {cases.length === 0 ? (
        <Empty
          icon={Scale}
          hue="mint"
          title="No live warnings"
          hint="Warnings appear here until the date they lapse."
        />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {cases.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <IconTile icon={CalendarClock} hue="sun" size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {row.subjectName ?? "Unnamed"}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {row.reference} · issued {formatDate(row.outcomeOn)}
                </p>
              </div>

              <ToneChip tone="warning">{row.outcomeLabel}</ToneChip>

              <span className="w-28 shrink-0 text-right text-xs text-neutral-500">
                {row.warningExpiresOn === null
                  ? "No expiry"
                  : `lapses ${formatDate(row.warningExpiresOn)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
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
      <Card>
        <Empty icon={AlertTriangle} hue="coral" title="That did not load" hint={error} />
      </Card>
    );
  }

  if (data === null) {
    return <div className="ws-card h-64 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />;
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
    <div className="space-y-6">
      <StatGrid>
        <StatCard icon={FolderOpen} hue="blue" label="Open" value={String(data.volume.open)} />
        <StatCard
          icon={Clock}
          hue={data.volume.runningOverNinetyDays > 0 ? "coral" : "mint"}
          label="Running over 90 days"
          value={String(data.volume.runningOverNinetyDays)}
        />
        <StatCard
          icon={CalendarClock}
          hue="sky"
          label="Median to resolve"
          value={
            data.resolution.medianDays === null
              ? "-"
              : `${data.resolution.medianDays}d`
          }
        />
        <StatCard icon={ShieldAlert} hue="sun" label="Live warnings" value={String(data.liveWarnings.total)} />
      </StatGrid>

      {/*
        Gaps rather than a compliance percentage. "94% compliant" is a
        comfortable number that hides the six cases that will be the ones
        litigated.
      */}
      <Panel
        title="Where the process has gaps"
        subtitle="Counted as cases, not as a percentage."
        icon={AlertTriangle}
        hue="coral"
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
                className="flex items-center justify-between gap-3 rounded-xl bg-sun-50/70 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 text-neutral-700">{label}</span>
                <span className="tnum shrink-0 rounded-full bg-white px-2.5 py-0.5 font-semibold text-sun-700 shadow-sm">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Where cases cluster"
          subtitle="By department."
          icon={Scale}
          hue="grape"
          bodyClassName={data.hotspots.departments.length === 0 ? "p-5" : "pt-3"}
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
              {data.hotspots.minimumGroupSize} cases. In a group that small a
              count names the person.
            </p>
          )}
        </Panel>

        <Panel
          title="Where cases land"
          subtitle="Including no case to answer."
          icon={Gavel}
          hue="sky"
          bodyClassName={data.outcomes.length === 0 ? "p-5" : "pt-3"}
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
                  <div className="ws-hatch h-2 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400"
                      style={{ width: `${row.sharePercent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
