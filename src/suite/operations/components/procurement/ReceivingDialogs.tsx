"use client";

import { useId, useMemo, useState } from "react";
import { Boxes, Star, Tag } from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { dutiesRefusal, opsError, opsFieldErrors, procurement, type Grn, type PoLine, type ReceivableOrder, type Scc, type VendorInvoice } from "@/lib/api/operations-procurement-client";
import { lineTotal, parseQty, qty, receiptProblem, serialProblem, splitSerials, today } from "./meta";
import { InvoiceMatch } from "./InvoiceMatch";

/* Recording what arrived (GRN), confirming a service (SCC), and the vendor's invoice. */

/** What is still to come on a line: the API's figure, or ordered less received. */
const outstanding = (l: PoLine) => l.outstanding ?? Math.max(0, l.quantity - l.received);

/** What can be invoiced on a line now: the API's received-less-invoiced, or what was received. */
const invoiceable = (l: PoLine) => l.toInvoice ?? l.received;

/** API errors on `lines.N.*` put back on the line that was sent N-th. */
function placeErrors(err: unknown, sent: string[]): Record<string, string> {
  const duties = dutiesRefusal(err);
  if (duties) return { general: duties };
  const f = opsFieldErrors(err);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    const m = /^lines\.(\d+)\./.exec(k);
    if (m && sent[Number(m[1])]) out[sent[Number(m[1])]] = v;
    else if (["receivedOn", "invoiceNo", "invoiceDate", "rating", "storeId"].includes(k)) out[k] = v;
    else out.general = out.general ?? v;
  }
  return Object.keys(out).length ? out : { general: opsError(err) };
}

/* ------------------------------------------------------------------ */
/*  GRN                                                                */
/* ------------------------------------------------------------------ */

interface GrnEntry {
  received: string;
  accepted: string;
  rejected: string;
  serials: string;
  notes: string;
}

/** Each goods line's problem (or null), from what was typed. */
export function grnLineProblem(line: PoLine, e: GrnEntry): string | null {
  if (!e.received.trim() && !e.accepted.trim() && !e.rejected.trim()) return null;
  const received = parseQty(e.received);
  const accepted = parseQty(e.accepted || "0");
  const rejected = parseQty(e.rejected || "0");
  if (received === null || accepted === null || rejected === null) return "Quantities are numbers, like 4 or 2.5.";
  return receiptProblem(received, accepted, rejected, outstanding(line)) ?? serialProblem(accepted, splitSerials(e.serials));
}

