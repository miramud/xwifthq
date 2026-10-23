import type { Metadata } from "next";

import { CapabilityColumns } from "@/components/platform/CapabilityColumns";
import { CrossModuleFlows } from "@/components/platform/CrossModuleFlows";
import { CtaBanner } from "@/components/platform/CtaBanner";
import { FaqAccordion } from "@/components/platform/FaqAccordion";
import { PillarGrid } from "@/components/platform/PillarGrid";
import { ProductConnections } from "@/components/platform/ProductConnections";
import { ProductHero } from "@/components/platform/ProductHero";
import { ProductScreenshot } from "@/components/platform/ProductScreenshot";
import { SectionHeader } from "@/components/platform/SectionHeader";
import { StatStrip } from "@/components/platform/StatStrip";
import { FinanceCase } from "@/suite/finance/components/marketing/FinanceCase";
import { FinanceDeepDive } from "@/suite/finance/components/marketing/FinanceDeepDive";
import { FinanceRoles } from "@/suite/finance/components/marketing/FinanceRoles";
import { ScreenFeature } from "@/suite/finance/components/marketing/ScreenFeature";
import { ScreenTour, type TourStop } from "@/suite/finance/components/marketing/ScreenTour";
import { HUE, getProduct } from "@/lib/products";

/*
  Elevate Finance — the money side of the company, sold to the company.

  Finance's hue is Summit Gold, and Summit Gold is the one colour here that
  cannot carry white text: #E6A532 behind white is 2.15:1, a flat WCAG failure,
  while behind Ink it is 7.7:1. So on this page and every component under
  `suite/finance/components/marketing/`:

    bg-accent-500  →  always text-neutral-900
    gold text      →  text-accent-700  (5.5:1)
    gold glyphs    →  text-accent-600  (3.4:1, the non-text threshold)

  And every CTA stays teal — here, on the hero, and in the closing band. The
  temptation on a money page is to make everything gold; the discipline is that
  gold marks the *numbers* and teal carries the structure. Teal leads, gold
  rewards. Five products that each recoloured their buttons would stop reading
  as one company.

  The page leads with real screens (owner, 9 Oct 2026): the live Finance
  overview in the hero, a tour of five working screens, then the two newest
  pieces — project expected-vs-actual and the company finance report — each
  told against its own screen. The hand-drawn visuals stay for the deep dive,
  where they explain a mechanism a screenshot cannot.
*/

const product = getProduct("finance");

export const metadata: Metadata = {
  title: "Finance",
  description:
    "The company's books, spend control and project funds in one module: ledger and close, memo-to-bank payments, budgets that block, revenue and receivables, and a printable company finance report.",
  openGraph: {
    title: "Elevate Finance",
    description:
      "Every payment from memo to bank line, every project's expected expense against actual, and one finance report for the whole company — on the same suite as HR, Projects and Operations.",
    url: "https://elevate.example.com/products/finance",
  },
};

const TOUR: readonly TourStop[] = [
  {
    id: "projects",
    label: "Project funds",
    title: "Every project's funds at a glance",
    body: "Budget, released, committed, spent and available for each project — with RAG status and earned value for the managing director.",
    screen: <ProductScreenshot screen="financeProjects" hue={product.hue} />,
  },
  {
    id: "vouchers",
    label: "Vouchers",
    title: "Payment vouchers, memo to bank",
    body: "Each voucher carries its memo, its checkpoints, the withholding tax and the bank line that confirmed it — numbered without gaps.",
    screen: <ProductScreenshot screen="financeVouchers" hue={product.hue} />,
  },
  {
    id: "banking",
    label: "Banking",
    title: "Bank statements, reconciled",
    body: "Import statements as PDF or CSV, let your rules classify the lines, pair them with the ledger and print the reconciliation.",
    screen: <ProductScreenshot screen="financeBanking" hue={product.hue} />,
  },
  {
    id: "budgets",
    label: "Budgets",
    title: "Company budgets against actual",
    body: "Budgets by cost centre and account, each line set to block or warn, with spend and commitments counted as they happen.",
    screen: <ProductScreenshot screen="financeBudgets" hue={product.hue} />,
  },
  {
    id: "approvals",
    label: "Approvals",
    title: "One approvals inbox",
    body: "Memos, vouchers, fund releases and budgets wait in the same inbox as leave and purchases, with a second factor on high-value approvals.",
    screen: <ProductScreenshot screen="approvals" hue={product.hue} />,
  },
];

