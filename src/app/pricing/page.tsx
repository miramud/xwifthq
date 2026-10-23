import type { Metadata } from "next";
import { CtaBanner } from "@/components/platform/CtaBanner";
import { FaqAccordion } from "@/components/platform/FaqAccordion";
import { SectionHeader } from "@/components/platform/SectionHeader";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { SpineIncludes } from "@/components/pricing/SpineIncludes";
import { WhyOneTime } from "@/components/pricing/WhyOneTime";
import { lmsFetch } from "@/lib/api/server";
import { DEFAULT_PRICING, normalisePricing, type PublicPricing } from "@/lib/api/public-pricing";

/**
 * Pricing.
 *
 * The model the owner set on 26 September 2026: modules are bought **once**,
 * priced by how many you take, in naira or dollars; the full source code and a
 * dedicated server are by request. The prices come from the platform's own
 * list (`GET /public/pricing`), which the owner edits in the Platform console.
 * If the API can't be reached the page shows the owner's published ladder —
 * the same numbers a fresh platform starts with — rather than an empty page.
 */

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Buy Elevate once. Choose one to five modules for a one-time price in naira or dollars, own the full source code, or add a dedicated server on your own domain.",
  openGraph: {
    title: "Elevate pricing — buy once, keep it",
    description:
      "One-time pricing by number of modules, full source code ownership, and dedicated hosting on your own domain.",
    url: "/pricing",
  },
};

/**
 * The questions whose honest answer depends on whether modules are sold
 * online right now (`paymentsEnabled`): while they aren't, a request goes to
 * our team, who invoice and switch the modules on.
 */
function faqs(paymentsEnabled: boolean) {
  return [
    {
      question: "Is it really a one-time payment?",
      answer:
        "Yes. You pay once for the modules you choose and they stay switched on for your organisation. There is no renewal, because the services that cost money to run — storage, AI, email and messaging — are ones you connect and pay for directly.",
    },
    {
      question: "Can I add modules later?",
      answer: paymentsEnabled
        ? "Yes. Your organisation's admin adds them from Plan & billing and pays only the difference between the bundle you have and the next one. Buying two modules and adding a third later costs the same as buying three at once."
        : "Yes. Your organisation's admin requests them from Plan & billing, and our team invoices only the difference between the bundle you have and the next one. Buying two modules and adding a third later costs the same as buying three at once.",
    },
    {
      question: "Finance and Admin aren't released yet. What do I get if I choose them?",
      answer:
        "They are part of your purchase and switch on for your organisation when they are released, at no extra cost. Until then the modules you can use today — Learning, HR and Projects — are fully available.",
    },
    {
      question: "Which currency will I pay in?",
      answer: paymentsEnabled
        ? "Choose naira or US dollars before you pay. The price shown is the price charged; card payments are handled by our payment partner, and the currency options depend on what it accepts."
        : "Choose naira or US dollars when you send your request. The price shown is the one-time price our team invoices; nothing is charged online.",
    },
    ...FAQS,
    {
      question: "Who becomes the admin of our organisation?",
      answer: paymentsEnabled
        ? "Whoever completes the purchase. They get an email with a sign-in link and a temporary password, and can add colleagues and give them roles from User management."
        : "The person who sends the request. Once our team switches your modules on, they get an email with a sign-in link and a temporary password, and can add colleagues and give them roles from User management.",
    },
  ];
}

const FAQS = [
  {
    question: "What does owning the source code include?",
    answer:
      "The codebase for every module and the shared spine, under a licence agreement, handed over by our team. You run it on your own infrastructure and can change it however you need. It is arranged by request: we send the agreement and an invoice.",
  },
  {
    question: "What does a dedicated server cost?",
    answer:
      "It depends on the size of your organisation, so our technical team quotes it with you. It is billed yearly, on top of your one-time purchase, and the team sets it up on your domain and migrates your data.",
  },
];

async function loadPricing(): Promise<PublicPricing> {
  try {
    const result = await lmsFetch("/public/pricing");
    return result.ok ? normalisePricing(result.body) : DEFAULT_PRICING;
  } catch {
    return DEFAULT_PRICING;
  }
}

export default async function PricingPage() {
  const pricing = await loadPricing();

  return (
    <>
      <PricingHero />

      {/* 1 — the three ways to buy */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="One-time pricing"
            title="Choose how many modules. Pay once."
            intro="Every bundle includes the shared spine. The more modules you take, the less each one costs."
          />
          <div className="mt-12">
            <PricingPlans pricing={pricing} />
          </div>
        </div>
      </section>

      {/* 2 — why one-time */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <WhyOneTime />
        </div>
      </section>

      {/* 3 — what every module includes */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Always included"
            title="The spine comes with every bundle"
            intro="Five modules are a suite only because these are shared. None of them is an upgrade."
          />
          <div className="mt-14">
            <SpineIncludes />
          </div>
        </div>
      </section>

      {/* 4 — FAQ */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader eyebrow="Questions" title="Before you buy" />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={faqs(pricing.paymentsEnabled)} />
          </div>
        </div>
      </section>

      {/* 5 — CTA */}
      <CtaBanner
        title="Set up your organisation in a few minutes"
        intro="Choose your modules, pay once, and sign in as your organisation's admin straight away."
        primary={{ label: "Get started", href: "/get-started" }}
        secondary={{ label: "Already on Elevate? Sign in", href: "/login" }}
      />
    </>
  );
}
