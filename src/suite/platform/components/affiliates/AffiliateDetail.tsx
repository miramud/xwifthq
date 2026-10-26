"use client";

import { useCallback, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CalendarDays,
  Check,
  Globe2,
  HandCoins,
  Landmark,
  Mail,
  MapPin,
  MousePointerClick,
  Phone,
  RotateCcw,
  Building2,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { Button, Card, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useAuth } from "@/lib/auth-store";
import {
  BackLink,
  ErrorNote,
  hintClass,
  InfoList,
  InfoRow,
  inputClass,
  labelClass,
  StatCard,
  textareaClass,
} from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import {
  ApiError,
  PAYOUT_METHODS,
  percentText,
  platformAffiliates,
  type Commission,
  type PayoutMethod,
  type PlatformAffiliate,
  type PlatformAffiliateDetail,
  type Referral,
} from "@/lib/api/affiliate-client";
import { formatMoney } from "@/lib/money";
import { canPlatform, PERM } from "@/suite/platform/access";
import { formatDate, LoadError, Notice, PageSkeleton, useLoad } from "../ui";
import {
  AFFILIATES_HREF,
  AffiliateStatusChip,
  CommissionsTable,
  CopyButton,
  earningsFor,
  fieldErrors,
  moneyList,
  organisationHref,
  PayoutsTable,
  ReferralStatusChip,
  todayISO,
  useCommissionActions,
} from "./shared";

/**
 * One affiliate, from the platform's side.
 *
 * An application is decided here (approve, with an optional code of our
 * choosing, or turn down), an affiliate is suspended or reinstated here, and
 * this is the only place a payout is recorded: the amount is always the sum
 * of the ready commissions it settles, never a typed figure, so what was paid
 * and what was owed can't drift apart.
 */
export default function AffiliateDetail({ affiliateId }: { affiliateId: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const allowed = canPlatform(user, PERM.affiliatesView);
  const canManage = canPlatform(user, PERM.affiliatesManage);

  const fetchDetail = useCallback(() => platformAffiliates.get(affiliateId), [affiliateId]);
  const { data, error, reload, setData } = useLoad(fetchDetail, "That affiliate didn't load.");

  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"approve" | "reject" | "suspend" | "payout" | null>(null);
  const [busy, setBusy] = useState(false);

  const commissionActions = useCommissionActions({
    onChanged: (row, message) => {
      setData((d) => (d ? { ...d, commissions: d.commissions.map((c) => (c.id === row.id ? row : c)) } : d));
      setNotice(message);
      // Stats move with every commission, so read them again.
      reload();
    },
    onError: setActionError,
  });

  const affiliate = data?.affiliate ?? null;

  /** A decision came back with the updated affiliate. */
  const decided = (updated: PlatformAffiliate, message: string) => {
    setDialog(null);
    setData((d) => (d ? { ...d, affiliate: { ...d.affiliate, ...updated } } : d));
    setNotice(message);
    reload();
  };

  async function reinstate() {
    if (!affiliate) return;
    const ok = await confirm({
      title: `Reinstate ${affiliate.name}?`,
      body: "Their link earns commission and gives the referral discount again.",
      confirmLabel: "Reinstate",
      tone: "primary",
      icon: RotateCcw,
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      decided(await platformAffiliates.reinstate(affiliate.id), `${affiliate.name} is active again.`);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : `${affiliate.name} wasn't reinstated.`);
    } finally {
      setBusy(false);
    }
  }

  const actions =
    affiliate && canManage ? (
      affiliate.status === "pending" ? (
        <>
          <Button icon={X} onClick={() => setDialog("reject")}>
            Turn down
          </Button>
          <Button variant="primary" icon={Check} onClick={() => setDialog("approve")}>
            Approve
          </Button>
        </>
      ) : affiliate.status === "approved" ? (
        <Button icon={Ban} onClick={() => setDialog("suspend")}>
          Suspend
        </Button>
      ) : affiliate.status === "suspended" ? (
        <Button icon={RotateCcw} disabled={busy} onClick={() => void reinstate()}>
          Reinstate
        </Button>
      ) : undefined
    ) : undefined;

  const heading = (
    <>
      <BackLink href={AFFILIATES_HREF} label="All affiliates" />
      <PageHeader
        eyebrow="Affiliate"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{affiliate?.name ?? "Affiliate"}</span>
            {affiliate && <AffiliateStatusChip status={affiliate.status} label={affiliate.statusLabel} />}
          </span>
        }
        subtitle={affiliate?.email}
        actions={actions}
      />
    </>
  );

  if (user && !allowed) {
    return (
      <div>
        {heading}
        <Card>
          <Empty icon={UserCheck} title="You can't see the affiliate programme" hint="Ask a platform owner for access to affiliates." />
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        {heading}
        <LoadError message={error} onRetry={reload} />
      </div>
    );
  }

  if (!data || !affiliate) {
    return (
      <div>
        {heading}
        <PageSkeleton stats={4} rows={2} />
      </div>
    );
  }

  const ready = data.commissions.filter((c) => c.status === "approved");

  return (
    <div className="space-y-6">
      {heading}

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      {affiliate.code && (
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <div>
              <p className={labelClass}>Code</p>
              <div className="flex gap-2">
                <code className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 font-mono text-sm font-semibold text-neutral-900">
                  {affiliate.code}
                </code>
                <CopyButton value={affiliate.code} label="Copy code" />
              </div>
            </div>
            {affiliate.link && (
              <div className="min-w-0">
                <p className={labelClass}>Link</p>
                <div className="flex gap-2">
                  <code className="flex h-11 min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-xs text-neutral-800">
                    {affiliate.link}
                  </code>
                  <CopyButton value={affiliate.link} label="Copy link" />
                </div>
              </div>
            )}
          </div>
          {affiliate.status === "suspended" && (
            <p className="mt-3 text-sm text-rose-700">Suspended: this link doesn&apos;t earn commission or give the discount.</p>
          )}
        </Card>
      )}

      <ApplicationPanel affiliate={affiliate} />

      {data.stats && <Stats data={data} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Payout details" subtitle="Where they asked to be paid" icon={Landmark} hue="mint" bodyClassName="px-5 pb-3 pt-2">
          {affiliate.payoutDetails ? (
            <InfoList>
              <InfoRow icon={Landmark} label="Bank" hue="mint">
                {affiliate.payoutDetails.bankName}
              </InfoRow>
              <InfoRow icon={Wallet} label="Account number" hue="sky">
                <span className="font-mono tabular-nums">{affiliate.payoutDetails.accountNumber}</span>
              </InfoRow>
              <InfoRow icon={UserCheck} label="Account name" hue="grape">
                {affiliate.payoutDetails.accountName}
              </InfoRow>
            </InfoList>
          ) : (
            <p className="py-3 text-sm text-neutral-500">They haven&apos;t added payout details yet.</p>
          )}
        </Panel>

        <Panel
          className="xl:col-span-2"
          title="Ready to pay"
          subtitle="Commissions past their hold, waiting for a payout"
          icon={HandCoins}
          hue="sky"
          actions={
            canManage ? (
              <Button variant="primary" icon={Wallet} disabled={ready.length === 0} onClick={() => setDialog("payout")}>
                Record a payout
              </Button>
            ) : undefined
          }
        >
          <p className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900">
            {moneyList(sumByCurrency(ready))}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {ready.length === 0
              ? "Nothing is ready to pay yet. Commissions become ready when their hold ends, or when you approve one early."
              : `${ready.length} commission${ready.length === 1 ? "" : "s"} ready. A payout settles them and the affiliate sees it on their dashboard.`}
          </p>
        </Panel>
      </div>

      <section aria-labelledby="referrals-heading">
        <SectionTitle id="referrals-heading" title="Referrals" hint="Organisations that came through this affiliate" />
        <ReferralsTable rows={data.referrals} />
      </section>

      <section aria-labelledby="commissions-heading">
        <SectionTitle
          id="commissions-heading"
          title="Commissions"
          hint="Earned on each referred organisation's first payment, worked out on the price before the discount"
        />
        <CommissionsTable
          rows={data.commissions}
          canManage={canManage}
          busy={commissionActions.busy}
          onApprove={(c) => void commissionActions.approve(c)}
          onReverse={commissionActions.reverse}
          storageKey="platform.affiliate.commissions"
        />
      </section>

      <section aria-labelledby="payouts-heading">
        <SectionTitle id="payouts-heading" title="Payouts" hint="Money paid to this affiliate, recorded by hand" />
        <PayoutsTable rows={data.payouts} storageKey="platform.affiliate.payouts" />
      </section>

      {commissionActions.dialog}

      {dialog === "approve" && (
        <ApproveDialog affiliate={affiliate} onClose={() => setDialog(null)} onDone={decided} />
      )}
      {dialog === "reject" && (
        <NoteDialog
          kind="reject"
          affiliate={affiliate}
          onClose={() => setDialog(null)}
          onDone={(a) => decided(a, `${affiliate.name}'s application is turned down. They've been emailed.`)}
        />
      )}
      {dialog === "suspend" && (
        <NoteDialog
          kind="suspend"
          affiliate={affiliate}
          onClose={() => setDialog(null)}
          onDone={(a) => decided(a, `${affiliate.name} is suspended.`)}
        />
      )}
      {dialog === "payout" && (
        <RecordPayoutDialog
          affiliate={affiliate}
          ready={ready}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setNotice(message);
            reload();
          }}
        />
      )}
    </div>
  );
}

