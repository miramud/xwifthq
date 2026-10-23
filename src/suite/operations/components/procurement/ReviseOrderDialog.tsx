"use client";

import { useId, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { opsError, opsFieldErrors, procurement, type PoFull, type PoReviseInput } from "@/lib/api/operations-procurement-client";
import { parseQty, qty } from "./meta";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Revise an approved order: quantities and unit prices per line, delivery
 * and terms, and why. The new total shows against the current one as it is
 * typed. A revision that costs no more applies at once; a dearer one goes
 * for approval when approvals are on, and the order keeps its figures until
 * then.
 */

type Row = { quantity: string; price: string };

/** What a line comes to at a quantity and unit price, VAT included, as the API works it. */
export function lineTotal(quantity: number, unitPrice: number, vatRateBp: number): number {
  const amount = Math.round(quantity * unitPrice);
  return amount + Math.round((amount * vatRateBp) / 10_000);
}

export default function ReviseOrderDialog({ po, onClose, onRevised }: { po: PoFull; onClose: () => void; onRevised: (po: PoFull, applied: boolean) => void }) {
  const uid = useId();
  const cur = po.currency;
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(po.lines.map((l) => [l.id, { quantity: String(l.quantity), price: amountInput(l.unitPrice) || "0.00" }])),
  );
  const [address, setAddress] = useState(po.deliveryAddress ?? "");
  const [date, setDate] = useState(po.deliveryDate ?? "");
  const [terms, setTerms] = useState(po.terms ?? "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Each line as typed; null where the box doesn't hold a number.
  const read = useMemo(
    () =>
      po.lines.map((l) => {
        const r = rows[l.id];
        return { line: l, quantity: parseQty(r.quantity), price: r.price.trim() === "" ? null : parseAmount(r.price) };
      }),
    [po.lines, rows],
  );
  const newTotal = read.reduce((s, r) => s + (r.quantity !== null && r.price !== null ? lineTotal(r.quantity, r.price, r.line.vatRateBp) : r.line.amount + r.line.vat), 0);
  const diff = newTotal - po.total;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    const lines: NonNullable<PoReviseInput["lines"]> = [];
    read.forEach(({ line, quantity, price }) => {
      if (quantity === null || quantity < 0) found[`q-${line.id}`] = "Type a quantity.";
      else if (quantity < line.received) found[`q-${line.id}`] = `Not below what has been received (${qty(line.received)}).`;
      if (price === null || price < 0) found[`p-${line.id}`] = "Type a price like 915,000.00.";
      if (quantity === null || price === null) return;
      const change: { id: string; quantity?: number; unitPrice?: number } = { id: line.id };
      if (quantity !== line.quantity) change.quantity = quantity;
      if (price !== line.unitPrice) change.unitPrice = price;
      if (change.quantity !== undefined || change.unitPrice !== undefined) lines.push(change);
    });
    if (reason.trim() === "") found.reason = "Say why the order changes.";

    const input: PoReviseInput = { reason: reason.trim() };
    if (lines.length) input.lines = lines;
    if (address.trim() !== (po.deliveryAddress ?? "")) input.deliveryAddress = address.trim() || null;
    if (date !== (po.deliveryDate ?? "")) input.deliveryDate = date || null;
    if (terms.trim() !== (po.terms ?? "").trim()) input.terms = terms.trim() || null;
    const changes = lines.length > 0 || "deliveryAddress" in input || "deliveryDate" in input || "terms" in input;
    if (Object.keys(found).length === 0 && !changes) found.general = "Nothing changes yet. Change a quantity, a price, the delivery or the terms.";

    setErrors(found);
    setError(found.general ?? null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const saved = await procurement.orders.revise(po.id, input);
      onRevised(saved, saved.pendingRevision === null);
    } catch (err) {
      const f = opsFieldErrors(err);
      // Line errors come back as lines.{i}.quantity: place them on the line sent at that index.
      const placed: Record<string, string> = {};
      for (const [k, v] of Object.entries(f)) {
        const m = /^lines\.(\d+)\.(quantity|unitPrice|unit_price|id)$/.exec(k);
        const sent = m ? input.lines?.[Number(m[1])] : undefined;
        if (sent) placed[`${m![2] === "quantity" ? "q" : "p"}-${sent.id}`] = v;
        else if (k === "reason") placed.reason = v;
      }
      setErrors(placed);
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={`Revise ${po.number ?? "this order"}`}
      subtitle="A revision that costs no more applies at once. A dearer one may need approval first; the order keeps its current figures until then."
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
            <Money value={po.total} currency={cur} className="text-neutral-500" />
            <ArrowRight size={14} className="text-neutral-400" aria-hidden />
            <Money value={newTotal} currency={cur} className="font-bold text-neutral-900" />
            {diff !== 0 && (
              <span className={cx("text-xs font-semibold", diff > 0 ? "text-sun-700" : "text-mint-700")}>
                {diff > 0 ? "+" : "−"}
                <Money value={Math.abs(diff)} currency={cur} />
              </span>
            )}
            <span className="sr-only">New total incl. VAT</span>
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving…" : diff > 0 ? "Send revision" : "Revise order"}
            </Button>
          </div>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Lines</legend>
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {read.map(({ line: l, quantity, price }) => {
            const now = l.amount + l.vat;
            const next = quantity !== null && price !== null ? lineTotal(quantity, price, l.vatRateBp) : now;
            return (
              <li key={l.id} className="space-y-2 px-4 py-3">
                <p className="text-sm font-medium text-neutral-900">
                  <span className="tabular-nums text-neutral-500">{l.lineNo}.</span> {l.description}
                  {l.received > 0 && <span className="ml-2 text-xs font-normal text-neutral-500">{qty(l.received)} received</span>}
                </p>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                  <div>
                    <label htmlFor={`${uid}-q-${l.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
                      Quantity ({l.unit}), line {l.lineNo}
                    </label>
                    <input
                      id={`${uid}-q-${l.id}`}
                      inputMode="decimal"
                      value={rows[l.id].quantity}
                      onChange={(e) => setRows((r) => ({ ...r, [l.id]: { ...r[l.id], quantity: e.target.value } }))}
                      aria-invalid={errors[`q-${l.id}`] ? true : undefined}
                      className={cx(inputClass, "!h-10 tabular-nums")}
                    />
                    <FieldError message={errors[`q-${l.id}`]} />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-p-${l.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
                      Unit price, line {l.lineNo}
                    </label>
                    <input
                      id={`${uid}-p-${l.id}`}
                      inputMode="decimal"
                      value={rows[l.id].price}
                      onChange={(e) => setRows((r) => ({ ...r, [l.id]: { ...r[l.id], price: e.target.value } }))}
                      aria-invalid={errors[`p-${l.id}`] ? true : undefined}
                      className={cx(inputClass, "!h-10 tabular-nums")}
                    />
                    <FieldError message={errors[`p-${l.id}`]} />
                  </div>
                  <div className="text-left sm:pt-6 sm:text-right">
                    <Money value={next} currency={cur} className={cx("text-sm font-bold", next === now ? "text-neutral-900" : "text-primary-700")} />
                    <p className="text-[11px] text-neutral-500">incl. VAT {l.vatRateBp / 100}%</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-addr`} label="Deliver to">
          <input id={`${uid}-addr`} className={inputClass} value={address} maxLength={255} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field id={`${uid}-date`} label="Deliver by">
          <input id={`${uid}-date`} type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field id={`${uid}-terms`} label="Terms and conditions" hint="Printed on the order">
        <RichTextEditor id={`${uid}-terms`} value={terms} onChange={setTerms} />
      </Field>
      <Field id={`${uid}-reason`} label="Why the order changes" hint="Required">
        <textarea
          id={`${uid}-reason`}
          rows={2}
          className={textareaClass}
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Vendor's price rose; two units dropped from the order"
          aria-invalid={errors.reason ? true : undefined}
        />
        <FieldError message={errors.reason} />
      </Field>
    </DialogFrame>
  );
}
