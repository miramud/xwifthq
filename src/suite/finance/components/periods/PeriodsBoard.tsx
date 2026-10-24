"use client";

import { useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight, Hourglass, Lock, LockOpen } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-store";
import { errorText, ledger, type Period, type PeriodStatus } from "@/lib/api/finance-ledger-client";
import { Button, Card, Chip, PageHeader, Segmented, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo, mayUseFinance } from "@/suite/finance/lib/finance-access";
import { compact, day } from "@/suite/finance/lib/format";
import { plainError } from "../journals/meta";
import { PERIOD_STATUS, PeriodLegend, monthKey } from "./PeriodStrip";
import { PeriodEndPanel } from "./PeriodEndPanel";

/**
 * The year's twelve months and how far each is closed. A month moves from
 * open, to closing (only a finance manager posts), to locked (nobody posts);
 * going back the other way needs a reason, which stays on the month.
 */

export default function PeriodsBoard({ initialYear }: { initialYear?: number }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [result, setResult] = useState<{ year: number; rows: Period[] | null; error: string | null }>({ year: 0, rows: null, error: null });
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reopening, setReopening] = useState<Period | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    ledger.periods
      .list(year)
      .then((rows) => alive && setResult({ year, rows, error: null }))
      .catch((e: unknown) => alive && setResult((r) => ({ year, rows: r.rows, error: errorText(e) || "The months didn't load." })));
    return () => {
      alive = false;
    };
  }, [year, tick]);

  const canChange = mayDo(user, "periods", "update");
  const canSeeJournals = mayDo(user, "journals", "view");
  const nowKey = monthKey(now);
  const rows = result.year === year ? result.rows : null;

  const move = async (p: Period, status: PeriodStatus) => {
    if (status === "locked") {
      const open = p.drafts + p.pending;
      if (
        !(await confirm({
          title: `Lock ${p.label}?`,
          body: `Nobody can post to ${p.label} once it is locked; corrections go in the next open month.${open ? ` ${p.drafts} drafts and ${p.pending} journals awaiting approval are dated in it and will not post.` : ""} It can be reopened later, with a reason.`,
          confirmLabel: `Lock ${p.label.split(" ")[0]}`,
        }))
      )
        return;
    }
    if (status === "soft_closed" && p.status === "open") {
      if (
        !(await confirm({
          title: `Start closing ${p.label}?`,
          body: "From now on only a finance manager can post to it. Use this while the month's accounts are checked.",
          confirmLabel: "Start closing",
          tone: "primary",
        }))
      )
        return;
    }
    await setStatus(p, status);
  };

  const setStatus = async (p: Period, status: PeriodStatus, reason?: string) => {
    setBusy(p.id);
    setActionError(null);
    try {
      await ledger.periods.setStatus(p.id, status, reason);
      setNotice(`${p.label} is now ${PERIOD_STATUS[status].label.toLowerCase()}.`);
      setTick((t) => t + 1);
      return true;
    } catch (e) {
      setActionError(plainError(errorText(e)));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Periods and close"
        subtitle="Close each month once its accounts are checked. Locked months take no postings."
        actions={
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-neutral-200">
            <button type="button" onClick={() => setYear((y) => y - 1)} aria-label={`Show ${year - 1}`} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300">
              <ChevronLeft size={17} aria-hidden />
            </button>
            <span className="min-w-[4.5rem] text-center text-sm font-bold tabular-nums text-neutral-900" aria-live="polite">
              {year}
            </span>
            <button type="button" onClick={() => setYear((y) => y + 1)} aria-label={`Show ${year + 1}`} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300">
              <ChevronRight size={17} aria-hidden />
            </button>
          </div>
        }
      />

      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-6">{actionError}</ErrorNote>}
      {result.error && <LoadError text={result.error} onRetry={() => setTick((t) => t + 1)} />}

      <div className="mb-4">
        <PeriodLegend />
      </div>

      {!rows ? (
        !result.error && <Skeleton className="h-96" />
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label={`Months of ${year}`}>
          {rows.map((p) => {
            const meta = PERIOD_STATUS[p.status];
            const Icon = meta.icon;
            const future = p.key > nowKey;
            const current = p.key === nowKey;
            return (
              <li key={p.id}>
                <Card className={cx("flex h-full flex-col p-4", current && "!border-primary-300 ring-2 ring-primary-100", future && p.status === "open" && "ws-hatch")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-neutral-900">{p.label}</h2>
                      <p className="text-xs text-neutral-500">
                        {current ? "This month" : future ? "Still to come" : `${day(p.startsOn)} to ${day(p.endsOn)}`}
                      </p>
                    </div>
                    <Chip hue={meta.hue} icon={Icon}>
                      {meta.label}
                    </Chip>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-neutral-50 px-2 py-2">
                      <dt className="text-[11px] text-neutral-500">Posted</dt>
                      <dd className="text-sm font-bold tabular-nums text-neutral-900">{p.posted}</dd>
                    </div>
                    <div className={cx("rounded-xl px-2 py-2", p.drafts ? "bg-sun-50" : "bg-neutral-50")}>
                      <dt className="text-[11px] text-neutral-500">Drafts</dt>
                      <dd className="text-sm font-bold tabular-nums text-neutral-900">
                        <CountLink n={p.drafts} href={journalsHref(p, "draft")} label={`${p.drafts} draft journals in ${p.label}`} show={canSeeJournals} />
                      </dd>
                    </div>
                    <div className={cx("rounded-xl px-2 py-2", p.pending ? "bg-sun-50" : "bg-neutral-50")}>
                      <dt className="text-[11px] text-neutral-500">Awaiting</dt>
                      <dd className="text-sm font-bold tabular-nums text-neutral-900">
                        <CountLink n={p.pending} href={journalsHref(p, "pending")} label={`${p.pending} journals awaiting approval in ${p.label}`} show={canSeeJournals} />
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-neutral-500">
                    {p.postedTotal ? `${compact(p.postedTotal)} posted. ` : ""}
                    {meta.hint}
                  </p>
                  {p.reopenReason && <p className="mt-1 text-xs text-neutral-600">Last reopened: “{p.reopenReason}”</p>}
                  {canChange && (
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      {p.status === "open" && (
                        <>
                          <Button size="sm" icon={Hourglass} onClick={() => move(p, "soft_closed")} disabled={busy !== null}>
                            Start closing
                          </Button>
                          <Button size="sm" variant="ghost" icon={Lock} onClick={() => move(p, "locked")} disabled={busy !== null}>
                            Lock
                          </Button>
                        </>
                      )}
                      {p.status === "soft_closed" && (
                        <>
                          <Button size="sm" icon={Lock} onClick={() => move(p, "locked")} disabled={busy !== null}>
                            Lock {p.label.split(" ")[0]}
                          </Button>
                          <Button size="sm" variant="ghost" icon={LockOpen} onClick={() => setReopening(p)} disabled={busy !== null}>
                            Reopen
                          </Button>
                        </>
                      )}
                      {p.status === "locked" && (
                        <Button size="sm" variant="ghost" icon={LockOpen} onClick={() => setReopening(p)} disabled={busy !== null}>
                          Reopen {p.label.split(" ")[0]}
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      {mayUseFinance(user, "period_end") && (
        <div className="mt-8">
          <PeriodEndPanel year={year} today={now} onPosted={(msg) => {
            setNotice(msg);
            setTick((t) => t + 1);
          }} />
        </div>
      )}

      {reopening && (
        <ReopenDialog
          period={reopening}
          onClose={() => setReopening(null)}
          onReopen={async (status, reason) => {
            const ok = await setStatus(reopening, status, reason);
            if (ok) setReopening(null);
            return ok;
          }}
          error={actionError}
        />
      )}
    </div>
  );
}

/** The journals register narrowed to one month and one status. */
export function journalsHref(p: Pick<Period, "startsOn" | "endsOn">, tab: "draft" | "pending"): string {
  return `/suite/finance/journals?${new URLSearchParams({ from: p.startsOn, to: p.endsOn, tab }).toString()}`;
}

/** A count that opens the journals behind it, when there are any and the reader may see them. */
function CountLink({ n, href, label, show }: { n: number; href: string; label: string; show: boolean }) {
  if (!n || !show) return <>{n}</>;
  return (
    <Link
      href={href}
      aria-label={label}
      className="rounded underline decoration-sun-500/60 underline-offset-2 outline-none hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      {n}
    </Link>
  );
}

function ReopenDialog({
  period,
  onClose,
  onReopen,
  error,
}: {
  period: Period;
  onClose: () => void;
  onReopen: (status: PeriodStatus, reason: string) => Promise<boolean>;
  error: string | null;
}) {
  const uid = useId();
  const [to, setTo] = useState<PeriodStatus>("open");
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const month = period.label.split(" ")[0];
  return (
    <DialogFrame
      titleId={`${uid}-t`}
      title={`Reopen ${period.label}`}
      subtitle="Postings will be allowed again. The reason is kept on the month and in the audit log."
      onClose={onClose}
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reason.trim()) {
          setMissing(true);
          return;
        }
        setBusy(true);
        await onReopen(to, reason.trim());
        setBusy(false);
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" icon={LockOpen} disabled={busy}>
            {busy ? "Reopening…" : `Reopen ${month}`}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      {period.status === "locked" && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-neutral-700">Reopen to</span>
          <Segmented
            label="Reopen to"
            value={to}
            onChange={setTo}
            options={[
              { key: "open", label: "Open to everyone" },
              { key: "soft_closed", label: "Finance managers only" },
            ]}
          />
        </div>
      )}
      <div>
        <label htmlFor={`${uid}-r`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Why is {month} being reopened?
        </label>
        <textarea
          id={`${uid}-r`}
          rows={3}
          maxLength={255}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setMissing(false);
          }}
          aria-invalid={missing || undefined}
          aria-describedby={missing ? `${uid}-r-err` : undefined}
          className={textareaClass}
          placeholder="e.g. Auditors asked for the depreciation charge to be corrected"
        />
        {missing && (
          <p id={`${uid}-r-err`} role="alert" className="mt-1.5 text-xs font-medium text-error-700">
            Say why the month is being reopened.
          </p>
        )}
      </div>
    </DialogFrame>
  );
}
