import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Banknote,
  Briefcase,
  Calculator,
  CalendarClock,
  Cookie,
  GraduationCap,
  Hourglass,
  Link2,
  Send,
  Server,
  Users,
  Wallet,
} from "lucide-react";
import { AffiliateApplyForm } from "@/components/affiliates/AffiliateApplyForm";
import { PricingFaq } from "@/components/pricing/PricingFaq";
import { CtaPanel } from "@/components/site/CtaPanel";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Sky } from "@/components/site/Sky";
import { DEFAULT_TERMS, percentText, type ProgrammeTerms } from "@/lib/api/affiliate-client";
import { lmsFetch } from "@/lib/api/server";
import { formatMoney } from "@/lib/api/public-pricing";

/**
 * Become an affiliate.
 *
 * The owner's programme (26 October 2026): anyone can apply, the platform
 * reviews each application by hand, and an approved affiliate shares a link.
 * An organisation that arrives through it gets a discount on its first
 * payment, and the affiliate earns a commission on that payment worked out on
 * the price before the discount. Every figure on this page comes from the
 * programme's live terms (`GET /public/affiliates/programme`), so a change in
 * the Platform console reaches the page without a deploy. If the API can't be
 * reached the page shows `DEFAULT_TERMS`, the same figures a fresh platform
 * starts with.
 */

export const metadata: Metadata = {
  title: "Become an affiliate",
  description:
    "Recommend XwiftHQ to the organisations you advise. They get a discount on their first payment and you earn a commission on it, paid by bank transfer.",
  openGraph: {
    title: "The XwiftHQ affiliate programme",
    description:
      "Share your link with the organisations you advise. They save on their first payment and you earn a commission on it.",
    url: "/affiliates",
  },
};

