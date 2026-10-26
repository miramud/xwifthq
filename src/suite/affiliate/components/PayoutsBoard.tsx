"use client";

import { useCallback, useState } from "react";
import { Wallet } from "lucide-react";
import { Empty, PageHeader } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Pager, formatDate, useLoad } from "@/suite/platform/components/ui";
import { myAffiliate, type Page, type Payout } from "@/lib/api/affiliate-client";
import { formatMoney } from "@/lib/money";
import { explained } from "./ui";

const COLUMNS: Column<Payout>[] = [
  { key: "paidOn", header: "Paid on", value: (p) => p.paidOn, render: (p) => formatDate(p.paidOn) },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    primary: true,
    value: (p) => p.amountMinor,
    render: (p) => <span className="font-semibold text-neutral-900">{formatMoney(p.amountMinor, p.currency)}</span>,
  },
  { key: "method", header: "Method", value: (p) => p.methodLabel, hideOnMobile: true },
  { key: "paymentReference", header: "Payment reference", value: (p) => p.paymentReference ?? "", hideOnMobile: true },
  {
    key: "commissions",
    header: "Commissions",
    align: "right",
    value: (p) => p.commissionCount,
    hideOnMobile: true,
  },
  { key: "reference", header: "Our reference", value: (p) => p.reference },
];

/**
 * The payments XwiftHQ has made to an affiliate. Payouts are recorded by the
 * platform team by hand once commission is ready to pay; each one settles
 * the commissions it lists, which then show as paid.
 */
export default function PayoutsBoard() {
  const [page, setPage] = useState(1);
  const fetcher = useCallback(() => explained(myAffiliate.payouts(page)), [page]);
  const { data, error, loading, reload } = useLoad<Page<Payout>>(fetcher, "Your payouts didn't load.");

  return (
    <>
      <PageHeader title="Payouts" subtitle="Money we have paid you, and how many commissions each payment covered." />

      {error && <LoadError message={error} onRetry={reload} />}

      {!data ? (
        !error && <Skeleton className="h-72" />
      ) : (
        <div aria-busy={loading} className={error ? "mt-4" : undefined}>
          <DataView
            rows={data.data}
            columns={COLUMNS}
            rowKey={(p) => p.id}
            storageKey="affiliate-payouts"
            views={["table", "list"]}
            searchable={false}
            caption="Payouts to you"
            empty={
              <Empty
                icon={Wallet}
                hue="mint"
                title="No payouts yet"
                hint="Once commission is ready to pay, we pay it into your bank account and the payment appears here."
              />
            }
          />
          <Pager
            page={data.meta.currentPage}
            lastPage={data.meta.lastPage}
            total={data.meta.total}
            onPage={setPage}
            noun={data.meta.total === 1 ? "payout" : "payouts"}
          />
        </div>
      )}
    </>
  );
}
