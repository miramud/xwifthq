"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, Switch, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { opsError, opsFieldErrors, procurement, type PrFull } from "@/lib/api/operations-procurement-client";
import { lineTotal, qty, today } from "./meta";

/* Inviting quotations, and entering one when it arrives. */

/** The organisation's active vendors, for both dialogs. */
export function useVendorOptions(): SelectOption[] | null {
  const [vendors, setVendors] = useState<SelectOption[] | null>(null);
  useEffect(() => {
    let alive = true;
    procurement.me.options().then(
      (o) => alive && setVendors(o.vendors.map((v) => ({ value: v.id, label: v.name }))),
      () => alive && setVendors([]),
    );
    return () => {
      alive = false;
    };
  }, []);
  return vendors;
}

/* ------------------------------------------------------------------ */
/*  RFQ                                                                */
/* ------------------------------------------------------------------ */

export function RfqDialog({
  pr,
  vendors,
  onDone,
  onClose,
}: {
  pr: PrFull;
  vendors: SelectOption[] | null;
  onDone: (number: string) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [chosen, setChosen] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) => vendors?.find((v) => v.value === id)?.label ?? "Vendor";
  const offered = (vendors ?? []).filter((v) => !chosen.includes(v.value));
  const needed = pr.comparison?.rule.needed ?? 3;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (chosen.length === 0) local.vendorIds = "Choose at least one vendor to invite.";
    if (!deadline) local.deadline = "Set the date quotations are due by.";
    else if (deadline < today()) local.deadline = "The deadline can't be in the past.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const r = await procurement.requests.rfq(pr.id, { vendorIds: chosen, deadline, message: message.trim() || null });
      onDone(r.number);
    } catch (err) {
      const f = opsFieldErrors(err);
      const placed = Boolean(f.vendorIds || f.deadline);
      setErrors(placed ? f : { general: Object.values(f)[0] ?? opsError(err) });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Invite quotations"
      subtitle={`A request for quotation for ${pr.number ?? pr.title}. This request needs ${needed} ${needed === 1 ? "quotation" : "quotations"}.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Keep as it is</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Sending…" : chosen.length ? `Send to ${chosen.length} ${chosen.length === 1 ? "vendor" : "vendors"}` : "Send the RFQ"}
          </Button>
        </div>
      }
    >
      <Field id={`${uid}-v`} label="Vendors to invite" hint={`${chosen.length} chosen`}>
        <SearchableSelect
          id={`${uid}-v`}
          value=""
          onChange={(v) => v && setChosen((c) => [...c, v])}
          options={offered}
          placeholder={vendors === null ? "Loading vendors…" : "Add a vendor from the register"}
          searchPlaceholder="Search vendors"
          noOptionsText={vendors === null ? "Loading vendors…" : "Every vendor in the register is already chosen."}
          aria-invalid={errors.vendorIds ? true : undefined}
        />
        {chosen.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Chosen vendors">
            {chosen.map((id) => (
              <li key={id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-3 pr-1 text-xs font-semibold text-primary-800">
                {nameOf(id)}
                <button
                  type="button"
                  onClick={() => setChosen((c) => c.filter((x) => x !== id))}
                  aria-label={`Remove ${nameOf(id)}`}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-primary-100 focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <FieldError message={errors.vendorIds} />
      </Field>
      <Field id={`${uid}-d`} label="Quotations due by">
        <input id={`${uid}-d`} type="date" min={today()} className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-invalid={errors.deadline ? true : undefined} />
        <FieldError message={errors.deadline} />
      </Field>
      <Field id={`${uid}-m`} label="Message to the vendors" hint="Optional">
        <textarea
          id={`${uid}-m`}
          rows={4}
          className={textareaClass}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything the vendors should know: delivery address, brands to avoid, how to send the quotation."
        />
      </Field>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Quotation                                                          */
/* ------------------------------------------------------------------ */

interface LineEntry {
  price: string;
  vat: string;
}

/** "7.5" → 750 basis points; null when it isn't a rate. */
function parseRate(input: string): number | null {
  const t = input.replace(/[%\s]/g, "");
  if (t === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp <= 5000 ? bp : null;
}

/** The RFQ a quotation most likely answers: the only one, or the only one still open. */
function defaultRfq(pr: PrFull): string {
  if (pr.rfqs.length === 1) return pr.rfqs[0].id;
  const open = pr.rfqs.filter((r) => r.status === "open");
  return open.length === 1 ? open[0].id : "";
}

/** The one invited vendor still to reply on an RFQ, if exactly one is. */
function onlyAwaiting(pr: PrFull, rfqId: string): string {
  const waiting = (pr.rfqs.find((r) => r.id === rfqId)?.invited ?? []).filter((i) => !i.replied);
  return waiting.length === 1 ? waiting[0].vendorId : "";
}

export function QuotationDialog({
  pr,
  vendors,
  onDone,
  onClose,
}: {
  pr: PrFull;
  vendors: SelectOption[] | null;
  /** `warning` is set when the quotation saved but its file didn't attach. */
  onDone: (vendor: string, warning?: string) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [rfqId, setRfqIdRaw] = useState(() => defaultRfq(pr));
  const [vendorId, setVendorId] = useState(() => onlyAwaiting(pr, defaultRfq(pr)));
  /** Choosing an RFQ with one vendor still to reply picks that vendor, unless one is already chosen. */
  const setRfqId = (id: string) => {
    setRfqIdRaw(id);
    const only = onlyAwaiting(pr, id);
    if (only) setVendorId((v) => v || only);
  };
  const [reference, setReference] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [meetsSpec, setMeetsSpec] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [lines, setLines] = useState<Record<string, LineEntry>>(() => Object.fromEntries(pr.lines.map((l) => [l.id, { price: "", vat: "7.5" }])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const quoted = new Set(pr.comparison?.vendors.map((v) => v.vendorId) ?? []);
  const rfq = pr.rfqs.find((r) => r.id === rfqId) ?? null;
  const awaiting = new Set((rfq?.invited ?? []).filter((i) => !i.replied).map((i) => i.vendorId));
  const allVendors = (vendors ?? []).map((v) => (quoted.has(v.value) ? { ...v, hint: "Already quoted: entering again adds a second quotation" } : v));
  // The RFQ's vendors still to reply come first, under their own heading.
  const vendorOptions =
    rfq && awaiting.size > 0
      ? [
          ...allVendors.filter((v) => awaiting.has(v.value)).map((v) => ({ ...v, group: `Invited on ${rfq.number}, not replied yet` })),
          ...allVendors.filter((v) => !awaiting.has(v.value)).map((v) => ({ ...v, group: "Other vendors" })),
        ]
      : allVendors;

  const rows = useMemo(
    () =>
      pr.lines.map((l) => {
        const e = lines[l.id];
        const price = parseAmount(e.price);
        const rate = parseRate(e.vat);
        const amount = price === null ? 0 : lineTotal(l.quantity, price);
        const vat = rate === null ? 0 : Math.floor((amount * rate) / 10_000);
        return { line: l, entry: e, price, rate, amount, vat };
      }),
    [pr.lines, lines],
  );
  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const vatTotal = rows.reduce((s, r) => s + r.vat, 0);

  const setLine = (id: string, k: keyof LineEntry, v: string) => setLines((cur) => ({ ...cur, [id]: { ...cur[id], [k]: v } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!vendorId) local.vendorId = "Choose the vendor whose quotation this is.";
    const priced = rows.filter((r) => r.entry.price.trim() !== "");
    for (const r of priced) {
      if (r.price === null) local[`line.${r.line.id}`] = "Type the unit price as a number, like 915,000.00.";
      else if (r.rate === null) local[`line.${r.line.id}`] = "VAT is a percentage up to 50, like 7.5.";
    }
    if (priced.length === 0) local.lines = "Enter a unit price for at least one line. Leave a line blank if the vendor didn't quote it.";
    const days = deliveryDays.trim() === "" ? null : Number(deliveryDays);
    if (days !== null && (!Number.isInteger(days) || days < 0)) local.deliveryDays = "Delivery is a whole number of days.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    const sent = priced.map((r) => r.line.id);
    try {
      const made = await procurement.requests.quote(pr.id, {
        vendorId,
        rfqId: rfqId || null,
        reference: reference.trim() || null,
        validUntil: validUntil || null,
        deliveryDays: days,
        paymentTerms: paymentTerms.trim() || null,
        meetsSpec,
        lines: priced.map((r) => ({ prLineId: r.line.id, unitPrice: r.price!, vatRateBp: r.rate! })),
      });
      // The vendor's document goes on the quotation itself, beside its column on the sheet.
      let warning: string | undefined;
      if (file) {
        try {
          await procurement.attachments.upload("quotation", made.id, file, "quotation");
        } catch (x) {
          warning = `${file.name} wasn't attached to it. ${opsError(x)} Attach it from the quotation's column.`;
        }
      }
      onDone(vendors?.find((v) => v.value === vendorId)?.label ?? "the vendor", warning);
    } catch (err) {
      const f = opsFieldErrors(err);
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(f)) {
        const m = /^lines\.(\d+)\./.exec(k);
        if (m && sent[Number(m[1])]) mapped[`line.${sent[Number(m[1])]}`] = v;
        else if (k === "vendorId" || k === "deliveryDays" || k === "lines") mapped[k] = v;
        else mapped.general = mapped.general ?? v;
      }
      setErrors(Object.keys(mapped).length ? mapped : { general: opsError(err) });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      size="lg"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Enter a quotation"
      subtitle="Type the vendor's prices as quoted. Leave a line blank if they didn't quote it; the comparison sheet updates when you save."
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-600" aria-live="polite">
            Total <Money value={subtotal + vatTotal} className="font-bold text-neutral-900" /> <span className="text-xs text-neutral-500">(VAT <Money value={vatTotal} />)</span>
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button onClick={onClose}>Keep as it is</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving…" : "Save quotation"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-v`} label="Vendor" className="sm:col-span-2">
          <SearchableSelect
            id={`${uid}-v`}
            value={vendorId}
            onChange={setVendorId}
            options={vendorOptions}
            placeholder={vendors === null ? "Loading vendors…" : "Choose from the vendor register"}
            searchPlaceholder="Search vendors"
            noOptionsText={vendors === null ? "Loading vendors…" : "No active vendors. Ask Finance to add one to the register."}
            aria-invalid={errors.vendorId ? true : undefined}
          />
          <FieldError message={errors.vendorId} />
        </Field>
        {pr.rfqs.length > 0 && (
          <Field id={`${uid}-r`} label="In answer to" hint="Optional">
            <SearchableSelect
              id={`${uid}-r`}
              value={rfqId}
              onChange={setRfqId}
              options={pr.rfqs.map((r) => ({ value: r.id, label: r.number, hint: `${r.status === "closed" ? "Closed" : `Due ${r.deadline}`} · ${r.replied ?? 0} of ${(r.invited ?? []).length || r.vendors.length} replied` }))}
              clearable
              clearLabel="No RFQ"
              placeholder="Choose the RFQ"
              searchPlaceholder="Search RFQs"
            />
          </Field>
        )}
        <Field id={`${uid}-ref`} label="Vendor's reference" hint="Optional">
          <input id={`${uid}-ref`} className={cx(inputClass, "font-mono")} value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="Q-10442" />
        </Field>
        <Field id={`${uid}-vu`} label="Valid until" hint="Optional">
          <input id={`${uid}-vu`} type="date" className={inputClass} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
        <Field id={`${uid}-dd`} label="Delivery (days)" hint="Optional">
          <input id={`${uid}-dd`} inputMode="numeric" className={cx(inputClass, "tabular-nums")} value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} placeholder="7" />
          <FieldError message={errors.deliveryDays} />
        </Field>
        <Field id={`${uid}-pt`} label="Payment terms" hint="As the vendor states them" className="sm:col-span-2">
          <input id={`${uid}-pt`} className={inputClass} value={paymentTerms} maxLength={255} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="50% advance, balance on delivery" />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Meets the specification</p>
          <p className="text-xs text-neutral-500">Turn off if what is offered differs from what was asked for.</p>
        </div>
        <Switch checked={meetsSpec} onChange={setMeetsSpec} label="Meets the specification" />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Prices, line by line</legend>
        <ul className="space-y-3">
          {rows.map((r) => {
            const err = errors[`line.${r.line.id}`];
            return (
              <li key={r.line.id} className={cx("rounded-2xl border bg-neutral-50/50 p-4", err ? "border-error-500/40" : "border-neutral-100")}>
                <p className="text-xs font-medium text-neutral-500">
                  Line {r.line.lineNo} · {qty(r.line.quantity)} {r.line.unit} · estimated <Money value={r.line.estUnitPrice} /> each
                </p>
                <p className="text-sm font-medium text-neutral-900">{r.line.description}</p>
                <div className="mt-2 grid grid-cols-[1fr_88px] gap-2 sm:grid-cols-[1fr_96px_auto] sm:items-end">
                  <div>
                    <label htmlFor={`${uid}-p-${r.line.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
                      Unit price (₦), line {r.line.lineNo}
                    </label>
                    <input
                      id={`${uid}-p-${r.line.id}`}
                      inputMode="decimal"
                      className={cx(inputClass, "text-right tabular-nums")}
                      value={r.entry.price}
                      onChange={(e) => setLine(r.line.id, "price", e.target.value)}
                      onBlur={() => r.price !== null && setLine(r.line.id, "price", amountInput(r.price))}
                      placeholder="Not quoted"
                      aria-invalid={err ? true : undefined}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-vat-${r.line.id}`} className="mb-1 block text-xs font-medium text-neutral-600">
                      VAT %
                    </label>
                    <input
                      id={`${uid}-vat-${r.line.id}`}
                      inputMode="decimal"
                      className={cx(inputClass, "text-right tabular-nums")}
                      value={r.entry.vat}
                      onChange={(e) => setLine(r.line.id, "vat", e.target.value)}
                    />
                  </div>
                  <p className="col-span-2 text-right text-sm sm:col-span-1 sm:pb-3">
                    {r.price !== null && r.entry.price.trim() ? (
                      <>
                        <Money value={r.amount} className="font-semibold text-neutral-900" />
                        <span className="block text-[11px] text-neutral-500">
                          + VAT <Money value={r.vat} />
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-neutral-500">Not quoted</span>
                    )}
                  </p>
                </div>
                <FieldError message={err} />
              </li>
            );
          })}
        </ul>
        <FieldError message={errors.lines} />
      </fieldset>

      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">The vendor&apos;s quotation document</p>
        {file ? (
          <p className="flex items-center justify-between gap-2 rounded-2xl border border-neutral-100 bg-white px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Paperclip size={15} className="shrink-0 text-neutral-500" aria-hidden />
              <span className="truncate">{file.name}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
              Remove
            </Button>
          </p>
        ) : (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/30 px-3 text-sm font-semibold text-primary-800 transition focus-within:ring-2 focus-within:ring-primary-300 hover:bg-primary-50">
            <Paperclip size={15} aria-hidden />
            Choose a file (optional), attached to this quotation
            <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
      </div>

      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}
