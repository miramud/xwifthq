"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Download, FileText, Lock, ScrollText, Zap } from "lucide-react";
import { ApiError, orgFoundations, type DoaMatrix } from "@/lib/api/org-foundations-client";
import { formatMoney } from "@/lib/api/approvals-client";
import { Card, Empty, buttonClass, cx } from "@/components/workspace/kit";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { ApprovalsHeader, shortDate } from "./parts";
import { STAGE_TYPES } from "./StageEditor";

/*
  The delegation-of-authority matrix: the organisation's DoA written out
  from the rules actually in force, so the document and the system can never
  disagree. Laid out as a document (numbered sections per process, each
  rule's "applies when" beside its approver chain), with the PDF the
  organisation files or circulates.
*/

export default function DoaBoard() {
  const [doa, setDoa] = useState<DoaMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    orgFoundations.approvals
      .doa()
      .then((d) => alive && setDoa(d))
      .catch((e: unknown) => alive && setError(e instanceof ApiError ? e.message : "The matrix didn't load."));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <ApprovalsHeader
        active="doa"
        actions={
          <a href={orgFoundations.approvals.doaPdfUrl()} download className={buttonClass("primary")}>
            <Download size={17} aria-hidden /> Download PDF
          </a>
        }
      />
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {!doa && !error && <Skeleton className="h-[520px]" />}
      {doa && <DoaDocument doa={doa} />}
    </div>
  );
}