export default function FinanceProductPage() {
  return (
    <main>
      {/* 1 — the hero: the live Finance overview leads. */}
      <ProductHero product={product}>
        <div>
          <ProductScreenshot screen="financeDashboard" hue={product.hue} priority />
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            The live Finance overview — month-by-month close, cash at bank,
            surplus, and the work waiting on each team.
          </p>
        </div>
      </ProductHero>

      {/* 2 — the figures */}
      <section className="bg-white pt-14 sm:pt-16">
        <div className="section-container">
          <StatStrip stats={product.stats} hue={product.hue} />
        </div>
      </section>

      {/* 3 — tour the module, on real screens */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Tour the module"
            title="The screens your finance team works in"
            intro="Captured from the running suite, on a demo company's real books. Pick a screen to see what it is for."
            hue={product.hue}
          />
          <div className="mt-12 lg:mt-16">
            <ScreenTour stops={TOUR} label="Finance screens" ruleClass={HUE[product.hue].rule} />
          </div>
        </div>
      </section>

      {/* 4 — the newest work, each piece against its own screen */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Newest in Finance"
            title="Every project reconciled. One report for the whole company."
            intro="Each project's expected expense now sits beside what it really spent, and the whole company's finances print as one document."
            hue={product.hue}
          />
          <div className="mt-14 space-y-16 lg:mt-20 lg:space-y-24">
            <ScreenFeature
              eyebrow="On the project itself"
              title="Expected expense against actual"
              body="The approved project budget is the expected expense. Beside it sits what the project really spent — labour at the rate card, travel, workshops, purchases and memos — so the gap is visible to the project manager long before it reaches the managing director."
              points={[
                "Labour costed from logged hours at each person's rate card",
                "Travel, workshops, purchases and memos counted once, by category",
                "Project managers draft and submit the budget from the project",
                "Money shown only to people allowed to see cost",
              ]}
              screen="projectsFinance"
              hue={product.hue}
            />
            <ScreenFeature
              eyebrow="For the board"
              title="The company finance report"
              body="Pick a period and get every analysis in one document: the statements, budget against actual, every project, spend by category, cost centre and payee, and every request with the name of the person who raised it."
              points={[
                "Receivables, payables, advances, tax, assets, labour and approvals",
                "Spend counted once, whichever module recorded it",
                "A branded landscape PDF with a QR code to verify it, or an Excel workbook",
              ]}
              screen="financeCompanyReport"
              hue={product.hue}
              reverse
            />
          </div>
        </div>
      </section>

      {/* 5 — the case */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <FinanceCase />
        </div>
      </section>

      {/* 6 — the six pillars */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="What it is for"
            title="What a company's finance module has to get right"
            intro="One ledger, one approval model, every project's money in view, and a close that does not depend on anyone remembering what happened in week two."
            hue={product.hue}
          />
          <div className="mt-14">
            <PillarGrid pillars={product.pillars} hue={product.hue} />
          </div>
        </div>
      </section>

      {/* 7 — the deep dive, where the page earns its keep */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="In detail"
            title="From the chart of accounts to the bank line"
            intro="Four parts of the module, and what each one does when money is asked for, spent or received."
            hue={product.hue}
          />
          <div className="mt-14 lg:mt-20">
            <FinanceDeepDive />
          </div>
        </div>
      </section>

      {/* 8 — the full inventory */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Everything in it"
            title="The full capability list"
            intro="The answer to “but does it do…”, written out rather than implied."
            hue={product.hue}
          />
          <div className="mt-14">
            <CapabilityColumns capabilities={product.capabilities} hue={product.hue} />
          </div>
        </div>
      </section>

      {/* 9 — who opens it */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Who it is for"
            title="Four roles, four different first screens"
            intro="The same books, scoped by what each person is accountable for — with separation of duties between them."
            hue={product.hue}
          />
          <div className="mt-14">
            <FinanceRoles />
          </div>
        </div>
      </section>

      {/* 10 — the flows Finance takes part in */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <CrossModuleFlows
            only="finance"
            heading="Where Finance sits in the suite"
            intro="The cross-module flows that end in the company's books. Every step names the module that acts."
          />
        </div>
      </section>

      {/* 11 — how it meets the rest of the suite */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connections"
            title="What the rest of the suite hands to Finance"
            intro="One organisation, one permission model, one audit log — which is why none of this is an integration."
            hue={product.hue}
          />
          <div className="mt-14">
            <ProductConnections product={product} />
          </div>
        </div>
      </section>

      {/* 12 — questions */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader eyebrow="Questions" title="The ones worth asking first" hue={product.hue} />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={product.faqs} />
          </div>
        </div>
      </section>

      {/* 13 — the closing band. Teal, like every CTA on the site. */}
      <CtaBanner
        title="Run the company's money on the same suite as its people and projects"
        intro="Finance works alongside HR, Projects, Admin & Operations and Learning — one sign-in, one approvals inbox, one audit log."
        primary={{ label: `Open ${product.shortName}`, href: product.appHref }}
        secondary={{ label: "How the suite fits together", href: "/platform" }}
      />
    </main>
  );
}
