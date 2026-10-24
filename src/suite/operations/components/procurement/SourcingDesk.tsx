"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, FileStack, Gavel, Hourglass, Scale } from "lucide-react";
import { Card, Empty, PageHeader, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { opsError, procurement, type PrDeskMeta, type PrSummary } from "@/lib/api/operations-procurement-client";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { isPast, prStatus } from "./meta";
import { DocNo, PrOriginChip, PrStatusChip } from "./ui";

/**
 * The sourcing desk: every request sent for approval, with the ones waiting
 * to be sourced first. Tabs follow a request from approval to award; a row
 * opens the request's RFQs, quotations and comparison sheet.
 */

type Tab = "source" | "award" | "approval" | "all";

const TABS: { key: Tab; label: string; status?: string }[] = [
  { key: "source", label: "To source", status: "approved" },
  { key: "award", label: "Award pending", status: "award_pending" },
  { key: "approval", label: "In approval", status: "in_approval" },
  { key: "all", label: "All" },
];

const isTab = (v: string | null | undefined): v is Tab => TABS.some((t) => t.key === v);

export default function SourcingDesk() {
  const router = useRouter();
  const params = useSearchParams();
  const asked = params?.get("tab");
  const tab: Tab = isTab(asked) ? asked : "source";
  const [rows, setRows] = useState<PrSummary[] | null>(null);
  const [meta, setMeta] = useState<PrDeskMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const listView = useListView("ops-sourcing");

  useEffect(() => {
    let alive = true;
    procurement.requests
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r.requests);
        setMeta(r.meta);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(`The requests didn't load. ${opsError(e)}`));
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const inTab = (p: PrSummary, t: Tab) => {
    const status = TABS.find((x) => x.key === t)?.status;
    return status ? p.status === status : true;
  };
  const shown = all.filter((p) => inTab(p, tab));
  const counts: Record<Tab, number> = {
    source: meta?.toSource ?? all.filter((p) => inTab(p, "source")).length,
    award: meta?.awardPending ?? all.filter((p) => inTab(p, "award")).length,
    approval: meta?.inApproval ?? all.filter((p) => inTab(p, "approval")).length,
    all: all.length,
  };
  const toSourceValue = all.filter((p) => p.status === "approved").reduce((s, p) => s + p.estimate, 0);
  const overdue = all.filter((p) => ["approved", "award_pending"].includes(p.status) && isPast(p.neededBy)).length;
  const go = (t: string) => router.replace(t === "source" ? "/suite/operations/procurement/requests" : `/suite/operations/procurement/requests?tab=${t}`, { scroll: false });

  /* The requests as listed: this tab, the search and the sort. */
  const exportCsv = (list: PrSummary[]) =>
    downloadCsv(csvName("purchase-requests", tab === "all" ? "" : tab), [
      ["Number", "Title", "Raised by", "Category", "Project", "Estimate", "Currency", "Needed by", "Status", "Raised on"],
      ...list.map((p) => [
        p.number ?? "",
        p.title,
        p.requester ?? "",
        p.categoryLabel,
        p.project ? [p.project.code, p.project.name].filter(Boolean).join(" ") : "Cost centre",
        csvAmount(p.estimate),
        p.currency,
        csvDate(p.neededBy),
        prStatus(p.status).label,
        csvDate(p.createdAt),
      ]),
    ]);

  const columns: Column<PrSummary>[] = [
    {
      key: "title",
      header: "Request",
      primary: true,
      sortable: true,
      value: (p) => `${p.title} ${p.number ?? ""}`,
      render: (p) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{p.title}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <DocNo value={p.number} />
            <PrOriginChip origin={p.origin} status={p.status} />
          </span>
        </span>
      ),
    },
    { key: "requester", header: "Raised by", sortable: true, hideOnMobile: true, value: (p) => p.requester ?? "" },
    { key: "category", header: "Category", sortable: true, hideOnMobile: true, value: (p) => p.categoryLabel },
    {
      key: "charged",
      header: "Charged to",
      hideOnMobile: true,
      value: (p) => (p.project ? `${p.project.code ?? ""} ${p.project.name}` : "Cost centre"),
      render: (p) => (p.project ? <span className="text-neutral-700">{p.project.code ? `${p.project.code} · ` : ""}{p.project.name}</span> : <span className="text-neutral-500">Cost centre</span>),
    },
    { key: "estimate", header: "Estimate", align: "right", sortable: true, value: (p) => p.estimate, render: (p) => <Money value={p.estimate} currency={p.currency} className="font-semibold" /> },
    {
      key: "neededBy",
      header: "Needed by",
      sortable: true,
      value: (p) => p.neededBy ?? "",
      render: (p) =>
        p.neededBy ? <span className={isPast(p.neededBy) && ["approved", "award_pending"].includes(p.status) ? "font-semibold text-rose-700" : undefined}>{day(p.neededBy)}</span> : "-",
    },
    { key: "status", header: "Status", sortable: true, value: (p) => p.status, render: (p) => <PrStatusChip status={p.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Requests & sourcing"
        subtitle="Approved purchase requests to source. Invite quotations, compare them and recommend who supplies what."
        tabs={rows ? TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] })) : undefined}
        activeTab={tab}
        onTab={go}
      />

      {error && rows === null && <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />}

      {rows === null && !error && (
        <div aria-busy="true" className="space-y-6">
          <p className="sr-only">Loading the requests…</p>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[132px]" />
            ))}
          </div>
          <Skeleton className="h-[320px]" />
        </div>
      )}

      {rows !== null && (
        <div className="space-y-6">
          <StatGrid>
            <StatCard featured label="To source" value={counts.source} icon={Scale} href="/suite/operations/procurement/requests" hint={counts.source ? `${compact(toSourceValue)} estimated` : "Nothing waiting"} />
            <StatCard label="Awards in approval" value={counts.award} icon={Gavel} hue="sun" href="/suite/operations/procurement/requests?tab=award" hint="Recommended, waiting on approvers" />
            <StatCard label="Requests in approval" value={counts.approval} icon={Hourglass} hue="grape" href="/suite/operations/procurement/requests?tab=approval" hint="Not yet ready to source" />
            <StatCard label="Past their needed-by date" value={overdue} icon={CalendarClock} hue={overdue ? "rose" : "mint"} hint={overdue ? "Still being sourced" : "None late"} />
          </StatGrid>

          {all.length === 0 ? (
            <Card>
              <Empty
                icon={FileStack}
                title="No purchase requests yet"
                hint="Approved purchase requests arrive here to be sourced. Staff raise them under My purchase requests."
              />
            </Card>
          ) : (
            <DataView
              rows={shown}
              columns={columns}
              rowKey={(p) => p.id}
              rowHref={(p) => `/suite/operations/procurement/requests/${p.id}`}
              {...listView}
              views={["table", "list"]}
              searchPlaceholder="Search requests"
              onDownload={exportCsv}
              caption="Purchase requests on the sourcing desk"
              empty={<Empty icon={FileStack} title="Nothing in this tab" hint="Try another tab." />}
              renderListItem={(p) => (
                <div className="flex items-start justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{p.title}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {p.number ?? "Draft"} · {p.requester ?? "-"} · needed {p.neededBy ? day(p.neededBy) : "-"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <PrStatusChip status={p.status} />
                      <PrOriginChip origin={p.origin} status={p.status} />
                    </div>
                  </div>
                  <Money value={p.estimate} currency={p.currency} className="shrink-0 text-sm font-bold text-neutral-900" />
                </div>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
