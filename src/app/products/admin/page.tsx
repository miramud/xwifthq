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
import { AdminCase } from "@/suite/admin/components/marketing/AdminCase";
import { AdminDeepDive } from "@/suite/admin/components/marketing/AdminDeepDive";
import { AdminRoles } from "@/suite/admin/components/marketing/AdminRoles";
import { ScreenFeature } from "@/suite/finance/components/marketing/ScreenFeature";
import { ScreenTour, type TourStop } from "@/suite/finance/components/marketing/ScreenTour";
import { HUE, getProduct } from "@/lib/products";

/*
  XwiftHQ Admin and Operations: the running of the company that every other
  module leans on (buying, travel, events, assets, stores, premises, fleet and
  compliance).

  Same rhythm as every module page: the sky hero with the live Operations
  overview, the figures, a bento of what it is for, a tabbed tour of real
  screens, then the depth before the questions and the purple closing panel.

  The in app module is "Operations" (/suite/operations); the registry slug
  stays "admin".
*/

const product = getProduct("admin");

export const metadata: Metadata = {
  title: "Admin & Operations",
  description:
    "Run the company's operations in one module: purchasing through a three way match, travel by policy, events with budgets, assets, stores, maintenance, premises, fleet, documents and compliance.",
  openGraph: {
    title: "XwiftHQ Admin & Operations",
    description:
      "Purchasing, travel, events, assets, stores, fleet and compliance, approved by your own rules, with every project charge held against its funds before money moves.",
    url: "https://xwifthq.example.com/products/admin",
  },
};

const TOUR: readonly TourStop[] = [
  {
    id: "travel",
    label: "Travel",
    title: "The travel desk and its calendar",
    body: "Trips priced by the policy for each grade, advances raised, bookings and changes on record, plus a calendar of who is away.",
    screen: <ProductScreenshot screen="opsTravel" hue={product.hue} />,
  },
  {
    id: "events",
    label: "Events",
    title: "Events, workshops and engagements",
    body: "Every event has a budget, and its lines feed the purchases, trips and advances that deliver it, charged to the right project.",
    screen: <ProductScreenshot screen="opsEvents" hue={product.hue} />,
  },
  {
    id: "assets",
    label: "Assets",
    title: "The asset register",
    body: "Each asset has a custodian and a full history: handovers, gate passes, checks and exit clearance tied to final pay.",
    screen: <ProductScreenshot screen="opsAssets" hue={product.hue} />,
  },
  {
    id: "stores",
    label: "Stores",
    title: "Stores and stock",
    body: "A stock ledger behind every item. Requisitions are issued on an SIV, counts are approved by a second person and reorder levels are checked every hour.",
    screen: <ProductScreenshot screen="opsStores" hue={product.hue} />,
  },
  {
    id: "fleet",
    label: "Fleet",
    title: "Vehicles, papers and bookings",
    body: "Vehicle papers sit on the compliance calendar, bookings and trips are logged, and servicing is raised as a work order.",
    screen: <ProductScreenshot screen="opsFleet" hue={product.hue} />,
  },
];

export default function AdminProductPage() {
  return (
    <>
      <ProductHero
        product={product}
        title={
          <>
            The everyday running of your company.
            <br className="hidden sm:block" /> Sorted.
          </>
        }
        roles={["Procurement", "Travel desk", "Storekeeper", "Facilities"]}
      >
        <ProductScreenshot screen="operationsDashboard" hue={product.hue} priority />
      </ProductHero>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            title="Why operations teams choose XwiftHQ"
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
            title="Everything it takes to keep the company running"
            intro="Buying, travelling, looking after assets, maintaining and proving compliance. Each has an owner, an approval and a record."
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
            title="The screens your operations team works in"
            intro="Captured from a demo company's live records. Pick a screen to see what it does."
          />
          <div className="mt-12">
            <ScreenTour stops={TOUR} label="Admin and Operations screens" ruleClass={HUE[product.hue].rule} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Shared foundations"
            title="Your rules, your structure, one inbox"
            intro="Operations runs on the same organisation, approvals and audit log as Finance, HR and Projects. You set it up once for the whole company."
          />
          <div className="mt-14 space-y-16 lg:mt-20 lg:space-y-24">
            <ScreenFeature
              eyebrow="Approvals"
              title="Every request in one approvals inbox"
              body="Purchase requests, trips, events, asset requests and stock issues wait beside leave, memos and vouchers. Each one follows the rules your organisation sets: head of department first, then the managing director above a set amount."
              points={[
                "Approval routes, levels, amounts and roles set per organisation",
                "Project charges held against the project's funds once approved",
                "A request stops early if the project cannot cover it",
              ]}
              screen="approvals"
              hue={product.hue}
            />
            <ScreenFeature
              eyebrow="Organisation console"
              title="Describe the company once"
              body="Departments, units, cost centres, roles, approval policies and document numbering live in one console. Every module reads the same structure, so nobody keeps a second copy."
              points={[
                "Units and cost centres that every module charges to",
                "Ready made roles for procurement, stores, travel and assets, plus your own",
                "Your own number formats for orders, vouchers and letters",
              ]}
              screen="orgConsole"
              hue={product.hue}
              reverse
            />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <AdminCase />
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="How it works"
            title="From purchase request to audit trail"
            intro="Four parts of the module, and what each one produces for Finance, HR and Projects to rely on."
          />
          <div className="mt-14 lg:mt-20">
            <AdminDeepDive />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Everything in it"
            title="The full feature list"
            intro="Every register and the workflow that keeps it up to date, written down rather than implied."
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
            title="The people who keep the company running"
            intro="The roles that open Operations every day, and the queue each of them comes to clear."
          />
          <div className="mt-14">
            <AdminRoles />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <CrossModuleFlows
            only="admin"
            heading="Where Operations fits in the workspace"
            intro="The flows across modules that start in or pass through Operations. Each step names the module that acts."
          />
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connected"
            title="What Operations hands to the other modules"
            intro="One identity, one structure, one approvals engine and one audit log. That is why none of this needs an integration."
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
        title="Run operations on the same workspace as your money"
        intro="Operations shares one login, one approvals inbox and one audit log with every other XwiftHQ module."
        primary={{ label: `Open ${product.shortName}`, href: product.appHref }}
        secondary={{ label: "See how it all connects", href: "/platform" }}
      />
    </>
  );
}
