"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CircleCheckBig, ClipboardCheck, Save, Scale, Send, ShieldCheck, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Chip, Empty, PageHeader, Panel, Segmented, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { dutiesRefusal, opsError } from "@/lib/api/operations-procurement-client";
import { stores, type CountLine, type StockCount } from "@/lib/api/operations-stores-client";
import { parseQty, qty } from "@/suite/operations/components/procurement/meta";
import { countSummary, impliedUnitCost, lineVariance } from "./meta";
import { CountStatusChip, signedQty } from "./ui";

/**
 * A count sheet: the system's figure beside what is counted, the difference
 * in quantity and value worked out as it is typed. Save as you go; submit
 * when every line is counted. Somebody other than the counter then approves
 * (the stock is adjusted to the count) or rejects it with a note.
 */

type Filter = "all" | "todo" | "diff";

export default function CountSheet({ id }: { id: string }) {
  const uid = useId();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [count, setCount] = useState<StockCount | null>(null);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<"save" | "submit" | "approve" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([stores.counts.get(id), stores.desk().catch(() => null)]).then(
      ([c, d]) => {
        if (!alive) return;
        setCount(c);
        setTyped(Object.fromEntries(c.lines.map((l) => [l.id, l.countedQty === null ? "" : String(l.countedQty)])));
        if (d) setCosts(Object.fromEntries(d.items.map((i) => [i.id, i.avgCost])));
        setDirty(false);
        setError(null);
      },
      (e: unknown) => alive && setError(`The count didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const can = { record: mayDoOps(user, "stores", "record_count"), approve: mayDoOps(user, "stores", "approve_count") };
  const editable = count?.status === "counting" && can.record;

  const counted = useMemo<Record<string, number | null>>(() => Object.fromEntries((count?.lines ?? []).map((l) => [l.id, typed[l.id]?.trim() ? parseQty(typed[l.id]) : null])), [count, typed]);
  const bad = (count?.lines ?? []).filter((l) => typed[l.id]?.trim() && counted[l.id] === null);
  const unitCost = useMemo(() => {
    const byLine = new Map((count?.lines ?? []).map((l) => [l.id, costs[l.itemId] ?? impliedUnitCost(l)]));
    return (lineId: string) => byLine.get(lineId) ?? 0;
  }, [count, costs]);
  const summary = useMemo(() => countSummary(count?.lines ?? [], counted, unitCost), [count, counted, unitCost]);

  const record = async (submit: boolean) => {
    if (!count) return;
    if (bad.length) {
      setActionError(`Counts are numbers, like 12 or 2.5. Check ${bad.map((b) => b.name).join(", ")}.`);
      return;
    }
    if (submit) {
      if (summary.counted < summary.total) {
        setActionError(`Count every line before submitting: ${summary.total - summary.counted} still blank.`);
        return;
      }
      const ok = await confirm({
        title: "Submit the count for approval?",
        body: "The sheet is locked. Somebody other than you approves it, and only then is the stock adjusted by each difference.",
        confirmLabel: "Submit the count",
        tone: "primary",
      });
      if (!ok) return;
    }
    setBusy(submit ? "submit" : "save");
    setActionError(null);
    try {
      const c = await stores.counts.record(count.id, counted, submit);
      setCount(c);
      setDirty(false);
      setNotice(submit ? "Count submitted. It now waits for somebody else to approve it." : "Count saved. Carry on when you are ready.");
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  const decide = async (approve: boolean) => {
    if (!count) return;
    if (!approve && !note.trim()) {
      setActionError("Say why it is rejected, so the counter knows what to recount.");
      return;
    }
    const ok = await confirm(
      approve
        ? {
            title: "Approve the count?",
            body: `The stock in ${count.store ?? "the store"} is adjusted by each difference: ${summary.short} short, ${summary.over} over, ${compact(summary.net)} net. This can't be undone; a later count corrects it.`,
            confirmLabel: "Approve and adjust stock",
            tone: "primary",
          }
        : { title: "Reject the count?", body: "Nothing is adjusted. The counter sees your note and starts a new count.", confirmLabel: "Reject the count", tone: "danger" },
    );
    if (!ok) return;
    setBusy(approve ? "approve" : "reject");
    setActionError(null);
    try {
      const c = await stores.counts.decide(count.id, approve, note.trim() || null);
      setCount(c);
      setNotice(approve ? "Count approved. The stock now matches what was counted." : "Count rejected. Nothing was adjusted.");
    } catch (e) {
      setActionError(dutiesRefusal(e) ?? opsError(e));
    } finally {
      setBusy(null);
    }
  };

  if (error && !count)
    return (
      <div>
        <BackLink href="/suite/operations/stores/counts" label="Stock counts" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!count)
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the count…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-5 xl:grid-cols-3">
          <Skeleton className="h-[480px] xl:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );

  const ownCount = count.countedById != null && count.countedById === user?.id;
  const lines = count.lines.filter((l) => {
    if (filter === "todo") return counted[l.id] === null;
    if (filter === "diff") {
      const v = lineVariance(l.systemQty, counted[l.id] ?? null, 0);
      return v !== null && v.qty !== 0;
    }
    return true;
  });
  const biggest = count.lines
    .map((l) => ({ l, v: lineVariance(l.systemQty, counted[l.id] ?? null, unitCost(l.id)) }))
    .filter((x): x is { l: CountLine; v: { qty: number; value: number } } => x.v !== null && x.v.qty !== 0)
    .sort((a, b) => Math.abs(b.v.value) - Math.abs(a.v.value))
    .slice(0, 6);
  const maxAbs = Math.max(1, ...biggest.map((b) => Math.abs(b.v.value)));
  const pct = summary.total ? (summary.counted / summary.total) * 100 : 0;

  return (
    <div>
      <BackLink href="/suite/operations/stores/counts" label="Stock counts" />
      <PageHeader
        eyebrow={count.kind === "cycle" ? "Cycle count" : "Full count"}
        title={count.store ?? "Stock count"}
        subtitle={`Started ${day(count.createdAt)}${count.countedBy ? ` by ${count.countedBy}` : ""}. ${count.lines.length} ${count.lines.length === 1 ? "line" : "lines"}.`}
        actions={<CountStatusChip status={count.status} />}
      />
      <Notice text={notice} />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Panel
            title="Count sheet"
            subtitle={editable ? "Type what is on the shelf. The difference is worked out as you go." : "System figure against what was counted"}
            icon={ClipboardCheck}
            hue="sky"
            actions={
              <Segmented
                label="Show lines"
                value={filter}
                onChange={setFilter}
                options={[
                  { key: "all", label: "All" },
                  { key: "todo", label: "Not counted" },
                  { key: "diff", label: "Different" },
                ]}
              />
            }
            bodyClassName="p-0"
          >
            {lines.length === 0 ? (
              <Empty icon={CircleCheckBig} title={filter === "todo" ? "Every line is counted" : filter === "diff" ? "No differences" : "No lines"} hint={filter === "diff" ? "What was counted matches the books." : undefined} hue="mint" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <caption className="sr-only">Count sheet for {count.store}</caption>
                  <thead>
                    <tr className="border-y border-neutral-100 bg-neutral-50/60 text-left text-xs font-semibold text-neutral-500">
                      <th scope="col" className="px-5 py-2.5">
                        Item
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right">
                        On the books
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right">
                        Counted
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right">
                        Difference
                      </th>
                      <th scope="col" className="px-5 py-2.5 text-right">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {lines.map((l) => {
                      const v = lineVariance(l.systemQty, counted[l.id] ?? null, unitCost(l.id));
                      const invalid = Boolean(typed[l.id]?.trim()) && counted[l.id] === null;
                      return (
                        <tr key={l.id} className={cx(v && v.qty !== 0 && (v.qty < 0 ? "bg-coral-50/40" : "bg-mint-50/40"))}>
                          <th scope="row" className="px-5 py-2.5 text-left font-normal">
                            <span className="block font-semibold text-neutral-900">{l.name}</span>
                            <span className="block font-mono text-[12px] text-neutral-500">{l.code}</span>
                          </th>
                          <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">
                            {qty(l.systemQty)} <span className="text-neutral-500">{l.unit}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {editable ? (
                              <>
                                <label htmlFor={`${uid}-c-${l.id}`} className="sr-only">
                                  Counted, {l.name} ({l.unit})
                                </label>
                                <input
                                  id={`${uid}-c-${l.id}`}
                                  inputMode="decimal"
                                  value={typed[l.id] ?? ""}
                                  onChange={(e) => {
                                    setTyped((t) => ({ ...t, [l.id]: e.target.value }));
                                    setDirty(true);
                                  }}
                                  aria-invalid={invalid || undefined}
                                  placeholder="-"
                                  className={cx(inputClass, "ml-auto h-9 w-24 text-right tabular-nums")}
                                />
                              </>
                            ) : (
                              <span className="tabular-nums font-semibold text-neutral-900">{l.countedQty === null ? "-" : qty(l.countedQty)}</span>
                            )}
                          </td>
                          <td className={cx("px-3 py-2.5 text-right font-semibold tabular-nums", !v ? "text-neutral-400" : v.qty < 0 ? "text-coral-700" : v.qty > 0 ? "text-mint-700" : "text-neutral-500")}>
                            {v ? signedQty(v.qty) : "-"}
                          </td>
                          <td className="px-5 py-2.5 text-right">{v ? <Money value={v.value} signed className={cx("tabular-nums", v.value > 0 && "text-mint-700")} /> : <span className="text-neutral-400">-</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {editable && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
                <p className="text-xs text-neutral-500" aria-live="polite">
                  {dirty ? "Unsaved changes" : "All saved"} · {summary.counted} of {summary.total} counted
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button icon={Save} onClick={() => void record(false)} disabled={busy !== null || !dirty}>
                    {busy === "save" ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="primary" icon={Send} onClick={() => void record(true)} disabled={busy !== null}>
                    {busy === "submit" ? "Submitting…" : "Submit for approval"}
                  </Button>
                </div>
              </div>
            )}
            {actionError && editable && <ErrorNote className="mx-5 mb-4">{actionError}</ErrorNote>}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Variance">
          <Panel title="Variance" subtitle="At each item's average cost" icon={Scale} hue={summary.net < 0 ? "coral" : "mint"}>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Net difference</p>
            <p className={cx("mt-1 text-[28px] font-bold leading-tight tracking-tight tabular-nums", summary.net < 0 ? "text-coral-700" : summary.net > 0 ? "text-mint-700" : "text-neutral-900")} aria-live="polite">
              <Money value={summary.net} signed className="!text-inherit" />
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-coral-50 px-2 py-2">
                <p className="text-lg font-bold tabular-nums text-coral-700">{summary.short}</p>
                <p className="text-coral-700">short</p>
              </div>
              <div className="rounded-xl bg-mint-50 px-2 py-2">
                <p className="text-lg font-bold tabular-nums text-mint-700">{summary.over}</p>
                <p className="text-mint-700">over</p>
              </div>
              <div className="rounded-xl bg-neutral-100 px-2 py-2">
                <p className="text-lg font-bold tabular-nums text-neutral-800">{summary.counted - summary.short - summary.over}</p>
                <p className="text-neutral-600">match</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-neutral-600">
                <span>Counted</span>
                <span className="tabular-nums">
                  {summary.counted} of {summary.total}
                </span>
              </div>
              <div className="ws-hatch h-2.5 overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Lines counted">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Gross difference <Money value={summary.gross} className="font-semibold text-neutral-700" />, shortages and overs together.
            </p>
            {biggest.length > 0 && (
              <figure className="mt-4">
                <figcaption className="mb-2 text-sm font-semibold text-neutral-900">Biggest differences</figcaption>
                <ul className="space-y-2">
                  {biggest.map(({ l, v }) => (
                    <li key={l.id} className="text-xs">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate text-neutral-700">{l.name}</span>
                        <span className={cx("shrink-0 font-semibold tabular-nums", v.value < 0 ? "text-coral-700" : "text-mint-700")}>
                          {signedQty(v.qty)} · {compact(v.value)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-px" aria-hidden>
                        <div className="flex justify-end">{v.value < 0 && <span className="h-2 rounded-l-full bg-coral-500" style={{ width: `${(Math.abs(v.value) / maxAbs) * 100}%` }} />}</div>
                        <div className="border-l border-neutral-300">{v.value > 0 && <span className="block h-2 rounded-r-full bg-mint-500" style={{ width: `${(v.value / maxAbs) * 100}%` }} />}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </figure>
            )}
          </Panel>

          {count.status === "submitted" && (
            <Panel title="Approve the count" icon={ShieldCheck} hue="sun">
              {!can.approve ? (
                <p className="text-sm text-neutral-600">A store supervisor approves it. You can see the sheet but not decide it.</p>
              ) : ownCount ? (
                <p className="text-sm text-neutral-600">You counted this, so somebody else approves it. That is the point of a count.</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor={`${uid}-note`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                      Note <span className="font-normal text-neutral-500">· needed to reject</span>
                    </label>
                    <textarea id={`${uid}-note`} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} placeholder="What you checked, or what to recount" />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="primary" icon={CircleCheckBig} onClick={() => void decide(true)} disabled={busy !== null} className="flex-1">
                      {busy === "approve" ? "Approving…" : "Approve and adjust"}
                    </Button>
                    <Button variant="danger" icon={XCircle} onClick={() => void decide(false)} disabled={busy !== null}>
                      {busy === "reject" ? "Rejecting…" : "Reject"}
                    </Button>
                  </div>
                </div>
              )}
              {actionError && !editable && <ErrorNote className="mt-3">{actionError}</ErrorNote>}
            </Panel>
          )}

          {(count.status === "approved" || count.status === "rejected") && (
            <Panel title={count.status === "approved" ? "Approved" : "Rejected"} icon={count.status === "approved" ? CircleCheckBig : XCircle} hue={count.status === "approved" ? "mint" : "rose"}>
              <p className="text-sm text-neutral-700">
                {count.approvedBy ?? "Someone"} on {day(count.approvedAt)}.{" "}
                {count.status === "approved" ? "The stock was adjusted to the count." : "Nothing was adjusted."}
              </p>
              {count.note && <p className="mt-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{count.note}</p>}
              {count.status === "approved" && (
                <p className="mt-2">
                  <Chip hue="mint">Adjusted by {compact(summary.net)}</Chip>
                </p>
              )}
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
