"use client";

import { useCallback, useState } from "react";
import { HandCoins } from "lucide-react";
import { Empty, PageHeader, type PageTab } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Pager, formatDate, useLoad } from "@/suite/platform/components/ui";
import { myAffiliate, percentText, type Commission, type CommissionStatus, type Page } from "@/lib/api/affiliate-client";
import { formatMoney } from "@/lib/money";
import { COMMISSION_STATUS, CommissionChip, explained } from "./ui";

type Tab = CommissionStatus | "all";

const TABS: PageTab[] = [{ key: "all", label: "All" }, ...COMMISSION_STATUS.map((s) => ({ key: s.key, label: s.label }))];

const money = (minor: number, c: Commission) => formatMoney(minor, c.currency);

const COLUMNS: Column<Commission>[] = [
  {
    key: "organisation",
    header: "Organisation",
    primary: true,
    value: (c) => c.organisation?.name ?? "Organisation no longer on XwiftHQ",
    render: (c) => (
      <span className="font-medium text-neutral-900">{c.organisation?.name ?? "Organisation no longer on XwiftHQ"}</span>
    ),
  },
  { key: "source", header: "What for", value: (c) => c.sourceLabel, hideOnMobile: true },
  { key: "paid", header: "They paid", align: "right", value: (c) => c.paidMinor, render: (c) => money(c.paidMinor, c), hideOnMobile: true },
  {
    key: "discount",
    header: "Their discount",
    align: "right",
    value: (c) => c.discountMinor,
    render: (c) => money(c.discountMinor, c),
    hideOnMobile: true,
  },
  { key: "base", header: "Base", align: "right", value: (c) => c.baseMinor, render: (c) => money(c.baseMinor, c), hideOnMobile: true },
  { key: "rate", header: "Rate", align: "right", value: (c) => c.ratePercent, render: (c) => percentText(c.ratePercent), hideOnMobile: true },
  {
    key: "amount",
    header: "Commission",
    align: "right",
    value: (c) => c.amountMinor,
    render: (c) => (
      <span className={c.status === "reversed" ? "font-semibold text-neutral-500 line-through" : "font-semibold text-neutral-900"}>
        {money(c.amountMinor, c)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    value: (c) => c.statusLabel,
    render: (c) => (
      <div className="min-w-0">
        <CommissionChip status={c.status} label={c.statusLabel} />
        {c.status === "reversed" && c.reversalNote && (
          <p className="mt-1 max-w-[16rem] whitespace-normal text-xs text-neutral-500">{c.reversalNote}</p>
        )}
      </div>
    ),
  },
  { key: "availableAt", header: "Ready on", value: (c) => c.availableAt, render: (c) => formatDate(c.availableAt), hideOnMobile: true },
  { key: "payout", header: "Payout", value: (c) => c.payout?.reference ?? "", hideOnMobile: true },
];

/** One commission on a narrow screen: who, how much, where it is and when. */
function ListItem({ c }: { c: Commission }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-neutral-900">
          {c.organisation?.name ?? "Organisation no longer on XwiftHQ"}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {c.sourceLabel} · {percentText(c.ratePercent)} of {money(c.baseMinor, c)} · ready on {formatDate(c.availableAt)}
        </p>
        {c.status === "reversed" && c.reversalNote && <p className="mt-1 text-xs text-neutral-500">{c.reversalNote}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-sm font-semibold tabular-nums text-neutral-900">{money(c.amountMinor, c)}</span>
        <CommissionChip status={c.status} label={c.statusLabel} />
      </div>
    </div>
  );
}

/**
 * Every commission an affiliate has earned, filtered by where it is: on hold
 * through the refund window, ready to pay, paid, or reversed (a refund undid
 * the payment it came from). Each row keeps the rate it was earned at, so a
 * later change to the programme's rate never rewrites history.
 */
export default function CommissionsBoard() {
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const fetcher = useCallback(
    () => explained(myAffiliate.commissions({ status: tab === "all" ? undefined : tab, page })),
    [tab, page],
  );
  const { data, error, loading, reload } = useLoad<Page<Commission>>(fetcher, "Your commissions didn't load.");

  const chooseTab = (key: string) => {
    setTab(key as Tab);
    setPage(1);
  };

  const shownLabel = TABS.find((t) => t.key === tab)?.label ?? "All";

  return (
    <>
      <PageHeader
        title="Commissions"
        subtitle="What you earned on each referred organisation's first payment."
        tabs={TABS}
        activeTab={tab}
        onTab={chooseTab}
      />

      <p className="-mt-2 mb-5 text-sm text-neutral-600">
        Base is what they paid plus their discount: your rate is worked out on the price before the discount.
      </p>

      {error && <LoadError message={error} onRetry={reload} />}

      {!data ? (
        !error && <Skeleton className="h-72" />
      ) : (
        <div aria-busy={loading} className={error ? "mt-4" : undefined}>
          <DataView
            rows={data.data}
            columns={COLUMNS}
            rowKey={(c) => c.id}
            storageKey="affiliate-commissions"
            views={["table", "list"]}
            renderListItem={(c) => <ListItem c={c} />}
            searchable={false}
            caption={`Commissions: ${shownLabel}`}
            empty={
              <Empty
                icon={HandCoins}
                hue="mint"
                title={tab === "all" ? "No commission yet" : `Nothing ${shownLabel.toLowerCase()}`}
                hint={
                  tab === "all"
                    ? "You earn when an organisation you referred makes its first payment."
                    : "Commissions with this status appear here."
                }
              />
            }
          />
          <Pager
            page={data.meta.currentPage}
            lastPage={data.meta.lastPage}
            total={data.meta.total}
            onPage={setPage}
            noun={data.meta.total === 1 ? "commission" : "commissions"}
          />
        </div>
      )}
    </>
  );
}
