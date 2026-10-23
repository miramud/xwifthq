"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Banknote, ClipboardCheck, FileSearch, ReceiptText, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { ButtonLink, Card, Chip, Empty, PageHeader, Panel, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Donut } from "@/components/workspace/charts";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { spend, spendError, type FcuMemoRow, type FcuQueues, type FcuRetirementRow, type FcuVoucherRow } from "@/lib/api/finance-spend-client";
import { mayUseFinance } from "@/suite/finance/lib/finance-access";
import { Money } from "@/suite/finance/components/banking/ui";
import { MemoStatusChip } from "@/suite/finance/components/requests/ui";
import { SLA_DAYS, memoStatus, memoType, slaState, voucherStatus } from "@/suite/finance/components/requests/labels";
import { csvAmount, downloadCsv } from "@/components/workspace/csv";

/**
 * The FCU's desk: four queues - memos to vet, vouchers to pre-audit,
 * payments to confirm against the bank, advance retirements to vet - oldest
 * first, each against its service level (one working day for memos and
 * vouchers, two for payments). Overdue work says so in words.
 */

type Queue = "memos" | "vouchers" | "payments" | "retirements";

const QUEUES: { key: Queue; label: string; icon: typeof ShieldCheck }[] = [
  { key: "memos", label: "Memos to vet", icon: ClipboardCheck },
  { key: "vouchers", label: "Vouchers to pre-audit", icon: FileSearch },
  { key: "payments", label: "Payments to confirm", icon: Banknote },
  { key: "retirements", label: "Retirements to vet", icon: ReceiptText },
];

const isQueue = (s: string | null): s is Queue => s === "memos" || s === "vouchers" || s === "payments" || s === "retirements";

function SlaChip({ days, sla, now }: { days: number | null; sla: number; now: Date }) {
  const s = slaState(days, sla, now);
  return (
    <Chip hue={s.hue} icon={s.overdue ? TriangleAlert : undefined} dot={!s.overdue}>
      {s.label}
    </Chip>
  );
}

