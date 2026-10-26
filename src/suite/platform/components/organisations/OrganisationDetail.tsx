"use client";

import { use, useCallback, useEffect, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Ban,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  Check,
  Coins,
  Loader2,
  Mail,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Ticket,
  Timer,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { formatDate } from "@/lib/console-data";
import {
  organisations as orgApi,
  organisationSeats as seatsApi,
  ApiError,
  BILLING_PERIODS,
  type BillingPeriod,
  type LicenceStatus,
  type Organisation,
  type SeatLedger,
  type SeatPurchase,
} from "@/lib/api/saas-client";
import { useAuth } from "@/lib/auth-store";
import { Button, Card, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, type Hue } from "@/components/workspace/modules";
import { BackLink, hintClass, InfoList, InfoRow, inputClass, labelClass, StatCard } from "@/suite/lms/components/ui/ws";
import { OrgMark, SeatMeter } from "@/suite/org/components/ui";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { platformOrganisations } from "@/lib/api/platform-client";
import { canPlatform, PERM } from "@/suite/platform/access";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import OrganisationModules from "./OrganisationModules";
import OrganisationUsers from "./OrganisationUsers";
import OrganisationAudit from "./OrganisationAudit";
import ReferralCard from "../affiliates/ReferralCard";

/**
 * One institution, from the platform owner's side.
 *
 * The page exists for the things only the owner can do: **price** a seat, set
 * **how often** that price is charged, and record money that arrived somewhere
 * this platform never saw: a bank transfer, a cheque, a purchase order. All of
 * them change what an institution is allowed to do, so all of them leave a row
 * in the ledger below, and the ledger is the point of the page: a seat limit
 * with no history is a number nobody can defend in a billing conversation.
 *
 * Beside the seats, the same page reassigns the institution's **modules**,
 * shows its users read-only, and its audit trail: the tabs under the name.
 *
 * Offline rows are marked **Unverified** rather than styled like a payment.
 * The platform has only somebody's word that the money landed, and a screen
 * that renders the two identically is quietly asserting something it does not
 * know.
 */

const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

type DetailTab = "seats" | "modules" | "users" | "audit";

const TABS: { key: DetailTab; label: string }[] = [
  { key: "seats", label: "Seats and billing" },
  { key: "modules", label: "Modules" },
  { key: "users", label: "Users" },
  { key: "audit", label: "Audit trail" },
];

function isTab(v: string | null | undefined): v is DetailTab {
  // `pricing` was the per-organisation override tab, retired with one-time
  // pricing (26 Sep 2026); an old link to it lands on the default tab.
  return v === "seats" || v === "modules" || v === "users" || v === "audit";
}

const LICENCE_HUE: Record<LicenceStatus, Hue> = {
  active: "mint",
  past_due: "sun",
  lapsed: "rose",
  unbilled: "slate",
};

export default function OrganisationDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const confirm = useConfirm();
  const initialTab = search?.get("tab");
  const [tab, setTab] = useState<DetailTab>(isTab(initialTab) ? initialTab : "seats");
  const [busy, setBusy] = useState(false);

  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [ledger, setLedger] = useState<SeatLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isOwner = canPlatform(user, PERM.organisationsView);
  const canManage = canPlatform(user, PERM.organisationsManage);

  const load = useCallback(() => {
    Promise.all([orgApi.get(slug), seatsApi.ledger(slug)])
      .then(([org, seatLedger]) => {
        setOrganisation(org);
        setLedger(seatLedger);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "That organisation didn't load."));
  }, [slug]);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  async function toggleStatus() {
    if (!organisation) return;
    const suspending = organisation.status === "active";
    if (
      suspending &&
      !(await confirm({
        title: `Suspend ${organisation.name}?`,
        body: "Its people can't sign in and its learning stops until you reactivate it. Its members, courses and records are all kept.",
        confirmLabel: "Suspend organisation",
      }))
    )
      return;
    setBusy(true);
    try {
      const updated = suspending
        ? await platformOrganisations.suspend(slug)
        : await platformOrganisations.reactivate(slug);
      setOrganisation((o) => (o ? { ...o, ...updated } : updated));
      setNotice(suspending ? `${organisation.name} is suspended.` : `${organisation.name} is active again.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't change the organisation.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!organisation) return;
    if (
      !(await confirm({
        title: `Delete ${organisation.name}?`,
        body: "Its people lose access straight away. The organisation, with all its members and records, moves to the platform recycle bin, where it can be restored.",
        confirmLabel: "Delete organisation",
        recoverable: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await platformOrganisations.remove(slug);
      router.push("/suite/platform/organisations");
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "That organisation wasn't deleted.");
    }
  }

  const heading = (
    <>
      <BackLink href="/suite/platform/organisations" label="All organisations" />
      <PageHeader
        eyebrow="Organisation"
        title={
          <span className="flex items-center gap-3">
            {organisation && <OrgMark name={organisation.name} logoUrl={organisation.logoUrl} size={44} />}
            <span>{organisation?.name ?? "Organisation"}</span>
            {organisation && (
              <Chip hue={organisation.status === "active" ? "mint" : "slate"} dot>
                {organisation.status === "active" ? "Active" : "Suspended"}
              </Chip>
            )}
          </span>
        }
        subtitle="Seats, modules, users and a record of every change."
        actions={
          organisation && canManage ? (
            <>
              <Button
                size="sm"
                icon={organisation.status === "active" ? Ban : RotateCcw}
                disabled={busy}
                onClick={toggleStatus}
              >
                {organisation.status === "active" ? "Suspend" : "Reactivate"}
              </Button>
              <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={remove}>
                Delete
              </Button>
            </>
          ) : undefined
        }
        tabs={organisation ? TABS : undefined}
        activeTab={tab}
        onTab={(k) => setTab(k as DetailTab)}
      />
    </>
  );

  if (user && !isOwner) {
    return (
      <div>
        {heading}
        <Card>
          <Empty
            icon={Users}
            title="This console is the platform owner's"
            hint="Your own institution's seats are on the Seats page."
          />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {heading}
        <Banner tone="error">{error}</Banner>
      </div>
    );
  }

  if (organisation === null || ledger === null) {
    return (
      <div>
        {heading}
        <div className="flex items-center gap-2 py-20 text-sm text-neutral-500">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading…
        </div>
      </div>
    );
  }

  if (tab !== "seats") {
    return (
      <div>
        {heading}
        {notice && (
          <div className="mb-6">
            <Banner tone="success">{notice}</Banner>
          </div>
        )}
        {tab === "modules" && (
          <OrganisationModules
            slug={slug}
            canManage={canManage}
            organisationName={organisation?.name}
            // `?tab=modules&licence=record`: straight from creating the organisation to licensing it.
            openLicence={search?.get("licence") === "record"}
          />
        )}
        {tab === "users" && <OrganisationUsers slug={slug} />}
        {tab === "audit" && <OrganisationAudit slug={slug} />}
      </div>
    );
  }

  const { summary } = ledger;

  return (
    <div>
      {heading}

      {notice && (
        <div className="mb-6">
          <Banner tone="success">{notice}</Banner>
        </div>
      )}

      <div className="mb-6">
        <StatGrid cols={3}>
          <StatCard
            featured
            featuredHue="sun"
            icon={Ticket}
            label="Seats"
            value={summary.seatLimit === null ? "Unlimited" : `${summary.seatsUsed} / ${summary.seatLimit}`}
            hint={
              summary.seatLimit === null ? "No limit, so nothing to sell against" : `${summary.seatsRemaining ?? 0} free`
            }
          />
          <StatCard
            icon={Coins}
            hue="sun"
            label="Price per seat"
            value={summary.seatPrice === null ? "Not priced" : NAIRA.format(summary.seatPrice)}
            hint={
              summary.seatPrice === null
                ? "This institution can't buy seats yet"
                : (summary.pricePer ?? "One-off, not on a plan")
            }
          />
          <StatCard
            icon={Wallet}
            hue="mint"
            label="Paid to date"
            value={NAIRA.format(summary.totalPaid)}
            hint={`${summary.seatsPurchased} seats bought or granted`}
          />
        </StatGrid>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <PricingCard
            organisation={organisation}
            platformGrace={organisation.graceDaysOverride === null ? summary.graceDays : 14}
            onSaved={(message) => {
              setNotice(message);
              load();
            }}
            onError={setError}
          />

          <GrantCard
            slug={slug}
            capped={summary.seatLimit !== null}
            onGranted={(message) => {
              setNotice(message);
              load();
            }}
            onError={setError}
          />
        </div>

        <div className="space-y-6">
          <Panel
            title="Licence"
            icon={CalendarClock}
            hue={LICENCE_HUE[summary.licenceStatus]}
            subtitle={
              summary.billingPeriod === null
                ? "Not on a recurring plan"
                : `Billed ${summary.billingPeriodLabel?.toLowerCase()}`
            }
          >
            <Chip hue={LICENCE_HUE[summary.licenceStatus]} dot={summary.licenceStatus !== "active"}>
              {summary.licenceStatusLabel}
            </Chip>

            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              {summary.billingPeriod === null ? (
                "Seats here are a one-off charge. Choose a billing period to put this institution on a recurring licence."
              ) : summary.licenceStatus === "lapsed" ? (
                <>
                  Ended {formatDate(summary.currentPeriodEnd)}. Past the {summary.graceDays}-day grace window, so no
                  new members can be added. Nobody has been signed out.
                </>
              ) : summary.licenceStatus === "past_due" ? (
                <>
                  Ended {formatDate(summary.currentPeriodEnd)}. Inside its {summary.graceDays}-day grace window;
                  nothing is blocked yet.
                </>
              ) : (
                <>
                  Runs to {formatDate(summary.currentPeriodEnd)}
                  {summary.renewalAmount !== null && <> · renews at {NAIRA.format(summary.renewalAmount)}</>}
                </>
              )}
            </p>

            {summary.billingPeriod !== null && (
              <div className="mt-4">
                <RenewButton
                  slug={slug}
                  suggested={summary.renewalAmount}
                  onDone={(message) => {
                    setNotice(message);
                    load();
                  }}
                  onError={setError}
                />
              </div>
            )}
          </Panel>

          <ReferralCard slug={slug} />

          <Panel title="Seat usage" icon={Ticket} hue="blue">
            <SeatMeter used={summary.seatsUsed} limit={summary.seatLimit} className="w-full" />
            <p className="mt-3 text-xs text-neutral-500">
              Counts everyone: learners, instructors and admins.
            </p>
          </Panel>

          <Panel title="Details" icon={BadgeCheck} hue="grape" bodyClassName="px-5 pb-3 pt-2">
            <InfoList>
              <InfoRow icon={Mail} label="Contact email" hue="blue">
                {organisation.contactEmail ?? "No contact address"}
              </InfoRow>
              <InfoRow icon={Phone} label="Phone" hue="mint">
                {organisation.contactPhone ?? "-"}
              </InfoRow>
              <InfoRow icon={Timer} label="Grace window" hue="sun">
                {organisation.graceDays} days{organisation.graceDaysOverride === null ? " (platform default)" : ""}
              </InfoRow>
              <InfoRow icon={CalendarDays} label="On the platform since" hue="coral">
                {formatDate(organisation.createdAt)}
              </InfoRow>
            </InfoList>
          </Panel>
        </div>
      </div>

      <section aria-labelledby="ledger-heading">
        <div className="mb-3">
          <h2 id="ledger-heading" className="text-base font-bold tracking-tight text-neutral-900">
            Seat ledger
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">Every change to this institution&apos;s seat limit, and what was paid for it</p>
        </div>
        <Ledger purchases={ledger.purchases} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */

function PricingCard({
  organisation,
  platformGrace,
  onSaved,
  onError,
}: {
  organisation: Organisation;
  /** What the institution would fall back to, shown as the placeholder. */
  platformGrace: number;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [price, setPrice] = useState(organisation.seatPrice?.toString() ?? "");
  const [limit, setLimit] = useState(organisation.seatLimit?.toString() ?? "");
  const [period, setPeriod] = useState<string>(organisation.billingPeriod ?? "");
  const periodId = useId();
  const [grace, setGrace] = useState(organisation.graceDaysOverride?.toString() ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await orgApi.update(organisation.slug, {
        seatPrice: price === "" ? null : Number(price),
        seatLimit: limit === "" ? null : Number(limit),
        billingPeriod: period === "" ? null : (period as BillingPeriod),
        // Empty means "follow the platform default", which is not zero days.
        graceDays: grace === "" ? null : Number(grace),
        // Only meaningful when the cap moved; the API records it against the
        // adjustment so a manual change is not an unexplained number.
        seatLimitNote: note.trim() || null,
      } as Partial<Organisation>);

      setNote("");
      onSaved("Saved.");
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That wasn't saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Pricing and seat limit"
      subtitle="What a seat costs, how often it's charged, and how many seats they can fill"
      icon={Coins}
      hue="sun"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="block sm:col-span-2">
          <label htmlFor={`${periodId}-period`} className={labelClass}>
            Billing period
          </label>
          <SearchableSelect
            id={`${periodId}-period`}
            value={period}
            onChange={setPeriod}
            aria-describedby={`${periodId}-period-help`}
            options={[
              { value: "", label: "One-off, not on a recurring plan" },
              ...BILLING_PERIODS.map((option) => ({ value: option.value, label: option.label })),
            ]}
          />
          <span id={`${periodId}-period-help`} className={`block ${hintClass}`}>
            Starting a plan opens the first term immediately. Seats bought part-way through one are prorated to the end
            of it, then billed in full at renewal.
          </span>
        </div>

        <label className="block">
          <span className={labelClass}>Price per seat (₦)</span>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Not priced"
          />
          <span className={`block ${hintClass}`}>
            Leave it empty to take the price off. They then can&apos;t buy seats until you set one again, which
            isn&apos;t the same as making seats free.
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>Seat limit</span>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Unlimited"
          />
          <span className={`block ${hintClass}`}>
            A change made here goes in the ledger as an adjustment, so the history still adds up.
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>Grace window (days)</span>
          <input
            type="number"
            min={0}
            max={180}
            className={inputClass}
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
            placeholder={`Platform default (${platformGrace})`}
          />
          <span className={`block ${hintClass}`}>
            How long they can keep adding members after a term ends. Leave it empty to follow the platform default
            (empty isn&apos;t zero).
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>Why (optional)</span>
          <input
            type="text"
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Pilot extended to the whole ministry"
          />
        </label>
      </div>

      <div className="mt-5 flex justify-end border-t border-neutral-100 pt-4">
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden />}
          Save
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Offline grant                                                      */
/* ------------------------------------------------------------------ */

function GrantCard({
  slug,
  capped,
  onGranted,
  onError,
}: {
  slug: string;
  capped: boolean;
  onGranted: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [seats, setSeats] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const count = Number(seats);
  const canSubmit = capped && Number.isFinite(count) && count > 0 && !saving;

  async function grant() {
    if (!canSubmit) return;

    setSaving(true);
    try {
      await seatsApi.grant(slug, {
        seats: count,
        amount: amount === "" ? null : Number(amount),
        note: note.trim() || null,
      });

      setSeats("");
      setAmount("");
      setNote("");
      onGranted(`Added ${count} ${count === 1 ? "seat" : "seats"}.`);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Those seats weren't added.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Add seats paid for offline"
      subtitle="A bank transfer, a cheque, a purchase order: money this platform never saw"
      icon={Receipt}
      hue="mint"
    >
      {!capped && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
          This institution has no seat limit, so it already has room for everyone. Set a limit above before selling
          seats against it.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Seats to add</span>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            disabled={!capped}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Amount received (₦)</span>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!capped}
            placeholder="Defaults to seats × price, less any referral discount"
          />
          <span className={`block ${hintClass}`}>
            Can differ from the list price. Transfers often carry a negotiated rate.
          </span>
        </label>
      </div>

      <label className="mt-4 block">
        <span className={labelClass}>Reference (optional)</span>
        <input
          type="text"
          className={inputClass}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!capped}
          placeholder="Bank transfer, ref 99120041"
        />
      </label>

      <div className="mt-5 flex justify-end border-t border-neutral-100 pt-4">
        <Button onClick={() => void grant()} disabled={!canSubmit}>
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />}
          Add seats
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Offline renewal                                                    */
/* ------------------------------------------------------------------ */

/**
 * Records the next term against money that arrived elsewhere.
 *
 * Separate from the seat grant because the two buy different things (capacity
 * against time), and one control that could do either invites asking for both
 * and getting neither.
 */
function RenewButton({
  slug,
  suggested,
  onDone,
  onError,
}: {
  slug: string;
  suggested: number | null;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function renew() {
    setSaving(true);
    try {
      await seatsApi.renew(slug, {
        amount: amount === "" ? null : Number(amount),
        note: note.trim() || null,
      });

      setAmount("");
      setNote("");
      setOpen(false);
      onDone("Term renewed.");
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That renewal wasn't recorded.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button icon={CalendarClock} onClick={() => setOpen(true)} className="w-full">
        Record a renewal
      </Button>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-neutral-50 p-4">
      <label className="block">
        <span className={labelClass}>Amount received (₦)</span>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={suggested === null ? "" : suggested.toString()}
        />
      </label>

      <label className="mt-3 block">
        <span className={labelClass}>Reference</span>
        <input
          type="text"
          className={inputClass}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Invoice INV-2026-114"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <Button variant="primary" size="sm" onClick={() => void renew()} disabled={saving}>
          {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
          Renew term
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ledger                                                             */
/* ------------------------------------------------------------------ */

function kindHue(p: SeatPurchase): Hue {
  if (p.kind === "renewal") return "sky";
  return p.seats < 0 ? "coral" : "mint";
}

function SeatsCell({ purchase }: { purchase: SeatPurchase }) {
  return purchase.kind === "renewal" ? (
    <span className="text-xs font-medium text-neutral-500">Term to {formatDate(purchase.periodEnd)}</span>
  ) : (
    <span className="text-sm font-semibold tabular-nums text-neutral-900">
      {purchase.seats > 0 ? `+${purchase.seats}` : purchase.seats}
    </span>
  );
}

function HowCell({ purchase }: { purchase: SeatPurchase }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-neutral-600">{purchase.methodLabel}</span>
      {purchase.status !== "paid" ? (
        <Chip hue={purchase.status === "pending" ? "sun" : "slate"} dot>
          {purchase.statusLabel}
        </Chip>
      ) : purchase.verified ? (
        <Chip hue="mint" icon={Check}>
          Verified
        </Chip>
      ) : purchase.method === "offline" ? (
        // Said plainly: the platform did not witness this money.
        <Chip hue="slate">Unverified</Chip>
      ) : null}
    </div>
  );
}

function Ledger({ purchases }: { purchases: SeatPurchase[] }) {
  const columns: Column<SeatPurchase>[] = [
    {
      key: "when",
      header: "When",
      sortable: true,
      value: (p) => p.paidAt ?? p.createdAt ?? "",
      render: (p) => <span className="text-xs text-neutral-500">{formatDate(p.paidAt ?? p.createdAt)}</span>,
    },
    {
      key: "seats",
      header: "Seats",
      primary: true,
      sortable: true,
      value: (p) => p.seats,
      render: (p) => <SeatsCell purchase={p} />,
    },
    { key: "how", header: "How", value: (p) => p.methodLabel, render: (p) => <HowCell purchase={p} /> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (p) => p.amount,
      render: (p) => (
        <span className="text-sm tabular-nums text-neutral-700">{p.amount > 0 ? NAIRA.format(p.amount) : "-"}</span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      value: (p) => p.note ?? p.reference,
      render: (p) => (
        <div>
          <p className="text-xs text-neutral-600">{p.note ?? p.reference}</p>
          {p.recordedBy && <p className="text-[11px] text-neutral-500">by {p.recordedBy}</p>}
        </div>
      ),
    },
  ];

  return (
    <DataView
      rows={purchases}
      columns={columns}
      rowKey={(p) => p.id}
      storageKey="org.organisation.ledger"
      caption="Seat ledger"
      searchPlaceholder="Search the ledger"
      empty={
        purchases.length === 0 ? (
          <Empty
            icon={Receipt}
            title="Nothing recorded yet"
            hint="Seats bought through the platform and seats you add here both show in this list."
          />
        ) : undefined
      }
      renderCard={(p) => (
        <div className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Chip hue={kindHue(p)}>{p.kindLabel}</Chip>
              <p className="mt-2">
                <SeatsCell purchase={p} />
              </p>
            </div>
            <span className="text-right text-lg font-bold tabular-nums text-neutral-900">
              {p.amount > 0 ? NAIRA.format(p.amount) : "-"}
            </span>
          </div>
          <HowCell purchase={p} />
          <div className="mt-auto border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            <p className="truncate">{p.note ?? p.reference}</p>
            <p className="mt-0.5">
              {formatDate(p.paidAt ?? p.createdAt)}
              {p.recordedBy ? ` · by ${p.recordedBy}` : ""}
            </p>
          </div>
        </div>
      )}
      renderListItem={(p) => (
        <div className="flex items-center gap-4 px-5 py-3.5">
          <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[kindHue(p)].soft)}>
            {p.kind === "renewal" ? <CalendarClock size={18} aria-hidden /> : <Ticket size={18} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeatsCell purchase={p} />
              <HowCell purchase={p} />
            </div>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {formatDate(p.paidAt ?? p.createdAt)} · {p.note ?? p.reference}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
            {p.amount > 0 ? NAIRA.format(p.amount) : "-"}
          </span>
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */

function Banner({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : Check;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm",
        tone === "error" ? "border-error-500/20 bg-error-500/5 text-error-700" : "border-mint-100 bg-mint-50 text-mint-700",
      )}
    >
      <Icon size={15} className="shrink-0" aria-hidden />
      {children}
    </p>
  );
}