export function GrnDialog({
  po,
  stores = [],
  onDone,
  onClose,
}: {
  po: ReceivableOrder;
  /** Open stores (the receiving desk's `stores`), for lines received as stock. */
  stores?: { id: string; name: string; location: string | null }[];
  onDone: (grn: Grn) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const goods = po.lines.filter((l) => l.kind === "goods");
  const stocked = goods.some((l) => l.itemId);
  const [storeId, setStoreId] = useState(stores.length === 1 ? stores[0].id : "");
  const [receivedOn, setReceivedOn] = useState(today());
  const [deliveryNote, setDeliveryNote] = useState("");
  const [location, setLocation] = useState(po.deliveryAddress ?? "");
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<Record<string, GrnEntry>>(() =>
    Object.fromEntries(goods.map((l) => [l.id, { received: outstanding(l) ? String(outstanding(l)) : "", accepted: outstanding(l) ? String(outstanding(l)) : "", rejected: "", serials: "", notes: "" }])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (id: string, k: keyof GrnEntry, v: string) => setEntries((cur) => ({ ...cur, [id]: { ...cur[id], [k]: v } }));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Record<string, string> = {};
    if (!receivedOn) local.receivedOn = "Say when it arrived.";
    else if (receivedOn > today()) local.receivedOn = "Goods can't be received in the future.";
    const filled = goods.filter((l) => entries[l.id].received.trim() !== "" && parseQty(entries[l.id].received) !== 0);
    for (const l of goods) {
      const p = grnLineProblem(l, entries[l.id]);
      if (p) local[l.id] = p;
    }
    if (filled.length === 0) local.general = "Record what arrived on at least one line.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    const sent = filled.map((l) => l.id);
    try {
      const grn = await procurement.receiving.grn(po.id, {
        receivedOn,
        location: location.trim() || null,
        ...(stocked && storeId ? { storeId } : {}),
        deliveryNote: deliveryNote.trim() || null,
        notes: notes.trim() || null,
        lines: filled.map((l) => {
          const e = entries[l.id];
          const serials = splitSerials(e.serials);
          return {
            poLineId: l.id,
            received: parseQty(e.received) ?? 0,
            accepted: parseQty(e.accepted || "0") ?? 0,
            rejected: parseQty(e.rejected || "0") ?? 0,
            ...(serials.length ? { serials } : {}),
            notes: e.notes.trim() || null,
          };
        }),
      });
      onDone(grn);
    } catch (err) {
      setErrors(placeErrors(err, sent));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      size="lg"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Record goods received"
      subtitle={`Against ${po.number ?? "the order"} from ${po.vendor ?? "the vendor"}. Count what arrived, accept what is right, and reject the rest. The GRN then waits for somebody else to approve it.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Keep as it is</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Recording…" : "Record the GRN"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-on`} label="Arrived on">
          <input id={`${uid}-on`} type="date" max={today()} className={inputClass} value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} aria-invalid={errors.receivedOn ? true : undefined} />
          <FieldError message={errors.receivedOn} />
        </Field>
        <Field id={`${uid}-dn`} label="Delivery note no." hint="Optional">
          <input id={`${uid}-dn`} className={cx(inputClass, "font-mono")} value={deliveryNote} maxLength={120} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="DN-55120" />
        </Field>
        <Field id={`${uid}-loc`} label="Received at" hint="Optional" className="sm:col-span-2">
          <input id={`${uid}-loc`} className={inputClass} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} placeholder="ICT Centre store" />
        </Field>
        {stocked && (
          <Field id={`${uid}-store`} label="Into store" hint={stores.length ? "For the stock lines" : undefined} className="sm:col-span-2">
            <SearchableSelect
              id={`${uid}-store`}
              value={storeId}
              onChange={setStoreId}
              options={stores.map((st) => ({ value: st.id, label: st.name, hint: st.location ?? undefined }))}
              clearable
              clearLabel="The first store"
              placeholder="The first store"
              searchPlaceholder="Search stores"
              noOptionsText="No store is open. Add one under Stores, or stock goes nowhere."
              aria-invalid={errors.storeId ? true : undefined}
            />
            <p className="mt-1.5 text-xs text-neutral-500">Lines marked as stock are added to this store&apos;s stock when the GRN is approved.</p>
            <FieldError message={errors.storeId} />
          </Field>
        )}
      </div>

      {goods.length === 0 ? (
        <p className="text-sm text-neutral-500">This order has no goods lines. Services are confirmed with a certificate instead.</p>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-neutral-900">Line by line</legend>
          <ul className="space-y-3">
            {goods.map((l) => {
              const e = entries[l.id];
              const accepted = parseQty(e.accepted || "0") ?? 0;
              const serials = splitSerials(e.serials);
              const err = errors[l.id];
              return (
                <li key={l.id} className={cx("rounded-2xl border p-3", err ? "border-error-500/40" : "border-neutral-200")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">
                      Line {l.lineNo}: {l.description}
                    </p>
                    {l.assetCategoryId ? (
                      <Chip hue="grape" icon={Tag} className="!px-2 !py-0.5 text-[11px]">
                        To the asset register
                      </Chip>
                    ) : l.itemId ? (
                      <Chip hue="mint" icon={Boxes} className="!px-2 !py-0.5 text-[11px]">
                        Into stock
                      </Chip>
                    ) : null}
                  </div>
                  <p className="text-xs text-neutral-500 tabular-nums">
                    Ordered {qty(l.quantity)} {l.unit} · received {qty(l.received)} · {qty(outstanding(l))} to come
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["received", "accepted", "rejected"] as const).map((k) => (
                      <div key={k}>
                        <label htmlFor={`${uid}-${k}-${l.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
                          {k === "received" ? "Arrived" : k === "accepted" ? "Accepted" : "Rejected"}
                          <span className="sr-only">, line {l.lineNo}</span>
                        </label>
                        <input
                          id={`${uid}-${k}-${l.id}`}
                          inputMode="decimal"
                          className={cx(inputClass, "text-right tabular-nums")}
                          value={e[k]}
                          onChange={(ev) => set(l.id, k, ev.target.value)}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <label htmlFor={`${uid}-sn-${l.id}`} className="mb-1 flex items-baseline justify-between text-xs font-medium text-neutral-600">
                      <span>
                        Serial numbers<span className="sr-only">, line {l.lineNo}</span>
                      </span>
                      <span className={cx("tabular-nums", serials.length && serials.length !== Math.round(accepted) ? "text-rose-700" : "text-neutral-500")}>
                        {serials.length} of {qty(Math.round(accepted))} · {l.assetCategoryId ? "one per item accepted" : "optional, one per item accepted"}
                      </span>
                    </label>
                    <textarea
                      id={`${uid}-sn-${l.id}`}
                      rows={Math.min(5, Math.max(2, Math.round(accepted)))}
                      className={cx(textareaClass, "font-mono text-[13px]")}
                      value={e.serials}
                      onChange={(ev) => set(l.id, "serials", ev.target.value)}
                      placeholder="One per line"
                    />
                  </div>
                  {l.assetCategoryId && (
                    <p className="mt-1.5 text-xs text-grape-700">Each item accepted becomes an asset on the register. Give one serial per item so each can be told apart.</p>
                  )}
                  <FieldError message={err} />
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      <Field id={`${uid}-notes`} label="Notes" hint="Optional">
        <textarea id={`${uid}-notes`} rows={2} className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Damage, shortages, what the driver said" />
      </Field>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  SCC                                                                */
/* ------------------------------------------------------------------ */

const RATING_WORDS = ["", "Poor", "Below what was agreed", "As agreed", "Good", "Excellent"];

export function SccDialog({ po, onDone, onClose }: { po: ReceivableOrder; onDone: (scc: Scc) => void; onClose: () => void }) {
  const uid = useId();
  const services = po.lines.filter((l) => l.kind === "service");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState(today());
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");
  const [confirmed, setConfirmed] = useState<Record<string, string>>(() => Object.fromEntries(services.map((l) => [l.id, outstanding(l) ? String(outstanding(l)) : ""])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Record<string, string> = {};
    const filled = services.filter((l) => confirmed[l.id].trim() !== "" && parseQty(confirmed[l.id]) !== 0);
    for (const l of services) {
      const t = confirmed[l.id].trim();
      if (!t) continue;
      const n = parseQty(t);
      if (n === null) local[l.id] = "Confirm a number, like 1 or 0.5.";
      else if (n > outstanding(l)) local[l.id] = `Only ${qty(outstanding(l))} is left to confirm on this line.`;
    }
    if (filled.length === 0) local.general = "Confirm at least one service line.";
    if (rating < 1) local.rating = "Rate the service from 1 to 5.";
    if (periodFrom && periodTo && periodFrom > periodTo) local.period = "The period ends before it starts.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    const sent = filled.map((l) => l.id);
    try {
      const scc = await procurement.receiving.scc(po.id, {
        periodFrom: periodFrom || null,
        periodTo: periodTo || null,
        rating,
        comments: comments.trim() || null,
        lines: filled.map((l) => ({ poLineId: l.id, confirmed: parseQty(confirmed[l.id]) ?? 0 })),
      });
      onDone(scc);
    } catch (err) {
      setErrors(placeErrors(err, sent));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      size="lg"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Confirm a service"
      subtitle={`A service completion certificate for ${po.number ?? "the order"} from ${po.vendor ?? "the vendor"}. It waits for somebody else to approve it.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Keep as it is</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Raising…" : "Raise the certificate"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-from`} label="Service from" hint="Optional">
          <input id={`${uid}-from`} type="date" className={inputClass} value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
        </Field>
        <Field id={`${uid}-to`} label="Service to">
          <input id={`${uid}-to`} type="date" className={inputClass} value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
        </Field>
      </div>
      <FieldError message={errors.period} />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-neutral-900">What was done</legend>
        <ul className="space-y-3">
          {services.map((l) => (
            <li key={l.id} className={cx("rounded-2xl border p-3", errors[l.id] ? "border-error-500/40" : "border-neutral-200")}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">
                    Line {l.lineNo}: {l.description}
                  </p>
                  <p className="text-xs text-neutral-500 tabular-nums">
                    Ordered {qty(l.quantity)} {l.unit} · confirmed {qty(l.received)} · {qty(outstanding(l))} left
                  </p>
                </div>
                <div className="w-28">
                  <label htmlFor={`${uid}-c-${l.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
                    Confirmed<span className="sr-only">, line {l.lineNo}</span>
                  </label>
                  <input
                    id={`${uid}-c-${l.id}`}
                    inputMode="decimal"
                    className={cx(inputClass, "text-right tabular-nums")}
                    value={confirmed[l.id]}
                    onChange={(e) => setConfirmed((c) => ({ ...c, [l.id]: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <FieldError message={errors[l.id]} />
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-neutral-900">How well was it done?</legend>
        <div role="radiogroup" aria-label="Rating" className="flex flex-wrap items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} of 5: ${RATING_WORDS[n]}`}
              onClick={() => setRating(n)}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl outline-none hover:bg-sun-50 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <Star size={24} aria-hidden className={n <= rating ? "fill-sun-500 text-sun-500" : "text-neutral-300"} />
            </button>
          ))}
          <span className="ml-2 text-sm font-medium text-neutral-700">{rating ? RATING_WORDS[rating] : "Not rated yet"}</span>
        </div>
        <FieldError message={errors.rating} />
      </fieldset>

      <Field id={`${uid}-cm`} label="Comments" hint="Optional">
        <textarea id={`${uid}-cm`} rows={3} className={textareaClass} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="What was done, anything left over, what to watch next time" />
      </Field>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Vendor invoice                                                     */
/* ------------------------------------------------------------------ */

export function InvoiceDialog({
  po,
  memoHref,
  onDone,
  onClose,
}: {
  po: ReceivableOrder;
  memoHref?: (memoId: string) => string | null;
  onDone: (invoice: VendorInvoice) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [lines, setLines] = useState<Record<string, { quantity: string; price: string }>>(() =>
    Object.fromEntries(po.lines.map((l) => [l.id, { quantity: invoiceable(l) > 0 ? String(invoiceable(l)) : "", price: amountInput(l.unitPrice) }])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VendorInvoice | null>(null);

  const rows = useMemo(
    () =>
      po.lines.map((l) => {
        const q = parseQty(lines[l.id].quantity);
        const p = parseAmount(lines[l.id].price);
        const amount = q && p !== null ? lineTotal(q, p) : 0;
        return { line: l, q, p, amount, vat: Math.floor((amount * l.vatRateBp) / 10_000) };
      }),
    [po.lines, lines],
  );
  const total = rows.reduce((s, r) => s + r.amount + r.vat, 0);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Record<string, string> = {};
    if (!invoiceNo.trim()) local.invoiceNo = "Enter the vendor's invoice number.";
    if (!invoiceDate) local.invoiceDate = "Enter the date on the invoice.";
    const filled = rows.filter((r) => lines[r.line.id].quantity.trim() !== "");
    for (const r of filled) {
      if (r.q === null || r.q <= 0) local[r.line.id] = "The quantity invoiced is a number above 0.";
      else if (r.p === null) local[r.line.id] = "Type the invoice's unit price, like 915,000.00.";
    }
    if (filled.length === 0) local.general = "Enter what the invoice charges on at least one line.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    const sent = filled.map((r) => r.line.id);
    try {
      const inv = await procurement.receiving.invoice(po.id, {
        invoiceNo: invoiceNo.trim(),
        invoiceDate,
        lines: filled.map((r) => ({ poLineId: r.line.id, quantity: r.q!, unitPrice: r.p! })),
      });
      setResult(inv);
    } catch (err) {
      setErrors(placeErrors(err, sent));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <DialogFrame
        titleId={`${uid}-t`}
        size="lg"
        title={result.status === "matched" ? "Invoice matched" : "Invoice recorded as an exception"}
        subtitle={result.status === "matched" ? "It agrees with the order and with what was received, so the payment memo has gone to the FCU." : "It doesn't agree with the order or with what was received. Nothing is paid until it is resolved."}
        onClose={() => onDone(result)}
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => onDone(result)}>
              Done
            </Button>
          </div>
        }
      >
        <InvoiceMatch invoice={result} currency={po.currency} memoHref={memoHref} />
      </DialogFrame>
    );
  }

  return (
    <DialogFrame
      as="form"
      size="lg"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Record the vendor's invoice"
      subtitle={`Against ${po.number ?? "the order"} from ${po.vendor ?? "the vendor"}. Type what the invoice says; it is matched against the order and what was received.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-600" aria-live="polite">
            Invoice total <Money value={total} currency={po.currency} className="font-bold text-neutral-900" />
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button onClick={onClose}>Keep as it is</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Matching…" : "Record and match"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-no`} label="Invoice number">
          <input id={`${uid}-no`} className={cx(inputClass, "font-mono")} value={invoiceNo} maxLength={120} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="KB-INV-90433" aria-invalid={errors.invoiceNo ? true : undefined} />
          <FieldError message={errors.invoiceNo} />
        </Field>
        <Field id={`${uid}-dt`} label="Invoice date">
          <input id={`${uid}-dt`} type="date" className={inputClass} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          <FieldError message={errors.invoiceDate} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-neutral-900">What the invoice charges</legend>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.line.id} className={cx("rounded-2xl border p-3", errors[r.line.id] ? "border-error-500/40" : "border-neutral-200")}>
              <p className="text-sm font-medium text-neutral-900">
                Line {r.line.lineNo}: {r.line.description}
              </p>
              <p className="text-xs text-neutral-500 tabular-nums">
                Ordered {qty(r.line.quantity)} at <Money value={r.line.unitPrice} currency={po.currency} /> · received {qty(r.line.received)}
                {r.line.invoiced != null && <> · invoiced {qty(r.line.invoiced)} · {qty(invoiceable(r.line))} to invoice</>}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div>
                  <label htmlFor={`${uid}-q-${r.line.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
                    Quantity<span className="sr-only">, line {r.line.lineNo}</span>
                  </label>
                  <input
                    id={`${uid}-q-${r.line.id}`}
                    inputMode="decimal"
                    className={cx(inputClass, "text-right tabular-nums")}
                    value={lines[r.line.id].quantity}
                    onChange={(e) => setLines((c) => ({ ...c, [r.line.id]: { ...c[r.line.id], quantity: e.target.value } }))}
                    placeholder="Not invoiced"
                  />
                </div>
                <div>
                  <label htmlFor={`${uid}-p-${r.line.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
                    Unit price (₦)<span className="sr-only">, line {r.line.lineNo}</span>
                  </label>
                  <input
                    id={`${uid}-p-${r.line.id}`}
                    inputMode="decimal"
                    className={cx(inputClass, "text-right tabular-nums")}
                    value={lines[r.line.id].price}
                    onChange={(e) => setLines((c) => ({ ...c, [r.line.id]: { ...c[r.line.id], price: e.target.value } }))}
                  />
                </div>
                <p className="col-span-2 text-right text-sm sm:col-span-1 sm:pb-3">
                  <Money value={r.amount} currency={po.currency} className="font-semibold text-neutral-900" />
                  <span className="block text-[11px] text-neutral-500">
                    + VAT <Money value={r.vat} currency={po.currency} />
                  </span>
                </p>
              </div>
              <FieldError message={errors[r.line.id]} />
            </li>
          ))}
        </ul>
      </fieldset>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}
