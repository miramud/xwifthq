"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  CirclePause,
  Copy,
  HandCoins,
  Landmark,
  Link2,
  MousePointerClick,
  Percent,
  Share2,
  Wallet,
} from "lucide-react";
import {
  Button,
  CalloutStrip,
  Chip,
  Panel,
  Segmented,
  StatCard,
  StatGrid,
  WelcomeBanner,
  bannerButtonClass,
  cx,
} from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { ColumnChart, StatusBars } from "@/components/workspace/charts";
import { inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError, PageSkeleton, useLoad } from "@/suite/platform/components/ui";
import { myAffiliate, percentText, type MonthFigures, type MyAffiliate, type ProgrammeTerms } from "@/lib/api/affiliate-client";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { COMMISSION_STATUS, currenciesOf, earnedOf, explained, totalsFor, useCopy } from "./ui";

/**
 * The affiliate's front page: the terms they are earning on, their link and
 * code ready to copy, how many people it brought and what it earned, and
 * what is still on hold. Every figure is the API's; nothing is estimated.
 */
export default function OverviewBoard() {
  const fetcher = useCallback(() => explained(myAffiliate.get()), []);
  const { data, error, loading, reload } = useLoad<MyAffiliate>(fetcher, "Your affiliate dashboard didn't load.");

  if (error && !data) return <LoadError message={error} onRetry={reload} />;
  if (loading && !data) return <PageSkeleton stats={4} rows={2} />;
  if (!data) return null;

  return <Overview data={data} />;
}

const COPIED_MESSAGE: Record<string, string> = {
  banner: "Your link is copied.",
  link: "Your link is copied.",
  code: "Your code is copied.",
};

