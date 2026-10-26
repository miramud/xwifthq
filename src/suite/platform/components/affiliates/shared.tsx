"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Check, Copy, HandCoins, RotateCcw, Undo2, Wallet } from "lucide-react";
import { Button, Card, Chip, Empty } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, labelClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import {
  ApiError,
  percentText,
  platformAffiliates,
  type AffiliateStatus,
  type Commission,
  type CommissionStatus,
  type Payout,
  type Referral,
} from "@/lib/api/affiliate-client";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { formatDate } from "../ui";

/*
  Pieces the affiliate pages share: status chips, money kept per currency,
  the commission and payout tables, and the two things the platform does to
  a commission by hand (approve it early, reverse it with a reason).
*/

export const AFFILIATES_HREF = "/suite/platform/affiliates";

export function affiliateHref(id: string): string {
  return `${AFFILIATES_HREF}/${encodeURIComponent(id)}`;
}

export function organisationHref(slug: string): string {
  return `/suite/platform/organisations/${encodeURIComponent(slug)}`;
}

/* ------------------------------------------------------------------ */
/*  Statuses                                                           */
/* ------------------------------------------------------------------ */

export const AFFILIATE_STATUS: Record<AffiliateStatus, { label: string; hue: Hue }> = {
  pending: { label: "Applied", hue: "sun" },
  approved: { label: "Active", hue: "mint" },
  suspended: { label: "Suspended", hue: "rose" },
  rejected: { label: "Not accepted", hue: "slate" },
};

export function AffiliateStatusChip({ status, label }: { status: AffiliateStatus | string; label?: string }) {
  const s = AFFILIATE_STATUS[status as AffiliateStatus] ?? { label: label ?? status, hue: "slate" as Hue };
  return (
    <Chip hue={s.hue} dot>
      {s.label}
    </Chip>
  );
}

export const COMMISSION_STATUS: Record<CommissionStatus, { label: string; hue: Hue }> = {
  pending: { label: "On hold", hue: "sun" },
  approved: { label: "Ready to pay", hue: "sky" },
  paid: { label: "Paid", hue: "mint" },
  reversed: { label: "Reversed", hue: "slate" },
};

export function CommissionStatusChip({ commission }: { commission: Commission }) {
  const s = COMMISSION_STATUS[commission.status] ?? { label: commission.statusLabel, hue: "slate" as Hue };
  return (
    <Chip hue={s.hue} dot>
      {s.label}
    </Chip>
  );
}

export function ReferralStatusChip({ referral }: { referral: Referral }) {
  return (
    <Chip hue={referral.status === "paying" ? "mint" : "sky"} dot>
      {referral.status === "paying" ? "Paying" : "Signed up"}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/*  Money per currency                                                 */
/* ------------------------------------------------------------------ */

/**
 * "₦120,000 · $40": one figure per currency, never added together. Zero
 * amounts are left out; nothing at all reads "-".
 */
export function moneyList(byCurrency: Record<string, number> | null | undefined, compact = false): string {
  const parts = Object.entries(byCurrency ?? {})
    .filter(([, minor]) => minor > 0)
    .map(([currency, minor]) => (compact ? formatMoneyCompact(minor, currency) : formatMoney(minor, currency)));
  return parts.length ? parts.join(" · ") : "-";
}

/** One status's amount per currency, out of the earnings breakdown. */
export function earningsFor(
  earnings: Record<string, Record<CommissionStatus, number>> | null | undefined,
  status: CommissionStatus,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [currency, byStatus] of Object.entries(earnings ?? {})) out[currency] = byStatus?.[status] ?? 0;
  return out;
}

/** `yyyy-mm-dd` for today in the browser's own time zone, for date inputs. */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The first message for each field of a 422, keyed by field name. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.errors) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.errors)) if (v?.[0]) out[k] = v[0];
  return out;
}

