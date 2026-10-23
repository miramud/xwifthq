import type { Metadata } from "next";
import Image from "next/image";
import { CapabilityColumns } from "@/components/platform/CapabilityColumns";
import { CrossModuleFlows } from "@/components/platform/CrossModuleFlows";
import { CtaBanner } from "@/components/platform/CtaBanner";
import { FaqAccordion } from "@/components/platform/FaqAccordion";
import { PillarGrid } from "@/components/platform/PillarGrid";
import { ProductHero } from "@/components/platform/ProductHero";
import { SectionHeader } from "@/components/platform/SectionHeader";
import { StatStrip } from "@/components/platform/StatStrip";
import { HrmAudience } from "@/suite/hrm/components/marketing/HrmAudience";
import { ProductConnections } from "@/components/platform/ProductConnections";
import { HrmDeepDive } from "@/suite/hrm/components/marketing/HrmDeepDive";
import { ProductScreenshot } from "@/components/platform/ProductScreenshot";
import {
  ModuleTour,
  type TourStop,
} from "@/suite/projects/components/marketing/ModuleTour";
import { LifecycleRibbon } from "@/suite/hrm/components/marketing/LifecycleRibbon";
import { getProduct } from "@/lib/products";

/**
 * Elevate HRM — the People module of a company suite.
 *
 * Owner, 9 Oct 2026: this is a company all-in-one suite, not a student
 * portal, and every module is complete. So the page opens on the real People
 * overview, then tours five real screens before it argues anything. Staff,
 * supervisors and managers are the audience throughout.
 *
 * HRM is the module that owns people; every other module borrows them. So the
 * page is built around the employment lifecycle rather than around a feature
 * list — the ribbon sits above the argument because the argument is the
 * ribbon: one record, from the offer to the exit.
 *
 * Violet labels this module. It appears on icon tiles, eyebrow rules and the
 * data accents inside this page's own figures, and nowhere else. Both CTAs
 * stay teal, here as on every other page: teal leads the whole site, and a
 * violet button would make HRM look like a different company's product.
 */

const product = getProduct("hrm");

const TOUR: TourStop[] = [
  {
    screen: "hrmPeople",
    area: "People",
    title: "Everyone who works for you, on one directory",
    body: "Staff, interns and contractors with their department, job title, supervisor and status. Open anyone to reach their contract, probation, leave, pay and documents.",
  },
  {
    screen: "hrmLeave",
    area: "Leave & attendance",
    title: "Leave requests with the balance beside them",
    body: "Requests arrive with the balance they would leave, and go to the right supervisor first. Approved days show on the team calendar and never count as absence.",
  },
  {
    screen: "hrmPayroll",
    area: "Payroll",
    title: "Every run, with what it really costs",
    body: "Gross, statutory deductions, net and employer cost for each run. Once a run is approved, its journal is posted to Finance.",
  },
  {
    screen: "hrmRecruitment",
    area: "Recruitment",
    title: "From requisition to signed offer",
    body: "Approved requisitions, candidates by stage, interview panels with their scores, and offers. The person who accepts becomes an employee without being typed in again.",
  },
  {
    screen: "hrmPerformance",
    area: "Performance",
    title: "KPIs and appraisals your managers will actually use",
    body: "Goals and KPIs with readings against target, and appraisals that collect them. Supervisors see the targets due for their own team.",
  },
];

export const metadata: Metadata = {
  title: product.shortName,
  description:
    "HR for your whole company: staff directory, onboarding, contracts, leave, attendance, payroll with statutory deductions, recruitment, performance and leavers on one employee record.",
  openGraph: {
    title: `${product.name} — ${product.tagline}`,
    description:
      "One employee record from offer to exit. Payroll with PAYE, pension and NHF that posts to Finance, self-service for every member of staff, and a My team view for every supervisor.",
    url: product.href,
  },
};

