"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, ChevronRight, HandCoins, Hourglass, MessageCircleQuestion, Plus, Wallet } from "lucide-react";
import { ButtonLink, Card, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ColumnChart } from "@/components/workspace/charts";
import { HUE, type Hue } from "@/components/workspace/modules";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount, compact, day } from "@/suite/finance/lib/format";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { clientPayments, opsError, type ClientPaymentSummary, type ClientPaymentsMeta } from "@/lib/api/operations-travel-client";
import { plural } from "../travel/labels";
import { FINISHED, stageMeta } from "./labels";

/**
 * Client payments: every request we have put to a client, where each is
 * in the client's process, how long it has sat there, and when it is next
 * chased, with the overdue chases called out.
 */

type Tab = "open" | "overdue" | "queried" | "finished" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Follow-ups overdue" },
  { key: "queried", label: "Queried" },
  { key: "finished", label: "Paid and closed" },
  { key: "all", label: "All" },
];

function inTab(r: ClientPaymentSummary, t: Tab): boolean {
  const done = FINISHED.includes(r.stage);
  if (t === "open") return !done;
  if (t === "overdue") return !done && r.followUpOverdue;
  if (t === "queried") return r.stage === "queried";
  if (t === "finished") return done;
  return true;
}

const AGEING: { key: keyof ClientPaymentsMeta["ageing"]; label: string; hue: Hue }[] = [
  { key: "notSubmitted", label: "Not sent", hue: "slate" },
  { key: "d30", label: "Up to 30 days", hue: "mint" },
  { key: "d60", label: "31 to 60 days", hue: "sun" },
  { key: "d90", label: "61 to 90 days", hue: "coral" },
  { key: "over90", label: "Over 90 days", hue: "rose" },
];

export default function ClientPaymentsBoard() {
  const { user } = useAuth();
  const [data, setData] = useState<{ requests: ClientPaymentSummary[]; meta: ClientPaymentsMeta } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("open");
  const listView = useListView("ops-client-payments");
  const canCreate = mayDoOps(user, "client_payments", "create");

  useEffect(() => {
    let alive = true;
    clientPayments.list().then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Client payment requests didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const rows = useMemo(() => data?.requests ?? [], [data]);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, rows.filter((x) => inTab(x, t.key)).length])) as Record<Tab, number>;

  const columns: Column<ClientPaymentSummary>[] = [
    {
      key: "request",
      header: "Request",
      primary: true,
      sortable: true,
      value: (r) => `${r.client ?? ""} ${r.title} ${r.number ?? ""} ${r.invoiceNo ?? ""}`,
      render: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{r.client}</span>
          <span className="block truncate text-xs text-neutral-500">
            {r.number} · {r.title}
          </span>
        </span>
      ),
    },
    { key: "amount", header: "Amount", align: "right", sortable: true, value: (r) => r.amount, render: (r) => <Money value={r.amount} currency={r.currency} className="font-semibold" /> },
    { key: "stage", header: "Stage", sortable: true, value: (r) => r.stageLabel, render: (r) => <StageChip stage={r.stage} label={r.stageLabel} /> },
    { key: "days", header: "Days in stage", align: "right", sortable: true, value: (r) => r.daysInStage, render: (r) => <span className="tabular-nums">{FINISHED.includes(r.stage) ? "-" : r.daysInStage}</span> },
    { key: "follow", header: "Next follow-up", sortable: true, value: (r) => r.nextFollowUpOn ?? "9999", render: (r) => <FollowUp row={r} /> },
    { key: "manager", header: "Account manager", sortable: true, hideOnMobile: true, value: (r) => r.accountManager ?? "" },
  ];

  if (error && !data) return <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />;

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading client payment requests…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[220px]" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const m = data.meta;
  const newButton = canCreate ? (
    <ButtonLink href="/suite/operations/clients/requests/new" variant="primary" icon={Plus}>
      Prepare a request
    </ButtonLink>
  ) : null;

  return (
    <div>
      <PageHeader
        title="Client payments"
        subtitle="Payment packs your team submits to clients, and the chase through their process until the money arrives."
        actions={newButton}
        tabs={rows.length > 0 ? TABS.map((t) => ({ ...t, count: counts[t.key] })) : undefined}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {rows.length === 0 ? (
        <Card>
          <Empty
            icon={HandCoins}
            title="Put your first payment request to a client"
            hint="Start from an issued invoice and attach the client's documents (cover letter, invoice, completion certificate). Get the pack approved, then record each stage until it is paid."
            action={newButton ?? undefined}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <StatGrid>
            <StatCard featured label="Open requests" value={m.totals.open} icon={HandCoins} hint={plural(m.totals.open, "request") + " being chased"} />
            <StatCard label="Value being chased" value={compact(m.totals.value)} icon={Wallet} hue="mint" hint={amount(m.totals.value)} />
            <StatCard label="Follow-ups overdue" value={m.totals.overdueFollowUps} icon={BellRing} hue={m.totals.overdueFollowUps ? "rose" : "slate"} hint={m.totals.overdueFollowUps ? "Chase these today" : "Everything chased on time"} />
            <StatCard label="Queried by the client" value={m.totals.queried} icon={MessageCircleQuestion} hue={m.totals.queried ? "sun" : "slate"} hint="Answer and resubmit" />
          </StatGrid>

          <Panel title="Pipeline" subtitle="Open requests at each stage of the client's process" icon={Hourglass} hue="sky">
            <StagePipeline stages={m.byStage} />
          </Panel>

          <Panel title="Ageing since submission" subtitle="Value of open requests by how long ago they reached the client" icon={Hourglass} hue="coral">
            <ColumnChart
              data={AGEING.map((a) => ({ label: a.label, value: m.ageing[a.key] ?? 0, hue: a.hue }))}
              height={180}
              format={(v) => compact(v)}
              caption="Open request value by days since submission"
              highlight="none"
            />
          </Panel>

          <DataView
            rows={rows.filter((r) => inTab(r, tab))}
            columns={columns}
            rowKey={(r) => r.id}
            rowHref={(r) => `/suite/operations/clients/requests/${r.id}`}
            {...listView}
            searchPlaceholder="Search by client, title, number or invoice"
            caption="Client payment requests"
            gridCols={3}
            renderCard={(r) => <RequestCard row={r} />}
            renderListItem={(r) => <RequestCard row={r} flat />}
            empty={<Empty icon={HandCoins} title="Nothing here" hint="Try another tab." />}
          />
        </div>
      )}
    </div>
  );
}

