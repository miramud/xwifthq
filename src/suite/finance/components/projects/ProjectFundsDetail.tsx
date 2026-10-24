"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, BookOpen, ClipboardList, Grid3x3, HandCoins, Layers, LineChart, PenLine, Plus, Receipt, Send, Undo2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { plainError, spend, type FundReleaseRecord, type ProjectFundsDetail as Detail } from "@/lib/api/finance-payments-client";
import { Button, Card, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { GroupedColumns, Heatmap, MultiLine, Waterfall } from "@/components/workspace/charts";
import { BackLink, ErrorNote, Skeleton, humanise } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { pct } from "../vouchers/meta";
import BudgetEditor from "./BudgetEditor";
import { FundsBar, FundsLegend } from "./FundsBar";
import { RagChip } from "./RagChip";
import { ReleaseDialog, RevokeDialog } from "./ReleaseDialogs";
import { PROJECT_STATUS, RELEASE_STATUS, SCOPE_LABEL, headline, thisMonth } from "./meta";
import { AlertsStrip, EarnedValueHero, LabourCard, ProfitViews, ProgressCard, RevenueStrip, StatusPanel } from "./ProjectEarnedValue";
import { richExcerpt } from "@/lib/richText";

/**
 * One project's money (Finance PRD §16.10). Open alerts first; then the
 * earned-value S-curve - planned value, earned value, actual cost - with
 * where the project stands; the three ways of reading profit and the
 * projection at completion; the money in from the client; every status
 * dimension with its reason; percent complete and how it was measured;
 * labour. Then the funds: the waterfall of the release, spend by category,
 * planned against actual spend, releases, the budget, commitments and the
 * latest transactions, each linked to where it came from.
 */

export default function ProjectFundsDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const { user } = useAuth();
  const [p, setP] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<"view" | "budget">(params?.get("budget") === "1" ? "budget" : "view");
  const [dialog, setDialog] = useState<{ kind: "release" } | { kind: "revoke"; release: FundReleaseRecord } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    spend.funds.project(id).then(
      (d) => {
        setP(d);
        setLoadError(null);
      },
      (e: unknown) => setLoadError(plainError(e, "The project didn't load.")),
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load, reload]);

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/finance/projects" label="All projects" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!p) return <Skeleton className="h-[36rem]" />;

  const done = (message: string) => {
    setDialog(null);
    setMode("view");
    setNotice(message);
    load();
  };

  if (mode === "budget") return <BudgetEditor project={p} onClose={() => setMode("view")} onSaved={done} />;

  const canBudget = mayDo(user, "project_funds", "create_budget");
  const canSubmitBudget = mayDo(user, "project_funds", "submit_budget");
  const canRelease = mayDo(user, "project_funds", "create_release") && p.hasBudget;
  const canRevoke = mayDo(user, "project_funds", "revoke_release");
  const canReportProgress = mayDo(user, "project_funds", "progress");
  const canAcknowledge = mayDo(user, "project_funds", "acknowledge_alert");

  const sendDraft = async (budgetId: string, version: number) => {
    setBusy(budgetId);
    setActionError(null);
    try {
      const r = await spend.funds.submitBudget(budgetId);
      done(r.status === "approved" ? `Budget v${version} approved.` : `Budget v${version} sent for approval.`);
    } catch (e) {
      setActionError(plainError(e));
    } finally {
      setBusy(null);
    }
  };

  // The S-curve: cumulative planned against cumulative actual, today marked.
  const now = thisMonth();
  const curve = p.curve;
  const todayIndex = curve.findIndex((c) => c.month === now);
  const lastActual = curve.reduce((i, c, k) => (c.month <= now ? k : i), -1);
  const cats = p.categories.filter((c) => c.budget > 0 || c.spent > 0);
  const budgetMonths = [...new Set((p.budget?.lines ?? []).map((l) => l.month))].sort();
  const budgetCats = [...new Set((p.budget?.lines ?? []).map((l) => l.category))];
  const catName = (c: string) => p.categories_catalogue?.[c] ?? humanise(c);
  const lead = headline(p);

  return (
    <div>
      <BackLink href="/suite/finance/projects" label="All projects" />
      <Notice text={notice} />

      {/* Header: the project, its status in words, the two things you can do. */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
            {[p.code, p.client, PROJECT_STATUS[p.projectStatus] ?? humanise(p.projectStatus)].filter(Boolean).join(" · ")}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">{p.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <RagChip status={p.status} />
            {lead}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canBudget && (
            <Button icon={p.budget ? PenLine : Plus} onClick={() => setMode("budget")}>
              {p.budget ? "Rebaseline budget" : "Draft a budget"}
            </Button>
          )}
          {canRelease && (
            <Button variant="primary" icon={HandCoins} onClick={() => setDialog({ kind: "release" })}>
              Request a release
            </Button>
          )}
        </div>
      </div>

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      {!p.hasBudget && (
        <Card className="mb-6">
          <Empty
            icon={ClipboardList}
            hue="sun"
            title="No approved budget yet"
            hint="Until a budget is approved this project is outside fund control: no funds can be released and requests against it are not checked. Draft one by category and month."
            action={
              canBudget && (
                <Button variant="primary" icon={Plus} onClick={() => setMode("budget")}>
                  Draft a budget
                </Button>
              )
            }
          />
        </Card>
      )}

      <AlertsStrip
        alerts={p.alerts}
        canAcknowledge={canAcknowledge}
        onAcknowledged={(a) => {
          setP((x) => (x ? { ...x, alerts: x.alerts.filter((y) => y.id !== a.id) } : x));
          setNotice("Alert acknowledged. It comes back if the project gets worse.");
        }}
      />

      <EarnedValueHero p={p} />
      <ProfitViews p={p} />

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <RevenueStrip p={p} />
        <ProgressCard p={p} canReport={canReportProgress} onReported={done} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <StatusPanel p={p} />
        <LabourCard projectId={p.id} />
      </div>

      {/* The figures, and the pipe they make. */}
      <Card className="mb-5 p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Contract value", p.contractValue, null],
              ["Budget (BAC)", p.bac, p.budget?.targetMarginBp != null ? `Target margin ${pct(p.budget.targetMarginBp)}` : null],
              ["Released", p.released, p.bac ? `${Math.round((p.released / p.bac) * 100)}% of budget` : null],
              ["Committed", p.committed, null],
              ["Spent", p.spent, `${compact(p.spentThisMonth)} this month`],
              ["Available", p.available, p.available < 0 ? "Overdrawn" : null],
            ] as const
          ).map(([label, v, note]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-medium text-neutral-500">{label}</dt>
              <dd className={cx("mt-1 text-xl font-bold tracking-tight tabular-nums", v < 0 ? "text-rose-700" : label === "Available" ? "text-mint-700" : "text-neutral-900")}>{compact(v)}</dd>
              {note && <dd className="text-xs text-neutral-500">{note}</dd>}
            </div>
          ))}
        </dl>
        {p.hasBudget && (
          <div className="mt-6">
            <FundsBar figures={p} size="lg" />
            <div className="mt-3">
              <FundsLegend figures={p} show={p.available < 0 ? ["spent", "committed", "over", "unreleased"] : undefined} />
            </div>
          </div>
        )}
        {p.unplanned > 0 && (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {amount(p.unplanned)} left the bank on this project with no approved request behind it.
          </p>
        )}
      </Card>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Where the release has gone" subtitle="Released, less spent and committed, leaves what is available" icon={Layers}>
          {p.released > 0 || p.spent > 0 ? (
            <Waterfall
              steps={[
                { label: "Released", value: p.released, kind: "total" },
                { label: "Spent", value: -p.spent },
                { label: "Committed", value: -p.committed },
                { label: "Available", value: p.available, kind: "total" },
              ]}
              format={(v) => compact(v)}
              caption={`Funds waterfall for ${p.name}`}
              upHue="mint"
              downHue="grape"
              totalHue="blue"
            />
          ) : (
            <p className="py-10 text-center text-sm text-neutral-500">Nothing released yet.</p>
          )}
        </Panel>

        <Panel title="Spend by category" subtitle="Against the budget to date" icon={Activity} hue="grape">
          {cats.length ? (
            <GroupedColumns
              data={cats.map((c) => ({ label: c.label, values: { budgetToDate: c.budgetToDate, spent: c.spent } }))}
              series={[
                { key: "budgetToDate", label: "Budget to date", hue: "slate", dashed: true },
                { key: "spent", label: "Spent", hue: "grape" },
              ]}
              format={(v) => compact(v)}
              caption={`Spend by category against budget to date for ${p.name}`}
              height={240}
            />
          ) : (
            <p className="py-10 text-center text-sm text-neutral-500">No budget lines or spend yet.</p>
          )}
        </Panel>
      </div>

      <div className="mb-6">
        <Panel title="Planned against actual spend" subtitle="Cumulative, by month: the budget's curve and what has been spent" icon={LineChart}>
          <MultiLine
            labels={curve.map((c) => monthLabel(c.month, true))}
            series={[
              { key: "planned", label: "Planned (budget)", hue: "slate", dashed: true, values: curve.map((c) => c.cumulativePlanned) },
              { key: "actual", label: "Actual", hue: "blue", area: true, values: curve.map((c, i) => (i <= lastActual ? c.cumulativeActual : null)) },
            ]}
            format={(v) => compact(v)}
            caption={`Cumulative planned and actual spend for ${p.name}`}
            marker={todayIndex >= 0 ? { index: todayIndex, label: "Today" } : undefined}
            height={240}
          />
        </Panel>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Fund releases"
          subtitle={p.releases.length ? `${p.releases.length} ${p.releases.length === 1 ? "tranche" : "tranches"}` : undefined}
          icon={HandCoins}
          hue="mint"
          bodyClassName="p-0 pt-4"
        >
          {p.releases.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-neutral-500">{p.hasBudget ? "Nothing released yet. Request the first tranche from the MD." : "A release needs an approved budget first."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">Fund releases</caption>
                <thead>
                  <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="py-2.5 pl-5 pr-2">Tranche</th>
                    <th scope="col" className="px-2 py-2.5">Status</th>
                    <th scope="col" className="px-2 py-2.5">For</th>
                    <th scope="col" className="px-2 py-2.5 text-right">Amount</th>
                    <th scope="col" className="py-2.5 pl-2 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.releases.map((r) => {
                    const s = RELEASE_STATUS[r.status] ?? { label: humanise(r.status), hue: "slate" as const };
                    return (
                      <tr key={r.id} className="border-b border-neutral-100 align-top last:border-b-0">
                        <td className="py-3 pl-5 pr-2">
                          <span className="font-semibold text-neutral-900">Release {r.tranche}</span>
                          <span className="block text-xs text-neutral-500">
                            {r.requestedBy ? `Asked by ${r.requestedBy}` : ""}
                            {r.approvedAt ? ` · approved ${day(r.approvedAt)}` : ""}
                          </span>
                          {r.conditions && <span className="mt-0.5 block max-w-xs text-xs text-neutral-600">Conditions: {richExcerpt(r.conditions, 200)}</span>}
                        </td>
                        <td className="px-2 py-3">
                          <Chip hue={s.hue}>{s.label}</Chip>
                        </td>
                        <td className="px-2 py-3 text-neutral-600">{SCOPE_LABEL[r.scope] ?? r.scope}</td>
                        <td className="px-2 py-3 text-right tabular-nums">
                          <span className="font-semibold text-neutral-900">{amount(r.amount)}</span>
                          {r.revoked > 0 && <span className="block text-xs text-neutral-500">{amount(r.revoked)} revoked</span>}
                        </td>
                        <td className="py-2 pl-2 pr-5 text-right">
                          {canRevoke && r.status === "approved" && r.amount > r.revoked && (
                            <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setDialog({ kind: "revoke", release: r })}>
                              Revoke
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Budget" subtitle={p.budget ? `Version ${p.budget.version}${p.budget.approvedAt ? `, approved ${day(p.budget.approvedAt)}` : ""}` : "None approved"} icon={Grid3x3} hue="sky">
          {p.budget && (
            <>
              <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-neutral-500">Budget at completion</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">{amount(p.budget.bac)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Contract value</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">{amount(p.budget.contractValue)}</dd>
                </div>
              </dl>
              {p.budget.rebaselineReason && <p className="mb-4 text-xs text-neutral-600">Rebaselined: {richExcerpt(p.budget.rebaselineReason, 300)}</p>}
              <Heatmap
                rows={budgetCats.map(catName)}
                cols={budgetMonths.map((m) => monthLabel(m, true))}
                cells={(p.budget.lines ?? []).map((l) => ({ row: catName(l.category), col: monthLabel(l.month, true), value: l.amount }))}
                hue="sky"
                format={(v) => compact(v)}
                caption={`Approved budget for ${p.name} by category and month`}
              />
            </>
          )}
          {p.drafts.length > 0 && (
            <ul className="mt-4 space-y-2">
              {p.drafts.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200/80 px-3 py-2.5 text-sm">
                  <span>
                    <span className="font-semibold text-neutral-900">Version {d.version}</span>{" "}
                    <span className="tabular-nums text-neutral-600">{amount(d.bac)}</span>
                  </span>
                  {d.status === "draft" ? (
                    canSubmitBudget ? (
                      <Button size="sm" variant="secondary" icon={Send} onClick={() => sendDraft(d.id, d.version)} disabled={busy !== null}>
                        {busy === d.id ? "Sending…" : "Send for approval"}
                      </Button>
                    ) : (
                      <Chip hue="slate">Draft</Chip>
                    )
                  ) : (
                    <Chip hue="grape">Awaiting approval</Chip>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!p.budget && p.drafts.length === 0 && <p className="text-sm text-neutral-500">No budget drafted yet.</p>}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Commitments" subtitle="Approved requests holding money back until they are paid" icon={Receipt} hue="grape" bodyClassName="p-0 pt-4">
          {p.commitments.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-neutral-500">No open commitments.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
              {p.commitments.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    {c.source === "memo" ? (
                      <Link href={`/suite/finance/memos/${c.sourceId}`} className="font-semibold text-primary-700 hover:underline">
                        {c.reference ?? "Request"}
                      </Link>
                    ) : (
                      <span className="font-semibold text-neutral-900">{c.reference ?? humanise(c.source)}</span>
                    )}{" "}
                    <span className="text-neutral-700">{c.title}</span>
                    <span className="block text-xs text-neutral-500">
                      {[c.category ? catName(c.category) : null, c.consumed ? `${amount(c.consumed)} of ${amount(c.amount)} used` : null, c.expiresAt ? `lapses ${day(c.expiresAt)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-semibold tabular-nums text-neutral-900">{amount(c.outstanding)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent transactions" subtitle="The latest 20 lines in the books on this project" icon={BookOpen} hue="slate" bodyClassName="p-0 pt-4">
          {p.transactions.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-neutral-500">Nothing in the books on this project yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
              {p.transactions.map((t, i) => (
                <li key={`${t.journalId}-${i}`} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="text-xs text-neutral-500">{day(t.date)} · </span>
                    <Link href={`/suite/finance/journals/${t.journalId}`} className="font-mono text-[13px] font-semibold text-primary-700 hover:underline">
                      {t.journalNo ?? "Journal"}
                    </Link>
                    <span className="block truncate text-neutral-800">{t.narration ?? t.account}</span>
                    <span className="block truncate text-xs text-neutral-500">{t.account}</span>
                  </span>
                  <span className={cx("shrink-0 text-right font-semibold tabular-nums", t.amount < 0 ? "text-mint-700" : "text-neutral-900")}>{amount(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {dialog?.kind === "release" && <ReleaseDialog project={p} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "revoke" && <RevokeDialog release={dialog.release} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  );
}
