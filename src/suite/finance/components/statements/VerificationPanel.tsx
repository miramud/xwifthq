"use client";

import { ArrowDownUp, Check, FileWarning, Info, MapPin, ShieldCheck, X } from "lucide-react";
import { Panel, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import type { StatementDetail } from "@/lib/api/finance-banking-client";
import { accounting } from "@/suite/finance/lib/format";
import { CHECK_STATUS, PIPELINE, pipelineStage } from "@/suite/finance/components/banking/labels";

/*
  How far a statement has come, and why it can be trusted. The six checks
  (Finance PRD §15.6) run before anything is classified: V1 to V4 stop the
  import when they fail, V5 and V6 warn. A check the file format cannot support
  says "not printed" - never a silent pass.
*/

/** uploaded → verified → reviewed → sent for approval → posted, as a stepped track. */
export function Pipeline({ detail }: { detail: Pick<StatementDetail, "status" | "counts"> }) {
  const { done, failed } = pipelineStage(detail, detail.counts?.needsAccount ?? 0);
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Progress">
      {PIPELINE.map((step, i) => {
        const complete = i < done;
        const stopped = failed && i === done;
        const current = !failed && i === done;
        return (
          <li key={step} className="flex items-center gap-1" aria-current={current ? "step" : undefined}>
            <span
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
                complete ? HUE.mint.soft : stopped ? HUE.rose.soft : current ? "bg-primary-600 text-white" : "border border-dashed border-neutral-300 text-neutral-500",
              )}
            >
              {complete ? <Check size={13} aria-hidden /> : stopped ? <X size={13} aria-hidden /> : <span className="tabular-nums" aria-hidden>{i + 1}</span>}
              {step}
              <span className="sr-only">{complete ? " (done)" : stopped ? " (stopped here)" : current ? " (next)" : " (not yet)"}</span>
            </span>
            {i < PIPELINE.length - 1 && <span aria-hidden className={cx("h-px w-4 sm:w-6", complete ? "bg-mint-500" : "bg-neutral-200")} />}
          </li>
        );
      })}
    </ol>
  );
}

export default function VerificationPanel({ detail }: { detail: StatementDetail }) {
  const v = detail.validation;
  const checks = v?.checks ?? [];
  const reordered = checks.find((c) => c.code === "V4")?.reordered ?? 0;
  const failed = detail.status === "failed_validation";

  return (
    <Panel
      title="Verification"
      subtitle={failed ? "This statement stopped at its checks. Nothing was imported." : "Checked before a single line was classified"}
      icon={failed ? FileWarning : ShieldCheck}
      hue={failed ? "rose" : "mint"}
    >
      {failed && detail.error && (
        <p role="alert" className="mb-4 rounded-xl border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-700">
          {detail.error}
        </p>
      )}

      {checks.length === 0 ? (
        <p className="text-sm text-neutral-500">{failed ? "The file could not be read far enough to run the checks." : "The checks run once the file has been read."}</p>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((c) => {
            const m = CHECK_STATUS[c.status] ?? CHECK_STATUS.na;
            const Icon = m.icon;
            return (
              <li key={c.code} className={cx("flex gap-3 rounded-2xl border p-3.5", c.status === "fail" ? "border-rose-100 bg-rose-50/60" : c.status === "warn" ? "border-sun-100 bg-sun-50/60" : "border-neutral-200/80 bg-white")}>
                <span className={cx("flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-[11px] font-bold", HUE[m.hue].soft)}>
                  <Icon size={14} aria-hidden />
                  {c.code}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-neutral-900">
                    {c.label}
                    <span className={cx("text-xs font-semibold", HUE[m.hue].text)}>{m.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{c.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(reordered > 0 || (v?.notes?.length ?? 0) > 0) && (
        <ul className="mt-4 space-y-2">
          {reordered > 0 && (
            <li className="flex gap-2.5 rounded-xl bg-sky-50 px-3.5 py-2.5 text-sm text-sky-700">
              <ArrowDownUp size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                The bank printed {reordered} {reordered === 1 ? "row" : "rows"} out of order. They were put back in posting order by following the running balance; the review below shows that order.
              </span>
            </li>
          )}
          {v?.notes?.map((n) => (
            <li key={n} className="flex gap-2.5 rounded-xl bg-sun-50 px-3.5 py-2.5 text-sm text-sun-700">
              <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      {failed && (v?.diagnostics?.length ?? 0) > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
            <Info size={15} className="text-neutral-400" aria-hidden />
            What the reader skipped
          </h4>
          <ul className="list-inside list-disc space-y-1 text-xs text-neutral-600">
            {v?.diagnostics?.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {failed && (v?.rows?.length ?? 0) > 0 && (
        <div className="mt-5">
          <h4 className="mb-1 text-sm font-semibold text-neutral-900">What was read</h4>
          <p className="mb-3 text-xs text-neutral-500">The first {v?.rows?.length} rows as they came out of the file, in the order printed. Compare them with the statement to see where the reading went wrong.</p>
          <div className="max-h-[420px] overflow-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[640px] text-left text-xs">
              <caption className="sr-only">Rows read from the failed statement</caption>
              <thead className="sticky top-0 bg-neutral-50 text-neutral-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">#</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Date</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Narration</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Withdrawal</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Deposit</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {v?.rows?.map((r) => (
                  <tr key={r.listed}>
                    <td className="px-3 py-2 tabular-nums text-neutral-400">{r.listed}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.date}</td>
                    <td className="px-3 py-2 text-neutral-700">
                      {r.narration}
                      {r.location && <span className="block text-[11px] text-neutral-400">{r.location}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{accounting(r.withdrawal, true)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{accounting(r.deposit, true)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{accounting(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}