export default function FcuBoard({ now: fixedNow }: { now?: Date } = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const allowed = mayUseFinance(user, "fcu");
  const tab: Queue = isQueue(params.get("tab")) ? (params.get("tab") as Queue) : "memos";
  const [now] = useState(() => fixedNow ?? new Date());
  const [data, setData] = useState<FcuQueues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    spend.fcu
      .queues()
      .then((q) => {
        if (!alive) return;
        setData(q);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(`The FCU queues didn't load. ${spendError(e)}`));
    return () => {
      alive = false;
    };
  }, [allowed, reload]);

  const overdue = useMemo(() => {
    const count = (rows: { waitingDays: number | null }[], sla: number) => rows.filter((r) => slaState(r.waitingDays, sla, now).overdue).length;
    if (!data) return { memos: 0, vouchers: 0, payments: 0, retirements: 0 };
    return {
      memos: count(data.memos, SLA_DAYS.memos),
      vouchers: count(data.vouchers, SLA_DAYS.vouchers),
      payments: count(data.payments, SLA_DAYS.payments),
      retirements: count(data.retirements, SLA_DAYS.retirements),
    };
  }, [data, now]);

  const sla = useMemo(() => {
    if (!data) return [];
    const all = QUEUES.flatMap((q) => (data[q.key] as { waitingDays: number | null }[]).map((r) => slaState(r.waitingDays, SLA_DAYS[q.key], now)));
    return [
      { label: "In time", value: all.filter((s) => s.hue === "mint").length, hue: "mint" as const },
      { label: "Due now", value: all.filter((s) => s.hue === "sun").length, hue: "sun" as const },
      { label: "Overdue", value: all.filter((s) => s.overdue).length, hue: "rose" as const },
    ];
  }, [data, now]);

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Finance Control Unit" />
        <Card>
          <Empty icon={ShieldAlert} title="The FCU's queues are for FCU officers" hint="Ask an administrator for the FCU officer role if you vet memos, vouchers or payments." />
        </Card>
      </div>
    );
  }

  const setTab = (k: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", k);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const counts = data ? { memos: data.memos.length, vouchers: data.vouchers.length, payments: data.payments.length, retirements: data.retirements.length } : null;
  const total = counts ? counts.memos + counts.vouchers + counts.payments + counts.retirements : 0;
  const totalOverdue = overdue.memos + overdue.vouchers + overdue.payments + overdue.retirements;

  const memoCols: Column<FcuMemoRow>[] = [
    {
      key: "title",
      header: "Memo",
      primary: true,
      sortable: true,
      value: (m) => `${m.reference ?? ""} ${m.title ?? ""} ${m.requester ?? ""}`,
      render: (m) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{m.title ?? "Untitled"}</span>
          <span className="block text-xs text-neutral-500">
            {m.reference ?? "—"} · {m.requester ?? "—"} · {memoType(m.type)}
          </span>
        </span>
      ),
    },
    { key: "amount", header: "Approved", align: "right", sortable: true, value: (m) => m.amount ?? 0, render: (m) => <Money value={m.amount} currency={m.currency ?? "NGN"} className="font-semibold" /> },
    {
      key: "status",
      header: "Status",
      value: (m) => m.status,
      render: (m) => (
        <span className="flex flex-wrap gap-1.5">
          <MemoStatusChip status={m.status} />
          {m.openQueries > 0 && <Chip hue="sun">{m.openQueries} open {m.openQueries === 1 ? "query" : "queries"}</Chip>}
        </span>
      ),
    },
    { key: "waiting", header: "Waiting", sortable: true, value: (m) => m.waitingDays ?? 0, render: (m) => <SlaChip days={m.waitingDays} sla={SLA_DAYS.memos} now={now} /> },
  ];

  const voucherCols = (kind: "vouchers" | "payments"): Column<FcuVoucherRow>[] => [
    {
      key: "pv",
      header: "Voucher",
      primary: true,
      sortable: true,
      value: (v) => `${v.pvNo ?? ""} ${v.payee}`,
      render: (v) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{v.pvNo ?? "Draft voucher"}</span>
          <span className="block truncate text-xs text-neutral-500">
            {v.payee}
            {v.cibReference ? ` · bank ref ${v.cibReference}` : ""}
          </span>
        </span>
      ),
    },
    { key: "net", header: "Net payable", align: "right", sortable: true, value: (v) => v.net, render: (v) => <Money value={v.net} currency={v.currency} className="font-semibold" /> },
    {
      key: "status",
      header: "Status",
      value: (v) => voucherStatus(v.status).label,
      render: (v) => {
        const s = voucherStatus(v.status);
        return (
          <Chip hue={s.hue} dot>
            {kind === "payments" && v.status === "payment_initiated" ? "Sent, to confirm" : s.label}
          </Chip>
        );
      },
    },
    { key: "waiting", header: "Waiting", sortable: true, value: (v) => v.waitingDays ?? 0, render: (v) => <SlaChip days={v.waitingDays} sla={SLA_DAYS[kind]} now={now} /> },
  ];

  const retirementCols: Column<FcuRetirementRow>[] = [
    { key: "person", header: "Advance to", primary: true, sortable: true, value: (r) => r.person ?? "" },
    { key: "advanced", header: "Advanced", align: "right", sortable: true, value: (r) => r.advanced, render: (r) => <Money value={r.advanced} className="font-semibold" /> },
    { key: "spent", header: "Spent", align: "right", value: (r) => r.spent, render: (r) => <Money value={r.spent} /> },
    { key: "refund", header: "Returned", align: "right", hideOnMobile: true, value: (r) => r.refund, render: (r) => <Money value={r.refund} /> },
    { key: "waiting", header: "Waiting", sortable: true, value: (r) => r.waitingDays ?? 0, render: (r) => <SlaChip days={r.waitingDays} sla={SLA_DAYS.retirements} now={now} /> },
  ];

  /* Each queue as listed, after the search and the sort. Waiting is calendar days; the service level is its word. */
  const waited = (days: number | null, slaDays: number) => [days ?? "", slaState(days, slaDays, now).label];
  const memoCsv = (rows: FcuMemoRow[]) =>
    downloadCsv("fcu-memos.csv", [
      ["Reference", "Title", "Type", "Requester", "Status", "Open queries", "Currency", "Approved", "Waiting (days)", "Service level"],
      ...rows.map((m) => [m.reference ?? "", m.title ?? "", memoType(m.type), m.requester ?? "", memoStatus(m.status).label, m.openQueries, m.currency ?? "NGN", csvAmount(m.amount), ...waited(m.waitingDays, SLA_DAYS.memos)]),
    ]);
  const voucherCsv = (kind: "vouchers" | "payments") => (rows: FcuVoucherRow[]) =>
    downloadCsv(`fcu-${kind}.csv`, [
      ["Voucher", "Payee", "Bank reference", "Status", "Currency", "Net payable", "Waiting (days)", "Service level"],
      ...rows.map((v) => [v.pvNo ?? "", v.payee, v.cibReference ?? "", voucherStatus(v.status).label, v.currency || "NGN", csvAmount(v.net), ...waited(v.waitingDays, SLA_DAYS[kind])]),
    ]);
  const retirementCsv = (rows: FcuRetirementRow[]) =>
    downloadCsv("fcu-retirements.csv", [
      ["Advance to", "Currency", "Advanced", "Spent", "Returned", "Waiting (days)", "Service level"],
      ...rows.map((r) => [r.person ?? "", "NGN", csvAmount(r.advanced), csvAmount(r.spent), csvAmount(r.refund), ...waited(r.waitingDays, SLA_DAYS.retirements)]),
    ]);

  const empty = (what: string) => <Empty icon={BadgeCheck} hue="mint" title={`No ${what} waiting`} hint="The queue is clear. New work appears here as it arrives." />;

  return (
    <div>
      <PageHeader
        eyebrow="Finance Control Unit"
        title="FCU queues"
        subtitle="Independent checks before money moves: oldest first, against the service level."
        actions={
          <ButtonLink href="/suite/finance/fcu/exceptions" icon={TriangleAlert}>
            Exceptions board
          </ButtonLink>
        }
        tabs={QUEUES.map((q) => ({ key: q.key, label: q.label, count: counts?.[q.key] }))}
        activeTab={tab}
        onTab={setTab}
      />

      {error && !data && <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />}

      {!data && !error && (
        <div aria-busy="true" className="space-y-5">
          <p className="sr-only">Loading the queues…</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[132px]" />
            ))}
          </div>
          <Skeleton className="h-[360px]" />
        </div>
      )}

      {data && (
        <div className="space-y-5">
          <StatGrid>
            {QUEUES.map((q, i) => (
              <StatCard
                key={q.key}
                featured={i === 0}
                label={q.label}
                value={data[q.key].length}
                icon={q.icon}
                hue={(["blue", "grape", "coral", "sky"] as const)[i]}
                hint={overdue[q.key] > 0 ? `${overdue[q.key]} overdue` : `Service level ${SLA_DAYS[q.key]} working ${SLA_DAYS[q.key] === 1 ? "day" : "days"}`}
              />
            ))}
          </StatGrid>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              {tab === "memos" && (
                <DataView rows={data.memos} columns={memoCols} rowKey={(m) => m.id} rowHref={(m) => `/suite/finance/fcu/memos/${m.id}`} storageKey="fcu-memos" searchPlaceholder="Search memos" caption="Memos waiting for FCU vetting" empty={empty("memos")} onDownload={memoCsv} />
              )}
              {tab === "vouchers" && (
                <DataView rows={data.vouchers} columns={voucherCols("vouchers")} rowKey={(v) => v.id} rowHref={(v) => `/suite/finance/fcu/vouchers/${v.id}`} storageKey="fcu-vouchers" searchPlaceholder="Search vouchers" caption="Vouchers waiting for pre-audit" empty={empty("vouchers")} onDownload={voucherCsv("vouchers")} />
              )}
              {tab === "payments" && (
                <DataView rows={data.payments} columns={voucherCols("payments")} rowKey={(v) => `${v.id}-${v.status}`} rowHref={(v) => `/suite/finance/fcu/payments/${v.id}`} storageKey="fcu-payments" searchPlaceholder="Search payments" caption="Payments waiting for confirmation against the bank" empty={empty("payments")} onDownload={voucherCsv("payments")} />
              )}
              {tab === "retirements" && (
                <DataView
                  rows={data.retirements}
                  columns={retirementCols}
                  rowKey={(r) => r.id}
                  rowHref={(r) => `/suite/finance/fcu/retirements/${r.id}?memo=${r.memoId}`}
                  storageKey="fcu-retirements"
                  searchPlaceholder="Search by person"
                  caption="Advance retirements waiting for vetting"
                  empty={empty("retirements")}
                  onDownload={retirementCsv}
                />
              )}
            </div>
            <Panel title="Against the service level" subtitle={total === 0 ? "Nothing waiting" : `${total} waiting across the queues`} icon={ShieldCheck} hue={totalOverdue > 0 ? "rose" : "mint"}>
              {total === 0 ? (
                <p className="text-sm text-neutral-500">Every queue is clear.</p>
              ) : (
                <Donut data={sla} total={total} centerLabel="waiting" size={160} legend="below" caption="Work waiting for the FCU, by service level" />
              )}
              <p className="mt-4 text-xs text-neutral-500">Memos and vouchers within one working day; payments within two. Weekends don&apos;t count.</p>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