/* ------------------------------------------------------------------ */
/*  Copy                                                               */
/* ------------------------------------------------------------------ */

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span aria-live="polite">
      <Button icon={copied ? Check : Copy} onClick={() => void copy()} aria-label={label}>
        <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
      </Button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Commission actions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Approve a held commission early, or reverse one with a reason. Returns the
 * two handlers and the reverse dialog to render; `onChanged` gets the updated
 * row and a line to confirm what happened.
 */
export function useCommissionActions({
  onChanged,
  onError,
}: {
  onChanged: (row: Commission, message: string) => void;
  onError: (message: string) => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [reversing, setReversing] = useState<Commission | null>(null);

  async function approve(c: Commission) {
    const ok = await confirm({
      title: "Make this commission ready to pay now?",
      body: `${formatMoney(c.amountMinor, c.currency)} on ${c.organisation?.name ?? "this organisation"}'s payment skips the rest of its hold and can go in the next payout.`,
      confirmLabel: "Approve now",
      tone: "primary",
      icon: BadgeCheck,
    });
    if (!ok) return;
    setBusy(c.id);
    try {
      const row = await platformAffiliates.approveCommission(c.id);
      onChanged(row, `${formatMoney(row.amountMinor, row.currency)} is ready to pay.`);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That commission wasn't approved.");
    } finally {
      setBusy(null);
    }
  }

  const dialog = reversing ? (
    <ReverseDialog
      commission={reversing}
      onClose={() => setReversing(null)}
      onReversed={(row) => {
        setReversing(null);
        onChanged(row, `${formatMoney(row.amountMinor, row.currency)} is reversed.`);
      }}
    />
  ) : null;

  return { approve, reverse: setReversing, busy, dialog };
}

function ReverseDialog({
  commission,
  onClose,
  onReversed,
}: {
  commission: Commission;
  onClose: () => void;
  onReversed: (row: Commission) => void;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reason = note.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setErrors({ note: "Say why it's being reversed." });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onReversed(await platformAffiliates.reverseCommission(commission.id, reason));
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err instanceof ApiError ? err.message : "That commission wasn't reversed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${id}-title`}
      title="Reverse this commission?"
      subtitle={`${formatMoney(commission.amountMinor, commission.currency)} on ${commission.organisation?.name ?? "an organisation"}'s payment`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" icon={Undo2} disabled={saving || !reason}>
            {saving ? "Reversing…" : "Reverse commission"}
          </Button>
        </div>
      }
    >
      {commission.status === "paid" && (
        <p role="note" className="flex items-start gap-3 rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            This commission was already paid out
            {commission.payout ? ` in ${commission.payout.reference} on ${formatDate(commission.payout.paidOn)}` : ""}.
            Reversing it here doesn&apos;t get that money back from the affiliate.
          </span>
        </p>
      )}
      <p className="text-sm text-neutral-600">
        A reversed commission is never paid. The affiliate sees it as reversed, with your reason.
      </p>
      <div>
        <label htmlFor={`${id}-note`} className={labelClass}>
          Reason <span className="text-error-600">*</span>
        </label>
        <textarea
          id={`${id}-note`}
          rows={3}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setErrors({});
          }}
          aria-invalid={Boolean(errors.note)}
          aria-describedby={errors.note ? `${id}-note-error` : undefined}
          className={textareaClass}
          placeholder="Payment refunded on 12 Oct"
        />
        {errors.note && (
          <p id={`${id}-note-error`} className="mt-1.5 text-xs font-medium text-error-700">
            {errors.note}
          </p>
        )}
      </div>
      {error && !errors.note && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Commissions table                                                  */
/* ------------------------------------------------------------------ */

const money = (minor: number, currency: string) => (
  <span className="whitespace-nowrap tabular-nums">{formatMoney(minor, currency)}</span>
);

export function CommissionsTable({
  rows,
  showAffiliate = false,
  canManage,
  busy,
  onApprove,
  onReverse,
  storageKey,
  empty,
}: {
  rows: Commission[];
  showAffiliate?: boolean;
  canManage: boolean;
  busy?: string | null;
  onApprove: (c: Commission) => void;
  onReverse: (c: Commission) => void;
  storageKey: string;
  empty?: React.ReactNode;
}) {
  const columns: Column<Commission>[] = [
    {
      key: "organisation",
      header: "Organisation",
      primary: true,
      value: (c) => c.organisation?.name ?? "",
      render: (c) => (
        <span className="block min-w-0">
          {c.organisation?.slug ? (
            <Link href={organisationHref(c.organisation.slug)} className="font-semibold text-neutral-900 hover:text-primary-700 hover:underline">
              {c.organisation.name}
            </Link>
          ) : (
            <span className="font-semibold text-neutral-900">{c.organisation?.name ?? "-"}</span>
          )}
          <span className="block text-xs text-neutral-500">
            {c.sourceLabel}
            {c.sourceReference ? ` · ${c.sourceReference}` : ""}
          </span>
        </span>
      ),
    },
    ...(showAffiliate
      ? [
          {
            key: "affiliate",
            header: "Affiliate",
            value: (c: Commission) => c.affiliate?.name ?? "",
            render: (c: Commission) =>
              c.affiliate ? (
                <Link href={affiliateHref(c.affiliate.id)} className="font-medium text-primary-700 hover:underline">
                  {c.affiliate.name}
                  {c.affiliate.code && <span className="ml-1 font-mono text-xs text-neutral-500">{c.affiliate.code}</span>}
                </Link>
              ) : (
                "-"
              ),
          } satisfies Column<Commission>,
        ]
      : []),
    { key: "paid", header: "Paid", align: "right", hideOnMobile: true, value: (c) => c.paidMinor, render: (c) => money(c.paidMinor, c.currency) },
    {
      key: "discount",
      header: "Discount",
      align: "right",
      hideOnMobile: true,
      value: (c) => c.discountMinor,
      render: (c) => (c.discountMinor > 0 ? money(c.discountMinor, c.currency) : "-"),
    },
    { key: "base", header: "Base", align: "right", hideOnMobile: true, value: (c) => c.baseMinor, render: (c) => money(c.baseMinor, c.currency) },
    { key: "rate", header: "Rate", align: "right", hideOnMobile: true, value: (c) => c.ratePercent, render: (c) => percentText(c.ratePercent) },
    {
      key: "amount",
      header: "Commission",
      align: "right",
      sortable: true,
      value: (c) => c.amountMinor,
      render: (c) => <span className="font-semibold text-neutral-900">{money(c.amountMinor, c.currency)}</span>,
    },
    {
      key: "status",
      header: "Status",
      value: (c) => c.status,
      render: (c) => (
        <span className="block">
          <CommissionStatusChip commission={c} />
          {c.status === "reversed" && c.reversalNote && (
            <span className="mt-1 block max-w-48 text-xs text-neutral-500">{c.reversalNote}</span>
          )}
        </span>
      ),
    },
    {
      key: "earned",
      header: "Earned on",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.earnedAt,
      render: (c) => <span className="whitespace-nowrap">{formatDate(c.earnedAt)}</span>,
    },
    {
      key: "ready",
      header: "Ready on",
      hideOnMobile: true,
      value: (c) => c.availableAt,
      render: (c) => <span className="whitespace-nowrap">{c.status === "reversed" ? "-" : formatDate(c.availableAt)}</span>,
    },
    {
      key: "payout",
      header: "Payout",
      hideOnMobile: true,
      value: (c) => c.payout?.reference ?? "",
      render: (c) =>
        c.payout ? (
          <span className="whitespace-nowrap text-xs">
            <span className="font-mono text-neutral-800">{c.payout.reference}</span>
            <span className="block text-neutral-500">{formatDate(c.payout.paidOn)}</span>
          </span>
        ) : (
          "-"
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            render: (c: Commission) => (
              <span className="flex flex-wrap gap-2">
                {c.status === "pending" && (
                  <Button icon={BadgeCheck} disabled={busy === c.id} onClick={() => onApprove(c)} aria-label={`Approve now: ${formatMoney(c.amountMinor, c.currency)} on ${c.organisation?.name ?? "this payment"}`}>
                    Approve now
                  </Button>
                )}
                {c.status !== "reversed" && (
                  <Button variant="ghost" icon={RotateCcw} disabled={busy === c.id} onClick={() => onReverse(c)} aria-label={`Reverse: ${formatMoney(c.amountMinor, c.currency)} on ${c.organisation?.name ?? "this payment"}`}>
                    Reverse
                  </Button>
                )}
              </span>
            ),
          } satisfies Column<Commission>,
        ]
      : []),
  ];

  return (
    <DataView
      rows={rows}
      columns={columns}
      rowKey={(c) => c.id}
      storageKey={storageKey}
      caption="Commissions"
      searchable={false}
      views={["table", "list"]}
      empty={
        empty ?? (
          <Card>
            <Empty icon={HandCoins} title="No commissions yet" hint="A commission is earned when a referred organisation makes its first payment." />
          </Card>
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Payouts table                                                      */
/* ------------------------------------------------------------------ */

export function PayoutsTable({
  rows,
  showAffiliate = false,
  storageKey,
  empty,
}: {
  rows: Payout[];
  showAffiliate?: boolean;
  storageKey: string;
  empty?: React.ReactNode;
}) {
  const columns: Column<Payout>[] = [
    {
      key: "paidOn",
      header: "Paid on",
      sortable: true,
      value: (p) => p.paidOn,
      render: (p) => <span className="whitespace-nowrap">{formatDate(p.paidOn)}</span>,
    },
    ...(showAffiliate
      ? [
          {
            key: "affiliate",
            header: "Affiliate",
            primary: true,
            value: (p: Payout) => p.affiliate?.name ?? "",
            render: (p: Payout) =>
              p.affiliate ? (
                <Link href={affiliateHref(p.affiliate.id)} className="font-semibold text-neutral-900 hover:text-primary-700 hover:underline">
                  {p.affiliate.name}
                  {p.affiliate.code && <span className="ml-1 font-mono text-xs font-normal text-neutral-500">{p.affiliate.code}</span>}
                </Link>
              ) : (
                "-"
              ),
          } satisfies Column<Payout>,
        ]
      : []),
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      primary: !showAffiliate,
      value: (p) => p.amountMinor,
      render: (p) => <span className="font-semibold text-neutral-900">{money(p.amountMinor, p.currency)}</span>,
    },
    { key: "method", header: "Method", value: (p) => p.methodLabel },
    {
      key: "paymentReference",
      header: "Payment reference",
      hideOnMobile: true,
      value: (p) => p.paymentReference ?? "",
      render: (p) => (
        <span className="block">
          {p.paymentReference ?? "-"}
          {p.note && <span className="block max-w-56 text-xs text-neutral-500">{p.note}</span>}
        </span>
      ),
    },
    {
      key: "count",
      header: "Commissions",
      align: "right",
      hideOnMobile: true,
      value: (p) => p.commissionCount,
    },
    { key: "recordedBy", header: "Recorded by", hideOnMobile: true, value: (p) => p.recordedBy ?? "" },
    {
      key: "reference",
      header: "Our reference",
      hideOnMobile: true,
      value: (p) => p.reference,
      render: (p) => <span className="font-mono text-xs text-neutral-700">{p.reference}</span>,
    },
  ];

  return (
    <DataView
      rows={rows}
      columns={columns}
      rowKey={(p) => p.id}
      storageKey={storageKey}
      caption="Payouts"
      searchable={false}
      views={["table", "list"]}
      empty={
        empty ?? (
          <Card>
            <Empty icon={Wallet} title="No payouts yet" hint="Payouts you record show here, with the commissions each one settled." />
          </Card>
        )
      }
    />
  );
}
