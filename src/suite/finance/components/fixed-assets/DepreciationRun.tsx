"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookCheck, CalendarCheck, ChevronLeft, ChevronRight, Play, TriangleAlert } from "lucide-react";
import { Button, Panel, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { StatusBars } from "@/components/workspace/charts";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, monthLabel } from "@/suite/finance/lib/format";
import { thisMonth } from "@/suite/finance/components/projects/meta";
import { errorText, fixedAssets, type AssetClassRow, type DepreciationPreview, type DepreciationRunRow } from "@/lib/api/finance-assets-client";
import { classHue, depreciationMonths, nextMonthToRun } from "./meta";

/**
 * The month's depreciation: pick a month on the year grid (posted months
 * show what was charged), see the charge by class before anything posts,
 * and post it. A month already posted can be run again; the earlier run is
 * reversed first, and the dialog says so.
 */
export function DepreciationRun({ runs, classes, canRun, onPosted }: { runs: DepreciationRunRow[]; classes: AssetClassRow[]; canRun: boolean; onPosted: (message: string) => void }) {
  const confirm = useConfirm();
  const now = thisMonth();
  const [month, setMonth] = useState(() => nextMonthToRun(runs, now));
  const [year, setYear] = useState(() => Number(nextMonthToRun(runs, now).slice(0, 4)));
  const [preview, setPreview] = useState<DepreciationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    fixedAssets.preview(month).then(
      (p) => {
        if (!alive) return;
        setPreview(p);
        setError(null);
      },
      (e: unknown) => alive && setError(`The preview didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [month, version]);

  const months = depreciationMonths(year, runs, now);
  const nowYear = Number(now.slice(0, 4));
  const showing = preview?.month === month ? preview : null;
  const blocked = Boolean(showing?.missingAccounts.length);

  const post = async () => {
    if (!showing) return;
    const ok = await confirm({
      title: showing.existingRunId ? `Run ${monthLabel(month)} again?` : `Post depreciation for ${monthLabel(month)}?`,
      body: showing.existingRunId
        ? `The run already posted for ${monthLabel(month)} is reversed, then ${compact(showing.total)} is charged again from today's books. One journal reverses, one posts.`
        : `${compact(showing.total)} is charged across ${showing.classes.length} ${showing.classes.length === 1 ? "class" : "classes"}: Dr depreciation charge, Cr accumulated depreciation, by class.`,
      confirmLabel: showing.existingRunId ? "Reverse and run again" : "Post depreciation",
      tone: showing.existingRunId ? "danger" : "primary",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fixedAssets.run(month);
      onPosted(`Depreciation for ${monthLabel(month)} posted: ${compact(r.total)}.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const pick = (key: string) => {
    setPreview(null);
    setMonth(key);
  };

  return (
    <Panel title="Run depreciation" subtitle="Pick a month, check the charge by class, then post" icon={CalendarCheck} hue="mint">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold tracking-tight tabular-nums text-neutral-900" aria-live="polite">
              {year}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                aria-label={`Show ${year - 1}`}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <ChevronLeft size={18} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                disabled={year >= nowYear}
                aria-label={`Show ${year + 1}`}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={18} aria-hidden />
              </button>
            </div>
          </div>
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={`Depreciation by month, ${year}`}>
            {months.map((m) => {
              const label = monthLabel(m.key, true).split(" ")[0];
              const chosen = m.key === month;
              const body = (
                <>
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold text-neutral-900">{label}</span>
                    {m.key === now && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary-600" />}
                  </span>
                  <span className={cx("mt-1 block truncate text-[11px] font-semibold", m.state === "posted" ? HUE.mint.text : "text-neutral-500")}>
                    {m.state === "posted" && m.run ? compact(m.run.total) : m.state === "future" ? "To come" : "Not run"}
                  </span>
                </>
              );
              return (
                <li key={m.key}>
                  {m.state === "future" ? (
                    <span className="ws-hatch block rounded-xl px-3 py-2.5 opacity-70">{body}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pick(m.key)}
                      aria-pressed={chosen}
                      aria-label={`${monthLabel(m.key)}: ${m.state === "posted" && m.run ? `posted, ${compact(m.run.total)}` : "not run yet"}`}
                      className={cx(
                        "block min-h-11 w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left outline-none transition hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary-300 motion-reduce:hover:translate-y-0",
                        m.state === "posted" ? "border-mint-500/25 bg-mint-50/70" : "border-neutral-200 bg-white",
                        chosen && "ring-2 ring-primary-500",
                      )}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-600">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className={cx("h-2.5 w-2.5 rounded-sm", HUE.mint.dot)} />
              Posted
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm ring-1 ring-neutral-300" />
              Not run yet
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="ws-hatch h-2.5 w-2.5 rounded-sm" />
              Still to come
            </li>
          </ul>
        </div>

        <div className="min-w-0 rounded-2xl border border-neutral-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{monthLabel(month)}</p>
          {error && !showing ? (
            <ErrorNote className="mt-3">{error}</ErrorNote>
          ) : !showing ? (
            <div aria-busy="true" className="mt-3 space-y-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <>
              <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">
                <Money value={showing.total} />
              </p>
              <p className="text-xs text-neutral-500">
                {showing.books} {showing.books === 1 ? "asset" : "assets"} on the books · {showing.classes.reduce((s, c) => s + c.assets, 0)} charged this month
              </p>
              {showing.existingRunId && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-sun-500/30 bg-sun-50 px-3 py-2 text-xs text-sun-700">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                  {monthLabel(month)} is already posted. Running it again reverses that run and replaces it.
                </p>
              )}
              {blocked && (
                <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-error-500/30 bg-error-500/5 px-3 py-2 text-xs text-error-700">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                  Set the depreciation accounts first for {showing.missingAccounts.join(", ")}. Edit the class below.
                </p>
              )}
              <div className="mt-4">
                {showing.classes.length === 0 ? (
                  <p className="py-4 text-sm text-neutral-500">Nothing to charge this month: no asset was capitalised before it, or everything is fully depreciated.</p>
                ) : (
                  <StatusBars
                    data={showing.classes.map((c, i) => ({
                      label: c.class,
                      value: c.amount,
                      hue: classHue(classes.find((k) => k.id === c.classId)?.key ?? "", i),
                      note: `${c.assets} ${c.assets === 1 ? "asset" : "assets"}`,
                    }))}
                    format={(v) => compact(v)}
                    caption={`Depreciation for ${monthLabel(month)} by class`}
                  />
                )}
              </div>
              {canRun && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                  {runs.find((r) => r.month === month && r.status === "posted")?.journalId ? (
                    <Link
                      href={`/suite/finance/journals/${runs.find((r) => r.month === month && r.status === "posted")!.journalId}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <BookCheck size={14} aria-hidden /> Open the posted journal
                    </Link>
                  ) : (
                    <span />
                  )}
                  <Button variant={showing.existingRunId ? "secondary" : "primary"} icon={Play} onClick={() => void post()} disabled={busy || blocked || showing.total <= 0}>
                    {busy ? "Posting…" : showing.existingRunId ? "Run again" : "Post depreciation"}
                  </Button>
                </div>
              )}
              {error && showing && <ErrorNote className="mt-3">{error}</ErrorNote>}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
