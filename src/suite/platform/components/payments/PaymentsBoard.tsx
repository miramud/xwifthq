"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, CheckCircle2, CircleDashed, FileQuestion, Gavel, RefreshCw, Scale, Wallet } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Segmented, StatGrid, Toolbar, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, StatCard, labelClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { LICENCE_METHOD_LABEL, type LicencePaymentMethod, type Paginated } from "@/lib/api/platform-client";
import {
  ApiError,
  minorOf,
  platformPayments,
  type Payment,
  type PaymentKind,
  type PaymentStatus,
  type PaymentSummary,
  type Resolution,
} from "@/lib/api/platform-commerce-client";
import { gatewayLabel } from "@/lib/api/platform-billing-client";
import { formatMoney } from "@/lib/money";
import { MODULE_LABEL, type SuiteModuleKey } from "@/lib/module-access";
import { useAuth } from "@/lib/auth-store";
import { canPlatform, PERM } from "@/suite/platform/access";
import { LoadError, ModuleChip, nairaCompact, Notice, Pager, When } from "../ui";

type Tab = PaymentStatus | "all";

const STATUS: Record<PaymentStatus, { label: string; hue: "mint" | "sun" | "rose" | "grape"; icon: typeof Wallet; hint: string }> = {
  matched: { label: "Matched", hue: "mint", icon: CheckCircle2, hint: "Gateway and record agree" },
  pending: { label: "Pending", hue: "sun", icon: CircleDashed, hint: "Expected, not yet confirmed" },
  mismatch: { label: "Mismatch", hue: "rose", icon: Scale, hint: "Both exist but disagree" },
  orphan: { label: "Orphan", hue: "grape", icon: FileQuestion, hint: "Money with no order" },
};

/** Unknown statuses from a newer API render as themselves rather than crashing the row. */
function statusOf(s: string) {
  return STATUS[s as PaymentStatus] ?? { label: s, hue: "grape" as const, icon: FileQuestion, hint: "" };
}

/** The gateway a payment went through; older rows only carry `provider`. */
export function gatewayOf(p: Payment): string {
  return p.gateway ?? p.provider;
}

