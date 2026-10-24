"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingCart, Siren, TrendingDown } from "lucide-react";
import { Button, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { Money } from "@/suite/finance/components/banking/ui";
import { opsError, type PrSummary } from "@/lib/api/operations-procurement-client";
import { stores, type ReorderSuggestion } from "@/lib/api/operations-stores-client";
import { parseQty, qty } from "@/suite/operations/components/procurement/meta";
import { DocNo, PrOriginChip } from "@/suite/operations/components/procurement/ui";

/**
 * Items whose stock plus what is on order has fallen to the reorder level,
 * critical ones first. The officer edits the quantities, leaves out what
 * they don't want, and drafts one purchase request for the lot; the request
 * then goes the usual way (approval, sourcing, order, GRN into the store).
 */
export function ReorderPanel({ costCentres, canDraft, version, onDrafted }: { costCentres: SelectOption[]; canDraft: boolean; version: number; onDrafted: () => void }) {
  const uid = useId();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ReorderSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, { on: boolean; qty: string }>>({});
  const [costCentre, setCostCentre] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [drafted, setDrafted] = useState<PrSummary | null>(null);

  useEffect(() => {
    let alive = true;
    stores.reorder().then(
      (r) => {
        if (!alive) return;
        setRows(r);
        setPicked(Object.fromEntries(r.map((s) => [s.itemId, { on: true, qty: String(s.suggested) }])));
        setError(null);
      },
      (e: unknown) => alive && setError(`Reorder suggestions didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [version]);

  const lines = useMemo(
    () =>
      (rows ?? [])
        .filter((s) => picked[s.itemId]?.on)
        .map((s) => ({ s, q: parseQty(picked[s.itemId]?.qty ?? "") })),
    [rows, picked],
  );
  const bad = lines.filter((l) => l.q === null || l.q <= 0);
  const estimate = lines.reduce((sum, l) => sum + (l.q ? Math.round(l.q * l.s.avgCost) : 0), 0);

  const draft = async () => {
    if (bad.length) {
      setActionError(`Give a quantity above 0 for ${bad.map((b) => b.s.name).join(", ")}, or leave ${bad.length === 1 ? "it" : "them"} out.`);
      return;
    }
    const ok = await confirm({
      title: `Draft a purchase request for ${lines.length} ${lines.length === 1 ? "item" : "items"}?`,
      body: "It is saved as a draft under your name, estimated at each item's average cost. Check it, then send it for approval.",
      confirmLabel: "Draft purchase request",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      const pr = await stores.draftReorder(
        lines.map((l) => ({ itemId: l.s.itemId, quantity: l.q! })),
        costCentre || null,
      );
      setDrafted(pr);
      onDrafted();
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  const critical = (rows ?? []).filter((r) => r.critical).length;

  return (
    <Panel
      title="Reorder"
      subtitle={rows ? (rows.length ? `${rows.length} ${rows.length === 1 ? "item is" : "items are"} at or below the reorder level, counting what is on order` : "Everything is above its reorder level") : "Items at or below their reorder level"}
      icon={TrendingDown}
      hue="coral"
      actions={critical > 0 ? <Chip hue="rose" icon={Siren}>{critical} critical</Chip> : undefined}
    >
      {drafted && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mint-500/25 bg-mint-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-mint-700">Purchase request drafted</p>
            <p className="text-xs text-neutral-600">
              <DocNo value={drafted.number} /> · {drafted.title} · <Money value={drafted.estimate} /> <PrOriginChip origin={drafted.origin} status={drafted.status} />
            </p>
          </div>
          <Link
            href={`/suite/operations/my/requests/${drafted.id}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Open the request <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      )}
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !rows ? (
        <div aria-busy="true" className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : rows.length === 0 ? (
        <Empty icon={ShoppingCart} title="Nothing to reorder" hint="When an item's stock and what is on order fall to its reorder level, it is suggested here." hue="mint" />
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((s) => {
              const p = picked[s.itemId] ?? { on: false, qty: "" };
              const q = parseQty(p.qty);
              return (
                <li key={s.itemId} className={cx("rounded-2xl border px-3 py-2.5 transition", p.on ? "border-neutral-200/80 bg-white" : "border-dashed border-neutral-200 bg-neutral-50/60")}>
                  <div className="flex items-center gap-3">
                    <input
                      id={`${uid}-on-${s.itemId}`}
                      type="checkbox"
                      checked={p.on}
                      disabled={!canDraft}
                      onChange={(e) => setPicked((c) => ({ ...c, [s.itemId]: { ...p, on: e.target.checked } }))}
                      className="h-5 w-5 shrink-0 cursor-pointer accent-primary-600"
                    />
                    <label htmlFor={`${uid}-on-${s.itemId}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-neutral-900">{s.name}</span>
                        {s.critical && <Chip hue="rose" className="!px-2 !py-0.5 text-[11px]">Critical</Chip>}
                      </span>
                      <span className="block text-xs tabular-nums text-neutral-500">
                        {s.code} · {qty(s.onHand)} on hand{s.onOrder > 0 ? ` + ${qty(s.onOrder)} on order` : ""} · reorder at {qty(s.reorderLevel)}
                      </span>
                    </label>
                    <div className="w-24 shrink-0">
                      <label htmlFor={`${uid}-q-${s.itemId}`} className="sr-only">
                        Quantity to buy of {s.name} ({s.unit})
                      </label>
                      <input
                        id={`${uid}-q-${s.itemId}`}
                        inputMode="decimal"
                        disabled={!p.on || !canDraft}
                        value={p.qty}
                        onChange={(e) => setPicked((c) => ({ ...c, [s.itemId]: { ...p, qty: e.target.value } }))}
                        aria-invalid={p.on && (q === null || q <= 0) ? true : undefined}
                        className={cx(inputClass, "h-9 text-right tabular-nums")}
                      />
                      <span className="mt-0.5 block text-right text-[11px] text-neutral-500">{s.unit}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {canDraft && (
            <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
              <div>
                <label htmlFor={`${uid}-cc`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Charge to
                </label>
                <SearchableSelect
                  id={`${uid}-cc`}
                  value={costCentre}
                  onChange={setCostCentre}
                  options={costCentres}
                  clearable
                  clearLabel="Your unit's cost centre"
                  placeholder="Your unit's cost centre"
                  searchPlaceholder="Search cost centres"
                  noOptionsText="No cost centres yet. Ask Finance to set them up."
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-600" aria-live="polite">
                  {lines.length} {lines.length === 1 ? "item" : "items"} · about <Money value={estimate} className="font-bold text-neutral-900" />
                </p>
                <Button variant="primary" icon={ShoppingCart} onClick={() => void draft()} disabled={busy || lines.length === 0}>
                  {busy ? "Drafting…" : "Draft purchase request"}
                </Button>
              </div>
              {actionError && <ErrorNote>{actionError}</ErrorNote>}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
