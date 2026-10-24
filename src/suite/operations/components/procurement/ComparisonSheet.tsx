"use client";

import { BadgeCheck, CircleSlash, Clock, FileText, Truck } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { useNarrow } from "@/suite/finance/components/revenue/ui";
import { procurement, type Comparison, type ComparisonLine, type QuotePrice, type QuoteVendor } from "@/lib/api/operations-procurement-client";
import { overLowest, qty, readSheet } from "./meta";
import { LowestTag } from "./ui";
import { CounterpartyLink } from "../links";

/**
 * The comparison sheet: the request's lines down the side, one column per
 * vendor, each cell the vendor's unit price with the line amount and VAT
 * under it. The lowest on each line wears a mint seal; a vendor that didn't
 * quote a line shows a hatched "Not quoted". Below, each vendor's subtotal,
 * VAT and total (VAT always shown on its own), how far over the lowest, and
 * delivery, terms, validity and whether it meets the specification.
 *
 * Each column carries the quotation's own files (the vendor's document) and
 * who keyed it in; `showFiles={false}` leaves the files out where the
 * reader can't open the desk's attachments (the requester's own view).
 *
 * With `onPick` the sheet becomes the award ballot: each cell is a radio for
 * its line, so a line can go to a different vendor than the next one.
 *
 * On a phone the grid turns into one card per vendor, cheapest first.
 */
