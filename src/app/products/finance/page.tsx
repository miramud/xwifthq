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
  XwiftHQ Finance: the money side of the company.

  The page follows the public site's rhythm: the sky hero with the live
  Finance overview rising out of it, the figures as staggered cards, a bento
  of what the module is for, a tabbed tour of real screens, then the depth
  (newest work, the case, the deep dive, the full list, roles, flows) before
  the questions and the purple closing panel.

  Finance's gold cannot carry white text (2.15:1), so it only ever marks a
  dot or a glyph here; every button and heading stays purple.
*/

const product = getProduct("finance");

export const metadata: Metadata = {
  title: "Finance",
  description:
    "Books, spend control and project money in one module: a ledger with a proper close, payments from memo to bank, budgets that block, revenue and receivables, and one printable finance report for the whole company.",
  openGraph: {
    title: "XwiftHQ Finance",
    description:
      "Follow every payment from memo to bank line, see each project's expected spend beside its actual, and print one finance report for the company, on the same workspace as people, projects and operations.",
    url: "https://xwifthq.example.com/products/finance",
  },
};

const TOUR: readonly TourStop[] = [
  {
    id: "projects",
    label: "Project funds",
    title: "Every project's money on one screen",
    body: "Budget, released, committed, spent and still available for each project, with a status colour and earned value for leadership.",
    screen: <ProductScreenshot screen="financeProjects" hue={product.hue} />,
  },
  {
    id: "vouchers",
    label: "Vouchers",
    title: "Payment vouchers from memo to bank",
    body: "Each voucher keeps its memo, its checks, the withholding tax and the bank line that confirmed it. Numbers never skip.",
    screen: <ProductScreenshot screen="financeVouchers" hue={product.hue} />,
  },
  {
    id: "banking",
    label: "Banking",
    title: "Statements in, reconciled out",
    body: "Bring in statements as PDF or CSV, let your rules sort the lines, match them to the ledger and print the reconciliation.",
    screen: <ProductScreenshot screen="financeBanking" hue={product.hue} />,
  },
  {
    id: "budgets",
    label: "Budgets",
    title: "Budgets checked as money moves",
    body: "Set budgets by cost centre and account, choose whether each line blocks or warns, and watch spend and commitments land in real time.",
    screen: <ProductScreenshot screen="financeBudgets" hue={product.hue} />,
  },
  {
    id: "approvals",
    label: "Approvals",
    title: "One inbox for every sign off",
    body: "Memos, vouchers, fund releases and budgets wait beside leave and purchases, with a second factor on large approvals.",
    screen: <ProductScreenshot screen="approvals" hue={product.hue} />,
  },
];

export default function FinanceProductPage() {
  return (
    <>
      <ProductHero
        product={product}
        title={
          <>
            Close the books with confidence.
            <br className="hidden sm:block" /> Every month.
          </>
        }
        roles={["Finance lead", "Accountant", "Budget holder", "Managing director"]}
      >
        <ProductScreenshot screen="financeDashboard" hue={product.hue} priority />
      </ProductHero>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            title="Why finance teams choose XwiftHQ"
            intro="Facts about how the module is built, each one something you can check in the product."
          />
          <div className="mt-14">
            <StatStrip stats={product.stats} />
          </div>
        </div>
      </section>

      <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
        <div className="section-container">
          <SectionHeader
            eyebrow="What it does"
            title="Everything the money side needs, built in"
            intro="One ledger, one way to approve, every project's money in view, and a close that never relies on someone's memory."
          />
          <div className="mt-14">
            <PillarGrid pillars={product.pillars} hue={product.hue} />
          </div>
        </div>
      </section>

      <section className="section-padding overflow-hidden bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Inside the product"
            title="The screens your finance team works in"
            intro="Captured from a demo company's real books. Pick a screen to see what it does."
          />
          <div className="mt-12">
            <ScreenTour stops={TOUR} label="Finance screens" ruleClass={HUE[product.hue].rule} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="New in Finance"
            title="Every project reconciled. One report for the company."
            intro="Each project now shows its expected spend beside its actual, and the whole company's finances print as one document."
          />
          <div className="mt-14 space-y-16 lg:mt-20 lg:space-y-24">
            <ScreenFeature
              eyebrow="On the project itself"
              title="Expected spend beside actual"
              body="The approved project budget is the expected spend. Next to it sits what the project really used: labour at each person's rate, travel, workshops, purchases and memos. The project manager sees a gap long before leadership does."
              points={[
                "Labour costed from logged hours at each person's rate card",
                "Travel, workshops, purchases and memos counted once, by category",
                "Project managers draft and submit the budget from the project",
                "Money is shown only to people allowed to see cost",
              ]}
              screen="projectsFinance"
              hue={product.hue}
            />
            <ScreenFeature
              eyebrow="For the board"
              title="The company finance report"
              body="Choose a period and get every analysis in one place: the statements, budget against actual, each project, spend by category, cost centre and payee, and every request with the name of whoever raised it."
              points={[
                "Receivables, payables, advances, tax, assets, labour and approvals",
                "Spend counted once, whichever module recorded it",
                "A branded PDF with a QR code to verify it, or an Excel workbook",
              ]}
              screen="financeCompanyReport"
              hue={product.hue}
              reverse
            />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <FinanceCase />
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="How it works"
            title="From the chart of accounts to the bank line"
            intro="Four parts of the module, and what each one does when money is requested, spent or received."
          />
          <div className="mt-14 lg:mt-20">
            <FinanceDeepDive />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Everything in it"
            title="The full feature list"
            intro="Every answer to “but does it do…”, written down rather than implied."
          />
          <div className="mt-14">
            <CapabilityColumns capabilities={product.capabilities} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Who uses it"
            title="Four roles, four starting screens"
            intro="The same books, scoped to what each person answers for, with duties kept apart."
          />
          <div className="mt-14">
            <FinanceRoles />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <CrossModuleFlows
            only="finance"
            heading="Where Finance fits in the workspace"
            intro="The flows across modules that end in the company's books. Each step names the module that acts."
          />
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connected"
            title="What the other modules hand to Finance"
            intro="One organisation, one set of permissions, one audit log. That is why none of this needs an integration."
          />
          <div className="mt-14">
            <ProductConnections product={product} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader eyebrow="Questions" title="Good questions to ask first" />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={product.faqs} />
          </div>
        </div>
      </section>

      <CtaBanner
        title="Run the company's money beside its people and projects"
        intro="Finance shares one login, one approvals inbox and one audit log with every other XwiftHQ module."
        primary={{ label: `Open ${product.shortName}`, href: product.appHref }}
        secondary={{ label: "See how it all connects", href: "/platform" }}
      />
    </>
  );
}
