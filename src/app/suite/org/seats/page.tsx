"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  Check,
  Loader2,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Ticket,
} from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SegmentedGauge } from "@/components/workspace/charts";
import { HUE, type Hue } from "@/components/workspace/modules";
import { ErrorNote, IconTile, inputClass, labelClass } from "@/suite/lms/components/ui/ws";
import { formatDate } from "@/lib/console-data";
import {
  seats as seatsApi,
  ApiError,
  type LicenceStatus,
  type SeatLedger,
  type SeatPurchase,
  type SeatQuote,
  type RenewalQuote,
} from "@/lib/api/saas-client";
import { useAuth } from "@/lib/auth-store";
import { percentText } from "@/lib/api/affiliate-client";

/**
 * The institution's own seats.
 *
 * An admin here has three questions: *have we got room*, *how long is the
 * licence good for*, and *what does more cost*. So the page leads with the term
 * (an expiry nobody noticed is the failure mode that stops a whole institution
 * onboarding anyone), then the seat meter, then a buy control that shows the
 * total against the number typed rather than revealing it on the payment page.
 *
 * Seats bought mid-term are prorated, and the screen says so. A total that is
 * quietly a quarter of the list price looks like a mistake unless the reason is
 * on the same line.
 *
 * What is deliberately absent: any way to change the price or to grant seats.
 * A cap the capped party can raise is not a cap, so both live with the platform
 * owner. When seats are unpriced the buy control says so rather than failing on
 * submit.
 */