export function DoaDocument({ doa }: { doa: DoaMatrix }) {
  if (doa.sections.length === 0) {
    return (
      <Card>
        <Empty icon={ScrollText} title="No processes need approval yet" hint="Switch a process on under Processes and its rules show here." />
      </Card>
    );
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Sections" className="hidden xl:sticky xl:top-4 xl:block">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Contents</p>
        <ol className="space-y-0.5 text-sm">
          {doa.sections.map((s, i) => (
            <li key={s.code}>
              <a href={`#doa-${s.code}`} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-neutral-600 outline-none hover:bg-white hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300">
                <span className="w-5 text-xs tabular-nums text-neutral-400">{i + 1}.</span>
                {s.name}
              </a>
            </li>
          ))}
          {doa.limits.length > 0 && (
            <li>
              <a href="#doa-limits" className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-neutral-600 outline-none hover:bg-white hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300">
                <span className="w-5 text-xs tabular-nums text-neutral-400">{doa.sections.length + 1}.</span>
                Approval limits
              </a>
            </li>
          )}
        </ol>
      </nav>

      <article className="ws-card overflow-hidden" aria-label="Delegation of authority">
        <header className="border-b border-neutral-100 bg-gradient-to-br from-primary-50/70 to-white px-6 py-7 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">Delegation of authority</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">{doa.organisation}</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Written from the approval rules in force on {shortDate(doa.generatedAt)}. Amounts in {doa.currency}.
          </p>
        </header>

        <div className="divide-y divide-neutral-100">
          {doa.sections.map((s, i) => (
            <section key={s.code} id={`doa-${s.code}`} aria-labelledby={`doa-${s.code}-h`} className="scroll-mt-4 px-6 py-7 sm:px-10">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full bg-primary-50 text-sm font-bold tabular-nums text-primary-700">{i + 1}</span>
                <h3 id={`doa-${s.code}-h`} className="text-lg font-bold tracking-tight text-neutral-900">
                  {s.name}
                </h3>
                <span className="text-xs text-neutral-500">
                  {s.version ? `Version ${s.version}` : "Default rules"}
                  {s.effectiveFrom ? ` · in force from ${shortDate(s.effectiveFrom)}` : ""}
                </span>
              </div>

              {s.rules.length === 0 && s.controls.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">No rules: nobody is asked.</p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {s.rules.map((r, k) => (
                    <li key={k} className="grid gap-3 rounded-2xl border border-neutral-200/80 p-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">
                          <span className="mr-1.5 tabular-nums text-neutral-400">
                            {i + 1}.{k + 1}
                          </span>
                          {r.rule}
                        </p>
                        <p className="mt-1 text-xs text-neutral-600">
                          <span className="font-semibold text-neutral-700">Applies when </span>
                          {r.when}
                        </p>
                      </div>
                      <ApproverChain stages={r.stages} />
                    </li>
                  ))}
                </ol>
              )}

              {s.controls.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Always added, whatever the rules say</p>
                  <ul className="flex flex-wrap gap-2">
                    {s.controls.map((c, k) => (
                      <li key={k} className="ws-hatch flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
                        <Lock size={13} className="text-neutral-600" aria-hidden />
                        <span className="rounded bg-white/90 px-1 text-sm font-semibold text-neutral-900">{c.name}</span>
                        <span className="rounded bg-white/90 px-1 text-xs text-neutral-600">{c.who}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.bypass.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Approved automatically</p>
                  <ul className="space-y-1.5">
                    {s.bypass.map((b, k) => (
                      <li key={k} className="flex items-start gap-2 text-sm text-neutral-700">
                        <Zap size={14} className="mt-0.5 shrink-0 text-mint-600" aria-hidden />
                        <span>
                          <span className="font-semibold">{b.label}</span> when {b.when}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}

          {doa.limits.length > 0 && (
            <section id="doa-limits" aria-labelledby="doa-limits-h" className="scroll-mt-4 px-6 py-7 sm:px-10">
              <div className="flex items-baseline gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full bg-primary-50 text-sm font-bold tabular-nums text-primary-700">{doa.sections.length + 1}</span>
                <h3 id="doa-limits-h" className="text-lg font-bold tracking-tight text-neutral-900">
                  Approval limits
                </h3>
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200/80">
                <table className="w-full text-sm">
                  <caption className="sr-only">Approval limits</caption>
                  <thead>
                    <tr className="bg-primary-50/50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      <th scope="col" className="px-4 py-2.5">Who</th>
                      <th scope="col" className="px-4 py-2.5">For</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Up to</th>
                      <th scope="col" className="px-4 py-2.5">Valid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doa.limits.map((l, k) => (
                      <tr key={k} className="border-t border-neutral-100">
                        <td className="px-4 py-2.5 font-medium text-neutral-900">{l.who}</td>
                        <td className="px-4 py-2.5 text-neutral-700">{l.process}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-900">{formatMoney(l.maxAmount, doa.currency)}</td>
                        <td className="px-4 py-2.5 text-neutral-600">
                          {l.validFrom || l.validTo ? `${l.validFrom ? shortDate(l.validFrom) : "Now"} to ${l.validTo ? shortDate(l.validTo) : "open-ended"}` : "Always"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-neutral-100 bg-primary-50/30 px-6 py-4 text-xs text-neutral-500 sm:px-10">
          <FileText size={14} aria-hidden /> Written by the system from the rules in force. Change the rules under Processes and this document follows.
        </footer>
      </article>
    </div>
  );
}

/** The stages of a rule in order: chips joined by arrows. */
function ApproverChain({ stages }: { stages: { name: string; who: string; type: string; order: number }[] }) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return <p className="text-sm text-neutral-500">Adds nobody.</p>;
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Approvers in order">
      {sorted.map((s, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight size={14} className="text-neutral-400" aria-hidden />}
          <span className={cx("flex flex-col rounded-xl px-3 py-1.5", s.type === "approval" ? "bg-primary-50" : "bg-neutral-100")}>
            <span className={cx("text-xs font-semibold", s.type === "approval" ? "text-primary-700" : "text-neutral-800")}>{s.name}</span>
            <span className="text-[11px] text-neutral-600">
              {s.who}
              {s.type !== "approval" && ` · ${(STAGE_TYPES.find((t) => t.value === s.type)?.label ?? s.type).toLowerCase()}`}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