function sumByCurrency(rows: Commission[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of rows) out[c.currency] = (out[c.currency] ?? 0) + c.amountMinor;
  return out;
}

function SectionTitle({ id, title, hint }: { id: string; title: string; hint: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-base font-bold tracking-tight text-neutral-900">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-neutral-500">{hint}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Application                                                        */
/* ------------------------------------------------------------------ */

function ApplicationPanel({ affiliate }: { affiliate: PlatformAffiliate }) {
  const pending = affiliate.status === "pending";
  return (
    <Panel
      title={pending ? "Application" : "How they applied"}
      subtitle={pending ? "Read how they'll promote XwiftHQ before you decide" : undefined}
      icon={Mail}
      hue="sun"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-neutral-500">How they&apos;ll promote XwiftHQ</p>
          <p className="mt-1.5 whitespace-pre-line rounded-2xl bg-primary-50/50 px-4 py-3 text-sm text-neutral-800">
            {affiliate.promotion?.trim() ? affiliate.promotion : "Nothing written."}
          </p>
          {affiliate.reviewNote && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-neutral-500">
                Review note{affiliate.reviewedAt ? `, ${formatDate(affiliate.reviewedAt)}` : ""}
              </p>
              <p className="mt-1.5 whitespace-pre-line text-sm text-neutral-700">{affiliate.reviewNote}</p>
            </div>
          )}
        </div>
        <InfoList>
          <InfoRow icon={Mail} label="Email" hue="blue">
            <a href={`mailto:${affiliate.email}`} className="font-medium text-primary-700 hover:underline">
              {affiliate.email}
            </a>
            {affiliate.hasAccount && <span className="block text-xs font-normal text-neutral-500">Has an XwiftHQ account</span>}
          </InfoRow>
          <InfoRow icon={Phone} label="Phone" hue="mint">
            {affiliate.phone ? (
              <a href={`tel:${affiliate.phone.replace(/\s+/g, "")}`} className="font-medium text-primary-700 hover:underline">
                {affiliate.phone}
              </a>
            ) : (
              <span className="text-neutral-500">Not given</span>
            )}
          </InfoRow>
          <InfoRow icon={MapPin} label="Country" hue="coral">
            {affiliate.country ?? <span className="text-neutral-500">Not given</span>}
          </InfoRow>
          <InfoRow icon={Globe2} label="Audience" hue="grape">
            {affiliate.audienceUrl ? (
              <a href={affiliate.audienceUrl} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-primary-700 hover:underline">
                {affiliate.audienceUrl}
              </a>
            ) : (
              <span className="text-neutral-500">Not given</span>
            )}
          </InfoRow>
          <InfoRow icon={CalendarDays} label="Applied on" hue="sky">
            {formatDate(affiliate.createdAt)}
            {affiliate.approvedAt && <span className="block text-xs font-normal text-neutral-500">Approved {formatDate(affiliate.approvedAt)}</span>}
          </InfoRow>
        </InfoList>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

function Stats({ data }: { data: PlatformAffiliateDetail }) {
  const s = data.stats;
  if (!s) return null;
  return (
    <StatGrid cols={4}>
      <StatCard icon={MousePointerClick} hue="sky" label="Link clicks" value={s.clicks} hint={`${s.clicksLast30Days} in the last 30 days`} />
      <StatCard
        icon={Building2}
        hue="coral"
        label="Organisations referred"
        value={s.referrals}
        hint={`${s.payingReferrals} paying${s.conversionPercent !== null ? ` · ${percentText(s.conversionPercent)} convert` : ""}`}
      />
      <StatCard
        icon={HandCoins}
        hue="grape"
        label="Ready to pay"
        value={moneyList(earningsFor(s.earnings, "approved"), true)}
        hint={`On hold: ${moneyList(earningsFor(s.earnings, "pending"), true)}`}
      />
      <StatCard icon={Wallet} hue="mint" label="Paid out" value={moneyList(earningsFor(s.earnings, "paid"), true)} />
    </StatGrid>
  );
}

/* ------------------------------------------------------------------ */
/*  Referrals                                                          */
/* ------------------------------------------------------------------ */

function ReferralsTable({ rows }: { rows: Referral[] }) {
  const columns: Column<Referral>[] = [
    {
      key: "organisation",
      header: "Organisation",
      primary: true,
      value: (r) => r.organisation?.name ?? "",
      render: (r) =>
        r.organisation?.slug ? (
          <Link href={organisationHref(r.organisation.slug)} className="font-semibold text-neutral-900 hover:text-primary-700 hover:underline">
            {r.organisation.name}
          </Link>
        ) : (
          <span className="font-semibold text-neutral-900">{r.organisation?.name ?? "-"}</span>
        ),
    },
    { key: "source", header: "How", value: (r) => r.sourceLabel },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <ReferralStatusChip referral={r} /> },
    {
      key: "referred",
      header: "Referred on",
      hideOnMobile: true,
      value: (r) => r.referredAt ?? "",
      render: (r) => <span className="whitespace-nowrap">{formatDate(r.referredAt)}</span>,
    },
    {
      key: "firstPaid",
      header: "First paid on",
      hideOnMobile: true,
      value: (r) => r.firstPaidAt ?? "",
      render: (r) => <span className="whitespace-nowrap">{formatDate(r.firstPaidAt)}</span>,
    },
  ];

  return (
    <DataView
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      storageKey="platform.affiliate.referrals"
      caption="Referrals"
      searchable={false}
      views={["table", "list"]}
      empty={
        <Card>
          <Empty icon={Building2} title="No referrals yet" hint="An organisation that signs up through their link, or that you record by hand, shows here." />
        </Card>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Decisions                                                          */
/* ------------------------------------------------------------------ */

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-error-700">
      {message}
    </p>
  );
}

function ApproveDialog({
  affiliate,
  onClose,
  onDone,
}: {
  affiliate: PlatformAffiliate;
  onClose: () => void;
  onDone: (a: PlatformAffiliate, message: string) => void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrors({});
    const body: { code?: string; note?: string } = {};
    if (code.trim()) body.code = code.trim();
    if (note.trim()) body.note = note.trim();
    try {
      const a = await platformAffiliates.approve(affiliate.id, body);
      onDone(a, `${a.name} is approved${a.code ? ` with the code ${a.code}` : ""}. They've been emailed their link.`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err instanceof ApiError ? err.message : "The application wasn't approved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${id}-title`}
      title={`Approve ${affiliate.name}?`}
      subtitle={affiliate.email}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={Check} disabled={saving}>
            {saving ? "Approving…" : "Approve affiliate"}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-neutral-600">
        An XwiftHQ account is created for {affiliate.email}, or linked if one already exists, and they&apos;re emailed
        their link to start sharing.
      </p>
      <div>
        <label htmlFor={`${id}-code`} className={labelClass}>
          Code (optional)
        </label>
        <input
          id={`${id}-code`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          aria-invalid={Boolean(errors.code)}
          aria-describedby={`${id}-code-help${errors.code ? ` ${id}-code-error` : ""}`}
          className={cx(inputClass, "font-mono")}
          placeholder="Leave blank to generate one"
        />
        <p id={`${id}-code-help`} className={hintClass}>
          It goes in their link as <span className="font-mono">/?ref=CODE</span>. Leave it blank and XwiftHQ generates one.
        </p>
        <FieldError id={`${id}-code-error`} message={errors.code} />
      </div>
      <div>
        <label htmlFor={`${id}-note`} className={labelClass}>
          Note (optional)
        </label>
        <textarea id={`${id}-note`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} />
        <p className={hintClass}>Kept with the decision for your team.</p>
        <FieldError id={`${id}-note-error`} message={errors.note} />
      </div>
      {error && !errors.code && !errors.note && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

const NOTE_COPY = {
  reject: {
    title: (name: string) => `Turn down ${name}'s application?`,
    body: "They're emailed to say the application wasn't accepted. A note, if you add one, goes in that email.",
    label: "Note to them (optional)",
    submit: "Turn down application",
    busy: "Turning down…",
    failed: "The application wasn't turned down.",
  },
  suspend: {
    title: (name: string) => `Suspend ${name}?`,
    body: "Their link stops earning commission and stops giving the referral discount until you reinstate them.",
    label: "Why (optional)",
    submit: "Suspend affiliate",
    busy: "Suspending…",
    failed: "The affiliate wasn't suspended.",
  },
} as const;

function NoteDialog({
  kind,
  affiliate,
  onClose,
  onDone,
}: {
  kind: keyof typeof NOTE_COPY;
  affiliate: PlatformAffiliate;
  onClose: () => void;
  onDone: (a: PlatformAffiliate) => void;
}) {
  const id = useId();
  const copy = NOTE_COPY[kind];
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = note.trim() ? { note: note.trim() } : {};
    try {
      onDone(kind === "reject" ? await platformAffiliates.reject(affiliate.id, body) : await platformAffiliates.suspend(affiliate.id, body));
    } catch (err) {
      setError(fieldErrors(err).note ?? (err instanceof ApiError ? err.message : copy.failed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${id}-title`}
      title={copy.title(affiliate.name)}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" icon={kind === "reject" ? X : Ban} disabled={saving}>
            {saving ? copy.busy : copy.submit}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-neutral-600">{copy.body}</p>
      <div>
        <label htmlFor={`${id}-note`} className={labelClass}>
          {copy.label}
        </label>
        <textarea id={`${id}-note`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Payout                                                             */
/* ------------------------------------------------------------------ */

/** The fields the payout form shows a 422 message beside. */
const PAYOUT_FIELDS = ["currency", "method", "commissionIds", "reference", "paidOn", "note"];

function RecordPayoutDialog({
  affiliate,
  ready,
  onClose,
  onDone,
}: {
  affiliate: PlatformAffiliate;
  ready: Commission[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const id = useId();
  const currencies = useMemo(() => [...new Set(ready.map((c) => c.currency))].sort(), [ready]);
  const [currency, setCurrency] = useState(currencies[0] ?? "NGN");
  const inCurrency = ready.filter((c) => c.currency === currency);
  // Everything ready in the currency is picked until somebody unticks a row.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(ready.filter((c) => c.currency === currencies[0]).map((c) => c.id)));
  const [method, setMethod] = useState<PayoutMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selected = inCurrency.filter((c) => picked.has(c.id));
  const total = selected.reduce((sum, c) => sum + c.amountMinor, 0);
  const today = todayISO();
  const future = paidOn > today;

  const chooseCurrency = (next: string) => {
    setCurrency(next);
    setPicked(new Set(ready.filter((c) => c.currency === next).map((c) => c.id)));
    setErrors({});
  };

  const toggle = (cid: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(cid)) n.delete(cid);
      else n.add(cid);
      return n;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0 || !paidOn || future) return;
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const payout = await platformAffiliates.recordPayout(affiliate.id, {
        currency,
        commissionIds: selected.map((c) => c.id),
        method,
        reference: reference.trim() || undefined,
        paidOn,
        note: note.trim() || undefined,
      });
      onDone(`Payout ${payout.reference} recorded: ${formatMoney(payout.amountMinor, payout.currency)} to ${affiliate.name}.`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err instanceof ApiError ? err.message : "The payout wasn't recorded.");
    } finally {
      setSaving(false);
    }
  }

  const err = (key: string) => <FieldError id={`${id}-${key}-error`} message={errors[key]} />;
  const describedBy = (key: string, help = false) =>
    [help ? `${id}-${key}-help` : null, errors[key] ? `${id}-${key}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${id}-title`}
      title="Record a payout"
      subtitle={`To ${affiliate.name}`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-600" aria-live="polite">
            Total <span className="text-lg font-bold tabular-nums text-neutral-900">{formatMoney(total, currency)}</span>
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" icon={Wallet} disabled={saving || selected.length === 0 || !paidOn || future}>
              {saving ? "Recording…" : "Record payout"}
            </Button>
          </div>
        </div>
      }
    >
      <p className="text-sm text-neutral-600">
        Record money you&apos;ve already sent. The amount is the sum of the commissions you tick, and they&apos;re marked paid.
      </p>

      {affiliate.payoutDetails ? (
        <p className="rounded-2xl bg-mint-50 px-4 py-3 text-sm text-mint-700">
          {affiliate.payoutDetails.accountName}, {affiliate.payoutDetails.bankName},{" "}
          <span className="font-mono">{affiliate.payoutDetails.accountNumber}</span>
        </p>
      ) : (
        <p className="rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-700">They haven&apos;t added payout details yet.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-currency`} className={labelClass}>
            Currency
          </label>
          <SearchableSelect
            id={`${id}-currency`}
            value={currency}
            onChange={chooseCurrency}
            options={currencies.map((c) => ({ value: c, label: c }))}
            aria-describedby={describedBy("currency", true)}
          />
          <p id={`${id}-currency-help`} className={hintClass}>
            Only currencies with commissions ready to pay. Each currency is paid separately.
          </p>
          {err("currency")}
        </div>
        <div>
          <label htmlFor={`${id}-method`} className={labelClass}>
            Method
          </label>
          <SearchableSelect
            id={`${id}-method`}
            value={method}
            onChange={(v) => setMethod(v as PayoutMethod)}
            options={PAYOUT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            aria-describedby={describedBy("method")}
          />
          {err("method")}
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Commissions to settle</legend>
        <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
          {inCurrency.map((c) => (
            <li key={c.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={picked.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-5 w-5 shrink-0 cursor-pointer accent-primary-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">{c.organisation?.name ?? "Organisation"}</span>
                  <span className="block truncate text-xs text-neutral-500">
                    {c.sourceLabel} · earned {formatDate(c.earnedAt)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{formatMoney(c.amountMinor, c.currency)}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className={hintClass}>
          {selected.length} of {inCurrency.length} ticked.
        </p>
        {err("commissionIds")}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-reference`} className={labelClass}>
            Payment reference (optional)
          </label>
          <input
            id={`${id}-reference`}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            aria-invalid={Boolean(errors.reference)}
            aria-describedby={describedBy("reference")}
            className={inputClass}
            placeholder="Bank transfer reference"
          />
          {err("reference")}
        </div>
        <div>
          <label htmlFor={`${id}-paidOn`} className={labelClass}>
            Paid on
          </label>
          <input
            id={`${id}-paidOn`}
            type="date"
            required
            max={today}
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            aria-invalid={future || Boolean(errors.paidOn)}
            aria-describedby={describedBy("paidOn", true)}
            className={inputClass}
          />
          <p id={`${id}-paidOn-help`} className={cx(hintClass, future && "font-medium text-error-700")}>
            {future ? "Pick today or an earlier day." : "Today or earlier."}
          </p>
          {err("paidOn")}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-note`} className={labelClass}>
          Note (optional)
        </label>
        <textarea id={`${id}-note`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} />
        {err("note")}
      </div>

      {error && !PAYOUT_FIELDS.some((k) => errors[k]) && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
