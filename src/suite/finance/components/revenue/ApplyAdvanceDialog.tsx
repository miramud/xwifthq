"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, CheckCircle2, Eraser, HandCoins, Wand2 } from "lucide-react";
import { revenue, revenueError, revenueFieldErrors, type AdvanceAllocationInput, type ReceiptDetail } from "@/lib/api/finance-revenue-client";
import { Button, Empty, cx } from "@/components/workspace/kit";
import { ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { accounting, amount, day, parseAmount } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { allocationSummary, share, today, type AllocationRow, type OpenInvoice } from "./meta";
import { DocNo, LateChip } from "./ui";

/**
 * Put money a receipt holds as the client's advance against their open
 * invoices. Per invoice: cash against what is due now, and any retention
 * the client has released. No WHT here - an advance is cash already in.
 * The check at the foot counts what is applied against what is held, and
 * nothing goes through for more than the advance.
 */

interface RowText {
  cash: string;
  retention: string;
}

const EMPTY: RowText = { cash: "", retention: "" };

export default function ApplyAdvanceDialog({
  receipt,
  onApplied,
  onClose,
}: {
  receipt: Pick<ReceiptDetail, "id" | "receiptNo" | "clientId" | "client" | "currency" | "unallocated">;
  onApplied: (r: ReceiptDetail) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const cur = receipt.currency as CurrencyCode;
  const held = receipt.unallocated;
  const [date, setDate] = useState(today);
  const [open, setOpen] = useState<{ rows: OpenInvoice[] | null; error: string | null }>({ rows: null, error: null });
  const [texts, setTexts] = useState<Record<string, RowText>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    revenue.invoices
      .list({ client: receipt.clientId, status: "open" })
      .then(({ invoices }) => {
        if (!alive) return;
        // A multi-currency invoice offers only its tranche in the advance's currency (the API picks it by currency).
        const rows: OpenInvoice[] = invoices
          .map((i): OpenInvoice | null => {
            if ((i.tranches?.length ?? 0) > 1) {
              const t = i.tranches!.find((x) => x.currency === receipt.currency);
              return t?.open && t.open.trade + t.open.retention > 0 ? { invoice: { ...i, currency: t.currency, subtotal: t.subtotal }, open: t.open } : null;
            }
            return i.open && i.currency === receipt.currency ? { invoice: i, open: i.open } : null;
          })
          .filter((o): o is OpenInvoice => o !== null)
          .sort((x, y) => (x.invoice.dueOn ?? "").localeCompare(y.invoice.dueOn ?? ""));
        setOpen({ rows, error: null });
      })
      .catch((e: unknown) => alive && setOpen({ rows: [], error: revenueError(e, "The client's open invoices didn't load.") }));
    return () => {
      alive = false;
    };
  }, [receipt.clientId, receipt.currency]);

  const invoices = open.rows;
  const rows: AllocationRow[] = (invoices ?? []).map((o) => {
    const t = texts[o.invoice.id] ?? EMPTY;
    return { invoiceId: o.invoice.id, cash: parseAmount(t.cash) ?? 0, wht: 0, retention: parseAmount(t.retention) ?? 0 };
  });
  const balances = Object.fromEntries((invoices ?? []).map((o) => [o.invoice.id, o.open]));
  const labelOf = (id: string) => invoices?.find((o) => o.invoice.id === id)?.invoice.invoiceNo ?? "That invoice";
  const sum = allocationSummary(held, rows, balances, labelOf, cur);
  const problemFor = (id: string, field: "cash" | "retention") => errors[`row.${id}.${field}`] ?? sum.problems.find((p) => p.invoiceId === id && p.field === field)?.message;
  const left = held - sum.applied;
  const over = left < 0;

  const setRow = (id: string, p: Partial<RowText>) => setTexts((t) => ({ ...t, [id]: { ...(t[id] ?? EMPTY), ...p } }));
  const tidy = (id: string, f: keyof RowText, text: string) => {
    const v = parseAmount(text);
    if (v !== null) setRow(id, { [f]: v === 0 ? "" : accounting(v) });
  };
  /** As much of what is due now as the advance still left covers. */
  const fill = (o: OpenInvoice) => {
    const others = sum.applied - ((parseAmount(texts[o.invoice.id]?.cash ?? "") ?? 0) + (parseAmount(texts[o.invoice.id]?.retention ?? "") ?? 0));
    const room = Math.max(0, held - others);
    const cash = Math.min(o.open.trade, room);
    setRow(o.invoice.id, { cash: cash ? accounting(cash) : "", retention: "" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    for (const p of sum.problems) err[`row.${p.invoiceId}.${p.field}`] = p.message;
    for (const [id, t] of Object.entries(texts)) {
      if (t.cash.trim() && parseAmount(t.cash) === null) err[`row.${id}.cash`] = "Enter an amount, like 1,500,000.00.";
      if (t.retention.trim() && parseAmount(t.retention) === null) err[`row.${id}.retention`] = "Enter an amount, like 250,000.00.";
    }
    if (Object.keys(err).length) {
      setErrors(err);
      setGeneral("Some rows need attention. They are marked below.");
      return;
    }
    if (sum.applied <= 0) {
      setErrors({});
      setGeneral("Say how much goes to which invoice.");
      return;
    }
    if (over) {
      setErrors({});
      setGeneral(`Only ${amount(held, cur)} is held as an advance from this receipt.`);
      return;
    }
    const allocations: AdvanceAllocationInput[] = rows
      .filter((r) => r.cash + r.retention > 0)
      .map((r) => ({ invoiceId: r.invoiceId, ...(r.cash ? { cash: r.cash } : {}), ...(r.retention ? { retention: r.retention } : {}) }));
    setBusy(true);
    setErrors({});
    setGeneral(null);
    try {
      const fresh = await revenue.receipts.applyAdvance(receipt.id, { date: date || null, allocations });
      onApplied(fresh);
    } catch (x) {
      const f = revenueFieldErrors(x);
      // `allocations.1.retention` → the row of the second invoice sent.
      const placed: Record<string, string> = {};
      for (const [k, v] of Object.entries(f)) {
        const m = /^allocations\.(\d+)\.(\w+)$/.exec(k);
        const a = m ? allocations[Number(m[1])] : undefined;
        if (m && a) placed[`row.${a.invoiceId}.${m[2] === "retention" ? "retention" : "cash"}`] = v;
        else placed[k] = v;
      }
      setErrors(placed);
      setGeneral(f.allocations ?? f.receipt ?? f.date ?? (Object.keys(f).length ? "Some rows need attention. They are marked below." : revenueError(x, "The advance wasn't applied.")));
      setBusy(false);
    }
  };

  const scale = Math.max(held, sum.applied, 1);

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-title`}
      title="Apply the advance"
      subtitle={
        <>
          {amount(held, cur)} from {receipt.receiptNo ?? "this receipt"} is held for {receipt.client ?? "the client"}. Put it against their open invoices.
        </>
      }
      onClose={onClose}
      footer={
        <div className="space-y-3">
          <div>
            <div className="ws-hatch flex h-2.5 overflow-hidden rounded-full" aria-hidden>
              <span className={cx("h-full transition-[width] duration-300", over ? "bg-sun-500" : "bg-primary-500")} style={{ width: `${share(Math.min(sum.applied, held), scale)}%` }} />
              {over && <span className="h-full bg-rose-500" style={{ width: `${share(sum.applied - held, scale)}%` }} />}
            </div>
            <dl className="mt-2.5 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-neutral-500">Held</dt>
                <dd className="font-semibold tabular-nums text-neutral-900">{accounting(held)}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Applied</dt>
                <dd className="font-semibold tabular-nums text-neutral-900">{accounting(sum.applied)}</dd>
              </div>
              <div className="text-right">
                <dt className={cx("text-xs", over ? "font-semibold text-rose-700" : "text-neutral-500")}>{over ? "Over by" : "Still held"}</dt>
                <dd className={cx("font-bold tabular-nums", over ? "text-rose-700" : "text-neutral-900")}>{accounting(Math.abs(left))}</dd>
              </div>
            </dl>
            <p role="status" aria-live="polite" className={cx("mt-2 flex items-start gap-1.5 text-xs", over ? "font-semibold text-rose-700" : "text-neutral-500")}>
              {over ? <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden /> : <CheckCircle2 size={14} className="mt-px shrink-0 text-mint-600" aria-hidden />}
              {over
                ? `${amount(-left, cur)} more than the advance holds. Lower a row.`
                : sum.applied === 0
                  ? "Nothing applied yet."
                  : left > 0
                    ? `${amount(left, cur)} stays held for a later invoice.`
                    : "The whole advance is applied."}
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Keep it held</Button>
            <Button type="submit" variant="primary" icon={HandCoins} disabled={busy || over || sum.applied <= 0}>
              {busy ? "Applying…" : "Apply the advance"}
            </Button>
          </div>
        </div>
      }
    >
      {general && <ErrorNote>{general}</ErrorNote>}
      <div className="max-w-[12rem]">
        <label htmlFor={`${uid}-date`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Apply on
        </label>
        <input id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputClass, "h-10")} />
        {errors.date && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-error-700">
            {errors.date}
          </p>
        )}
      </div>

      {invoices === null ? (
        <Skeleton className="h-32" />
      ) : open.error ? (
        <ErrorNote>{open.error}</ErrorNote>
      ) : invoices.length === 0 ? (
        <Empty icon={CheckCircle2} title="Nothing open for this client" hint="The advance stays held. Apply it once an invoice is issued to them." />
      ) : (
        <ol className="-mx-6 divide-y divide-neutral-100 border-y border-neutral-100" aria-label="Open invoices">
          {invoices.map((o) => {
            const t = texts[o.invoice.id] ?? EMPTY;
            const f = (k: string) => `${uid}-${o.invoice.id}-${k}`;
            const cashErr = problemFor(o.invoice.id, "cash");
            const retErr = problemFor(o.invoice.id, "retention");
            const name = o.invoice.invoiceNo ?? "this invoice";
            return (
              <li key={o.invoice.id} className="px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <DocNo value={o.invoice.invoiceNo} />
                    <span className="ml-2 text-xs text-neutral-500">due {day(o.invoice.dueOn)}</span>
                    <span className="ml-2 inline-block align-middle">
                      <LateChip days={o.invoice.daysLate} />
                    </span>
                    <p className="mt-1 text-xs text-neutral-500">
                      To pay now <span className="font-semibold tabular-nums text-neutral-800">{amount(o.open.trade, cur)}</span>
                      {o.open.retention > 0 && (
                        <>
                          {" "}
                          · retention held <span className="font-semibold tabular-nums text-neutral-800">{amount(o.open.retention, cur)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" icon={Wand2} onClick={() => fill(o)} disabled={o.open.trade === 0} aria-label={`Fill what is due now on ${name}`}>
                      Fill
                    </Button>
                    {(t.cash || t.retention) && (
                      <Button size="sm" variant="ghost" icon={Eraser} onClick={() => setRow(o.invoice.id, EMPTY)} aria-label={`Clear ${name}`}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["cash", "Cash", cashErr, false],
                      ["retention", "Retention released (optional)", retErr, o.open.retention === 0],
                    ] as const
                  ).map(([k, label, err, off]) => (
                    <div key={k}>
                      <label htmlFor={f(k)} className="mb-1 block text-xs font-medium text-neutral-600">
                        {label}
                        <span className="sr-only">, {name}</span>
                      </label>
                      <input
                        id={f(k)}
                        inputMode="decimal"
                        autoComplete="off"
                        value={t[k]}
                        disabled={off}
                        onChange={(e) => setRow(o.invoice.id, { [k]: e.target.value })}
                        onBlur={(e) => tidy(o.invoice.id, k, e.target.value)}
                        placeholder={off ? "None held" : "0.00"}
                        aria-invalid={Boolean(err) || undefined}
                        aria-describedby={err ? `${f(k)}-err` : undefined}
                        className={cx(inputClass, "h-10 text-right tabular-nums", err && "border-error-500")}
                      />
                      {err && (
                        <p id={`${f(k)}-err`} role="alert" className="mt-1 text-xs font-medium text-error-700">
                          {err}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </DialogFrame>
  );
}
