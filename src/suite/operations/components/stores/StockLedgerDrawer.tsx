"use client";

import { useEffect, useMemo, useState } from "react";
import { History, PackageOpen } from "lucide-react";
import { Chip, Empty, cx } from "@/components/workspace/kit";
import { AreaLine } from "@/components/workspace/charts";
import { HUE } from "@/components/workspace/modules";
import { Drawer } from "@/suite/projects/components/ui/pkit";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { opsError } from "@/lib/api/operations-procurement-client";
import { stores, type StockItem, type StockMovement } from "@/lib/api/operations-stores-client";
import { qty } from "@/suite/operations/components/procurement/meta";
import { REF_LABEL, movementMeta } from "./meta";
import { LevelGauge, signedQty } from "./ui";

/**
 * One item's stock ledger beside the list: every receipt, issue, transfer
 * and count adjustment, newest first, with the balance it left in its store
 * and a line of the item's total on hand across stores over time.
 */

/** Total on hand across stores after each movement, oldest first. Pure, for testing. */
export function totalAfterEach(rows: Pick<StockMovement, "store" | "balanceAfter" | "at">[]): { at: string | null; total: number }[] {
  const last = new Map<string, number>();
  return [...rows]
    .reverse()
    .map((m) => {
      last.set(m.store ?? "", m.balanceAfter);
      return { at: m.at, total: [...last.values()].reduce((s, v) => s + v, 0) };
    });
}

export function StockLedgerDrawer({ item, stores: storeNames, onClose }: { item: StockItem; stores: Record<string, string>; onClose: () => void }) {
  const [rows, setRows] = useState<StockMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    stores.movements({ itemId: item.id }).then(
      (r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`The ledger didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [item.id, reload]);

  const trend = useMemo(() => (rows ? totalAfterEach(rows).slice(-24) : []), [rows]);
  const totals = useMemo(() => {
    let inQ = 0;
    let outQ = 0;
    for (const m of rows ?? []) {
      if (m.kind === "transfer_in" || m.kind === "transfer_out") continue;
      if (m.quantity > 0) inQ += m.quantity;
      else outQ += -m.quantity;
    }
    return { inQ, outQ };
  }, [rows]);

  return (
    <Drawer title={item.name} subtitle={`${item.code} · stock ledger`} icon={History} hue="sky" onClose={onClose} width="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="On hand" value={`${qty(item.onHand)} ${item.unit}`} />
          <Fact label="Value" value={<Money value={item.value} />} />
          <Fact label="Received" value={rows ? `${qty(totals.inQ)}` : "…"} />
          <Fact label="Issued or written off" value={rows ? `${qty(totals.outQ)}` : "…"} />
        </div>
        <LevelGauge item={item} showLabel />
        {item.reorderLevel > 0 && (
          <p className="-mt-3 text-xs text-neutral-500">
            The tick is the reorder level, {qty(item.reorderLevel)} {item.unit}. The bar runs to twice that.
          </p>
        )}

        {Object.keys(item.byStore).length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">By store</h3>
            <ul className="flex flex-wrap gap-2">
              {Object.entries(item.byStore).map(([id, q]) => (
                <li key={id} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <span className="block text-xs text-neutral-500">{storeNames[id] ?? "A store"}</span>
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {qty(q)} <span className="font-normal text-neutral-500">{item.unit}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error ? (
          <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
        ) : !rows ? (
          <div aria-busy="true" className="space-y-3">
            <p className="sr-only">Loading the ledger…</p>
            <Skeleton className="h-40" />
            <Skeleton className="h-60" />
          </div>
        ) : rows.length === 0 ? (
          <Empty icon={PackageOpen} title="Nothing has moved yet" hint="Receive the opening stock and every movement after it shows here." hue="sky" />
        ) : (
          <>
            {trend.length > 1 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-neutral-900">On hand over time</h3>
                <AreaLine
                  data={trend.map((t, i) => ({ label: t.at ? day(t.at) : `Movement ${i + 1}`, value: t.total }))}
                  hue="sky"
                  height={140}
                  format={(v) => `${qty(v)} ${item.unit}`}
                  caption={`${item.name}: total on hand across stores after each of the last ${trend.length} movements`}
                />
              </div>
            )}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">Movements</h3>
              <ol className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
                {rows.map((m) => {
                  const meta = movementMeta(m.kind);
                  const Icon = meta.icon;
                  return (
                    <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", HUE[meta.hue].soft)}>
                        <Icon size={15} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="text-sm font-semibold text-neutral-900">
                            {meta.label}
                            <span className="font-normal text-neutral-500"> · {m.store ?? "A store"}</span>
                          </p>
                          <p className={cx("text-sm font-bold tabular-nums", m.quantity < 0 ? "text-coral-700" : "text-mint-700")}>
                            {signedQty(m.quantity)} {m.unit}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {day(m.at)}
                          {m.by ? ` · ${m.by}` : ""}
                          {m.refType ? ` · ${REF_LABEL[m.refType] ?? m.refType}` : ""}
                          {m.project ? ` · ${m.project.code ?? m.project.name}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-neutral-600">
                          Leaves {qty(m.balanceAfter)} in the store · at <Money value={m.unitCost} />
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {rows.length >= 300 && (
                <p className="mt-2">
                  <Chip hue="slate">Showing the latest 300</Chip>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
      <p className="text-[11px] font-medium text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}
