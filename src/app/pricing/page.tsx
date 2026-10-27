import type { Metadata } from "next";
import { CtaPanel } from "@/components/site/CtaPanel";
import { SectionHeading } from "@/components/site/SectionHeading";
import { BringYourOwn } from "@/components/pricing/BringYourOwn";
import { PriceCalculator } from "@/components/pricing/PriceCalculator";
import { AddOns, CarePlans, OnboardingPackages } from "@/components/pricing/PricingExtras";
import { PricingFaq } from "@/components/pricing/PricingFaq";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingOffers } from "@/components/pricing/PricingOffers";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { SpineIncludes } from "@/components/pricing/SpineIncludes";
import { lmsFetch } from "@/lib/api/server";
import { DEFAULT_PRICING, normalisePricing, type PublicModule } from "@/lib/api/public-pricing";

/**
 * Pricing: "Rent or Own", from the Pricing & Go-To-Market Strategy (23 October
 * 2026). XwiftHQ Cloud is a subscription per employee a month; XwiftHQ Own is a
 * one-time licence by company size with Care from year two; both price 1–5
 * modules at fixed shares of the suite, on three price lists (Nigeria in
 * naira, Africa and International in dollars).
 *
 * The prices come from `lib/pricing/price-book`, not the API: the platform
 * still serves the older one-time ladder. The API is read only for the
 * modules and whether each one has been released. Until Cloud checkout is
 * live, every plan button sends a request carrying the visitor's choice.
 */

const TITLE = "Pricing";
const DESCRIPTION =
  "Rent XwiftHQ per employee a month, or own it with a one-time licence sized to your company. Priced in naira and US dollars, free for up to 10 employees, with a 30-day trial of the whole suite.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: "XwiftHQ pricing: rent it or own it",
    description:
      "XwiftHQ Cloud per employee a month, or XwiftHQ Own as a one-time licence by company size. Free for up to 10 employees.",
    url: "/pricing",
  },
};

function faqs(modules: PublicModule[]) {
  const live = modules.filter((m) => m.status === "available").map((m) => m.label);
  const coming = modules.filter((m) => m.status === "coming_soon").map((m) => m.label);

  return [
    {
      question: "What is the difference between Cloud and Own?",
      answer:
        "Cloud is rented: you pay per employee a month, billed yearly, and hosting, updates and support are included. Own is bought: a one-time licence sized to your company that never expires, with Care from year two to keep it hosted, updated and supported. Owning costs more up front and less over time; for a 50-person company on the full suite it comes out cheaper after about three years. The calculator above works it out for yours.",
    },
    {
      question: "Who counts as an employee on Cloud?",
      answer:
        "Everyone with an active staff record in HR, or every active user if you don't take HR. Leavers stop counting the month they leave. Staff you add mid-term are charged only to the end of the term, and above 50 employees each extra person is priced in a cheaper volume band.",
    },
    {
      question: "Can I add modules later?",
      answer:
        "Yes. On Cloud, your company moves to the rate for the new number of modules from the next invoice, prorated. On Own, you pay only the difference between what you have and the new count inside your band, so adding a module later costs the same as buying it at the start. If you grow into a bigger band, you pay the difference between the two when you next renew Care or add modules.",
    },
    {
      question: "What is in XwiftHQ Free?",
      answer:
        "HR records, leave, documents, payroll and basic learning (up to three courses) for up to 10 employees, for as long as you like. The other modules show in preview. When you add your 11th employee, you move to Cloud or Own.",
    },
    {
      question: "How does the 30-day trial work?",
      answer:
        "You get the whole suite, at any company size, on a sample company or on your own data. At the end you choose Free or a paid plan, and nothing you entered is deleted. Yearly Cloud plans also carry a 90-day money-back guarantee.",
    },
    {
      question: "Which price list am I on, and does it include VAT?",
      answer:
        "Nigerian companies are invoiced in naira on the Nigeria list. Companies elsewhere in Africa, and Nigerian companies that prefer to pay in dollars, use the Africa list in US dollars; everyone else uses the International list. Prices exclude VAT, which is shown on the invoice (7.5% in Nigeria). Naira prices are reviewed each January, and any increase is capped at the lower of inflation and 10%.",
    },
    {
      question: "Can we spread the cost of owning?",
      answer:
        "Yes. Own the licence in 12 monthly payments (8% more in total) or 24 (15% more); ownership passes to you with the last payment. Founding customers can pay in six payments at no extra cost. On Cloud, paying three years up front takes 10% off.",
    },
    {
      question: "What happens if we stop paying for Care?",
      answer:
        "Your licence stays valid; Care is what keeps it hosted, updated and supported. We never lock a company out of its own data, and you can export all of it at any time. Talk to us and we'll set out the options for rejoining.",
    },
    {
      question: "What if XwiftHQ goes out of business?",
      answer:
        "An Own licence never expires, and your data exports in full at any time. Enterprise and government buyers can add source-code escrow: the code is lodged with an escrow agent and released to you if we stop trading or stop supporting the product.",
    },
    {
      question: "Can we buy the source code?",
      answer:
        "Not on the price list. Escrow answers the continuity question for most buyers. Enterprise-band companies and government can take a restricted source licence for internal use, from ₦120m or US$120,000, with Care Plus.",
    },
    ...(coming.length > 0
      ? [
          {
            question: `${coming.join(" and ")} ${coming.length === 1 ? "isn't" : "aren't"} released yet. What happens if I choose ${coming.length === 1 ? "it" : "them"}?`,
            answer: `${coming.length === 1 ? "It switches" : "They switch"} on for your company when released, as part of the plan you chose. Until then, ${live.join(", ")} ${live.length === 1 ? "is" : "are"} yours to use in full.`,
          },
        ]
      : []),
    {
      question: "We bought XwiftHQ on the old one-time price list. What changes?",
      answer:
        "Nothing you bought changes: your licence stands as sold, for good. We'll write to you personally about Care, which brings you updates and support at a Founding rate. Modules you add from now on are priced on the new size bands.",
    },
    {
      question: "Who becomes the admin of our company workspace?",
      answer:
        "The person who sends the request. Once our team sets up your workspace, they get an email with a log in link and a temporary password, and can add colleagues and give them roles from User management.",
    },
  ];
}

