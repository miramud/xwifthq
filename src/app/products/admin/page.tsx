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
  Elevate Admin & Operations — the page with no hue, on purpose.

  Every other product page has a colour to lean on. This one has ink, mist,
  hairlines and space, because Admin & Operations is the chassis: purchasing,
  travel, events, assets, stores, premises, fleet and compliance — the running
  of the company that the other modules hang off. Its restraint is the
  argument, so the hierarchy here is carried by typography and structure
  rather than by a fifth brand colour borrowed to fill the gap.

  The one place other hues appear is the cross-module flows, a diagram *about*
  the other modules, where telling them apart is the reader's actual task. The
  shared three-way-match diagram is drawn in its neutral tone here so Finance's
  gold does not leak onto this page.

  The in-app module is "Operations" (/suite/operations); the registry slug
  stays "admin". The page leads with the live Operations overview, then tours
  five working screens (owner, 9 Oct 2026: real screens, every module live).

  Teal still carries every CTA, here as on all five pages.
*/

const product = getProduct("admin");

export const metadata: Metadata = {
  title: "Admin & Operations",
  description:
    "Run the company's operations in one module: procurement to a three-way match, travel by policy, events with budgets, assets, stores, maintenance, premises, fleet, documents and compliance.",
  openGraph: {
    title: "Elevate Admin & Operations",
    description:
      "Purchasing, travel, events, assets, stores, fleet and compliance — approved by your own rules, and every project charge committed against its funds before the money moves.",
    url: "https://elevate.example.com/products/admin",
  },
};

const TOUR: readonly TourStop[] = [
  {
    id: "travel",
    label: "Travel",
    title: "The travel desk and its calendar",
    body: "Trips priced by the policy for each grade, advances raised, bookings and changes recorded — and a calendar of who is away.",
    screen: <ProductScreenshot screen="opsTravel" hue={product.hue} />,
  },
  {
    id: "events",
    label: "Events",
    title: "Events, workshops and engagements",
    body: "Each event carries a budget; its lines feed the purchases, trips and advances that deliver it, charged to the right project.",
    screen: <ProductScreenshot screen="opsEvents" hue={product.hue} />,
  },
  {
    id: "assets",
    label: "Assets",
    title: "The asset register",
    body: "Every asset with a custodian and a history — handovers, gate passes, verification and exit clearance linked to final pay.",
    screen: <ProductScreenshot screen="opsAssets" hue={product.hue} />,
  },
  {
    id: "stores",
    label: "Stores",
    title: "Stores and stock",
    body: "A stock ledger behind every item: requisitions issued on an SIV, counts approved by a second person, reorder checked hourly.",
    screen: <ProductScreenshot screen="opsStores" hue={product.hue} />,
  },
  {
    id: "fleet",
    label: "Fleet",
    title: "Fleet: vehicles, papers and bookings",
    body: "Vehicles with their papers on the compliance calendar, bookings and trips logged, and servicing raised as work orders.",
    screen: <ProductScreenshot screen="opsFleet" hue={product.hue} />,
  },
];

export default function AdminProductPage() {
  return (
    <main>
      {/* 1 — the hero: the live Operations overview leads. */}
      <ProductHero product={product}>
        <div>
          <ProductScreenshot screen="operationsDashboard" hue={product.hue} priority />
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            The live Operations overview — purchasing, deliveries, trips,
            events and stock, with what is waiting on whom.
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
            title="The screens your operations team works in"
            intro="Captured from the running suite, on a demo company's real records. Pick a screen to see what it is for."
            hue={product.hue}
          />
          <div className="mt-12 lg:mt-16">
            <ScreenTour stops={TOUR} label="Admin & Operations screens" ruleClass={HUE[product.hue].rule} />
          </div>
        </div>
      </section>

      {/* 4 — the suite underneath: one inbox, one organisation */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Across the suite"
            title="Your rules, your structure, one inbox"
            intro="Operations runs on the same organisation, approval engine and audit log as Finance, HR and Projects — set up once for the whole company."
            hue={product.hue}
          />
          <div className="mt-14 space-y-16 lg:mt-20 lg:space-y-24">
            <ScreenFeature
              eyebrow="Approvals"
              title="Every request in one approvals inbox"
              body="Purchase requests, trips, events, asset requests and stock issues wait beside leave, memos and vouchers. Each routes by the rules your organisation publishes — head of department first, the managing director above a band."
              points={[
                "Approval routes, levels, bands and roles set per organisation",
                "Project charges committed against Finance's project funds on approval",
                "Short project funds stop a request before money is committed",
              ]}
              screen="approvals"
              hue={product.hue}
            />
            <ScreenFeature
              eyebrow="Organisation console"
              title="The company, defined once"
              body="Departments, units, cost centres, roles, approval policies and document numbering live in one console. Operations, Finance, HR and Projects all read the same structure, so nobody keeps a second copy."
              points={[
                "Org units and cost centres every module charges to",
                "Starter roles for procurement, stores, travel and assets, plus your own",
                "Your own numbering formats for orders, vouchers and letters",
              ]}
              screen="orgConsole"
              hue={product.hue}
              reverse
            />
          </div>
        </div>
      </section>

      {/* 5 — the case */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <AdminCase />
        </div>
      </section>

      {/* 6 — the pillars */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="What it is for"
            title="What running a company's operations takes"
            intro="Buying, travelling, holding, maintaining and proving — each with an owner, an approval and a record."
            hue={product.hue}
          />
          <div className="mt-14">
            <PillarGrid pillars={product.pillars} hue={product.hue} />
          </div>
        </div>
      </section>

      {/* 7 — the deep dive */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="In detail"
            title="From the purchase request to the audit trail"
            intro="Four parts of the module, and what each one produces that Finance, HR or Projects then relies on."
            hue={product.hue}
          />
          <div className="mt-14 lg:mt-20">
            <AdminDeepDive />
          </div>
        </div>
      </section>

      {/* 8 — the full inventory */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Everything in it"
            title="The full capability list"
            intro="Every register and the workflow that keeps it current, written out rather than implied."
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
            title="Four people who keep the company running"
            intro="The roles that open Operations every day, and the queue each of them opens it for."
            hue={product.hue}
          />
          <div className="mt-14">
            <AdminRoles />
          </div>
        </div>
      </section>

      {/* 10 — the flows it takes part in */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <CrossModuleFlows
            only="admin"
            heading="Where Admin & Operations sits in the suite"
            intro="The cross-module flows that start or pass through Operations. Every step names the module that acts."
          />
        </div>
      </section>

      {/* 11 — how it meets the rest of the suite */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connections"
            title="What Admin & Operations hands to the rest of the suite"
            intro="One identity, one org structure, one approvals engine, one audit log — which is why none of this is an integration."
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
        title="Run the company's operations on the same suite as its money"
        intro="Admin & Operations works alongside Finance, HR, Projects and Learning — one sign-in, one approvals inbox, one audit log."
        primary={{ label: `Open ${product.shortName}`, href: product.appHref }}
        secondary={{ label: "How the suite fits together", href: "/platform" }}
      />
    </main>
  );
}
