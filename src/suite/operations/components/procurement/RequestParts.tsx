"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleCheckBig, Clock, Gavel, Hourglass, Landmark, Lock, Mail, ScrollText } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { Money } from "@/suite/finance/components/banking/ui";
import { when } from "@/suite/finance/components/requests/ui";
import { day } from "@/suite/finance/lib/format";
import { CounterpartyLink } from "../links";
import type { Award, PoSummary, PrFull, QuotationRule, Rfq } from "@/lib/api/operations-procurement-client";
import { isPast, qty } from "./meta";
import { ApprovalLink, DocNo, Fact, PoStatusChip } from "./ui";
import { RichTextView } from "@/components/workspace/RichTextView";

/* Pieces of a purchase request shown to the requester and to the desk alike. */

/** Who asked, what for, which budget, by when. */
export function RequestFacts({ pr, costCentre }: { pr: PrFull; costCentre?: string | null }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        <Fact label="Raised by">{pr.requester ?? "-"}</Fact>
        <Fact label="Category">{pr.categoryLabel}</Fact>
        <Fact label="Charged to">
          {pr.project ? `${pr.project.code ? `${pr.project.code} · ` : ""}${pr.project.name}` : costCentre ?? (pr.costCentreId ? "A cost centre" : "-")}
        </Fact>
        <Fact label="Needed by">
          <span className={isPast(pr.neededBy) && !["ordered", "cancelled", "rejected"].includes(pr.status) ? "text-rose-700" : undefined}>{pr.neededBy ? day(pr.neededBy) : "-"}</span>
        </Fact>
        <Fact label="Deliver to">{pr.location || "-"}</Fact>
        <Fact label="Estimate">
          <Money value={pr.estimate} currency={pr.currency} />
        </Fact>
      </dl>
      {pr.justification && (
        <div>
          <p className="text-xs font-medium text-neutral-500">Why it is needed</p>
          <RichTextView value={pr.justification} size="sm" className="mt-1 text-neutral-800" />
        </div>
      )}
      {pr.singleSourceReason && (
        <div className="rounded-xl bg-sun-50 px-3 py-2.5 text-sm text-sun-700 ring-1 ring-sun-500/30">
          <p className="font-semibold">Single source asked for</p>
          <p className="mt-0.5">{pr.singleSourceReason}</p>
        </div>
      )}
    </div>
  );
}

/** The request's lines with their estimates; cards on a phone. */
export function RequestLines({ pr }: { pr: PrFull }) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">What is asked for</caption>
          <thead>
            <tr className="border-b border-neutral-100 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th scope="col" className="py-2 pr-3 text-left">
                #
              </th>
              <th scope="col" className="py-2 pr-3 text-left">
                Description
              </th>
              <th scope="col" className="py-2 pr-3 text-right">
                Quantity
              </th>
              <th scope="col" className="py-2 pr-3 text-right">
                Est. unit price
              </th>
              <th scope="col" className="py-2 text-right">
                Estimate
              </th>
            </tr>
          </thead>
          <tbody>
            {pr.lines.map((l) => (
              <tr key={l.id} className="border-b border-neutral-100 last:border-0">
                <td className="py-3 pr-3 align-top tabular-nums text-neutral-500">{l.lineNo}</td>
                <td className="py-3 pr-3 align-top">
                  <span className="font-medium text-neutral-900">{l.description}</span>
                  <span className="ml-2 align-middle">
                    <Chip hue={l.kind === "service" ? "grape" : "sky"} className="!px-2 !py-0.5 !text-[10px]">
                      {l.kind === "service" ? "Service" : "Goods"}
                    </Chip>
                  </span>
                  {l.specification && <span className="mt-0.5 block text-xs text-neutral-500">{l.specification}</span>}
                </td>
                <td className="py-3 pr-3 text-right align-top tabular-nums">
                  {qty(l.quantity)} {l.unit}
                </td>
                <td className="py-3 pr-3 text-right align-top">
                  <Money value={l.estUnitPrice} currency={pr.currency} />
                </td>
                <td className="py-3 text-right align-top">
                  <Money value={l.estimate} currency={pr.currency} className="font-semibold text-neutral-900" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4} className="pt-3 text-right text-xs font-semibold text-neutral-500">
                Estimated total
              </th>
              <td className="pt-3 text-right">
                <Money value={pr.estimate} currency={pr.currency} className="text-[15px] font-bold text-neutral-900" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <ul className="space-y-2 sm:hidden" aria-label="What is asked for">
        {pr.lines.map((l) => (
          <li key={l.id} className="rounded-xl border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">
              Line {l.lineNo} · {l.kind === "service" ? "Service" : "Goods"}
            </p>
            <p className="text-sm font-medium text-neutral-900">{l.description}</p>
            <p className="mt-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="tabular-nums text-neutral-600">
                {qty(l.quantity)} {l.unit} × <Money value={l.estUnitPrice} currency={pr.currency} />
              </span>
              <Money value={l.estimate} currency={pr.currency} className="font-semibold text-neutral-900" />
            </p>
          </li>
        ))}
        <li className="flex items-baseline justify-between px-1 pt-1 text-sm">
          <span className="font-semibold text-neutral-600">Estimated total</span>
          <Money value={pr.estimate} currency={pr.currency} className="text-[15px] font-bold text-neutral-900" />
        </li>
      </ul>
    </>
  );
}