export default function ComparisonSheet({
  comparison: c,
  currency = "NGN",
  picks,
  onPick,
  showFiles = true,
}: {
  comparison: Comparison;
  currency?: string;
  showFiles?: boolean;
  picks?: Record<string, string>;
  onPick?: (prLineId: string, quotationId: string) => void;
}) {
  const narrow = useNarrow();
  const sheet = readSheet(c);

  if (c.vendors.length === 0) {
    return (
      <div className="ws-hatch rounded-2xl px-5 py-10 text-center">
        <p className="text-sm font-semibold text-neutral-800">No quotations yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-600">Enter each vendor&apos;s quotation as it arrives; the sheet fills in and the lowest price on each line is picked out.</p>
      </div>
    );
  }

  const priceOf = (line: ComparisonLine, v: QuoteVendor): QuotePrice | null => line.prices.find((p) => p?.quotationId === v.quotationId) ?? null;
  const isLowest = (line: ComparisonLine, v: QuoteVendor) => sheet.lowestOn.get(line.prLineId)?.has(v.quotationId) ?? false;
  const rank = (v: QuoteVendor) => sheet.ranked.findIndex((x) => x.quotationId === v.quotationId) + 1;

  if (narrow) {
    return (
      <ul className="space-y-3" aria-label="Quotations, cheapest first">
        {sheet.ranked.map((v) => (
          <li key={v.quotationId} className={cx("overflow-hidden rounded-2xl border bg-white", rank(v) === 1 ? "border-mint-500/50" : "border-neutral-200/80")}>
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
                  <RankBadge n={rank(v)} />
                  <span className="truncate">
                    <CounterpartyLink id={v.vendorId} name={v.vendor} fallback="Vendor" />
                  </span>
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-500">{v.reference ?? "No reference"}</p>
              </div>
              <div className="shrink-0 text-right">
                <Money value={v.total} currency={currency} className="text-[15px] font-bold text-neutral-900" />
                <p className="text-[11px] text-neutral-500">
                  incl. VAT <Money value={v.vat} currency={currency} />
                </p>
                {overLowest(v.total, sheet.bestTotal) ? <p className="text-[11px] font-semibold text-coral-700">{overLowest(v.total, sheet.bestTotal)} on the lowest</p> : <LowestTag>Lowest total</LowestTag>}
              </div>
            </div>
            <ul className="divide-y divide-neutral-100">
              {c.lines.map((line) => {
                const p = priceOf(line, v);
                const low = p && isLowest(line, v);
                const picked = picks?.[line.prLineId] === v.quotationId;
                return (
                  <li key={line.prLineId} className={cx("px-4 py-3", low && "bg-mint-50/60")}>
                    <p className="text-xs font-medium text-neutral-500">
                      Line {line.lineNo} · {qty(line.quantity)} {line.unit}
                    </p>
                    <p className="text-sm text-neutral-900">{line.description}</p>
                    {p ? (
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm">
                          <Money value={p.unitPrice} currency={currency} className="font-semibold" /> <span className="text-neutral-500">each</span>
                        </span>
                        <span className="flex items-center gap-2">
                          {low && <LowestTag />}
                          <Money value={p.amount} currency={currency} className="text-sm font-semibold text-neutral-900" />
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-sm text-neutral-500">Not quoted</p>
                    )}
                    {onPick && p && (
                      <label className={cx("mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-primary-300", picked ? "border-primary-500 bg-primary-50 text-primary-800" : "border-neutral-200/80 text-neutral-700")}>
                        <input type="radio" name={`pick-${line.prLineId}`} checked={picked} onChange={() => onPick(line.prLineId, v.quotationId)} className="h-4 w-4 accent-primary-600" />
                        Award line {line.lineNo} to {v.vendor}
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
            <dl className="grid grid-cols-2 gap-3 border-t border-neutral-100 bg-neutral-50/60 px-4 py-3 text-sm">
              <Term label="Subtotal">
                <Money value={v.subtotal} currency={currency} />
              </Term>
              <Term label="VAT">
                <Money value={v.vat} currency={currency} />
              </Term>
              <Term label="Delivery">{v.deliveryDays != null ? `${v.deliveryDays} days` : "Not given"}</Term>
              <Term label="Valid until">{v.validUntil ? day(v.validUntil) : "Not given"}</Term>
              <Term label="Payment terms" wide>
                {v.paymentTerms ?? "Not given"}
              </Term>
              <Term label="Specification" wide>
                <SpecChip ok={v.meetsSpec} />
              </Term>
              {showFiles && (
                <Term label="Quotation file" wide>
                  <QuoteFiles v={v} start />
                </Term>
              )}
            </dl>
          </li>
        ))}
      </ul>
    );
  }

  const vendors = c.vendors;
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Quotations compared line by line{onPick ? "; choose a vendor for each line" : ""}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-[34%] border-b border-neutral-100 bg-neutral-50 px-4 py-3 text-left align-bottom text-xs font-semibold text-neutral-500">
              Line
            </th>
            {vendors.map((v) => (
              <th key={v.quotationId} scope="col" className={cx("border-b border-l border-neutral-100 px-4 py-3 text-left align-bottom font-normal", rank(v) === 1 ? "bg-mint-50/70" : "bg-neutral-50")}>
                <span className="flex items-center gap-2">
                  <RankBadge n={rank(v)} />
                  <span className="min-w-0 truncate text-[13px] font-semibold text-neutral-900">
                    <CounterpartyLink id={v.vendorId} name={v.vendor} fallback="Vendor" />
                  </span>
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-neutral-500">{v.reference ?? "No reference"}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.lines.map((line) => (
            <tr key={line.prLineId}>
              <th scope="row" className="sticky left-0 z-10 border-b border-neutral-100 bg-white px-4 py-3 text-left align-top font-normal">
                <span className="block text-xs font-semibold text-neutral-500">
                  Line {line.lineNo} · {line.kind === "service" ? "Service" : "Goods"}
                </span>
                <span className="mt-0.5 block font-medium text-neutral-900">{line.description}</span>
                <span className="mt-0.5 block text-xs text-neutral-500 tabular-nums">
                  {qty(line.quantity)} {line.unit} · est. <Money value={line.estimate} currency={currency} />
                </span>
              </th>
              {vendors.map((v) => {
                const p = priceOf(line, v);
                if (!p)
                  return (
                    <td key={v.quotationId} className="ws-hatch border-b border-l border-neutral-100 px-4 py-3 text-right align-top text-xs font-medium text-neutral-500">
                      Not quoted
                    </td>
                  );
                const low = isLowest(line, v);
                const picked = picks?.[line.prLineId] === v.quotationId;
                const body = (
                  <>
                    <span className="flex items-center justify-end gap-2">
                      {low && <LowestTag />}
                      <Money value={p.unitPrice} currency={currency} className="text-[15px] font-bold text-neutral-900" />
                    </span>
                    <span className="mt-0.5 block text-right text-xs text-neutral-500">
                      × {qty(p.quantity)} = <Money value={p.amount} currency={currency} className="font-semibold text-neutral-700" />
                    </span>
                    <span className="block text-right text-[11px] text-neutral-500">
                      VAT <Money value={p.vat} currency={currency} />
                    </span>
                  </>
                );
                return (
                  <td key={v.quotationId} className={cx("border-b border-l border-neutral-100 p-0 align-top", low && "bg-mint-50/60")}>
                    {onPick ? (
                      <label
                        className={cx(
                          "relative block cursor-pointer px-4 py-3 outline-none transition focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-300",
                          picked ? "bg-primary-50 ring-2 ring-inset ring-primary-500" : "hover:bg-neutral-50",
                        )}
                      >
                        <input
                          type="radio"
                          name={`pick-${line.prLineId}`}
                          checked={picked}
                          onChange={() => onPick(line.prLineId, v.quotationId)}
                          aria-label={`Award line ${line.lineNo} to ${v.vendor}`}
                          className="absolute left-3 top-3.5 h-4 w-4 accent-primary-600"
                        />
                        {body}
                      </label>
                    ) : (
                      <div className="px-4 py-3">{body}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <FootRow label="Subtotal" vendors={vendors} render={(v) => <Money value={v.subtotal} currency={currency} />} />
          <FootRow label="VAT" vendors={vendors} render={(v) => <Money value={v.vat} currency={currency} />} />
          <FootRow
            label="Total"
            strong
            vendors={vendors}
            render={(v) => (
              <span className="flex flex-col items-end gap-1">
                <Money value={v.total} currency={currency} className="text-[15px] font-bold text-neutral-900" />
                {overLowest(v.total, sheet.bestTotal) ? (
                  <span className="text-[11px] font-semibold text-coral-700">{overLowest(v.total, sheet.bestTotal)} on the lowest</span>
                ) : (
                  <LowestTag>Lowest total</LowestTag>
                )}
              </span>
            )}
          />
          <FootRow
            label="Delivery"
            vendors={vendors}
            render={(v) => (
              <span className="inline-flex items-center gap-1 text-neutral-700">
                <Truck size={13} aria-hidden />
                {v.deliveryDays != null ? `${v.deliveryDays} days` : "Not given"}
              </span>
            )}
          />
          <FootRow label="Payment terms" vendors={vendors} render={(v) => <span className="text-neutral-700">{v.paymentTerms ?? "Not given"}</span>} />
          <FootRow
            label="Valid until"
            vendors={vendors}
            render={(v) => (
              <span className="inline-flex items-center gap-1 text-neutral-700">
                <Clock size={13} aria-hidden />
                {v.validUntil ? day(v.validUntil) : "Not given"}
              </span>
            )}
          />
          <FootRow label="Specification" vendors={vendors} last={!showFiles} render={(v) => <SpecChip ok={v.meetsSpec} />} />
          {showFiles && <FootRow label="Quotation file" vendors={vendors} last render={(v) => <QuoteFiles v={v} />} />}
        </tfoot>
      </table>
    </div>
  );
}

/** The quotation's own files, each opening in a new tab, and who keyed the quotation in. */
function QuoteFiles({ v, start = false }: { v: QuoteVendor; start?: boolean }) {
  const files = v.attachments ?? [];
  return (
    <span className={cx("flex flex-col gap-1", start ? "items-start text-left" : "items-end text-right")}>
      {files.length === 0 ? (
        <span className="text-[12px] font-medium text-neutral-500">No file</span>
      ) : (
        files.map((a) => (
          <a
            key={a.id}
            href={procurement.attachments.href(a.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg py-1 text-[12px] font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
            aria-label={`Open ${a.name}, ${v.vendor ?? "the vendor"}'s quotation`}
          >
            <FileText size={13} className="shrink-0" aria-hidden />
            <span className="truncate">{a.name}</span>
          </a>
        ))
      )}
      {v.enteredBy && <span className="text-[11px] font-normal text-neutral-500">Keyed in by {v.enteredBy}</span>}
    </span>
  );
}

function RankBadge({ n }: { n: number }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
        n === 1 ? "bg-mint-500 text-white" : "bg-neutral-200 text-neutral-700",
      )}
      title={`Ranked ${n} by total`}
    >
      <span aria-hidden>#{n}</span>
      <span className="sr-only">Ranked {n} by total</span>
    </span>
  );
}

function SpecChip({ ok }: { ok: boolean }) {
  return ok ? (
    <Chip hue="mint" icon={BadgeCheck} className="!px-2 !py-0.5 !text-[11px]">
      Meets the specification
    </Chip>
  ) : (
    <Chip hue="rose" icon={CircleSlash} className="!px-2 !py-0.5 !text-[11px]">
      Does not meet it
    </Chip>
  );
}

function FootRow({
  label,
  vendors,
  render,
  strong = false,
  last = false,
}: {
  label: string;
  vendors: QuoteVendor[];
  render: (v: QuoteVendor) => React.ReactNode;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <tr className={strong ? "bg-neutral-50/80" : undefined}>
      <th scope="row" className={cx("sticky left-0 z-10 px-4 py-2.5 text-left text-xs font-semibold", strong ? "bg-neutral-50 text-neutral-900" : "bg-white text-neutral-500", !last && "border-b border-neutral-100")}>
        {label}
      </th>
      {vendors.map((v) => (
        <td key={v.quotationId} className={cx("border-l border-neutral-100 px-4 py-2.5 text-right align-top text-[13px] tabular-nums", !last && "border-b")}>
          {render(v)}
        </td>
      ))}
    </tr>
  );
}

function Term({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cx("min-w-0", wide && "col-span-2")}>
      <dt className="text-[11px] font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-semibold text-neutral-800 tabular-nums">{children}</dd>
    </div>
  );
}
