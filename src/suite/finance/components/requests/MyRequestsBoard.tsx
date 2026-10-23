"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleCheckBig, HandCoins, Hourglass, Plus, ReceiptText, UserRoundCheck } from "lucide-react";
import { ButtonLink, Card, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Donut } from "@/components/workspace/charts";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { spend, spendError, type MemoSummary } from "@/lib/api/finance-spend-client";
import { amount, compact, day } from "@/suite/finance/lib/format";
import { Money } from "@/suite/finance/components/banking/ui";
import { MemoStatusChip, RequestRoad } from "./ui";
import { isOpen, memoStatus, memoType, nextStep, requestStage } from "./labels";

/**
 * My requests: the payments and advances this person has asked for, where
 * each one is, and what - if anything - they need to do next.
 */

type Tab = "all" | "you" | "moving" | "done";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "you", label: "Waiting on you" },
  { key: "moving", label: "On its way" },
  { key: "done", label: "Finished" },
];

const inTab = (m: MemoSummary, t: Tab) => {
  const who = nextStep(m).who;
  if (t === "you") return who === "you";
  if (t === "moving") return who === "others";
  if (t === "done") return who === "done";
  return true;
};

export default function MyRequestsBoard() {
  const [rows, setRows] = useState<MemoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    let alive = true;
    spend.me
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(`Your requests didn't load. ${spendError(e)}`));
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const stats = useMemo(() => {
    const open = all.filter((m) => isOpen(m.status));
    const yours = all.filter((m) => nextStep(m).who === "you");
    const year = String(new Date().getFullYear());
    const paid = all.filter((m) => m.paidAmount > 0 && (m.submittedAt ?? m.createdAt ?? "").startsWith(year));
    const toRetire = all.filter((m) => m.status === "awaiting_retirement");
    return {
      open: open.length,
      openValue: open.reduce((s, m) => s + (m.approvedAmount ?? m.amount), 0),
      yours: yours.length,
      paid: paid.reduce((s, m) => s + m.paidAmount, 0),
      toRetire: toRetire.length,
      toRetireValue: toRetire.reduce((s, m) => s + m.paidAmount, 0),
    };
  }, [all]);

  const byStage = useMemo(() => {
    const groups = new Map<string, { label: string; value: number; hue: ReturnType<typeof memoStatus>["hue"] }>();
    for (const m of all.filter((x) => isOpen(x.status))) {
      const s = memoStatus(m.status);
      const g = groups.get(m.status) ?? { label: s.label, value: 0, hue: s.hue };
      g.value += 1;
      groups.set(m.status, g);
    }
    return [...groups.values()];
  }, [all]);

  const shown = all.filter((m) => inTab(m, tab));
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((m) => inTab(m, t.key)).length])) as Record<Tab, number>;

  const columns: Column<MemoSummary>[] = [
    {
      key: "title",
      header: "Request",
      primary: true,
      sortable: true,
      value: (m) => `${m.title} ${m.reference ?? ""}`,
      render: (m) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{m.title}</span>
          <span className="block text-xs text-neutral-500">
            {m.reference ?? "Not sent yet"} · {memoType(m.type)}
          </span>
        </span>
      ),
    },
    { key: "amount", header: "Amount", align: "right", sortable: true, value: (m) => m.amount, render: (m) => <Money value={m.amount} currency={m.currency ?? "NGN"} className="font-semibold" /> },
    { key: "status", header: "Status", sortable: true, value: (m) => memoStatus(m.status).label, render: (m) => <MemoStatusChip status={m.status} /> },
    {
      key: "next",
      header: "What's next",
      value: (m) => nextStep(m).text,
      render: (m) => <NextLabel memo={m} />,
    },
    { key: "neededBy", header: "Needed by", sortable: true, hideOnMobile: true, value: (m) => m.neededBy ?? "", render: (m) => (m.neededBy ? day(m.neededBy) : "-") },
  ];

  return (
    <div>
      <PageHeader
        title="My requests"
        subtitle="Payments and advances you have asked Finance for, and where each one is."
        actions={
          <ButtonLink href="/suite/finance/requests/new" variant="primary" icon={Plus}>
            New request
          </ButtonLink>
        }
        tabs={rows && rows.length > 0 ? TABS.map((t) => ({ ...t, count: counts[t.key] })) : undefined}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {error && rows === null && <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />}

      {rows === null && !error && (
        <div aria-busy="true" className="space-y-5">
          <p className="sr-only">Loading your requests…</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[132px]" />
            ))}
          </div>
          <Skeleton className="h-[320px]" />
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <Card>
          <Empty
            icon={HandCoins}
            title="Ask Finance for a payment or an advance"
            hint="Raise a request to pay a vendor or a colleague, or for money up front that you account for later. Attach the documents, send it, and follow it here until it is paid."
            action={
              <ButtonLink href="/suite/finance/requests/new" variant="primary" icon={Plus}>
                Raise your first request
              </ButtonLink>
            }
          />
        </Card>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="space-y-5">
          <StatGrid>
            <StatCard featured label="Waiting on you" value={stats.yours} icon={UserRoundCheck} hint={stats.yours === 0 ? "Nothing to do" : "Answer, send or retire"} />
            <StatCard label="On their way" value={stats.open} icon={Hourglass} hue="sky" hint={`${amount(stats.openValue)} asked for`} />
            <StatCard label="Paid to date this year" value={compact(stats.paid)} icon={CircleCheckBig} hue="mint" hint={amount(stats.paid)} />
            <StatCard label="Advances to retire" value={stats.toRetire} icon={ReceiptText} hue="coral" hint={stats.toRetire ? `${amount(stats.toRetireValue)} to account for` : "None outstanding"} />
          </StatGrid>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <DataView
                rows={shown}
                columns={columns}
                rowKey={(m) => m.id}
                rowHref={(m) => (m.status === "draft" ? `/suite/finance/requests/new?id=${m.id}` : `/suite/finance/requests/${m.id}`)}
                storageKey="finance-my-requests"
                defaultView="list"
                searchPlaceholder="Search your requests"
                caption="Your payment and advance requests"
                gridCols={2}
                renderCard={(m) => <RequestCard memo={m} />}
                renderListItem={(m) => <RequestCard memo={m} flat />}
                empty={<p className="px-5 py-10 text-center text-sm text-neutral-500">Nothing here. Try another tab.</p>}
              />
            </div>
            <Panel title="Where your requests are" subtitle="Requests still on their way, by stage" icon={Hourglass} hue="sky">
              {byStage.length === 0 ? (
                <p className="text-sm text-neutral-500">Everything you asked for has been dealt with.</p>
              ) : (
                <Donut data={byStage} total={stats.open} centerLabel="on their way" size={160} legend="below" caption="Open requests by stage" />
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function NextLabel({ memo }: { memo: MemoSummary }) {
  const n = nextStep(memo);
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-sm", n.who === "you" ? "font-semibold text-neutral-900" : "text-neutral-600")}>
      {n.who === "you" && <ArrowRight size={14} className="text-primary-600" aria-hidden />}
      {n.text}
    </span>
  );
}

/** A request as a card (DataView wraps it in the row's link): title, amount, the road, and what's next. */
function RequestCard({ memo: m, flat = false }: { memo: MemoSummary; flat?: boolean }) {
  const n = nextStep(m);
  return (
    <div className={flat ? "px-5 py-3.5" : "flex h-full flex-col p-5"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{m.title}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {m.reference ?? "Not sent yet"} · {memoType(m.type)}
            {m.project ? ` · ${m.project}` : ""}
          </p>
        </div>
        <Money value={m.amount} currency={m.currency ?? "NGN"} className="shrink-0 text-[15px] font-bold text-neutral-900" />
      </div>
      <div className="mt-3">
        <RequestRoad stage={requestStage(m)} compact />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <MemoStatusChip status={m.status} />
          {m.status === "partially_paid" && (
            <Chip hue="sky" className="!px-2 !py-0.5 !text-[11px]">
              {amount(m.paidAmount)} paid
            </Chip>
          )}
        </span>
        <span className={cx("inline-flex items-center gap-1 text-xs", n.who === "you" ? "font-semibold text-primary-700" : "text-neutral-500")}>
          {n.text}
          {n.who === "you" && <ArrowRight size={13} aria-hidden />}
        </span>
      </div>
    </div>
  );
}