async function loadModules(): Promise<PublicModule[]> {
  try {
    const result = await lmsFetch("/public/pricing");
    return (result.ok ? normalisePricing(result.body) : DEFAULT_PRICING).modules;
  } catch {
    return DEFAULT_PRICING.modules;
  }
}

export default async function PricingPage() {
  const modules = await loadModules();

  return (
    <>
      {/* 1. The promise on the sky, with Free, Cloud and Own rising out of it, then Own by size. */}
      <PricingHero>
        <PricingPlans modules={modules} />
      </PricingHero>

      {/* 2. The launch offers. */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeading
            eyebrow="Launch offers"
            title="Join us early and pay less"
            intro="Three offers for the companies that move first, each with its terms in plain sight."
          />
          <div className="mt-14">
            <PricingOffers />
          </div>
        </div>
      </section>

      {/* 3. Price my company. */}
      <section id="calculator" className="scroll-mt-24 bg-white pb-16 sm:pb-20 lg:pb-24">
        <div className="section-container">
          <SectionHeading
            eyebrow="Price my company"
            title="What XwiftHQ costs your company"
            intro="Enter your headcount and modules to see renting and owning side by side, over five years."
          />
          <div className="mt-12">
            <PriceCalculator />
          </div>
        </div>
      </section>

      {/* 4. Care. */}
      <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
        <div className="section-container">
          <SectionHeading
            eyebrow="Care"
            title="Care keeps an owned licence current"
            intro="Every Own licence includes its first year of Care. After that it renews yearly, so hosting, updates, statutory changes and support never stop."
          />
          <div className="mx-auto mt-12 max-w-5xl">
            <CarePlans />
          </div>
        </div>
      </section>

      {/* 5. Onboarding and add-ons. */}
      <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
        <div className="section-container">
          <SectionHeading
            eyebrow="Onboarding"
            title="A fixed price to get you live"
            intro="One-time packages for Cloud and Own alike, sized to your team. Your first payroll runs within 14 working days."
          />
          <div className="mt-12">
            <OnboardingPackages />
          </div>

          <SectionHeading eyebrow="Add-ons" title="Extras, priced up front" className="mt-20" />
          <div className="mx-auto mt-12 max-w-4xl">
            <AddOns />
          </div>
        </div>
      </section>

      {/* 6. What every plan includes. */}
      <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
        <div className="section-container">
          <SectionHeading
            eyebrow="In every plan"
            title="The shared foundation comes with every plan"
            intro="Five modules work as one company suite because these pieces are shared. None of them is an upgrade or an extra."
          />
          <div className="mt-14">
            <SpineIncludes />
          </div>
        </div>
      </section>

      {/* 7. No AI tax. */}
      <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
        <div className="section-container">
          <BringYourOwn />
        </div>
      </section>

      {/* 8. Questions. */}
      <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
        <div className="section-container">
          <SectionHeading
            eyebrow="Questions"
            title="Before you buy"
            intro="The answers people ask for most often. Anything else, our team is a message away."
          />
          <div className="mx-auto mt-12 max-w-3xl">
            <PricingFaq faqs={faqs(modules)} />
          </div>
        </div>
      </section>

      {/* 9. The closing panel. */}
      <CtaPanel
        title="Run your whole company on one record"
        intro="Start free for up to 10 employees, try the whole suite for 30 days, or price your company in a minute."
        primary={{ label: "Price my company", href: "#calculator" }}
        secondary={{ label: "Already with XwiftHQ? Log in", href: "/login" }}
      />
    </>
  );
}
