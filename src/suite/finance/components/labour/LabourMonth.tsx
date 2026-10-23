"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { AlertOctagon, ArrowUpRight, BookCheck, BookX, Download, FolderLock, CheckCircle2, ChevronLeft, ChevronRight, FolderKanban, History, Stamp, TriangleAlert, Users, Wallet, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { ApiError, blockerList, errorText, labour, overridable, type LabourBlockerCode, type LabourMethod, type LabourPosted, type LabourPreview } from "@/lib/api/finance-labour-client";
import { Button, ButtonLink, Card, Chip, Panel, Segmented, UnderlineTabs, cx } from "@/components/workspace/kit";
import { BackLink, ErrorNote, Skeleton, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { mayDo, mayUseFinance } from "@/suite/finance/lib/finance-access";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { addMonths, thisMonth } from "@/suite/finance/components/projects/meta";
import { ExceptionList, LabourSplit, ProjectShares } from "./LabourParts";
import { csvAmount, downloadCsv } from "@/components/workspace/csv";
import { METHOD, hoursOf, hoursText, isMonthKey } from "./meta";

/** The icon beside each blocker: no payroll run, a payroll not in the books, hours on a closed project. */
const BLOCKER_ICON: Record<LabourBlockerCode, LucideIcon> = {
  no_payroll: Wallet,
  payroll_not_posted: BookX,
  closed_project: FolderLock,
};

/**
 * One month before it is posted (Finance PRD §9): is the payroll in the
 * books, where would its cost go - projects or bench - and what needs a
 * look first. Blockers stop the post; a closed-project blocker alone can be
 * lifted with a written override. Those allowed to see individual pay get a
 * People tab with each person's cost, rate and hours.
 */

const CLOSED_STATUSES = ["complete", "completed", "cancelled", "archived", "closed"];

type Tab = "projects" | "exceptions" | "people";

export default function LabourMonth({ month }: { month: string }) {
  const { user } = useAuth();
  const valid = isMonthKey(month);
  const [method, setMethod] = useState<LabourMethod | null>(null);
  const [p, setP] = useState<LabourPreview | null>(null);
  const [seesPeople, setSeesPeople] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("projects");
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState<LabourPosted | null>(null);

  const wantsPeople = mayUseFinance(user, "labour_people");

  /*
    With the people key the people route is the preview plus each person;
    without it that route answers 403, so it is only tried when the key is
    held - and a 403 then falls back to the totals.
  */
  const fetchPreview = useCallback(async (m: string, how: LabourMethod | null): Promise<{ data: LabourPreview; people: boolean }> => {
    if (wantsPeople) {
      try {
        return { data: await labour.people(m, how), people: true };
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 403)) throw e;
      }
    }
    return { data: await labour.preview(m, how), people: false };
  }, [wantsPeople]);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    fetchPreview(month, method).then(
      (r) => {
        if (!alive) return;
        setP(r.data);
        setSeesPeople(r.people && r.data.people !== null);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(`The preview didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [valid, month, method, reload, fetchPreview]);

  if (!valid)
    return (
      <div>
        <BackLink href="/suite/finance/labour" label="Labour costing" />
        <ErrorNote>That isn&apos;t a month. Open one from the calendar on Labour costing.</ErrorNote>
      </div>
    );

  const now = thisMonth();
  const title = `Labour for ${monthLabel(month)}`;
  const canPost = mayDo(user, "labour", "post");
  const nav = (
    <div className="flex items-center gap-1">
      <Link
        href={`/suite/finance/labour/${addMonths(month, -1)}`}
        aria-label={`Previous month, ${monthLabel(addMonths(month, -1))}`}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <ChevronLeft size={18} aria-hidden />
      </Link>
      {month < now ? (
        <Link
          href={`/suite/finance/labour/${addMonths(month, 1)}`}
          aria-label={`Next month, ${monthLabel(addMonths(month, 1))}`}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <ChevronRight size={18} aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-100 text-neutral-300">
          <ChevronRight size={18} />
        </span>
      )}
    </div>
  );

  const head = (
    <>
      <BackLink href="/suite/finance/labour" label="Labour costing" />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Preview before posting</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">{title}</h1>
          {p && (
            <p className="mt-1 text-sm text-neutral-500">
              {p.totals.people} {p.totals.people === 1 ? "person" : "people"} on the payroll · {hoursText(p.totals.hours)} logged · standard month {p.standardHours} h
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {nav}
          {p && canPost && (
            <Button variant="primary" icon={Stamp} onClick={() => setPosting(true)} disabled={p.blockers.length > 0 && !overridable(p)}>
              Post allocation
            </Button>
          )}
        </div>
      </div>
    </>
  );

  if (loadError)
    return (
      <div>
        {head}
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!p)
    return (
      <div aria-busy="true">
        {head}
        <p className="sr-only">Loading the preview…</p>
        <Skeleton className="mb-5 h-40" />
        <Skeleton className="h-80" />
      </div>
    );

  const closed = (status: string | null) => (status && CLOSED_STATUSES.includes(status.toLowerCase()) ? status : null);
  const names = new Map(p.projects.map((x) => [x.projectId, x.project]));
  const tabs = [
    { key: "projects", label: "Projects", count: p.projects.length },
    { key: "exceptions", label: "Exceptions", count: p.exceptions.length },
    ...(seesPeople ? [{ key: "people", label: "People", count: p.people?.length ?? 0 }] : []),
  ];
  const shown: Tab = tab === "people" && !seesPeople ? "projects" : tab;

  /* The tab on screen: each project's share, or (for those who may see pay) each person's cost and where it went. */
  const exportCsv = () => {
    const method = METHOD[p.method]?.short ?? p.method;
    if (shown === "people" && p.people) {
      downloadCsv(`labour_${month}_people.csv`, [
        ["Month", "Method", "Person", "Project", "Hours", "Currency", "Loaded cost", "Hourly rate", "Amount", "Bench"],
        ...p.people.flatMap((x) => [
          [month, method, x.name ?? "", "All projects", hoursOf(x.minutes), "NGN", csvAmount(x.loaded), csvAmount(x.hourlyRate), "", csvAmount(x.bench)],
          ...x.lines.map((l) => [month, method, x.name ?? "", names.get(l.projectId) ?? "", hoursOf(l.minutes), "NGN", "", "", csvAmount(l.amount), ""]),
        ]),
      ]);
      return;
    }
    downloadCsv(`labour_${month}_projects.csv`, [
      ["Month", "Method", "Project", "Project status", "People", "Hours", "Currency", "Amount"],
      ...p.projects.map((x) => [month, method, x.project ?? "", x.status ?? "", x.people, hoursOf(x.minutes), "NGN", csvAmount(x.amount)]),
    ]);
  };

  return (
    <div>
      {head}

      {posted && (
        <p role="status" className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">
          <CheckCircle2 size={16} aria-hidden />
          Allocation posted: {amount(posted.allocated)} to projects, {amount(posted.bench)} on the bench.
          <Link href={`/suite/finance/labour/runs/${posted.id}`} className="font-semibold underline-offset-2 hover:underline">
            Open the run
          </Link>
          {posted.journalId && (
            <Link href={`/suite/finance/journals/${posted.journalId}`} className="font-semibold underline-offset-2 hover:underline">
              Open the journal
            </Link>
          )}
        </p>
      )}

      {p.blockers.length > 0 && (
        <div role="alert" className="mb-5 rounded-[1.125rem] border border-rose-500/25 bg-rose-50 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-rose-700">
            <AlertOctagon size={18} aria-hidden />
            {overridable(p) ? "Posting needs a Finance override" : p.blockers.length === 1 ? "This month can't be posted yet" : `This month can't be posted yet: ${p.blockers.length} things first`}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-rose-700">
            {blockerList(p).map((b, i) => {
              const Icon = b.code ? BLOCKER_ICON[b.code] : null;
              return (
                <li key={`${i}-${b.text}`} className="flex gap-2">
                  {Icon ? <Icon size={15} className="mt-0.5 shrink-0" aria-hidden /> : <span aria-hidden>·</span>}
                  {b.text}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-500">Loaded payroll cost</p>
              <p className="mt-1 text-[36px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">{compact(p.totals.loaded)}</p>
              <p className="mt-1 text-xs tabular-nums text-neutral-500">{amount(p.totals.loaded)}, employer costs included</p>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-neutral-500">Method</span>
              <Segmented
                label="Costing method for this preview"
                value={p.method}
                onChange={(m) => setMethod(m)}
                options={[
                  { key: "standard_hours", label: METHOD.standard_hours.short },
                  { key: "proportional", label: METHOD.proportional.short },
                ]}
              />
            </div>
          </div>
          <LabourSplit loaded={p.totals.loaded} allocated={p.totals.allocated} bench={p.totals.unallocated} />
          <p className="mt-4 text-xs text-neutral-500">{METHOD[p.method]?.hint}</p>
        </Card>

        <PayrollCard p={p} />
      </div>

      <section className="ws-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-3">
          <div className="min-w-0 flex-1">
            <UnderlineTabs tabs={tabs} active={shown} onChange={(k) => setTab(k as Tab)} />
          </div>
          {shown !== "exceptions" && (
            <Button size="sm" icon={Download} onClick={exportCsv} disabled={shown === "people" ? !p.people?.length : p.projects.length === 0}>
              Download CSV
            </Button>
          )}
        </div>
        <div className="pt-4">
          {shown === "projects" && (
            <ProjectShares
              caption={`Labour charged to each project, ${monthLabel(month)}`}
              rows={p.projects.map((x) => ({
                projectId: x.projectId,
                project: x.project,
                hours: hoursOf(x.minutes),
                people: x.people,
                amount: x.amount,
                flag: closed(x.status) ? `Project ${closed(x.status)}` : null,
              }))}
            />
          )}
          {shown === "exceptions" && (
            <div className="px-5 pb-5">
              <ExceptionList exceptions={p.exceptions} />
            </div>
          )}
          {shown === "people" && p.people && <PeopleTable people={p.people} names={names} month={month} />}
        </div>
      </section>

      {posting && (
        <PostDialog
          preview={p}
          onClose={() => setPosting(false)}
          onPosted={(r) => {
            setPosting(false);
            setPosted(r);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PayrollCard({ p }: { p: LabourPreview }) {
  const run = p.payrollRun;
  return (
    <Panel title="Payroll" subtitle={monthLabel(p.month)} icon={Wallet} hue={run?.posted ? "mint" : "sun"}>
      {run === null ? (
        <div className="space-y-3">
          <Chip hue="rose" icon={TriangleAlert}>
            No approved payroll
          </Chip>
          <p className="text-sm text-neutral-600">HR hasn&apos;t approved a payroll for this month yet, so there is no cost to spread.</p>
          <ButtonLink href="/suite/finance/payroll" icon={ArrowUpRight} size="sm">
            Payroll postings
          </ButtonLink>
        </div>
      ) : !run.posted ? (
        <div className="space-y-3">
          <Chip hue="sun" icon={TriangleAlert}>
            Approved, not in the books
          </Chip>
          <p className="text-sm text-neutral-600">{run.reference ?? "The payroll"} is approved in HR. Post it to the books first; then this month can be allocated.</p>
          <ButtonLink href="/suite/finance/payroll" icon={ArrowUpRight} size="sm" variant="primary">
            Post the payroll
          </ButtonLink>
        </div>
      ) : (
        <div className="space-y-3">
          <Chip hue="mint" icon={BookCheck}>
            In the books
          </Chip>
          <p className="text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">{run.reference ?? "The payroll"}</span> is posted, so its cost can be spread over projects.
          </p>
        </div>
      )}
      {p.existingRun && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
          <p className="flex items-center gap-1.5 font-semibold text-neutral-900">
            <History size={15} aria-hidden />
            Already allocated
          </p>
          <p className="mt-0.5">
            {amount(p.existingRun.allocated)} went to projects on {day(p.existingRun.postedAt)}.{" "}
            <Link href={`/suite/finance/labour/runs/${p.existingRun.id}`} className="font-semibold text-primary-700 underline-offset-2 hover:underline">
              Open that run
            </Link>
          </p>
        </div>
      )}
    </Panel>
  );
}

function PeopleTable({ people, names, month }: { people: NonNullable<LabourPreview["people"]>; names: Map<string, string | null>; month: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Each person&apos;s loaded cost, hourly rate and hours, {monthLabel(month)}</caption>
        <thead>
          <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <th scope="col" className="py-2.5 pl-5 pr-3">Person</th>
            <th scope="col" className="px-3 py-2.5 text-right">Loaded cost</th>
            <th scope="col" className="px-3 py-2.5 text-right">Hourly rate</th>
            <th scope="col" className="px-3 py-2.5 text-right">Hours</th>
            <th scope="col" className="px-3 py-2.5">To projects</th>
            <th scope="col" className="py-2.5 pl-3 pr-5 text-right">Bench</th>
          </tr>
        </thead>
        <tbody>
          {people.map((x) => (
            <tr key={x.userId} className="border-b border-neutral-100 align-top last:border-b-0">
              <td className="py-3 pl-5 pr-3 font-semibold text-neutral-900">{x.name ?? "Someone"}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-neutral-700">{amount(x.loaded)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-neutral-700">{amount(x.hourlyRate)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-neutral-700">{hoursText(hoursOf(x.minutes))}</td>
              <td className="px-3 py-3">
                {x.lines.length === 0 ? (
                  <span className="text-neutral-500">None</span>
                ) : (
                  <ul className="space-y-1">
                    {x.lines.map((l) => (
                      <li key={l.projectId} className="flex justify-between gap-3 text-xs">
                        <span className="truncate text-neutral-700">
                          {names.get(l.projectId) ?? "A project"} · {hoursText(hoursOf(l.minutes))}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-neutral-900">{amount(l.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className={cx("whitespace-nowrap py-3 pl-3 pr-5 text-right tabular-nums", x.bench > 0 ? "text-sun-700" : "text-neutral-500")}>{amount(x.bench)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Posting                                                            */
/* ------------------------------------------------------------------ */

function PostDialog({ preview: p, onClose, onPosted }: { preview: LabourPreview; onClose: () => void; onPosted: (r: LabourPosted) => void }) {
  const uid = useId();
  const needsOverride = overridable(p);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string[] | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsOverride && reason.trim() === "") {
      setReasonError("Say why this month can post with hours on a closed project.");
      return;
    }
    setBusy(true);
    setError(null);
    setReasonError(null);
    try {
      const r = await labour.post(p.month, { method: p.method, overrideReason: needsOverride ? reason.trim() : null });
      onPosted(r);
    } catch (err) {
      const messages = err instanceof ApiError && err.errors ? Object.values(err.errors).flat().filter((m): m is string => typeof m === "string") : [];
      setError(messages.length ? messages : [errorText(err)]);
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={`Post labour for ${monthLabel(p.month)}?`}
      subtitle={`${amount(p.totals.allocated)} to ${p.projects.length === 1 ? "1 project" : `${p.projects.length} projects`}, ${amount(p.totals.unallocated)} on the bench, by ${METHOD[p.method]?.label.toLowerCase() ?? p.method}.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={Stamp} disabled={busy}>
            {busy ? "Posting…" : "Post allocation"}
          </Button>
        </div>
      }
    >
      {error && (
        <div role="alert" className="rounded-xl bg-error-500/5 px-4 py-3 text-sm text-error-700">
          {error.length === 1 ? (
            error[0]
          ) : (
            <ul className="list-inside list-disc space-y-1">
              {error.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ul className="space-y-3 text-sm text-neutral-700">
        <li className="flex gap-3">
          <FolderKanban size={18} aria-hidden className="mt-0.5 shrink-0 text-primary-600" />
          <span>One journal moves the month&apos;s labour cost onto the projects it was logged to, dated the last day of the month.</span>
        </li>
        {p.existingRun && (
          <li className="flex gap-3">
            <History size={18} aria-hidden className="mt-0.5 shrink-0 text-sun-600" />
            <span>
              The allocation posted on {day(p.existingRun.postedAt)} ({amount(p.existingRun.allocated)} to projects) is <strong className="font-semibold">reversed and replaced</strong> by this one.
            </span>
          </li>
        )}
        <li className="flex gap-3">
          <Users size={18} aria-hidden className="mt-0.5 shrink-0 text-grape-600" />
          <span>Any provisional labour charged for {monthLabel(p.month)} is reversed: the real figures take over.</span>
        </li>
        {p.exceptions.length > 0 && (
          <li className="flex gap-3">
            <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-coral-600" />
            <span>
              {p.exceptions.length} {p.exceptions.length === 1 ? "exception goes" : "exceptions go"} into the run as they stand.
            </span>
          </li>
        )}
      </ul>
      {needsOverride && (
        <div>
          <label htmlFor={`${uid}-reason`} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Why post with hours on a closed project?
          </label>
          <textarea
            id={`${uid}-reason`}
            rows={3}
            maxLength={500}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={Boolean(reasonError) || undefined}
            aria-describedby={`${uid}-reason-hint`}
            placeholder="e.g. Snagging hours agreed with the client after handover"
            className={textareaClass}
          />
          {reasonError ? (
            <FieldError message={reasonError} />
          ) : (
            <p id={`${uid}-reason-hint`} className="mt-1.5 text-xs text-neutral-500">
              Kept with the run as the Finance override, for audit.
            </p>
          )}
        </div>
      )}
    </DialogFrame>
  );
}
