"use client";

import Link from "next/link";
import { CalendarClock, ExternalLink, FolderKanban, Layers, Send, Stamp, Tag, UserRound, Wallet } from "lucide-react";
import { Card, Chip } from "@/components/workspace/kit";
import { InfoList, InfoRow } from "@/suite/lms/components/ui/ws";
import { Figure, Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import type { MemoFull, MemoVoucherLink } from "@/lib/api/finance-spend-client";
import { RequestRoad, when } from "./ui";
import { memoType, nextStep, requestStage, voucherStatus } from "./labels";

/* The parts of a memo every view of it shows: figures and road, facts, vouchers. */

/** The money and the road, at the top of every view of a request. */
export function MemoSummaryCard({ memo: m }: { memo: MemoFull }) {
  const currency = m.currency ?? "NGN";
  return (
    <Card className="mb-5 p-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label="Asked for">
          <Money value={m.amount} currency={currency} />
        </Figure>
        <Figure label="Approved">{m.approvedAmount == null ? <span className="text-neutral-400">-</span> : <Money value={m.approvedAmount} currency={currency} />}</Figure>
        <Figure label="Paid" tone={m.paidAmount > 0 ? "in" : undefined}>
          <Money value={m.paidAmount} currency={currency} />
        </Figure>
        <Figure label="Still to pay">
          <Money value={m.balance} currency={currency} />
        </Figure>
      </dl>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <RequestRoad stage={requestStage(m)} />
      </div>
    </Card>
  );
}

/** What the request is: type, who asked, who is paid, what pays for it, when. */
export function MemoFacts({ memo: m, categories = {} }: { memo: MemoFull; categories?: Record<string, string> }) {
  return (
    <InfoList cols={2}>
      <InfoRow icon={Layers} label="Type" hue="grape">
        {memoType(m.type)}
      </InfoRow>
      <InfoRow icon={UserRound} label="Asked for by" hue="blue">
        {m.requester ?? "-"}
      </InfoRow>
      <InfoRow icon={Wallet} label="To be paid to" hue="mint">
        {m.payee ? (
          <>
            {m.payee.name ?? "-"}
            <span className="block text-xs font-normal text-neutral-500">{m.payee.kind === "vendor" ? "Vendor; bank details from the vendor register" : "Member of staff; bank details from their staff record"}</span>
          </>
        ) : (
          <span className="text-neutral-500">Not chosen yet</span>
        )}
      </InfoRow>
      <InfoRow icon={FolderKanban} label={m.projectId ? "Project" : "Cost centre"} hue="sky">
        {m.project ?? m.costCentre ?? <span className="text-neutral-500">Not chosen yet</span>}
      </InfoRow>
      <InfoRow icon={Tag} label="Cost category" hue="coral">
        {m.costCategory ? (categories[m.costCategory] ?? m.costCategory) : "-"}
      </InfoRow>
      <InfoRow icon={CalendarClock} label="Needed by" hue="sun">
        {m.neededBy ? day(m.neededBy) : "-"}
      </InfoRow>
      <InfoRow icon={Send} label="Sent" hue="slate">
        {m.submittedAt ? when(m.submittedAt) : "Not sent yet"}
      </InfoRow>
      <InfoRow icon={Stamp} label="Approval" hue="grape">
        {m.approvalId ? (
          <Link href={`/suite/approvals/${m.approvalId}`} className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
            See the approval trail <ExternalLink size={13} aria-hidden />
          </Link>
        ) : (
          "Not sent for approval yet"
        )}
      </InfoRow>
    </InfoList>
  );
}

/** The voucher(s) paying a request; linked when the reader may open vouchers. */
export function VoucherLinks({ vouchers, linkable, currency = "NGN" }: { vouchers: MemoVoucherLink[]; linkable: boolean; currency?: string }) {
  if (vouchers.length === 0) return <p className="text-sm text-neutral-500">No payment voucher yet. Finance prepares one once the FCU has cleared the request.</p>;
  return (
    <ul className="divide-y divide-neutral-100">
      {vouchers.map((v) => {
        const s = voucherStatus(v.status);
        const title = v.pvNo ?? "Draft voucher";
        return (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              {linkable ? (
                <Link href={`/suite/finance/vouchers/${v.id}`} className="font-semibold text-primary-700 hover:underline">
                  {title}
                </Link>
              ) : (
                <span className="font-semibold text-neutral-900">{title}</span>
              )}
              <span className="block text-xs text-neutral-500">
                Pays <Money value={v.amount} currency={currency} /> of this request
              </span>
            </span>
            <Chip hue={s.hue} dot>
              {s.label}
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}

/** "What happens next", said once, near the top. */
export function NextStepBanner({ memo }: { memo: MemoFull }) {
  const n = nextStep(memo);
  if (n.who !== "you") return null;
  return (
    <p role="status" className="mb-5 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700">
      Next: {n.text.charAt(0).toLowerCase() + n.text.slice(1)}.
    </p>
  );
}
