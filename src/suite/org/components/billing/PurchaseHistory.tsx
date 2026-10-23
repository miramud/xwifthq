"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Receipt, RotateCcw } from "lucide-react";
import { Button, Chip, Empty, Segmented, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import type { Hue } from "@/components/workspace/modules";
import { formatDate } from "@/lib/console-data";
import {
  ApiError,
  STATUS_LABEL,
  billing,
  amountOf,
  gatewayLabel,
  purchaseAmount,
  type Paginated,
  type Purchase,
  type PurchaseStatus,
} from "@/lib/api/billing-client";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";

export const STATUS_HUE: Record<PurchaseStatus, Hue> = {
  paid: "mint",
  pending: "sun",
  failed: "rose",
  abandoned: "slate",
  cancelled: "slate",
};

type KindFilter = "all" | "module" | "seats";

/** What a purchase bought, in a line: "HRM, Projects" or "12 seats". */
export function describePurchase(p: Purchase): string {
  if (p.kind === "seats") return p.seats === null ? "Seats" : `${p.seats} seat${p.seats === 1 ? "" : "s"}`;
  return p.modules.length > 0 ? p.modules.map((m) => m.label).join(", ") : "Modules";
}

/**
 * Every payment this organisation has made or started — modules and seats in
 * one ledger, because an admin reconciling a bank statement doesn't care which
 * screen the money was spent on. Each paid row opens a printable receipt.
 */
export function PurchaseHistory({ className }: { className?: string }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<Paginated<Purchase> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    billing
      .purchases({ kind: kind === "all" ? undefined : kind, page })
      .then((r) => {
        if (!alive) return;
        setList(r);
        setError(null);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Payment history didn't load.");
      });
    return () => {
      alive = false;
    };
  }, [kind, page, reloadKey]);

  const columns: Column<Purchase>[] = [
    {
      key: "what",
      header: "What",
      primary: true,
      value: (p) => describePurchase(p),
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">{describePurchase(p)}</p>
          <p className="truncate text-xs text-neutral-500">
            {p.kind === "seats" ? "Seats" : "Modules"} · {p.reference}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (p) => amountOf(p) ?? 0,
      render: (p) => <span className="tabular-nums font-semibold">{purchaseAmount(p)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (p) => STATUS_LABEL[p.status] ?? p.status,
      render: (p) => (
        <Chip hue={STATUS_HUE[p.status] ?? "slate"} dot>
          {STATUS_LABEL[p.status] ?? p.status}
        </Chip>
      ),
    },
    {
      key: "gateway",
      header: "Paid with",
      hideOnMobile: true,
      value: (p) => gatewayLabel(p.gateway),
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      hideOnMobile: true,
      value: (p) => p.paidAt ?? p.createdAt,
      render: (p) => formatDate(p.paidAt ?? p.createdAt),
    },
    {
      key: "receipt",
      header: "",
      align: "right",
      tableOnly: true,
      render: (p) =>
        p.status === "paid" ? (
          <Link
            href={`/suite/org/billing/receipts/${encodeURIComponent(p.id)}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline"
          >
            <Receipt size={14} aria-hidden />
            Receipt
          </Link>
        ) : null,
    },
  ];

  return (
    <section aria-labelledby="billing-history" data-tour="billing-history" className={className}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="billing-history" className="text-lg font-bold tracking-tight text-neutral-900">
            Payment history
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">Module and seat payments, newest first.</p>
        </div>
        <Segmented
          label="Show"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setPage(1);
          }}
          options={[
            { key: "all", label: "All" },
            { key: "module", label: "Modules" },
            { key: "seats", label: "Seats" },
          ]}
        />
      </div>

      {error && !list ? (
        <ErrorNote>
          <span className="flex flex-wrap items-center justify-between gap-3">
            {error}
            <Button size="sm" icon={RotateCcw} onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          </span>
        </ErrorNote>
      ) : !list ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <DataView
            rows={list.data}
            columns={columns}
            rowKey={(p) => p.id}
            storageKey="org.billing.history"
            views={["table", "list"]}
            caption="Payment history"
            searchable={false}
            empty={
              <Empty
                icon={Receipt}
                title="No payments yet."
                hint="When you pay for modules or seats, each payment and its receipt appears here."
              />
            }
          />
          {list.meta.lastPage > 1 && (
            <nav aria-label="Payment history pages" className="mt-4 flex items-center justify-between text-sm">
              <Button size="sm" icon={ArrowLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <span className={cx("tabular-nums text-neutral-500")}>
                Page {list.meta.currentPage} of {list.meta.lastPage}
              </span>
              <Button size="sm" disabled={page >= list.meta.lastPage} onClick={() => setPage((p) => p + 1)}>
                Older
                <ArrowRight size={15} aria-hidden />
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
