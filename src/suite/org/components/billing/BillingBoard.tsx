"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  CircleCheck,
  CreditCard,
  FlaskConical,
  Infinity as InfinityIcon,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  PackageCheck,
  Plus,
  Receipt,
  RotateCcw,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Segmented, buttonClass, cx } from "@/components/workspace/kit";
import { HUE, WORKSPACE_MODULES, type Hue } from "@/components/workspace/modules";
import {
  ApiError,
  billing,
  ladderPrice,
  type BillingCatalogue,
  type CurrencyCode,
  type ModuleOffer,
  type ModuleQuote,
  type ModuleRequest,
} from "@/lib/api/billing-client";
import { formatMoney } from "@/lib/money";
import { ErrorNote, Field, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { PurchaseHistory } from "./PurchaseHistory";

/**
 * Plan & billing: what this organisation owns, and buying more.
 *
 * Modules are bought once and kept for good (the owner's ruling of 26 September
 * 2026). The price follows a ladder by how many modules the organisation has
 * bought — one module, two, up to five — and adding modules later charges only
 * the difference between rungs. So the order summary is built around three
 * numbers the admin can check against each other before leaving for the
 * gateway: the ladder price for everything they'll own, the credit for what
 * they already bought, and the difference they pay today.
 *
 * Modules the platform owner switched on by hand don't count towards the
 * credit; they are the owner's to give, not something this organisation paid
 * for. Finance and Admin can be bought now and are switched on the day they
 * ship, and the cards say so.
 *
 * The owner can switch online payment off (`paymentsEnabled: false`). Then the
 * picker and the price stay exactly as they are (the admin still sees what it
 * will cost) but the summary sends a request instead of opening a checkout,
 * and the platform owner switches the modules on by hand once the invoice is
 * settled. Turning payment back on brings the checkout straight back; nothing
 * of it is removed, only branched.
 */
export function BillingBoard({ initialModule }: { initialModule?: string | null }) {
  const [catalogue, setCatalogue] = useState<BillingCatalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [currency, setCurrency] = useState<CurrencyCode | null>(null);
  const [selected, setSelected] = useState<string[]>(initialModule ? [initialModule] : []);

  const [quote, setQuote] = useState<{ key: string; value: ModuleQuote } | null>(null);
  const [quoteError, setQuoteError] = useState<{ key: string; message: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const quoteSeq = useRef(0);

  // Payments off: the request the admin sends in place of a checkout.
  const [note, setNote] = useState({ message: "", phone: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [sent, setSent] = useState<ModuleRequest | null>(null);

  useEffect(() => {
    let alive = true;
    billing
      .catalogue()
      .then((c) => {
        if (!alive) return;
        setCatalogue(c);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(e instanceof ApiError ? e.message : "Your plan didn't load.");
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const currencies = useMemo(() => catalogue?.currencies ?? [], [catalogue]);
  const activeCurrency: CurrencyCode | null =
    currency && currencies.includes(currency) ? currency : (currencies[0] ?? null);

  const buyable = (m: ModuleOffer) => m.purchasable && !m.owned;

  /** The ticked modules that can actually be bought. */
  const chosen = useMemo(
    () => (catalogue ? catalogue.modules.filter((m) => selected.includes(m.key) && buyable(m)).map((m) => m.key) : []),
    [catalogue, selected],
  );
  const quoteKey = activeCurrency && chosen.length > 0 ? `${activeCurrency}:${[...chosen].sort().join(",")}` : "";

  useEffect(() => {
    if (quoteKey === "" || !activeCurrency) return;
    const seq = ++quoteSeq.current;
    billing
      .quote(chosen, activeCurrency)
      .then((value) => {
        if (seq === quoteSeq.current) setQuote({ key: quoteKey, value });
      })
      .catch((e: unknown) => {
        if (seq === quoteSeq.current) {
          setQuoteError({ key: quoteKey, message: e instanceof ApiError ? e.message : "The price didn't load." });
        }
      });
    // `chosen` and `activeCurrency` are summarised by `quoteKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const currentQuote = quote && quote.key === quoteKey ? quote.value : null;
  const currentQuoteError = quoteError && quoteError.key === quoteKey ? quoteError.message : null;
  const quoting = quoteKey !== "" && !currentQuote && !currentQuoteError;

  const toggle = (key: string) => {
    setPayError(null);
    setFieldErrors({});
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  };

  const pay = async () => {
    if (!activeCurrency || chosen.length === 0) return;
    setPaying(true);
    setPayError(null);
    try {
      const { authorizationUrl } = await billing.checkout(chosen, activeCurrency);
      window.location.href = authorizationUrl;
    } catch (e) {
      setPayError(e instanceof ApiError ? e.message : "Checkout didn't start. Nothing was charged.");
      setPaying(false);
    }
  };

  const sendRequest = async () => {
    if (chosen.length === 0) return;
    setPaying(true);
    setPayError(null);
    setFieldErrors({});
    try {
      const message = note.message.trim();
      const phone = note.phone.trim();
      const result = await billing.requestModules({
        modules: chosen,
        currency: activeCurrency ?? undefined,
        message: message || undefined,
        phone: phone || undefined,
      });
      setSent(result);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors(e.errors ?? {});
        setPayError(e.status === 429 ? "Too many requests in a row. Wait a minute, then send it again." : e.message);
      } else {
        setPayError("Your request didn't send. Check your connection and try again.");
      }
    } finally {
      setPaying(false);
    }
  };

  const startAnother = () => {
    setSent(null);
    setSelected([]);
    setNote({ message: "", phone: "" });
  };

  if (loadError && !catalogue) {
    return (
      <div>
        <Header />
        <Card className="p-6">
          <Empty
            icon={CreditCard}
            title="Your plan didn't load."
            hint={loadError}
            hue="coral"
            action={
              <Button size="sm" icon={RotateCcw} onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (!catalogue) {
    return (
      <div aria-busy="true" aria-label="Loading your plan">
        <Header />
        <Skeleton className="mb-6 h-24" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const { gateway, paymentsEnabled } = catalogue;
  const forSale = catalogue.modules.filter(buyable);
  const ladder = activeCurrency ? catalogue.ladder[activeCurrency] : undefined;
  const nothingForSale = forSale.length === 0 || !activeCurrency || !ladder;

  return (
    <div>
      <Header gateway={gateway} paymentsEnabled={paymentsEnabled} />

      {!paymentsEnabled && (
        <div
          role="note"
          className="mb-6 flex items-start gap-3 rounded-[1.25rem] border border-sky-100 bg-sky-50/70 px-5 py-4 text-sm leading-relaxed text-neutral-700"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700" aria-hidden>
            <Info size={17} />
          </span>
          <div>
            <p className="font-semibold text-neutral-900">Modules are activated by our team for now.</p>
            <p className="mt-0.5">
              There&apos;s no online payment at the moment. Pick what you need and send us a request: we&apos;ll
              contact you to confirm and arrange payment, then switch the modules on. They show as active on this
              page the moment they&apos;re on.
            </p>
          </div>
        </div>
      )}

      <OwnedStrip modules={catalogue.modules} purchasedCount={catalogue.purchasedCount} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <section aria-labelledby="billing-modules" data-tour="billing-modules">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="billing-modules" className="text-lg font-bold tracking-tight text-neutral-900">
                Add modules
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                {paymentsEnabled
                  ? "One payment, yours for good. Everyone in your organisation gets what you add."
                  : "A one-time price, invoiced by our team. Everyone in your organisation gets what you add."}
              </p>
            </div>
            {activeCurrency && currencies.length > 1 && (
              <Segmented
                label="Currency"
                value={activeCurrency}
                onChange={(c) => {
                  setPayError(null);
                  setFieldErrors({});
                  setCurrency(c);
                }}
                options={currencies.map((c) => ({ key: c, label: c }))}
              />
            )}
          </div>

          {nothingForSale ? (
            <Card className="p-6">
              <Empty
                icon={forSale.length === 0 ? PackageCheck : Lock}
                title={forSale.length === 0 ? "You own every module on offer." : "Modules aren't on sale yet."}
                hint={
                  forSale.length === 0
                    ? "There's nothing left to add. New modules will appear here when they're released."
                    : "The platform owner hasn't set prices yet. Ask them to switch on what you need."
                }
                action={
                  forSale.length === 0 ? undefined : (
                    <Link href="/support?to=platform&subject=Module%20pricing" className={buttonClass("secondary", "sm")}>
                      <MessageSquare size={15} aria-hidden />
                      Contact the platform owner
                    </Link>
                  )
                }
              />
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {catalogue.modules.map((m) => (
                <ModuleCard
                  key={m.key}
                  offer={m}
                  selected={selected.includes(m.key)}
                  onToggle={() => toggle(m.key)}
                  byRequest={!paymentsEnabled}
                  locked={sent !== null}
                />
              ))}
            </ul>
          )}

          {ladder && activeCurrency && (
            <LadderGuide
              ladder={ladder}
              currency={activeCurrency}
              owned={catalogue.purchasedCount}
              target={catalogue.purchasedCount + chosen.length}
            />
          )}
        </section>

        {paymentsEnabled ? (
          <OrderSummary
            gatewayLabel={gateway.label}
            testMode={gateway.testMode}
            count={chosen.length}
            quote={currentQuote}
            quoting={quoting}
            quoteError={currentQuoteError}
            paying={paying}
            payError={payError}
            onPay={pay}
          />
        ) : (
          <RequestSummary
            count={chosen.length}
            quote={currentQuote}
            quoting={quoting}
            quoteError={currentQuoteError}
            note={note}
            onNote={setNote}
            fieldErrors={fieldErrors}
            sending={paying}
            sendError={payError}
            sent={sent}
            onSend={sendRequest}
            onStartAnother={startAnother}
          />
        )}
      </div>

      <PurchaseHistory className="mt-10" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header({
  gateway,
  paymentsEnabled = true,
}: {
  gateway?: BillingCatalogue["gateway"];
  paymentsEnabled?: boolean;
}) {
  return (
    <PageHeader
      eyebrow="Organisation"
      title="Plan & billing"
      subtitle={
        paymentsEnabled
          ? "The modules your organisation owns, and adding more with a one-time payment."
          : "The modules your organisation owns, and requesting more from our team."
      }
      actions={
        paymentsEnabled && gateway?.testMode ? (
          <Chip hue="sun" icon={FlaskConical}>
            Test mode · no real money moves
          </Chip>
        ) : undefined
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  What the organisation owns                                         */
/* ------------------------------------------------------------------ */

function ownershipLabel(m: ModuleOffer): string {
  if (!m.owned && m.status !== "active") return "Not owned";
  if (m.deliveredWhenReleased) return "Owned · delivered when released";
  switch (m.source) {
    case "purchase":
      return "Owned · paid";
    case "manual":
      return "Granted by the platform owner";
    case "default":
      return "Included";
    default:
      return "Owned";
  }
}

function OwnedStrip({ modules, purchasedCount }: { modules: ModuleOffer[]; purchasedCount: number }) {
  return (
    <section aria-labelledby="billing-plan" className="ws-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="billing-plan" className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          What you own
        </h2>
        <p className="text-xs text-neutral-500">
          {purchasedCount === 0
            ? "No modules bought yet"
            : `${purchasedCount} module${purchasedCount === 1 ? "" : "s"} bought · yours for good`}
        </p>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {modules.map((m) => {
          const look = lookFor(m.key);
          const Icon = look.icon;
          const on = m.owned || m.status === "active";
          return (
            <li key={m.key} className="flex items-start gap-3">
              <span
                className={cx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  on ? HUE[look.hue].tile : "bg-neutral-100 text-neutral-400",
                )}
                aria-hidden
              >
                <Icon size={17} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">{m.label}</p>
                <p className="text-xs text-neutral-500">{ownershipLabel(m)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  One module                                                         */
/* ------------------------------------------------------------------ */

const RELEASING_LATER = new Set(["finance", "admin"]);

function ModuleCard({
  offer,
  selected,
  onToggle,
  byRequest = false,
  locked = false,
}: {
  offer: ModuleOffer;
  selected: boolean;
  onToggle: () => void;
  /** Online payment is off: the module is requested, not paid for here. */
  byRequest?: boolean;
  /** A request was just sent: the selection is what was asked for. */
  locked?: boolean;
}) {
  const look = lookFor(offer.key);
  const Icon = look.icon;
  const owned = offer.owned || (offer.status === "active" && offer.source !== null);
  const buyable = offer.purchasable && !offer.owned;
  const later = RELEASING_LATER.has(offer.key) || offer.deliveredWhenReleased;

  return (
    <li
      className={cx(
        "relative flex flex-col rounded-[1.25rem] border bg-white p-5 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
        selected && buyable
          ? "border-primary-400 shadow-lg shadow-primary-600/10 ring-4 ring-primary-100"
          : "border-neutral-200",
        owned && "bg-neutral-50/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cx("flex h-11 w-11 items-center justify-center rounded-2xl", HUE[look.hue].tile)} aria-hidden>
          <Icon size={20} />
        </span>
        {owned ? (
          <Chip hue="mint" dot>
            Owned
          </Chip>
        ) : later ? (
          <Chip hue="grape">Delivered when released</Chip>
        ) : (
          <Chip hue="slate">Available</Chip>
        )}
      </div>

      <h3 className="mt-4 text-base font-bold tracking-tight text-neutral-900">{offer.label}</h3>

      <p className="mt-1 text-sm text-neutral-500">
        {owned
          ? offer.deliveredWhenReleased
            ? "Yours already. It switches on the day it's released."
            : "Yours for good. Nothing more to pay."
          : buyable
            ? later
              ? byRequest
                ? "Request it now at today's price; it switches on the day it ships."
                : "Buy it now at today's price; it switches on the day it ships."
              : byRequest
                ? "Switches on for everyone once our team activates it."
                : "Switches on for everyone as soon as the payment clears."
            : (
              <>
                Not sold online.{" "}
                <Link
                  href={`/support?to=platform&subject=${encodeURIComponent(`Please activate ${offer.label}`)}`}
                  className="font-semibold text-primary-700 underline-offset-2 hover:underline"
                >
                  Ask the platform owner
                </Link>{" "}
                to switch it on.
              </>
            )}
      </p>

      <div className="mt-auto pt-5">
        {buyable && (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={onToggle}
            disabled={locked}
            className={cx(buttonClass(selected ? "primary" : "secondary", "md"), "w-full")}
          >
            {selected ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
            {selected ? `${offer.label} added` : `Add ${offer.label}`}
          </button>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  The ladder, so the difference is visible, not asserted             */
/* ------------------------------------------------------------------ */

function LadderGuide({
  ladder,
  currency,
  owned,
  target,
}: {
  ladder: Record<string, number>;
  currency: CurrencyCode;
  owned: number;
  target: number;
}) {
  const rungs = [1, 2, 3, 4, 5];
  return (
    <section aria-labelledby="billing-ladder" className="mt-6 rounded-[1.25rem] border border-neutral-200 bg-white p-5">
      <h3 id="billing-ladder" className="text-sm font-bold tracking-tight text-neutral-900">
        How the price works
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        The price depends on how many modules you own. Adding more later costs only the difference between steps.
      </p>
      <ol className="mt-4 grid grid-cols-5 gap-2">
        {rungs.map((n) => {
          const price = ladderPrice(ladder, n);
          const isOwned = n <= owned;
          const isTarget = target > owned && n === target;
          return (
            <li
              key={n}
              aria-current={isTarget ? "step" : undefined}
              className={cx(
                "rounded-xl border px-2 py-2.5 text-center",
                isTarget
                  ? "border-primary-400 bg-primary-50 ring-2 ring-primary-100"
                  : isOwned
                    ? "border-mint-200 bg-mint-50/60"
                    : "border-neutral-200",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {n} module{n === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs font-bold tabular-nums text-neutral-900 sm:text-sm">
                {formatMoney(price, currency)}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Order summary                                                      */
/* ------------------------------------------------------------------ */

function OrderSummary({
  gatewayLabel,
  testMode,
  count,
  quote,
  quoting,
  quoteError,
  paying,
  payError,
  onPay,
}: {
  gatewayLabel: string;
  testMode: boolean;
  count: number;
  quote: ModuleQuote | null;
  quoting: boolean;
  quoteError: string | null;
  paying: boolean;
  payError: string | null;
  onPay: () => void;
}) {
  const canPay = count > 0 && quote !== null && !quoting && !paying && quote.amountMinor > 0;
  const total = quote ? formatMoney(quote.amountMinor, quote.currency) : null;

  return (
    <aside aria-labelledby="billing-summary" className="ws-card p-5 sm:p-6 lg:sticky lg:top-24">
      <div className="flex items-center gap-2">
        <Receipt size={17} className="text-neutral-400" aria-hidden />
        <h2 id="billing-summary" className="text-base font-bold tracking-tight text-neutral-900">
          Order summary
        </h2>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
        <InfinityIcon size={13} aria-hidden />
        One-time payment · no renewals
      </p>

      <QuoteLines count={count} quote={quote} quoting={quoting} quoteError={quoteError} emptyHint="Add a module to see what you'd pay." />

      <div className="mt-4 flex items-baseline justify-between border-t border-neutral-200 pt-4">
        <span className="text-sm font-semibold text-neutral-700">You pay</span>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900">{total ?? "-"}</span>
      </div>
      {quote && quote.creditMinor > 0 && (
        <p className="mt-1 text-right text-xs text-neutral-500">You pay only the difference.</p>
      )}

      {payError && <ErrorNote className="mt-4">{payError}</ErrorNote>}

      <Button variant="primary" className="mt-5 w-full" disabled={!canPay} onClick={onPay}>
        {paying ? <Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <CreditCard size={17} aria-hidden />}
        {paying ? `Opening ${gatewayLabel}…` : total && count > 0 ? `Pay ${total} with ${gatewayLabel}` : `Pay with ${gatewayLabel}`}
      </Button>

      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-neutral-500">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          Paid once, kept for good: your organisation runs its own storage, email, messaging and AI keys, so modules
          carry no monthly fee. Seats renew separately, on the Seats page. Modules switch on as soon as the payment
          clears.
          {testMode && " This checkout is in test mode: use the gateway's test card."}
        </span>
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Request summary (online payment switched off)                      */
/* ------------------------------------------------------------------ */

/**
 * The same price the checkout would show, so the admin knows what the invoice
 * will say, but the action sends a request to the platform owner. Once sent,
 * the card becomes the receipt for the request: its reference and what
 * happens next.
 */
function RequestSummary({
  count,
  quote,
  quoting,
  quoteError,
  note,
  onNote,
  fieldErrors,
  sending,
  sendError,
  sent,
  onSend,
  onStartAnother,
}: {
  count: number;
  quote: ModuleQuote | null;
  quoting: boolean;
  quoteError: string | null;
  note: { message: string; phone: string };
  onNote: (note: { message: string; phone: string }) => void;
  fieldErrors: Record<string, string[]>;
  sending: boolean;
  sendError: string | null;
  sent: ModuleRequest | null;
  onSend: () => void;
  onStartAnother: () => void;
}) {
  const sentHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (sent) sentHeading.current?.focus();
  }, [sent]);

  if (sent) {
    return (
      <aside aria-labelledby="billing-summary" className="ws-card p-5 sm:p-6 lg:sticky lg:top-24">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-100 text-mint-700" aria-hidden>
          <CircleCheck size={22} />
        </span>
        <h2
          id="billing-summary"
          ref={sentHeading}
          tabIndex={-1}
          className="mt-4 text-base font-bold tracking-tight text-neutral-900 outline-none"
        >
          Request sent
        </h2>
        <p className="mt-1 text-sm text-neutral-600">Thanks. We have your request and the modules you picked.</p>

        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Reference</p>
          <p className="mt-0.5 font-mono text-base font-bold tracking-wide text-neutral-900">{sent.reference}</p>
          <p className="mt-1 text-xs text-neutral-500">Quote it if you contact us about this request.</p>
        </div>

        <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
          <li className="flex items-start gap-2">
            <MessageSquare size={15} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
            Our team will contact you to confirm the modules and arrange payment.
          </li>
          <li className="flex items-start gap-2">
            <PackageCheck size={15} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
            Once they&apos;re switched on, they show as active here and in everyone&apos;s suite menu.
          </li>
        </ul>

        <Button variant="secondary" className="mt-5 w-full" icon={Plus} onClick={onStartAnother}>
          Start another request
        </Button>
      </aside>
    );
  }

  const total = quote ? formatMoney(quote.amountMinor, quote.currency) : null;
  const phoneError = fieldErrors.phone?.[0];
  const messageError = fieldErrors.message?.[0];

  return (
    <aside aria-labelledby="billing-summary" className="ws-card p-5 sm:p-6 lg:sticky lg:top-24">
      <div className="flex items-center gap-2">
        <Receipt size={17} className="text-neutral-400" aria-hidden />
        <h2 id="billing-summary" className="text-base font-bold tracking-tight text-neutral-900">
          Your request
        </h2>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
        <InfinityIcon size={13} aria-hidden />
        One-time price · invoiced by our team
      </p>

      <QuoteLines count={count} quote={quote} quoting={quoting} quoteError={quoteError} emptyHint="Add a module to see what it will cost." />

      <div className="mt-4 flex items-baseline justify-between border-t border-neutral-200 pt-4">
        <span className="text-sm font-semibold text-neutral-700">To be invoiced</span>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900">{total ?? "-"}</span>
      </div>
      {quote && quote.creditMinor > 0 && (
        <p className="mt-1 text-right text-xs text-neutral-500">Only the difference is invoiced.</p>
      )}

      <div className="mt-5 space-y-4">
        <Field id="billing-request-phone" label="Phone" hint="Optional">
          <input
            id="billing-request-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={note.phone}
            onChange={(e) => onNote({ ...note, phone: e.target.value })}
            placeholder="So we can call to confirm"
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={phoneError ? "billing-request-phone-error" : undefined}
            className={inputClass}
          />
          {phoneError && (
            <p id="billing-request-phone-error" className="mt-1.5 text-xs text-error-700">
              {phoneError}
            </p>
          )}
        </Field>
        <Field id="billing-request-message" label="Message" hint="Optional">
          <textarea
            id="billing-request-message"
            rows={3}
            maxLength={5000}
            value={note.message}
            onChange={(e) => onNote({ ...note, message: e.target.value })}
            placeholder="Anything we should know: timing, invoice details, who to contact"
            aria-invalid={messageError ? true : undefined}
            aria-describedby={messageError ? "billing-request-message-error" : undefined}
            className={cx(textareaClass, "resize-y")}
          />
          {messageError && (
            <p id="billing-request-message-error" className="mt-1.5 text-xs text-error-700">
              {messageError}
            </p>
          )}
        </Field>
      </div>

      {sendError && <ErrorNote className="mt-4">{sendError}</ErrorNote>}

      <Button variant="primary" className="mt-5 w-full" disabled={count === 0 || sending} onClick={onSend}>
        {sending ? <Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Send size={17} aria-hidden />}
        {sending ? "Sending request…" : "Send request"}
      </Button>

      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-neutral-500">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          Nothing is charged now. We&apos;ll confirm the price with you and send an invoice; the modules switch on once
          it&apos;s settled, and stay yours for good.
        </span>
      </p>
    </aside>
  );
}

/** The ladder breakdown both summaries show: full price, credit for what's owned. */
function QuoteLines({
  count,
  quote,
  quoting,
  quoteError,
  emptyHint,
}: {
  count: number;
  quote: ModuleQuote | null;
  quoting: boolean;
  quoteError: string | null;
  emptyHint: React.ReactNode;
}) {
  return (
    <div className="mt-5" aria-live="polite">
      {count === 0 ? (
        <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">{emptyHint}</p>
      ) : quoting ? (
        <div className="space-y-3" aria-label="Pricing your selection">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      ) : quoteError ? (
        <ErrorNote>{quoteError}</ErrorNote>
      ) : quote ? (
        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-neutral-600">
              Price for {quote.purchasedCount + quote.addingCount} module
              {quote.purchasedCount + quote.addingCount === 1 ? "" : "s"}
            </dt>
            <dd className="font-semibold tabular-nums text-neutral-900">
              {formatMoney(quote.fullPriceMinor, quote.currency)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-neutral-600">
              {quote.purchasedCount === 0
                ? "Already bought"
                : `Already paid for ${quote.purchasedCount} module${quote.purchasedCount === 1 ? "" : "s"}`}
            </dt>
            <dd className="font-semibold tabular-nums text-mint-700">
              {quote.creditMinor > 0 ? `− ${formatMoney(quote.creditMinor, quote.currency)}` : formatMoney(0, quote.currency)}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Module look                                                        */
/* ------------------------------------------------------------------ */

function lookFor(key: string): { icon: LucideIcon; hue: Hue } {
  // The LMS has three workspace entries (console, studio, learning space);
  // the console carries the module's own colour.
  const entry =
    WORKSPACE_MODULES.find((m) => m.key === key) ?? WORKSPACE_MODULES.find((m) => m.suiteModule === key);
  return entry ? { icon: entry.icon, hue: entry.hue } : { icon: Sparkles, hue: "slate" };
}