function kindLabel(kind: string): string {
  if (kind === "module") return "Modules";
  if (kind === "licence") return "Module licence";
  if (kind === "signup") return "New organisation";
  if (kind === "seats") return "Seats";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function moduleName(key: string): string {
  return MODULE_LABEL[key as SuiteModuleKey] ?? key.toUpperCase();
}

const GATEWAYS = [
  { key: "", label: "All gateways" },
  { key: "flutterwave", label: "Flutterwave" },
  { key: "paystack", label: "Paystack" },
];

const KINDS: { key: PaymentKind | ""; label: string }[] = [
  { key: "", label: "Everything" },
  { key: "module", label: "Modules" },
  { key: "seats", label: "Seats" },
  { key: "signup", label: "New organisations" },
  { key: "licence", label: "Licences" },
];

/**
 * A licence is money the owner recorded by hand: there is no gateway to ask
 * (the API refuses to verify one) and it is matched the moment it is recorded.
 */
const isLicence = (p: Payment) => p.kind === "licence";

function methodLabel(m: string | null | undefined): string {
  if (!m) return "Method not recorded";
  return LICENCE_METHOD_LABEL[m as LicencePaymentMethod] ?? m;
}

/** Expected and received in minor units, whichever fields the row carries. */
function amounts(p: Payment): { expected: number | null; received: number | null; currency: string } {
  return {
    expected: minorOf(p.expectedMinor, p.expectedKobo),
    received: minorOf(p.receivedMinor ?? null, p.receivedKobo ?? null),
    currency: p.currency ?? "NGN",
  };
}

const RESOLUTIONS: { key: Resolution; label: string; help: string }[] = [
  { key: "mark_paid", label: "Mark as paid", help: "The money arrived. The order is fulfilled as if the gateway confirmed it." },
  { key: "mark_failed", label: "Mark as failed", help: "No money arrived. The order is closed and nothing it bought is granted." },
  { key: "ignore", label: "Ignore", help: "Leave the order as it is and take the row off the queue — for test payments and duplicates." },
];

/**
 * Reconciling what the gateways say against what the platform recorded.
 *
 * Payments go through Paystack or Flutterwave, whichever checkout used at the
 * time; each row is verified with its own gateway, not the one selected now.
 * The queue is everything that is not `matched`. Verify asks the gateway again,
 * which settles most pending rows on its own. What it can't settle a person
 * resolves, always with a note, because a resolution changes what an
 * organisation or learner is entitled to and somebody will ask why.
 */
function isKind(v: string | null | undefined): v is PaymentKind {
  return v === "module" || v === "seats" || v === "signup" || v === "licence";
}

export default function PaymentsBoard() {
  const { user } = useAuth();
  // `?kind=signup` from the overview's onboarding alert opens on that kind.
  const initialKind = useSearchParams()?.get("kind");
  const canReconcile = canPlatform(user, PERM.paymentsReconcile);

  const [tab, setTab] = useState<Tab>("pending");
  const [page, setPage] = useState(1);
  const [gateway, setGateway] = useState("");
  const [kind, setKind] = useState<PaymentKind | "">(isKind(initialKind) ? initialKind : "");
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [data, setData] = useState<Paginated<Payment> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Payment | null>(null);

  const loadSummary = useCallback(() => {
    platformPayments.summary().then(setSummary).catch(() => setSummary(null));
  }, []);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    platformPayments
      .list({ status: tab === "all" ? "" : tab, gateway: gateway || undefined, kind, page, perPage: 20 })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Payments didn't load."));
  }, [tab, gateway, kind, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    load();
  }, [load]);

  function replace(updated: Payment) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            // A row that has left this tab's status leaves this tab's list.
            data: prev.data
              .map((p) => (p.id === updated.id ? updated : p))
              .filter((p) => tab === "all" || p.status === tab),
          }
        : prev,
    );
    loadSummary();
  }

  async function verify(p: Payment) {
    setVerifying(p.id);
    setRowError(null);
    try {
      const updated = await platformPayments.verify(p.id);
      replace(updated);
      const via = gatewayLabel(gatewayOf(p));
      setNotice(
        updated.status === "matched"
          ? `${p.reference} is confirmed by ${via} and matched.`
          : `${via} still reports ${p.reference} as ${statusOf(updated.status).label.toLowerCase()}.`,
      );
    } catch (e) {
      setRowError({
        id: p.id,
        message: e instanceof ApiError ? e.message : `${gatewayLabel(gatewayOf(p))} didn't answer. Try again shortly.`,
      });
    } finally {
      setVerifying(null);
    }
  }

  const columns: Column<Payment>[] = [
    {
      key: "reference",
      header: "Payment",
      primary: true,
      value: (p) => p.reference,
      render: (p) => (
        <span className="min-w-0">
          <span className="block truncate font-mono text-xs font-semibold text-neutral-900">{p.reference}</span>
          <span className="block text-xs text-neutral-500">
            {kindLabel(p.kind)}
            {isLicence(p) && p.purchaseKind && ` · ${p.purchaseKind === "upgrade" ? "Upgrade" : "New purchase"}`}
            {isLicence(p) && typeof p.modulesAfter === "number" && ` · ${p.modulesAfter} modules after`}
          </span>
          {(p.kind === "module" || isLicence(p)) && p.modules && p.modules.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1" aria-label="Modules paid for">
              {p.modules.map((m) => (
                <ModuleChip key={m} moduleKey={m} label={moduleName(m)} />
              ))}
            </span>
          )}
          {rowError?.id === p.id && (
            <span role="alert" className="mt-1 block text-xs text-error-700">
              {rowError.message}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "gateway",
      header: "Gateway",
      value: (p) => (isLicence(p) ? "by hand" : gatewayOf(p)),
      render: (p) =>
        isLicence(p) ? (
          <Chip hue="grape" icon={BadgeCheck}>
            Licensed by hand
          </Chip>
        ) : (
          <Chip hue={gatewayOf(p) === "flutterwave" ? "sun" : "sky"} dot>
            {gatewayLabel(gatewayOf(p))}
          </Chip>
        ),
    },
    {
      key: "organisation",
      header: "Organisation",
      hideOnMobile: true,
      value: (p) => p.organisation?.name ?? p.signup?.organisationName ?? "",
      render: (p) =>
        p.kind === "signup" && !p.organisation && p.signup ? (
          <span className="min-w-0">
            <span className="block truncate text-neutral-900">{p.signup.organisationName}</span>
            <span className="block truncate text-xs text-neutral-500">
              Onboarding · {p.signup.name} · {p.signup.email}
            </span>
          </span>
        ) : p.organisation ? (
          <Link
            href={`/suite/platform/organisations/${encodeURIComponent(p.organisation.slug)}`}
            className="text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            {p.organisation.name}
          </Link>
        ) : (
          <span className="text-neutral-500">Marketplace</span>
        ),
    },
    {
      key: "amount",
      header: "Expected / received",
      align: "right",
      value: (p) => amounts(p).expected ?? 0,
      render: (p) => {
        const { expected, received, currency } = amounts(p);
        const differs = received !== null && received !== expected;
        return (
          <span className="tabular-nums">
            <span className="block font-semibold text-neutral-900">{formatMoney(expected, currency)}</span>
            <span className={cx("block text-xs", differs ? "font-semibold text-error-700" : "text-neutral-500")}>
              {received === null ? "Nothing received" : differs ? `Received ${formatMoney(received, currency)}` : "Received in full"}
            </span>
          </span>
        );
      },
    },
    {
      key: "seen",
      header: "Confirmation",
      hideOnMobile: true,
      value: (p) => (isLicence(p) ? `${p.paymentMethod ?? ""} ${p.paymentReference ?? ""}` : (p.webhookAt ?? "")),
      render: (p) =>
        isLicence(p) ? (
          <span className="min-w-0 text-xs text-neutral-600">
            <span className="block font-medium text-neutral-800">{methodLabel(p.paymentMethod)}</span>
            <span className="block truncate font-mono">{p.paymentReference ?? "No reference"}</span>
            <span className="block">Recorded by {p.recordedBy ?? "—"}</span>
          </span>
        ) : (
          <span className="text-xs text-neutral-600">
            <span className="block">
              Webhook <When at={p.webhookAt} />
            </span>
            <span className="block">
              Verified <When at={p.verifiedAt} />
            </span>
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      value: (p) => p.status,
      render: (p) => {
        const s = statusOf(p.status);
        return (
          <span className="space-y-1">
            <Chip hue={s.hue} icon={s.icon}>
              {s.label}
            </Chip>
            {p.note && <span className="block max-w-[14rem] truncate text-xs text-neutral-500" title={p.note}>{p.note}</span>}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) =>
        p.status === "matched" ? null : (
          <span className="flex justify-end gap-2">
            {/* A licence has no gateway to ask; the API refuses to verify one. */}
            {!isLicence(p) && (
              <Button size="sm" icon={RefreshCw} disabled={verifying === p.id} onClick={() => verify(p)}>
                {verifying === p.id ? "Checking…" : `Verify with ${gatewayLabel(gatewayOf(p))}`}
              </Button>
            )}
            {canReconcile && (
              <Button size="sm" icon={Gavel} onClick={() => setResolving(p)}>
                Resolve
              </Button>
            )}
          </span>
        ),
    },
  ];

  const tabs = [
    { key: "pending", label: "Pending", count: summary?.pending },
    { key: "mismatch", label: "Mismatch", count: summary?.mismatch },
    { key: "orphan", label: "Orphan", count: summary?.orphan },
    { key: "matched", label: "Matched", count: summary?.matched },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commerce"
        title="Payments"
        subtitle="What Paystack and Flutterwave reported against what the platform recorded, licences recorded by hand, and the queue of what doesn't agree."
        tabs={tabs}
        activeTab={tab}
        onTab={(k) => {
          setTab(k as Tab);
          setPage(1);
          setRowError(null);
        }}
      />

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {summary && (
        <StatGrid cols={4}>
          <StatCard
            featured
            featuredHue="rose"
            icon={Wallet}
            label="Unreconciled"
            value={nairaCompact(summary.unreconciledKobo)}
            hint={`${summary.pending + summary.mismatch + summary.orphan} payments to look at`}
          />
          {(["pending", "mismatch", "orphan"] as const).map((k) => (
            <StatCard key={k} icon={STATUS[k].icon} hue={STATUS[k].hue} label={STATUS[k].label} value={summary[k]} hint={STATUS[k].hint} />
          ))}
        </StatGrid>
      )}

      <Toolbar>
        <Segmented
          label="What was paid for"
          value={kind}
          onChange={(v) => {
            setKind(v);
            setPage(1);
          }}
          options={KINDS}
        />
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span aria-hidden className="hidden sm:inline">
            Gateway
          </span>
          <SearchableSelect
            value={gateway}
            onChange={(v) => {
              setGateway(v);
              setPage(1);
            }}
            aria-label="Gateway"
            size="sm"
            className="w-44"
            options={GATEWAYS.map((g) => ({ value: g.key, label: g.label }))}
          />
        </div>
      </Toolbar>

      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : !data ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <DataView
            rows={data.data}
            columns={columns}
            rowKey={(p) => p.id}
            storageKey="platform.payments"
            caption="Payments"
            searchPlaceholder="Search by reference or organisation…"
            empty={
              <Card>
                <Empty
                  icon={CheckCircle2}
                  hue="mint"
                  title={tab === "matched" || tab === "all" ? "No payments yet" : "Nothing to reconcile here"}
                  hint={tab === "matched" || tab === "all" ? "Payments appear as organisations and learners pay." : "Every payment in this state has been settled."}
                />
              </Card>
            }
          />
          <Pager page={data.meta.currentPage} lastPage={data.meta.lastPage} total={data.meta.total} onPage={setPage} noun="payments" />
        </>
      )}

      {resolving && (
        <ResolveDialog
          payment={resolving}
          onClose={() => setResolving(null)}
          onResolved={(updated, resolution) => {
            setResolving(null);
            replace(updated);
            setNotice(`${updated.reference} ${RESOLUTIONS.find((r) => r.key === resolution)?.label.toLowerCase().replace("mark as", "marked as") ?? "resolved"}.`);
          }}
        />
      )}
    </div>
  );
}

/** Settling one payment by hand. The note is required: it is the audit trail. */
export function ResolveDialog({
  payment,
  onClose,
  onResolved,
}: {
  payment: Payment;
  onClose: () => void;
  onResolved: (updated: Payment, resolution: Resolution) => void;
}) {
  const confirm = useConfirm();
  const id = useId();
  const [resolution, setResolution] = useState<Resolution>("mark_paid");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noteOk = note.trim().length >= 5;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!noteOk || saving) return;

    if (resolution !== "mark_paid") {
      const ok = await confirm(
        resolution === "mark_failed"
          ? {
              title: `Mark ${payment.reference} as failed?`,
              body: "The order closes and nothing it paid for is granted. If money did arrive, it will need a refund outside the platform.",
              confirmLabel: "Mark as failed",
            }
          : {
              title: `Ignore ${payment.reference}?`,
              body: "It leaves the reconciliation queue as it is. The payment and your note stay on record.",
              confirmLabel: "Ignore payment",
            },
      );
      if (!ok) return;
    }

    setSaving(true);
    setError(null);
    try {
      onResolved(await platformPayments.resolve(payment.id, resolution, note.trim()), resolution);
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "That payment wasn't resolved.");
    }
  }

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${id}-title`}
      title={`Resolve ${payment.reference}`}
      subtitle={(() => {
        const { expected, received, currency } = amounts(payment);
        return `${formatMoney(expected, currency)} expected · ${received === null ? "nothing received" : `${formatMoney(received, currency)} received`}`;
      })()}
      onClose={onClose}
      footer={
        <div className="space-y-3">
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant={resolution === "mark_paid" ? "primary" : "danger"} disabled={!noteOk || saving}>
              {saving ? "Saving…" : RESOLUTIONS.find((r) => r.key === resolution)?.label}
            </Button>
          </div>
        </div>
      }
    >
      <fieldset>
        <legend className={labelClass}>Resolution</legend>
        <div className="space-y-2">
          {RESOLUTIONS.map((r) => (
            <label
              key={r.key}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                resolution === r.key ? "border-primary-300 bg-primary-50/60" : "border-neutral-200 hover:bg-neutral-50",
              )}
            >
              <input
                type="radio"
                name={`${id}-resolution`}
                value={r.key}
                checked={resolution === r.key}
                onChange={() => setResolution(r.key)}
                className="mt-0.5 h-4 w-4 text-primary-600 focus:ring-2 focus:ring-primary-500"
              />
              <span>
                <span className="block text-sm font-semibold text-neutral-900">{r.label}</span>
                <span className="block text-xs text-neutral-500">{r.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-note`} className={labelClass}>
          Note <span className="text-error-600">*</span>
        </label>
        <textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required
          aria-describedby={`${id}-note-help`}
          className={textareaClass}
          placeholder="e.g. Bank statement shows ₦250,000 received on 24 Sep, ref 9912…"
        />
        <p id={`${id}-note-help`} className="mt-1.5 text-xs text-neutral-500">
          Required. Say what you checked — it is kept with the payment and in the audit log.
        </p>
      </div>
    </DialogFrame>
  );
}