export function StageChip({ stage, label }: { stage: string; label?: string }) {
  const s = stageMeta(stage, label);
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {label ?? s.label}
    </Chip>
  );
}

/** The next chase date, in rose with the word "overdue" once it has passed. */
export function FollowUp({ row: r }: { row: Pick<ClientPaymentSummary, "nextFollowUpOn" | "followUpOverdue" | "stage"> }) {
  if (FINISHED.includes(r.stage)) return <span className="text-neutral-500">Nothing to chase</span>;
  if (!r.nextFollowUpOn) return <span className="text-neutral-500">Not set</span>;
  return r.followUpOverdue ? (
    <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700">
      <BellRing size={14} aria-hidden />
      {day(r.nextFollowUpOn)} <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[11px]">Overdue</span>
    </span>
  ) : (
    <span className="tabular-nums text-neutral-700">{day(r.nextFollowUpOn)}</span>
  );
}

/**
 * Open requests per stage as a pipeline: each stage a tile with its count,
 * its value and a bar for its share of the value. Queried stands out.
 */
export function StagePipeline({ stages }: { stages: ClientPaymentsMeta["byStage"] }) {
  const top = Math.max(1, ...stages.map((s) => s.value));
  const total = stages.reduce((n, s) => n + s.count, 0);
  if (total === 0) return <p className="py-4 text-center text-sm text-neutral-500">No open requests. Paid and closed ones are under their own tab.</p>;
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Open requests by stage">
      {stages.map((s, i) => {
        const meta = stageMeta(s.stage, s.label);
        const Icon = meta.icon;
        const empty = s.count === 0;
        const alert = s.stage === "queried" && !empty;
        return (
          <li
            key={s.stage}
            className={cx(
              "relative flex min-w-0 flex-col rounded-2xl border p-3.5",
              alert ? "border-rose-500/40 bg-rose-50/60" : empty ? "border-dashed border-neutral-200 bg-white" : "border-neutral-100 bg-white",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", empty ? "bg-neutral-100 text-neutral-400" : HUE[meta.hue].soft)}>
                <Icon size={15} aria-hidden />
              </span>
              <span className={cx("min-w-0 truncate text-xs font-semibold", empty ? "text-neutral-500" : "text-neutral-800")} title={s.label}>
                {s.label}
              </span>
            </div>
            <p className={cx("mt-3 text-2xl font-bold tabular-nums leading-none", empty ? "text-neutral-300" : "text-neutral-900")}>
              {s.count}
              <span className="sr-only"> {s.count === 1 ? "request" : "requests"}</span>
            </p>
            <p className="mt-1 text-xs tabular-nums text-neutral-500">{empty ? "-" : compact(s.value)}</p>
            <div className="ws-hatch mt-2.5 h-1.5 overflow-hidden rounded-full" aria-hidden>
              <span className={cx("block h-full rounded-full", HUE[meta.hue].bar)} style={{ width: `${(s.value / top) * 100}%` }} />
            </div>
            {i < stages.length - 1 && (
              <ChevronRight size={14} aria-hidden className="absolute -right-[11px] top-1/2 z-[1] hidden -translate-y-1/2 rounded-full bg-canvas text-neutral-400 lg:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function RequestCard({ row: r, flat = false }: { row: ClientPaymentSummary; flat?: boolean }) {
  return (
    <div className={cx(flat ? "px-5 py-3.5" : "flex h-full flex-col p-5", r.followUpOverdue && !FINISHED.includes(r.stage) && "border-l-4 border-rose-500")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{r.client}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {r.number} · {r.title}
          </p>
        </div>
        <Money value={r.amount} currency={r.currency} className="shrink-0 text-[15px] font-bold text-neutral-900" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StageChip stage={r.stage} label={r.stageLabel} />
        {!FINISHED.includes(r.stage) && <span className="text-xs tabular-nums text-neutral-500">{plural(r.daysInStage, "day")} in stage</span>}
      </div>
      <p className="mt-2 text-sm">
        <span className="text-neutral-500">Next follow-up </span>
        <FollowUp row={r} />
      </p>
    </div>
  );
}
