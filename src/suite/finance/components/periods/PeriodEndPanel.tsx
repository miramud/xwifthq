"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, CalendarCheck2, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { errorText, ledger, type RevaluationRow } from "@/lib/api/finance-ledger-client";
import { Button, Chip, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, day, monthLabel } from "@/suite/finance/lib/format";
import { plainError } from "../journals/meta";
import { monthKey } from "./PeriodStrip";

/**
 * Month-end and year-end runs. FX revaluation restates every foreign-currency
 * account at the month-end rate (and reverses itself on the 1st); closing a
 * year moves its income and expenditure into accumulated surplus.
 */

export function PeriodEndPanel({ year, today, onPosted }: { year: number; today: Date; onPosted: (message: string) => void }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const uid = useId();
  const lastMonth = monthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const [month, setMonth] = useState(lastMonth);
  const [preview, setPreview] = useState<{ month: string; rows: RevaluationRow[] | null; error: string | null }>({ month: "", rows: null, error: null });
  const [tick, setTick] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState<{ id: string; label: string } | null>(null);

  const defaultYearEnd = `${year < today.getFullYear() ? year : year - 1}-12-31`;
  const [yearEnd, setYearEnd] = useState(defaultYearEnd);
  const [closeError, setCloseError] = useState<string | null>(null);

  const canPreview = mayDo(user, "period_end", "revaluation_preview");
  useEffect(() => {
    if (!canPreview || !/^\d{4}-\d{2}$/.test(month)) return;
    let alive = true;
    ledger.periodEnd
      .revaluationPreview(month)
      .then((rows) => alive && setPreview({ month, rows, error: null }))
      .catch((e: unknown) => alive && setPreview({ month, rows: null, error: errorText(e) }));
    return () => {
      alive = false;
    };
  }, [month, tick, canPreview]);

  const rows = preview.month === month ? preview.rows : null;
  const ready = (rows ?? []).filter((r): r is Extract<RevaluationRow, { rate: string }> => !r.error);
  const missing = (rows ?? []).filter((r) => r.error);
  const net = ready.reduce((s, r) => s + r.difference, 0);

  const revalue = async () => {
    if (
      !(await confirm({
        title: `Revalue ${monthLabel(month)}?`,
        body: `Posts one journal dated ${monthLabel(month)}'s last day, moving each foreign-currency account to the month-end rate, with the difference to unrealised FX gain or loss. It reverses itself on the 1st of the next month.`,
        confirmLabel: "Post revaluation",
        tone: "primary",
      }))
    )
      return;
    setBusy(true);
    setRunError(null);
    try {
      const r = await ledger.periodEnd.revalue(month);
      if (r) {
        setPosted({ id: r.id, label: r.journalNo ?? "the revaluation journal" });
        onPosted(`${monthLabel(month)} revalued.`);
      } else onPosted(`Nothing to revalue in ${monthLabel(month)}: every balance is already at the month-end rate.`);
      setTick((t) => t + 1);
    } catch (e) {
      setRunError(plainError(errorText(e)));
    } finally {
      setBusy(false);
    }
  };

  const closeYear = async () => {
    if (
      !(await confirm({
        title: `Close the year ended ${day(yearEnd)}?`,
        body: "Posts one journal that brings every income and expense account to zero for that year and moves the net surplus (or deficit) into accumulated surplus. The year's months should be locked first.",
        confirmLabel: "Close the year",
        tone: "primary",
      }))
    )
      return;
    setBusy(true);
    setCloseError(null);
    try {
      const r = await ledger.periodEnd.closeYear(yearEnd);
      if (r) {
        setPosted({ id: r.id, label: r.journalNo ?? "the closing journal" });
        onPosted(`The year ended ${day(yearEnd)} is closed.`);
      } else onPosted(`There was no income or expenditure to close for the year ended ${day(yearEnd)}.`);
    } catch (e) {
      setCloseError(plainError(errorText(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Panel title="Foreign-currency revaluation" subtitle="Restate foreign balances at the month-end rate" icon={ArrowLeftRight} hue="grape" className="xl:col-span-2">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">Month</span>
            <input id={`${uid}-m`} type="month" value={month} max={monthKey(today)} onChange={(e) => setMonth(e.target.value)} className={cx(inputClass, "h-10 w-44")} />
          </label>
          {mayDo(user, "period_end", "revalue") && (
            <Button variant="primary" onClick={revalue} disabled={busy || !rows || missing.length > 0 || ready.every((r) => r.difference === 0)}>
              Post revaluation
            </Button>
          )}
          {posted && (
            <Link href={`/suite/finance/journals/${posted.id}`} className="text-sm font-semibold text-primary-700 hover:underline">
              Open {posted.label}
            </Link>
          )}
        </div>
        {runError && <ErrorNote className="mb-4">{runError}</ErrorNote>}
        {!canPreview ? (
          <p className="text-sm text-neutral-500">You can see month-end runs once you hold the period-end permission.</p>
        ) : preview.error && preview.month === month ? (
          <ErrorNote>{preview.error}</ErrorNote>
        ) : !rows ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">No account is held in a foreign currency, so there is nothing to revalue.</p>
        ) : (
          <>
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">Revaluation at the end of {monthLabel(month)}</caption>
                <thead>
                  <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="py-2.5 pl-5 pr-2">Account</th>
                    <th scope="col" className="px-2 py-2.5 text-right">Balance</th>
                    <th scope="col" className="px-2 py-2.5 text-right">Rate</th>
                    <th scope="col" className="px-2 py-2.5 text-right">In the books</th>
                    <th scope="col" className="px-2 py-2.5 text-right">Restated</th>
                    <th scope="col" className="py-2.5 pl-2 pr-5 text-right">Gain or (loss)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.accountId} className="border-b border-neutral-100 last:border-0">
                      <th scope="row" className="py-2.5 pl-5 pr-2 text-left font-medium text-neutral-900">
                        <span className="font-mono text-[13px] text-neutral-500">{r.code}</span> {r.name}
                      </th>
                      {r.error !== undefined ? (
                        <td colSpan={5} className="py-2.5 pl-2 pr-5 text-right text-sm text-error-700">
                          <span className="inline-flex items-center gap-1.5">
                            <TriangleAlert size={14} aria-hidden />
                            {r.error}{" "}
                            <Link href="/suite/org/profile" className="font-semibold underline">
                              Record a rate
                            </Link>
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="px-2 py-2.5 text-right tabular-nums">
                            {r.currency} {accounting(r.currencyBalance)}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{r.rate}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{accounting(r.carried)}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{accounting(r.restated)}</td>
                          <td className={cx("py-2.5 pl-2 pr-5 text-right font-semibold tabular-nums", r.difference > 0 ? "text-mint-700" : r.difference < 0 ? "text-rose-700" : "text-neutral-500")}>
                            {accounting(r.difference, true)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
              Net effect:{" "}
              <Chip hue={net > 0 ? "mint" : net < 0 ? "rose" : "slate"}>
                {net > 0 ? `Gain ${accounting(net)}` : net < 0 ? `Loss ${accounting(-net)}` : "No change"}
              </Chip>
            </p>
          </>
        )}
      </Panel>

      <Panel title="Close the year" subtitle="Income and expenditure into accumulated surplus" icon={CalendarCheck2} hue="mint">
        <p className="text-sm text-neutral-600">
          Closing posts one journal on the year&apos;s last day: every income and expense account goes to zero, and the year&apos;s surplus or deficit moves to accumulated surplus. Next year&apos;s income statement then starts clean. Lock the year&apos;s months first.
        </p>
        {closeError && <ErrorNote className="mt-4">{closeError}</ErrorNote>}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">Year ended</span>
            <input type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} className={cx(inputClass, "h-10 w-44")} />
          </label>
          {mayDo(user, "period_end", "close_year") ? (
            <Button onClick={closeYear} disabled={busy || !yearEnd}>
              Close the year
            </Button>
          ) : (
            <p className="text-xs text-neutral-500">A financial controller closes the year.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