/** The quotation rule: how many are needed, how many are in, and whether that is enough. */
export function RuleBanner({ rule }: { rule: QuotationRule }) {
  const pct = rule.needed > 0 ? Math.min(100, (rule.have / rule.needed) * 100) : 100;
  return (
    <div
      role="status"
      className={cx(
        "flex flex-col gap-3 rounded-2xl px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between",
        rule.met ? "bg-mint-50 ring-1 ring-mint-500/30" : "bg-sun-50 ring-1 ring-sun-500/30",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", rule.met ? "bg-mint-500 text-white" : "bg-sun-500 text-white")}>
          {rule.met ? <CircleCheckBig size={18} aria-hidden /> : <AlertTriangle size={18} aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className={cx("text-sm font-semibold", rule.met ? "text-mint-700" : "text-sun-700")}>
            {rule.met ? "Quotation rule met" : "More quotations needed"}
            {rule.tender && " · tender threshold"}
            {rule.singleSource && " · single source"}
          </p>
          <p className={cx("text-sm", rule.met ? "text-mint-700" : "text-sun-700")}>{rule.message}</p>
        </div>
      </div>
      <div className="w-full shrink-0 sm:w-44" aria-hidden>
        <p className="mb-1 text-right text-xs font-semibold tabular-nums text-neutral-700">
          {rule.have} of {rule.needed}
        </p>
        <div className="ws-hatch h-2 overflow-hidden rounded-full">
          <div className={cx("h-full rounded-full", rule.met ? "bg-mint-500" : "bg-sun-500")} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Each RFQ with who it went to and who has answered: a bar of replies over
 * the invited, then every vendor marked replied (with the day) or awaiting.
 * Open while waiting; closed once everyone replied or the deadline passed.
 */
export function RfqList({ rfqs }: { rfqs: Rfq[] }) {
  if (rfqs.length === 0) return <p className="text-sm text-neutral-500">No RFQs sent yet. Invite quotations from the vendors you want to hear from.</p>;
  return (
    <ul className="space-y-3">
      {rfqs.map((r) => {
        const invited = r.invited?.length ? r.invited : r.vendors.map((v, i) => ({ vendorId: `${r.id}-${i}`, vendor: v, replied: false, quotationId: null, repliedAt: null }));
        const replied = r.replied ?? invited.filter((i) => i.replied).length;
        const awaiting = r.awaiting ?? invited.length - replied;
        const closed = r.status ? r.status === "closed" : isPast(r.deadline);
        const pct = invited.length ? (replied / invited.length) * 100 : 0;
        return (
          <li key={r.id} className="rounded-xl border border-neutral-200 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="flex min-w-0 items-start gap-3">
                <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", HUE.sky.soft)}>
                  <Mail size={15} aria-hidden />
                </span>
                <span className="min-w-0">
                  <DocNo value={r.number} className="text-neutral-700" />
                  <span className="block text-sm font-semibold text-neutral-900">
                    {replied} of {invited.length} replied
                    {awaiting > 0 && <span className="font-normal text-neutral-500"> · {awaiting} awaiting</span>}
                  </span>
                </span>
              </span>
              <Chip hue={closed ? "slate" : "sky"} icon={closed ? Lock : Clock} className="!text-[11px]">
                {closed ? "Closed" : "Open"} · {isPast(r.deadline) ? "was due" : "due"} {day(r.deadline)}
              </Chip>
            </div>
            <div className="ws-hatch mt-3 h-1.5 overflow-hidden rounded-full" aria-hidden>
              <div className="h-full rounded-full bg-mint-500" style={{ width: `${pct}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5" aria-label={`Vendors invited on ${r.number}`}>
              {invited.map((i) => (
                <li key={i.vendorId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {i.replied ? <CircleCheckBig size={15} className="shrink-0 text-mint-600" aria-hidden /> : <Hourglass size={15} className="shrink-0 text-sun-600" aria-hidden />}
                    <span className="truncate text-neutral-800">{r.invited?.length ? <CounterpartyLink id={i.vendorId} name={i.vendor} fallback="Vendor" /> : (i.vendor ?? "Vendor")}</span>
                  </span>
                  <span className={cx("shrink-0 text-xs", i.replied ? "text-mint-700" : "text-neutral-500")}>
                    {i.replied ? `Replied${i.repliedAt ? ` ${day(i.repliedAt)}` : ""}` : closed ? "No reply" : "Awaiting"}
                  </span>
                </li>
              ))}
            </ul>
            {r.message && <p className="mt-2.5 border-t border-neutral-100 pt-2 text-xs italic text-neutral-500">&ldquo;{r.message}&rdquo;</p>}
          </li>
        );
      })}
    </ul>
  );
}

const AWARD_STATUS: Record<string, { label: string; hue: "sun" | "mint" | "rose" | "slate" }> = {
  pending: { label: "In approval", hue: "sun" },
  in_approval: { label: "In approval", hue: "sun" },
  approved: { label: "Approved", hue: "mint" },
  rejected: { label: "Rejected", hue: "rose" },
};

/** Each recommendation, newest first, with who gets which line and its approval. */
export function AwardsList({ awards, pr }: { awards: Award[]; pr: PrFull }) {
  if (awards.length === 0) return <p className="text-sm text-neutral-500">No award recommended yet.</p>;
  const lineNo = (id: string) => pr.lines.find((l) => l.id === id)?.lineNo;
  return (
    <ol className="space-y-3">
      {awards.map((a) => {
        const st = AWARD_STATUS[a.status] ?? { label: a.status, hue: "slate" as const };
        const byVendor = new Map<string, number[]>();
        for (const l of a.lines) byVendor.set(l.vendor ?? "Vendor", [...(byVendor.get(l.vendor ?? "Vendor") ?? []), lineNo(l.prLineId) ?? 0]);
        return (
          <li key={a.id} className="rounded-2xl border border-neutral-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", HUE.grape.soft)}>
                  <Gavel size={15} aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    <Money value={a.total} currency={pr.currency} />
                  </p>
                  <p className="text-xs text-neutral-500">
                    {a.recommendedBy ?? "-"} · {when(a.createdAt)}
                  </p>
                </div>
              </div>
              <Chip hue={st.hue}>{st.label}</Chip>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {[...byVendor.entries()].map(([vendor, nos]) => (
                <li key={vendor} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                  {vendor}: {nos.length === 1 ? "line" : "lines"} {nos.sort((x, y) => x - y).join(", ")}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-neutral-700">&ldquo;{a.reason}&rdquo;</p>
            <div className="mt-2">
              <ApprovalLink id={a.approvalId} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The orders raised from the request; linked to their page when `linked`. */
export function OrdersList({ orders, linked }: { orders: PoSummary[]; linked: boolean }) {
  if (orders.length === 0) return <p className="text-sm text-neutral-500">No orders yet. They are raised automatically once the award is approved.</p>;
  return (
    <ul className="space-y-2">
      {orders.map((o) => {
        const body = (
          <>
            <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", o.kind === "lso" ? HUE.grape.soft : HUE.blue.soft)}>
              {o.kind === "lso" ? <Landmark size={16} aria-hidden /> : <ScrollText size={16} aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-neutral-900">{o.vendor ?? "Vendor"}</span>
              <DocNo value={o.number} />
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <Money value={o.total} currency={o.currency} className="text-sm font-bold text-neutral-900" />
              <PoStatusChip status={o.status} />
            </span>
            {linked && <ArrowRight size={16} className="shrink-0 text-neutral-400" aria-hidden />}
          </>
        );
        return (
          <li key={o.id}>
            {linked ? (
              <Link
                href={`/suite/operations/procurement/orders/${o.id}`}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 outline-none transition hover:border-primary-300 hover:bg-primary-50/30 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