function Overview({ data }: { data: MyAffiliate }) {
  const { affiliate, programme, stats } = data;
  const { copied, failed, copy } = useCopy();
  const suspended = affiliate.status === "suspended";
  const link = affiliate.link;
  const ngn = totalsFor(stats.earnings, "NGN");
  const others = currenciesOf(stats.earnings).filter((c) => c !== "NGN");
  const discount = percentText(programme.discountPercent);
  const commission = percentText(programme.commissionPercent);

  const otherEarned = others
    .map((c) => earnedOf(totalsFor(stats.earnings, c)))
    .map((v, i) => (v > 0 ? formatMoney(v, others[i]) : null))
    .filter(Boolean);

  return (
    <>
      <WelcomeBanner
        name={affiliate.name}
        eyebrow="Affiliate programme"
        subtitle={`${discount} off a referred organisation's first payment; you earn ${commission} of it, before their discount.`}
        art="money"
        figure={{
          label: "Ready to pay",
          value: formatMoney(ngn.approved, "NGN"),
          hint:
            ngn.pending > 0
              ? `${formatMoney(ngn.pending, "NGN")} more is on hold for up to ${programme.holdDays} days`
              : `Commission is ready to pay ${programme.holdDays} days after the payment it came from`,
        }}
        actions={
          <>
            {link && !suspended && (
              <button type="button" className={bannerButtonClass("solid")} onClick={() => copy("banner", link)}>
                {copied === "banner" ? <Check size={17} aria-hidden /> : <Copy size={17} aria-hidden />}
                {copied === "banner" ? "Copied" : "Copy your link"}
              </button>
            )}
            <Link href="/suite/affiliate/settings" className={bannerButtonClass(link && !suspended ? "glass" : "solid")}>
              <Landmark size={17} aria-hidden />
              Payout details
            </Link>
          </>
        }
      />

      <div className="space-y-6">
        {/* Announces a copy wherever it happened; the button itself also says "Copied". */}
        <p role="status" className="sr-only">
          {copied ? COPIED_MESSAGE[copied] : ""}
        </p>

        {suspended && (
          <CalloutStrip icon={CirclePause} hue="sun" title="Your link is paused">
            Your affiliate account is suspended, so visits and sign-ups through your link earn nothing new. Everything you
            earned before stays listed here.
          </CalloutStrip>
        )}

        {!affiliate.payoutDetails && (
          <CalloutStrip icon={Landmark} hue="coral" title="Add your bank details" href="/suite/affiliate/settings">
            We need an account to pay your commission into.
          </CalloutStrip>
        )}

        <LinkPanel
          link={link}
          code={affiliate.code}
          suspended={suspended}
          copied={copied}
          failed={failed}
          onCopy={copy}
        />

        <StatGrid cols={4}>
          <StatCard
            label="Visits"
            value={stats.clicks.toLocaleString("en-NG")}
            icon={MousePointerClick}
            hue="sky"
            hint={`${stats.clicksLast30Days.toLocaleString("en-NG")} in the last 30 days`}
          />
          <StatCard
            label="Organisations referred"
            value={stats.referrals.toLocaleString("en-NG")}
            icon={Building2}
            hue="grape"
            href="/suite/affiliate/referrals"
          />
          <StatCard
            label="Paying organisations"
            value={stats.payingReferrals.toLocaleString("en-NG")}
            icon={Percent}
            hue="sun"
            hint={
              stats.conversionPercent == null
                ? "None referred yet"
                : `${percentText(stats.conversionPercent)} of those referred`
            }
          />
          <StatCard
            label="Earned"
            value={formatMoney(earnedOf(ngn), "NGN")}
            icon={HandCoins}
            featured
            featuredHue="mint"
            href="/suite/affiliate/commissions"
            hint={otherEarned.length > 0 ? `Also ${otherEarned.join(", ")}` : "On hold, ready and paid"}
          />
        </StatGrid>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <MonthsPanel months={stats.months} className="lg:col-span-2" />
          <Panel title="Earnings by status" subtitle="Reversed commission is not counted as earned" icon={Wallet} hue="mint">
            <div className="space-y-6">
              {currenciesOf(stats.earnings).map((currency) => {
                const totals = totalsFor(stats.earnings, currency);
                return (
                  <section key={currency} aria-label={`Earnings in ${currency}`}>
                    {others.length > 0 && (
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{currency}</h4>
                    )}
                    <StatusBars
                      caption={`Commission by status, ${currency}`}
                      format={(v) => formatMoney(v, currency)}
                      data={COMMISSION_STATUS.map((s) => ({ label: s.label, value: totals[s.key], hue: s.hue }))}
                    />
                  </section>
                );
              })}
            </div>
          </Panel>
        </div>

        <HowYouEarn programme={programme} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Link and code                                                      */
/* ------------------------------------------------------------------ */

function LinkPanel({
  link,
  code,
  suspended,
  copied,
  failed,
  onCopy,
}: {
  link: string | null;
  code: string | null;
  suspended: boolean;
  copied: string | null;
  failed: boolean;
  onCopy: (key: string, text: string) => void;
}) {
  return (
    <Panel
      title="Your link"
      subtitle="Share it anywhere. Organisations that sign up through it are referred to you."
      icon={Link2}
      hue="mint"
      actions={suspended ? <Chip hue="sun" icon={CirclePause}>Paused</Chip> : undefined}
    >
      {link ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="affiliate-link" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Referral link
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="affiliate-link"
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className={cx(inputClass, "min-w-0 flex-1 font-mono text-[13px]")}
              />
              {!suspended && (
                <Button icon={copied === "link" ? Check : Copy} onClick={() => onCopy("link", link)} className="shrink-0">
                  {copied === "link" ? "Copied" : "Copy link"}
                </Button>
              )}
            </div>
          </div>
          {code && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-neutral-600">Your code</span>
              <span className="rounded-lg bg-neutral-100 px-3 py-1.5 font-mono text-sm font-semibold tracking-wide text-neutral-900">
                {code}
              </span>
              {!suspended && (
                <Button variant="ghost" icon={copied === "code" ? Check : Copy} onClick={() => onCopy("code", code)}>
                  {copied === "code" ? "Copied" : "Copy code"}
                </Button>
              )}
            </div>
          )}
          {failed && (
            <p role="alert" className="text-sm text-error-700">
              Your browser didn&apos;t let us copy. Select the link above and copy it yourself.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-600">Your link isn&apos;t ready yet. It appears here once your code is set.</p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Six months                                                         */
/* ------------------------------------------------------------------ */

type Metric = "clicks" | "referrals" | "firstPayments" | "earned";

const METRICS: { key: Metric; label: string; caption: string; hue: Hue }[] = [
  { key: "clicks", label: "Visits", caption: "Visits through your link by month", hue: "sky" },
  { key: "referrals", label: "Sign-ups", caption: "Organisations referred by month", hue: "grape" },
  { key: "firstPayments", label: "Payments", caption: "First payments by referred organisations by month", hue: "sun" },
  { key: "earned", label: "Earned", caption: "Commission earned by month, in naira", hue: "mint" },
];

function MonthsPanel({ months, className }: { months: MonthFigures[]; className?: string }) {
  const [metric, setMetric] = useState<Metric>("clicks");
  const meta = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const recent = useMemo(() => months.slice(-6), [months]);
  const data = recent.map((m) => ({
    label: m.label,
    value: metric === "earned" ? (m.earned.NGN ?? 0) : m[metric],
  }));
  const format = metric === "earned" ? (v: number) => formatMoneyCompact(v, "NGN") : (v: number) => v.toLocaleString("en-NG");

  return (
    <Panel
      title="Last six months"
      subtitle={meta.caption}
      className={className}
    >
      {/* In the body, not the header, so a narrow screen scrolls it rather than clipping it. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <Segmented
          label="Figure to chart"
          value={metric}
          onChange={setMetric}
          options={METRICS.map((m) => ({ key: m.key, label: m.label }))}
        />
      </div>
      <ColumnChart data={data} hue={meta.hue} format={format} caption={`${meta.caption}, last six months`} highlight="last" />
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  How you earn                                                       */
/* ------------------------------------------------------------------ */

/** A list price for the worked example: the owner's own, ₦50,000. */
const EXAMPLE_PRICE_MINOR = 5_000_000;

function HowYouEarn({ programme }: { programme: ProgrammeTerms }) {
  const discount = percentText(programme.discountPercent);
  const commission = percentText(programme.commissionPercent);
  const pays = Math.round(EXAMPLE_PRICE_MINOR * (1 - programme.discountPercent / 100));
  const earns = Math.round((EXAMPLE_PRICE_MINOR * programme.commissionPercent) / 100);

  const steps: { title: string; body: string; icon: typeof Share2; hue: Hue }[] = [
    {
      title: "Share your link",
      body: `An organisation that opens it and signs up within ${programme.cookieDays} days is referred to you.`,
      icon: Share2,
      hue: "sky",
    },
    {
      title: `They get ${discount} off`,
      body: `Their first payment is ${discount} lower, whether they pay online or we record a payment for them.`,
      icon: Percent,
      hue: "grape",
    },
    {
      title: `You earn ${commission}`,
      body: `Worked out on the price before their discount. It is on hold for ${programme.holdDays} days in case of a refund, then ready to pay.`,
      icon: HandCoins,
      hue: "mint",
    },
  ];

  return (
    <Panel title="How you earn" icon={HandCoins} hue="mint">
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="flex gap-3 rounded-2xl border border-neutral-100 p-4">
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[s.hue].soft)} aria-hidden>
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">{s.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-neutral-600">
        For example, on a {formatMoney(EXAMPLE_PRICE_MINOR, "NGN")} price they pay {formatMoney(pays, "NGN")} and you
        earn {formatMoney(earns, "NGN")}.
      </p>
    </Panel>
  );
}
