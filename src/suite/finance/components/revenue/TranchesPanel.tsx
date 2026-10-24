"use client";

import { useId, useState } from "react";
import { PencilLine, RotateCcw } from "lucide-react";
import { revenue, revenueError, revenueFieldErrors, type InvoiceDetail, type InvoiceTranche } from "@/lib/api/finance-revenue-client";
import { Button, Card, Chip, cx } from "@/components/workspace/kit";
import { HUE, hueFor } from "@/components/workspace/modules";
import { inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { amount, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { RATE_SOURCE, pct, rateScaled, toBase } from "./meta";

/**
 * An invoice's tranches: the part billed in each currency, its total, the
 * rate it is booked at (with where that rate came from and its date), its
 * base equivalent and - once issued - what is still owed on it. On a saved
 * draft someone allowed to override rates can bill a tranche at another
 * rate, saying why; it is logged and shown here with who set it.
 */
export default function TranchesPanel({
  invoice,
  base,
  draft = false,
  dirty = false,
  onChanged,
}: {
  invoice: Pick<InvoiceDetail, "id" | "status" | "tranches" | "canOverrideRate">;
  base: string;
  /** Editing a draft: offer the override (when allowed). */
  draft?: boolean;
  /** Unsaved changes: overriding waits for a save. */
  dirty?: boolean;
  onChanged?: (next: InvoiceDetail) => void;
}) {
  const tranches = invoice.tranches ?? [];
  const [editing, setEditing] = useState<InvoiceTranche | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (tranches.length === 0) return null;

  const open = invoice.status === "issued" || invoice.status === "part_paid";
  const baseTotal = tranches.every((t) => t.baseTotal !== null) ? tranches.reduce((s, t) => s + (t.baseTotal ?? 0), 0) : null;
  const mayOverride = draft && Boolean(invoice.canOverrideRate);

  const clear = async (t: InvoiceTranche) => {
    setBusy(true);
    setError(null);
    try {
      onChanged?.(await revenue.invoices.overrideRate(invoice.id, t.id, null));
    } catch (e) {
      setError(revenueError(e, "The recorded rate wasn't put back."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight text-neutral-900">{tranches.length > 1 ? "Billed in each currency" : "Exchange rate"}</h2>
        {tranches.length > 1 && baseTotal !== null && (
          <p className="text-sm text-neutral-600">
            In {base} <span className="font-semibold tabular-nums text-neutral-900">{amount(baseTotal, base as CurrencyCode)}</span>
          </p>
        )}
      </div>
      {tranches.length > 1 && (
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
          {tranches.map((t) => (
            <span key={t.id} className={cx("h-full", HUE[hueFor(t.currency)].bar)} style={{ width: `${baseTotal ? ((t.baseTotal ?? 0) / baseTotal) * 100 : 100 / tranches.length}%` }} />
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-error-700">
          {error}
        </p>
      )}
      <ul className="mt-3 divide-y divide-neutral-100">
        {tranches.map((t) => {
          const c = t.currency as CurrencyCode;
          const src = RATE_SOURCE[t.rateSource] ?? RATE_SOURCE.table;
          const isBase = t.currency === base;
          return (
            <li key={t.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <span className={cx("h-2.5 w-2.5 rounded-full", HUE[hueFor(t.currency)].bar)} aria-hidden />
                  {t.currency}
                  {t.shareBp ? <span className="font-normal text-neutral-500">{pct(t.shareBp)} of the milestone</span> : null}
                </p>
                <p className="text-sm font-semibold tabular-nums text-neutral-900">{amount(t.total, c)}</p>
              </div>
              {!isBase && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                  <Chip hue={src.hue}>{src.label}</Chip>
                  {t.rate ? (
                    <span className="tabular-nums">
                      {base} {t.rate} per 1{t.rateAsOf ? ` · ${day(t.rateAsOf)}` : ""}
                      {t.baseTotal !== null ? ` · ${amount(t.baseTotal, base as CurrencyCode)}` : ""}
                    </span>
                  ) : (
                    <span className="font-medium text-rose-700">No {t.currency} rate recorded on this date yet. Record one before issuing.</span>
                  )}
                </div>
              )}
              {t.rateSource === "override" && t.overrideReason && (
                <p className="mt-1 text-xs text-neutral-500">
                  {t.overriddenBy ? `${t.overriddenBy}: ` : ""}
                  {t.overrideReason}
                </p>
              )}
              {open && t.open && (
                <p className="mt-1.5 text-xs tabular-nums text-neutral-600">
                  Owed now <span className="font-semibold text-neutral-900">{amount(t.open.trade, c)}</span>
                  {t.open.retention > 0 && <> · retention held {amount(t.open.retention, c)}</>}
                  {t.settled > 0 && <> · settled {amount(t.settled, c)}</>}
                </p>
              )}
              {mayOverride && !isBase && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" icon={PencilLine} disabled={busy || dirty} onClick={() => setEditing(t)} title={dirty ? "Save your changes first" : undefined}>
                    Use another rate
                  </Button>
                  {t.rateSource === "override" && (
                    <Button size="sm" variant="ghost" icon={RotateCcw} disabled={busy || dirty} onClick={() => clear(t)}>
                      Use the recorded rate
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {draft && tranches.some((t) => t.currency !== base && t.rateSource !== "override") && (
        <p className="mt-1 text-xs text-neutral-500">Recorded rates are read again on the issue date.</p>
      )}
      {editing && (
        <OverrideDialog
          invoiceId={invoice.id}
          tranche={editing}
          base={base}
          onClose={() => setEditing(null)}
          onDone={(next) => {
            setEditing(null);
            onChanged?.(next);
          }}
        />
      )}
    </Card>
  );
}

function OverrideDialog({
  invoiceId,
  tranche,
  base,
  onClose,
  onDone,
}: {
  invoiceId: string;
  tranche: InvoiceTranche;
  base: string;
  onClose: () => void;
  onDone: (next: InvoiceDetail) => void;
}) {
  const uid = useId();
  const [rate, setRate] = useState(tranche.rate);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const preview = toBase(tranche.total, rate);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (rateScaled(rate) === null) e.rate = `Enter the rate as ${base} per one ${tranche.currency}, like 1550.25.`;
    if (!reason.trim()) e.reason = "Say why this rate is used instead of the recorded one.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      onDone(await revenue.invoices.overrideRate(invoiceId, tranche.id, rate.replace(/,/g, "").trim(), reason.trim()));
    } catch (err) {
      const f = revenueFieldErrors(err);
      setErrors(Object.keys(f).length ? f : { general: revenueError(err, "The rate wasn't changed.") });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      titleId={`${uid}-title`}
      title={`Bill the ${tranche.currency} part at another rate`}
      subtitle="The rate is used instead of the recorded one when the invoice is issued. Your name, the rate and your reason are logged."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Keep the recorded rate</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Use this rate"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {errors.general && (
          <p role="alert" className="text-sm font-medium text-error-700">
            {errors.general}
          </p>
        )}
        <div>
          <label htmlFor={`${uid}-rate`} className="mb-1.5 block text-sm font-medium text-neutral-700">
            {base} per 1 {tranche.currency}
          </label>
          <input
            id={`${uid}-rate`}
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            aria-invalid={Boolean(errors.rate) || undefined}
            className={cx(inputClass, "text-right tabular-nums", errors.rate && "border-error-500")}
          />
          {errors.rate ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-error-700">
              {errors.rate}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-neutral-500">
              Recorded: {tranche.rate || "none yet"}
              {preview !== null ? ` · ${amount(tranche.total, tranche.currency as CurrencyCode)} is ${amount(preview, base as CurrencyCode)} at this rate` : ""}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${uid}-reason`} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Why <span className="text-error-700">*</span>
          </label>
          <textarea
            id={`${uid}-reason`}
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. the rate fixed in the contract addendum"
            aria-invalid={Boolean(errors.reason) || undefined}
            className={textareaClass}
          />
          {errors.reason && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-error-700">
              {errors.reason}
            </p>
          )}
        </div>
      </div>
    </DialogFrame>
  );
}
