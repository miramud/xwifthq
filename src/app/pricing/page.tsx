import type { Metadata } from "next";
import { CtaPanel } from "@/components/site/CtaPanel";
import { SectionHeading } from "@/components/site/SectionHeading";
import { PricingFaq } from "@/components/pricing/PricingFaq";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { SpineIncludes } from "@/components/pricing/SpineIncludes";
import { WhyOneTime } from "@/components/pricing/WhyOneTime";
import { lmsFetch } from "@/lib/api/server";
import { DEFAULT_PRICING, normalisePricing, type PublicPricing } from "@/lib/api/public-pricing";

/**
 * Pricing.
 *
 * The model the owner set on 26 September 2026: modules are bought once,
 * priced by how many you take, in naira or dollars; the full source code and a
 * dedicated server are by request. The prices come from the platform's own
 * list (`GET /public/pricing`), which the owner edits in the Platform console.
 * If the API can't be reached the page shows the owner's published ladder (the
 * same numbers a fresh platform starts with) rather than an empty page.
 */

const TITLE = "Pricing";
const DESCRIPTION =
  "Buy XwiftHQ once. Choose one to five modules for a one-time price in naira or US dollars, own the full source code, or add a dedicated server on your own domain.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: "XwiftHQ pricing: pay once, keep it",
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
        "Yes. You pay once for the modules you choose and they stay switched on for your company. There is no renewal, because the services that cost money to run (storage, AI, email and messaging) are ones you connect and pay for directly.",
    },
    {
      question: "Can I add modules later?",
      answer: paymentsEnabled
        ? "Yes. Your company's admin adds them from Plan and billing and pays only the difference between the bundle you have and the next one. Buying two modules and adding a third later costs the same as buying three at once."
        : "Yes. Your company's admin requests them from Plan and billing, and our team invoices only the difference between the bundle you have and the next one. Buying two modules and adding a third later costs the same as buying three at once.",
    },
    {
      question: "Finance and Admin aren't released yet. What do I get if I choose them?",
      answer:
        "They are part of your purchase and switch on for your company when they are released, at no extra cost. Until then the modules available today (Learning, HR and Projects) are yours to use in full.",
    },
    {
      question: "Which currency will I pay in?",
      answer: paymentsEnabled
        ? "Choose naira or US dollars before you pay. The price shown is the price charged. Card payments are handled by our payment partner, and the currency options depend on what it accepts."
        : "Choose naira or US dollars when you send your request. The price shown is the one-time price our team invoices, and nothing is charged online.",
    },
    ...FAQS,
    {
      question: "Who becomes the admin of our company workspace?",
      answer: paymentsEnabled
        ? "Whoever completes the purchase. They get an email with a log in link and a temporary password, and can add colleagues and give them roles from User management."
        : "The person who sends the request. Once our team switches your modules on, they get an email with a log in link and a temporary password, and can add colleagues and give them roles from User management.",
    },
  ];
}

const FAQS = [
  {
    question: "What does owning the source code include?",
    answer:
      "The codebase for every module and the shared foundation beneath them, under a licence agreement, handed over by our team. You host it on your own infrastructure and can change it however you need. It is arranged by request: we send the agreement and an invoice.",
  },
  {
    question: "What does a dedicated server cost?",
    answer:
      "It depends on the size of your company, so our technical team quotes it with you. It is billed yearly on top of your one-time purchase, and the team sets it up on your domain and moves your data across.",
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
      {/* 1. The promise on the sky, with the ways to buy rising out of it. */}
      <PricingHero>
        <PricingPlans pricing={pricing} />
      </PricingHero>

      {/* 2. What every plan includes. */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeading
            eyebrow="In every plan"
            title="The shared foundation comes with every bundle"
            intro="Five modules work as one company suite because these pieces are shared. None of them is an upgrade or an extra."
          />
          <div className="mt-14">
            <SpineIncludes />
          </div>
        </div>
      </section>

      {/* 3. Why one time. */}
      <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
        <div className="section-container">
          <WhyOneTime />
        </div>
      </section>

      {/* 4. Questions. */}
      <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
        <div className="section-container">
          <SectionHeading
            eyebrow="Questions"
            title="Before you buy"
            intro="The answers people ask for most often. Anything else, our team is a message away."
          />
          <div className="mx-auto mt-12 max-w-3xl">
            <PricingFaq faqs={faqs(pricing.paymentsEnabled)} />
          </div>
        </div>
      </section>

      {/* 5. The closing panel. */}
      <CtaPanel
        title="Set up your company workspace in minutes"
        intro="Choose your modules, pay once, and log in as your company's admin straight away."
        primary={{ label: "Get started", href: "/get-started" }}
        secondary={{ label: "Already with XwiftHQ? Log in", href: "/login" }}
      />
    </>
  );
}