const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function SeatsPage() {
  const { user } = useAuth();

  const [ledger, setLedger] = useState<SeatLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState("10");
  const [buying, setBuying] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [quote, setQuote] = useState<SeatQuote | null>(null);
  /*
    What the renewal actually buys. `summary.renewalAmount` is the total and
    nothing else, so the button could say "Renew for ₦840,000" without
    saying what term that covers, and an administrator renewing three weeks
    early has no way to know those three weeks are not being thrown away.
  */
  const [renewal, setRenewal] = useState<RenewalQuote | null>(null);

  const belongsToOrganisation = Boolean(user?.organisationId);

  const load = useCallback(() => {
    seatsApi
      .mine()
      .then((data) => {
        setLedger(data);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "Your seats didn't load."),
      );
  }, []);

  useEffect(() => {
    if (belongsToOrganisation) load();
  }, [belongsToOrganisation, load]);

  const onAPlan = ledger?.summary.renewalAmount != null;

  useEffect(() => {
    if (!onAPlan) {
      return;
    }

    let alive = true;

    seatsApi
      .renewalQuote()
      .then((result) => {
        if (alive) setRenewal(result);
      })
      .catch(() => {
        /*
          Quiet. The breakdown is an explanation of a figure that is already
          on screen, so losing it should cost the detail line and not the
          renew button.
        */
      });

    return () => {
      alive = false;
    };
  }, [onAPlan]);

  const wanted = Number(count);
  const price = ledger?.summary.seatPrice ?? null;
  const prorated = ledger?.summary.billingPeriod != null;
  /** An affiliate referral's discount on the organisation's first payment; 0 when there is none. */
  const referralPct = ledger?.summary.referralDiscountPercent ?? 0;

  const valid = Number.isFinite(wanted) && wanted >= 1;

  /**
   * The API prices a mid-term purchase, because proration depends on the exact
   * moment and the server owns the clock. Off a plan it is one multiplication,
   * so that case is answered locally and instantly.
   */
  useEffect(() => {
    if (!valid || price === null) {
      setQuote(null);
      return;
    }

    if (!prorated) {
      // The same rounding as the server, so the gateway asks for this figure.
      const list = price * wanted;
      const off = referralPct > 0 ? Math.round((list * referralPct) / 100) : 0;
      setQuote({
        seats: wanted,
        unitPrice: price,
        amount: list - off,
        listAmount: list,
        referralDiscount: off,
        prorated: false,
        daysRemaining: null,
        periodEnd: null,
      });
      return;
    }

    let alive = true;

    seatsApi
      .quote(wanted)
      .then((q) => {
        if (alive) setQuote(q);
      })
      .catch(() => {
        if (alive) setQuote(null);
      });

    return () => {
      alive = false;
    };
  }, [valid, wanted, price, prorated, referralPct]);

  const total = quote?.amount ?? null;

  async function renew() {
    if (renewing) return;

    setRenewing(true);
    setError(null);
    try {
      const { authorizationUrl } = await seatsApi.renew();

      if (authorizationUrl) {
        window.location.href = authorizationUrl;
        return;
      }

      setError("The renewal didn't start. Try again in a moment.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That renewal didn't start.");
    } finally {
      setRenewing(false);
    }
  }

  async function buy() {
    if (total === null || buying) return;

    setBuying(true);
    setError(null);
    try {
      const { authorizationUrl } = await seatsApi.purchase(wanted);

      if (authorizationUrl) {
        // Hand off to the gateway. Coming back lands on /admin/seats/verify.
        window.location.href = authorizationUrl;
        return;
      }

      setError("The payment didn't start. Try again in a moment.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That payment didn't start.");
    } finally {
      setBuying(false);
    }
  }

  const heading = (
    <PageHeader
      eyebrow="Organisation"
      title="Seats"
      subtitle="How many people your organisation is licensed for, and what you have paid."
    />
  );

  if (user && !belongsToOrganisation) {
    return (
      <div>
        {heading}
        <Card>
          <Empty
            icon={Building2}
            title="Seats belong to an institution"
            hint="Your account administers the platform. Seat limits and pricing are on each organisation's page."
          />
        </Card>
      </div>
    );
  }

  if (ledger === null) {
    return (
      <div>
        {heading}
        {error ? (
          <ErrorNote className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" aria-hidden />
            {error}
          </ErrorNote>
        ) : (
          <div className="flex items-center gap-2 py-20 text-sm text-neutral-500">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            Loading your seats…
          </div>
        )}
      </div>
    );
  }

  const { summary } = ledger;
  const full = summary.seatsRemaining !== null && summary.seatsRemaining <= 0;
  const usedPct =
    summary.seatLimit === null ? 0 : Math.min(100, (summary.seatsUsed / Math.max(1, summary.seatLimit)) * 100);

  return (
    <div className="space-y-6">
      {heading}

      {error && (
        <ErrorNote className="flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" aria-hidden />
          {error}
        </ErrorNote>
      )}

      {summary.billingPeriod !== null && (
        <Panel
          title="Your licence"
          subtitle={`Billed ${summary.billingPeriodLabel?.toLowerCase()} · ${summary.seatLimit} seats`}
          icon={CalendarClock}
          hue={LICENCE_HUE[summary.licenceStatus]}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <LicencePill status={summary.licenceStatus} label={summary.licenceStatusLabel} />
                {summary.daysLeftInTerm !== null && summary.daysLeftInTerm >= 0 && (
                  <span className="text-xs text-neutral-500">
                    {summary.daysLeftInTerm} {summary.daysLeftInTerm === 1 ? "day" : "days"} left
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm text-neutral-600">
                {summary.licenceStatus === "lapsed" ? (
                  <>
                    Your licence ended on{" "}
                    <span className="font-semibold">{formatDate(summary.currentPeriodEnd)}</span>.
                    Nobody has been signed out and nothing has been deleted, but you cannot add
                    anyone else until it is renewed.
                  </>
                ) : summary.licenceStatus === "past_due" ? (
                  <>
                    Your licence ended on{" "}
                    <span className="font-semibold">{formatDate(summary.currentPeriodEnd)}</span>.
                    Everything still works for now.
                  </>
                ) : (
                  <>
                    Renews on{" "}
                    <span className="font-semibold">{formatDate(summary.currentPeriodEnd)}</span>
                    {summary.renewalAmount !== null && (
                      <> for {NAIRA.format(summary.renewalAmount)}</>
                    )}
                    .
                  </>
                )}
              </p>

              {/*
                The breakdown. `GET /organisation/seats/renewal` had no caller,
                so the only figure anybody saw was the total, and the dates
                it buys, which are the thing somebody renewing early is
                worried about, were not on the page at all.
              */}
              {renewal !== null && (
                <p className="mt-2 text-xs text-neutral-500">
                  {/* One string, not six nodes: it is read as a sentence. */}
                  <span>
                    {`${renewal.seats} ${renewal.seats === 1 ? "seat" : "seats"} × ${NAIRA.format(renewal.unitPrice)} · covers ${formatDate(renewal.periodStart)} to ${formatDate(renewal.periodEnd)}`}
                  </span>
                  {startsLater(renewal.periodStart) && (
                    <span className="text-neutral-600">
                      {", and renewing now adds to your current term rather than replacing it"}
                    </span>
                  )}
                  .
                </p>
              )}

              {referralPct > 0 && summary.renewalAmount !== null && (
                <p className="mt-2 text-xs text-neutral-500">
                  {`This includes your ${percentText(referralPct)} referral discount, which applies to your first payment only.`}
                </p>
              )}
            </div>

            <Button
              variant={summary.licenceStatus === "active" ? "secondary" : "primary"}
              onClick={() => void renew()}
              disabled={renewing || summary.renewalAmount === null}
            >
              {renewing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <RefreshCw size={16} aria-hidden />}
              {summary.renewalAmount === null
                ? "Renew"
                : `Renew for ${NAIRA.format(summary.renewalAmount)}`}
            </Button>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          title="Your seats"
          subtitle="Every member costs a seat: learner, instructor or admin"
          icon={Ticket}
          className="lg:col-span-2"
        >
          {summary.seatLimit === null ? (
            <p className="text-sm text-neutral-600">
              Your organisation has <span className="font-semibold">no seat limit</span>. Add as many
              people as you need.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <SegmentedGauge
                value={usedPct}
                hue={full ? "rose" : usedPct >= 85 ? "sun" : "blue"}
                label="of seats filled"
                size={200}
              />
              <div className="w-full flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm text-neutral-600">
                    <span className="text-[28px] font-bold tabular-nums text-neutral-900">
                      {summary.seatsUsed}
                    </span>{" "}
                    of {summary.seatLimit} seats in use
                  </p>
                  <p className={cx("text-sm font-semibold", full ? "text-error-700" : "text-neutral-500")}>
                    {summary.seatsRemaining} free
                  </p>
                </div>

                <div
                  className="ws-hatch mt-3 h-3 overflow-hidden rounded-full"
                  role="img"
                  aria-label={`${summary.seatsUsed} of ${summary.seatLimit} seats in use`}
                >
                  <div
                    className={cx(
                      "h-full rounded-full bg-gradient-to-r",
                      full ? "bg-rose-500 from-rose-500 to-rose-400" : "bg-primary-500 from-primary-500 to-primary-400",
                    )}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>

                {full && (
                  <p className="mt-3 flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-error-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                    You have used every seat. Nobody else can be added until you buy more.
                  </p>
                )}

                <dl className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { k: "Free seats", v: String(summary.seatsRemaining ?? 0), hue: "mint" as const },
                    { k: "Licensed for", v: String(summary.seatLimit), hue: "sky" as const },
                    { k: "Price per seat", v: price === null ? "Not priced" : NAIRA.format(price), hue: "grape" as const },
                  ].map((t) => (
                    <div key={t.k} className={cx("rounded-2xl px-3 py-3", HUE[t.hue].soft)}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide">{t.k}</dt>
                      <dd className="mt-0.5 text-base font-bold tabular-nums text-neutral-900">{t.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Buy more seats"
          subtitle={
            price === null
              ? "Seats are not priced for your organisation yet"
              : `${NAIRA.format(price)} per seat ${summary.pricePer ?? ""}`.trim()
          }
          icon={ShoppingCart}
          hue="mint"
        >
          {!summary.canBuy ? (
            <p className="flex items-start gap-2.5 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden />
              {summary.seatLimit === null
                ? "Your seats are not capped, so there is nothing to buy."
                : "Your platform administrator sets the price. Ask them to set one, or arrange payment with them directly."}
            </p>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Seats</span>
                <input
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className={inputClass}
                />
              </label>

              <div className="rounded-2xl bg-primary-50/60 p-4 ring-1 ring-inset ring-primary-100">
                <p className="text-xs font-semibold text-primary-700">Total</p>
                <p className="text-2xl font-bold tabular-nums text-neutral-900">
                  {total === null ? "-" : NAIRA.format(total)}
                </p>
                {/* A total that is quietly a fraction of the list price reads as a
                    bug unless the reason sits next to it. */}
                {quote?.referralDiscount != null && quote.referralDiscount > 0 && (
                  <>
                    <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-neutral-600">
                      <span>Referral discount ({percentText(referralPct)})</span>
                      <span className="font-semibold tabular-nums text-mint-700">
                        -{NAIRA.format(quote.referralDiscount)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">Applies to your first payment only.</p>
                  </>
                )}
                {quote?.prorated && (
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Prorated to {formatDate(quote.periodEnd)}, then billed in full from the next
                    renewal.
                  </p>
                )}
              </div>

              <Button
                variant="primary"
                onClick={() => void buy()}
                disabled={total === null || buying}
                className="w-full"
              >
                {buying ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShoppingCart size={16} aria-hidden />}
                {buying ? "Starting payment…" : "Pay for seats"}
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <section aria-labelledby="history-heading">
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={Receipt} hue="mint" size={40} />
          <div>
            <h2 id="history-heading" className="text-lg font-bold tracking-tight text-neutral-900">
              History
            </h2>
            <p className="text-sm text-neutral-500">
              What you have bought, and anything your platform administrator recorded
            </p>
          </div>
        </div>
        <History purchases={ledger.purchases} />
      </section>
    </div>
  );
}

const LICENCE_HUE: Record<LicenceStatus, Hue> = {
  active: "mint",
  past_due: "sun",
  lapsed: "rose",
  unbilled: "slate",
};

/** One pill, four states, each with the hue its consequence deserves. */
function LicencePill({ status, label }: { status: LicenceStatus; label: string }) {
  return (
    <Chip hue={LICENCE_HUE[status]} dot={status !== "active"}>
      {label}
    </Chip>
  );
}

function What({ purchase }: { purchase: SeatPurchase }) {
  return purchase.kind === "renewal" ? (
    <>
      Renewal
      {purchase.periodEnd && (
        <span className="ml-1 text-xs font-normal text-neutral-500">to {formatDate(purchase.periodEnd)}</span>
      )}
    </>
  ) : (
    <>
      {purchase.seats > 0 ? `+${purchase.seats}` : purchase.seats}{" "}
      {Math.abs(purchase.seats) === 1 ? "seat" : "seats"}
    </>
  );
}

function StatusCell({ purchase }: { purchase: SeatPurchase }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {purchase.status === "paid" ? (
        <Chip hue="mint" icon={Check}>
          Paid
        </Chip>
      ) : (
        <Chip hue={purchase.status === "pending" ? "sun" : "slate"} dot>
          {purchase.statusLabel}
        </Chip>
      )}

      {/* A pending payment is resumable: abandoning the gateway tab is
          the single most common way one ends up in this state. */}
      {purchase.status === "pending" && purchase.authorizationUrl && (
        <a href={purchase.authorizationUrl} className={buttonClass("secondary", "sm")}>
          Finish payment
        </a>
      )}
    </span>
  );
}

function History({ purchases }: { purchases: SeatPurchase[] }) {
  const money = (p: SeatPurchase) => (p.amount > 0 ? NAIRA.format(p.amount) : "-");

  const columns: Column<SeatPurchase>[] = [
    {
      key: "what",
      header: "What",
      primary: true,
      value: (p) => (p.kind === "renewal" ? "Renewal" : `${p.seats} seats`),
      render: (p) => (
        <span className="text-sm font-semibold text-neutral-900">
          <What purchase={p} />
        </span>
      ),
    },
    { key: "method", header: "How", sortable: true, value: (p) => p.methodLabel },
    {
      key: "when",
      header: "When",
      sortable: true,
      value: (p) => p.paidAt ?? p.createdAt ?? "",
      render: (p) => (
        <span className="text-xs text-neutral-500">
          {formatDate(p.paidAt ?? p.createdAt)}
          {p.note ? ` · ${p.note}` : ""}
        </span>
      ),
    },
    { key: "status", header: "Status", value: (p) => p.statusLabel, render: (p) => <StatusCell purchase={p} /> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (p) => p.amount,
      render: (p) => <span className="text-sm tabular-nums text-neutral-800">{money(p)}</span>,
    },
  ];

  return (
    <DataView
      rows={purchases}
      columns={columns}
      rowKey={(p) => p.id}
      storageKey="org.seats.history"
      caption="Seat history"
      searchPlaceholder="Search history"
      empty={
        purchases.length === 0 ? (
          <Empty
            icon={Receipt}
            title="Nothing yet"
            hint="Seats you buy, and any your platform administrator adds, show here."
          />
        ) : undefined
      }
      renderCard={(p) => (
        <div className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <span
              className={cx(
                "flex h-11 w-11 items-center justify-center rounded-2xl",
                p.kind === "renewal" ? HUE.sky.soft : HUE.mint.soft,
              )}
            >
              {p.kind === "renewal" ? <CalendarClock size={18} aria-hidden /> : <Ticket size={18} aria-hidden />}
            </span>
            <span className="text-lg font-bold tabular-nums text-neutral-900">{money(p)}</span>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-neutral-900">
              <What purchase={p} />
            </p>
            <p className="text-xs text-neutral-500">
              {p.methodLabel} · {formatDate(p.paidAt ?? p.createdAt)}
            </p>
          </div>
          <div className="mt-auto border-t border-neutral-100 pt-3">
            <StatusCell purchase={p} />
          </div>
        </div>
      )}
      renderListItem={(p) => (
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">
              <What purchase={p} />
              <span className="ml-2 text-xs font-normal text-neutral-500">{p.methodLabel}</span>
            </p>
            <p className="text-xs text-neutral-500">
              {formatDate(p.paidAt ?? p.createdAt)}
              {p.note ? ` · ${p.note}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusCell purchase={p} />
            <span className="w-24 text-right text-sm tabular-nums text-neutral-800">{money(p)}</span>
          </div>
        </div>
      )}
    />
  );
}

/**
 * Does this renewal start after today?
 *
 * Renewing early extends the term rather than discarding what is left (the
 * billing service starts the new period at the end of the current one), but
 * nothing said so, and the fear of losing paid-for weeks is exactly what stops
 * somebody renewing before the last day.
 */
function startsLater(iso: string): boolean {
  const start = new Date(iso);

  return Number.isFinite(start.getTime()) && start.getTime() > Date.now();
}