export default function HrmProductPage() {
  return (
    <>
      <ProductHero product={product}>
        <ProductScreenshot
          screen="hrmDashboard"
          hue={product.hue}
          priority
          caption="The People overview: headcount, onboarding, probation and who is in today."
          className="[&_figcaption]:text-white/75"
        />
      </ProductHero>

      {/* Stat strip — white */}
      <section className="bg-white py-14 sm:py-16">
        <div className="section-container">
          <StatStrip stats={product.stats} hue={product.hue} />
        </div>
      </section>

      {/* Tour — real screens, before any argument */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Tour the module"
            title="What your HR team opens every morning"
            intro="Real screens from a demo company running the suite. Nothing here is mocked up."
            hue={product.hue}
          />
          <div className="mt-16">
            <ModuleTour stops={TOUR} hue={product.hue} />
          </div>
        </div>
      </section>

      {/* The lifecycle — the page's signature figure */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="One record"
            title="The employment lifecycle, end to end"
            intro="Seven stages, one employee record. Each stage writes to the same person, which is why nobody reconciles a staff list against a payroll register at the end of the month."
            hue={product.hue}
          />
          <div className="mt-14">
            <LifecycleRibbon />
          </div>
        </div>
      </section>

      {/* The case */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeader
                eyebrow="The case"
                title="HR data fragments the moment it becomes useful"
                align="left"
                hue={product.hue}
              />
              <div className="mt-8 aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
                <Image
                  src="/images/2150408702.jpg"
                  alt="An HR professional reviewing workforce charts on two laptops beside a whiteboard of data"
                  width={800}
                  height={600}
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-5 lg:col-span-7">
              <p className="max-w-prose leading-relaxed text-neutral-600">
                The roster lives in one system, leave in a spreadsheet, payroll
                at a bureau and training somewhere else again. Each of them is
                defensible on its own. Together they produce an organisation
                where no two systems agree on headcount on any given day, and
                where the honest answer to &ldquo;how many people work here&rdquo;
                is &ldquo;which number would you like&rdquo;.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                The cost is not the licence fees. It is that every question worth
                asking needs a reconciliation first. A leaver still on the
                payroll. A promotion the org chart has not heard about. A
                compliance course finished in a training tool that never reached
                the employee record, so at audit the person counts as untrained.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                Elevate HRM keeps one employee record for the whole company. The
                modules that need a person read it rather than copying it: a
                project team is staffed from it, a payroll run posts its journal
                to the books Finance closes on, and a leaver&apos;s final pay
                waits until Admin shows their laptop returned and Finance shows
                their advance retired. There is nothing between the modules to
                reconcile, because there is nothing between them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="What it is for"
            title="Six things Elevate HRM is built to do"
            intro="Not a feature list — the capability inventory further down does that. These are the decisions the module is shaped by."
            hue={product.hue}
          />
          <div className="mt-14">
            <PillarGrid pillars={product.pillars} hue={product.hue} />
          </div>
        </div>
      </section>

      {/* Deep dive */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="In depth"
            title="Four parts of the module, in detail"
            intro="The figures below are drawn, not photographed, and every number in them is illustrative."
            hue={product.hue}
          />
          <div className="mt-16">
            <HrmDeepDive />
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="The inventory"
            title="Everything in Elevate HRM"
            intro="Every area of the module, in the shape it is organised in the product."
            hue={product.hue}
          />
          <div className="mt-14">
            <CapabilityColumns
              capabilities={product.capabilities}
              hue={product.hue}
            />
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Who opens it"
            title="Four roles, four reasons"
            intro="Everyone in the company appears in HRM. These four work in it every day."
            hue={product.hue}
          />
          <div className="mt-14">
            <HrmAudience />
          </div>
        </div>
      </section>

      {/* Cross-module flows */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <CrossModuleFlows
            only="hrm"
            heading="Where HRM sits in a flow that crosses modules"
            intro="Each of these starts in one module and finishes in another. They work because there is one organisation, one permission model and one audit trail underneath all five."
          />
        </div>
      </section>

      {/* Connections */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connections"
            title="How HRM meets the other four"
            intro="People are the thing every other module needs and none of them should own."
            hue={product.hue}
          />
          <div className="mt-14">
            <ProductConnections product={product} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Questions"
            title="What people ask about Elevate HRM"
            hue={product.hue}
          />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={product.faqs} />
          </div>
        </div>
      </section>

      <CtaBanner
        title="Run your people operations on one record"
        intro="Onboarding, contracts, probation, leave, rotas, attendance, recruitment, performance, payroll and leavers — all against the same employee record, so nothing is re-typed between them."
        primary={{ label: "Open Elevate HRM", href: product.appHref }}
        secondary={{ label: "How the suite fits together", href: "/platform" }}
      />
    </>
  );
}