async function loadTerms(): Promise<ProgrammeTerms> {
  try {
    const result = await lmsFetch("/public/affiliates/programme");
    if (!result.ok) return DEFAULT_TERMS;
    const data = (result.body as { data?: Partial<ProgrammeTerms> } | null)?.data;
    if (!data || typeof data !== "object") return DEFAULT_TERMS;
    // Any missing or malformed figure falls back to the default, never to NaN on the page.
    const num = (value: unknown, fallback: number) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
    return {
      open: typeof data.open === "boolean" ? data.open : DEFAULT_TERMS.open,
      commissionPercent: num(data.commissionPercent, DEFAULT_TERMS.commissionPercent),
      discountPercent: num(data.discountPercent, DEFAULT_TERMS.discountPercent),
      cookieDays: num(data.cookieDays, DEFAULT_TERMS.cookieDays),
      holdDays: num(data.holdDays, DEFAULT_TERMS.holdDays),
    };
  } catch {
    return DEFAULT_TERMS;
  }
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** An illustration, not a price: what the worked example starts from. */
const EXAMPLE_LIST_MINOR = 250_000_000;

const AUDIENCES = [
  { icon: Briefcase, title: "Consultants", body: "You help organisations change how they work and want a suite to point them to." },
  { icon: Calculator, title: "Accountants", body: "Your clients ask how to get their finance, people and records in one place." },
  { icon: GraduationCap, title: "Trainers", body: "You run courses and programmes for teams who need somewhere to learn and track it." },
  { icon: Server, title: "IT providers", body: "You set up and support the systems your clients run their day on." },
  { icon: Users, title: "Anyone who advises organisations", body: "Membership bodies, coaches, community leads: if organisations ask you what to use, this is for you." },
] as const;

function faqs(t: ProgrammeTerms) {
  const discount = percentText(t.discountPercent);
  const commission = percentText(t.commissionPercent);
  return [
    {
      question: "Do I need to be an XwiftHQ customer to apply?",
      answer:
        "No. Anyone can apply. Tell us who you advise and how you would introduce XwiftHQ, and our team reviews your application by hand.",
    },
    {
      question: "How do I get my link?",
      answer:
        "Once we approve you, we email your link and your code, and set up a sign-in (or link the account you already have) where you can follow your referrals, commission and payouts.",
    },
    {
      question: "What counts as a referral?",
      answer: `An organisation that sets up XwiftHQ within ${days(t.cookieDays)} of following your link, or that enters your code when it signs up. If it asks our team to set it up instead of paying online, the code goes with the request and we record the referral when we set the organisation up.`,
    },
    {
      question: "Does the discount reduce my commission?",
      answer: `No. Your ${commission} is worked out on the price before the organisation's ${discount} discount is taken off.`,
    },
    {
      question: "What if the organisation pays by invoice?",
      answer:
        "Payments our team records by hand, such as a bank transfer against an invoice, count in the same way as a card payment made online.",
    },
    {
      question: "When am I paid?",
      answer: `Commission waits ${days(t.holdDays)} after the payment, so a refunded payment can be taken off first. After that our team pays it to your bank account by transfer.`,
    },
  ];
}

export default async function AffiliatesPage() {
  const terms = await loadTerms();
  const discount = percentText(terms.discountPercent);
  const commission = percentText(terms.commissionPercent);

  // The same rounding as the API: whole minor units, half away from zero.
  const exampleDiscount = Math.round((EXAMPLE_LIST_MINOR * terms.discountPercent) / 100);
  const examplePaid = EXAMPLE_LIST_MINOR - exampleDiscount;
  const exampleCommission = Math.round((EXAMPLE_LIST_MINOR * terms.commissionPercent) / 100);

  const figures = [
    {
      icon: BadgePercent,
      value: discount,
      label: "Off the referred organisation's first payment",
    },
    {
      icon: Wallet,
      value: commission,
      label: "Your commission on that payment, worked out before the discount",
    },
    {
      icon: Cookie,
      value: days(terms.cookieDays),
      label: "How long your link is remembered after a visit",
    },
    {
      icon: Hourglass,
      value: days(terms.holdDays),
      label: "Hold before commission is ready to pay",
    },
    {
      icon: Banknote,
      value: "Bank transfer",
      label: "Payouts made by our team, by hand",
    },
  ];

  const steps = [
    {
      icon: Send,
      title: "Apply",
      body: "Tell us who you advise and how you would introduce XwiftHQ. Our team reads every application and replies by email.",
    },
    {
      icon: Link2,
      title: "Share your link",
      body: `Once approved you get a link and a code. Organisations that use either get ${discount} off their first payment.`,
    },
    {
      icon: Wallet,
      title: "Earn",
      body: `You earn ${commission} of that first payment. After a ${days(terms.holdDays)} hold, our team pays it to your bank account.`,
    },
  ];

  return (
    <>
      {/* 1. The offer on the sky, in figures. */}
      <Sky className="pb-16 sm:pb-24">
        <div className="section-container">
          <SectionHeading
            as="h1"
            eyebrow="Affiliate programme"
            title="Recommend XwiftHQ to the organisations you advise"
            intro={`They get ${discount} off their first payment. You earn ${commission} of it, worked out on the full price.`}
          />
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#apply" className="btn-primary min-h-11 w-full gap-2 sm:w-auto">
              {terms.open ? "Apply to join" : "Applications are paused"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href="#terms" className="btn-outline min-h-11 w-full sm:w-auto">
              Read the terms
            </a>
          </div>

          <dl className="xw-frame mx-auto mt-12 grid max-w-3xl divide-y divide-neutral-200/70 overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {figures.slice(0, 3).map((f) => (
              <div key={f.label} className="flex flex-col px-6 py-6 text-center">
                <dt className="mt-1 text-sm leading-snug text-neutral-600">{f.label}</dt>
                <dd className="font-heading order-first text-3xl font-bold tracking-[-0.02em] text-primary-700">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Sky>

      {/* 2. What it is, and who it suits. */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeading
            eyebrow="Who it suits"
            title="For the people organisations ask for advice"
            intro="The affiliate programme pays you for introducing organisations to XwiftHQ. It suits anybody whose work puts them in front of organisations choosing how to run themselves."
          />
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCES.map((a) => (
              <li key={a.title} className="xw-tile flex flex-col p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-[0_1px_2px_rgb(16_18_31/0.06)]">
                  <a.icon className="h-5 w-5 text-primary-600" aria-hidden="true" />
                </span>
                <h3 className="xw-h3 mt-5">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{a.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. How it works, in order. */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeading eyebrow="How it works" title="Three steps from application to payout" />
          <ol className="mt-14 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="xw-glow-card flex flex-col p-6">
                <span className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white">
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="label-mono text-neutral-500">Step {i + 1}</span>
                </span>
                <h3 className="xw-h3 mt-6">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. The terms as figures, and a worked example. */}
      <section id="terms" className="section-padding scroll-mt-24 bg-white">
        <div className="section-container">
          <SectionHeading
            eyebrow="The terms"
            title="What the referred organisation gets, and what you earn"
            intro="These are the programme's current terms. They apply to every referral you make while they stand."
          />

          <dl className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {figures.map((f) => (
              <div key={f.label} className="xw-tile flex flex-col p-6">
                <dt className="order-last mt-2 text-sm leading-relaxed text-neutral-600">{f.label}</dt>
                <dd className="flex flex-col gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-[0_1px_2px_rgb(16_18_31/0.06)]">
                    <f.icon className="h-5 w-5 text-primary-600" aria-hidden="true" />
                  </span>
                  <span className="font-heading text-2xl font-bold tracking-[-0.02em] text-neutral-900">{f.value}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="xw-glow-card p-6 sm:p-8">
              <h3 className="xw-h3">A worked example</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                An organisation you referred makes its first payment, at a list price of{" "}
                {formatMoney(EXAMPLE_LIST_MINOR, "NGN")}.
              </p>
              <dl className="mt-6 divide-y divide-neutral-200/70 rounded-[1.25rem] bg-neutral-50 text-sm">
                <div className="flex flex-wrap justify-between gap-2 px-5 py-4">
                  <dt className="text-neutral-600">List price</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">{formatMoney(EXAMPLE_LIST_MINOR, "NGN")}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 px-5 py-4">
                  <dt className="text-neutral-600">Referral discount ({discount})</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">-{formatMoney(exampleDiscount, "NGN")}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 px-5 py-4">
                  <dt className="text-neutral-600">The organisation pays</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">{formatMoney(examplePaid, "NGN")}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 rounded-b-[1.25rem] bg-primary-50 px-5 py-4">
                  <dt className="font-semibold text-primary-800">You earn ({commission} of the list price)</dt>
                  <dd className="font-heading text-lg font-bold tabular-nums text-primary-800">
                    {formatMoney(exampleCommission, "NGN")}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="xw-tile p-6 sm:p-8">
              <h3 className="xw-h3">The rules</h3>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-600">
                <li>
                  The discount and the commission apply to the referred organisation&apos;s first payment only.
                </li>
                <li>
                  A referral counts when the organisation signs up within {days(terms.cookieDays)} of following your
                  link, or enters your code. The last affiliate link followed is the one that counts.
                </li>
                <li>Payments our team records by hand, such as a bank transfer against an invoice, count too.</li>
                <li>
                  Commission waits {days(terms.holdDays)} before it is ready to pay. Commission on a payment that is
                  refunded can be reversed.
                </li>
                <li>
                  Our team pays commission by bank transfer, by hand. You add your bank details once you are approved.
                </li>
                <li>We review every application by hand, and can decline or suspend an affiliate account.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Questions. */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeading eyebrow="Questions" title="Before you apply" />
          <div className="mx-auto mt-12 max-w-3xl">
            <PricingFaq faqs={faqs(terms)} />
          </div>
        </div>
      </section>

      {/* 6. The application. */}
      <section id="apply" className="section-padding scroll-mt-24 bg-white">
        <div className="section-container">
          <SectionHeading
            eyebrow="Apply"
            title={terms.open ? "Apply to become an affiliate" : "We're not taking applications right now"}
            intro={
              terms.open
                ? "It takes a couple of minutes. Our team reviews every application by hand and replies by email."
                : "The programme isn't open to new affiliates at the moment. Affiliates already approved carry on as before."
            }
          />
          <div className="mx-auto mt-12 max-w-2xl">
            {terms.open ? (
              <AffiliateApplyForm />
            ) : (
              <div className="xw-tile flex items-start gap-4 p-6">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-neutral-600">
                  Want to hear when applications open again? Write to us from the{" "}
                  <Link
                    href="/support"
                    className="rounded font-semibold text-primary-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    help centre
                  </Link>{" "}
                  and we will let you know.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. The closing panel. */}
      <CtaPanel
        title="See what you would be recommending"
        intro="One workspace for learning, HR, projects and more, bought once."
        primary={{ label: "Explore the platform", href: "/platform" }}
        secondary={{ label: "View pricing", href: "/pricing" }}
      />
    </>
  );
}
