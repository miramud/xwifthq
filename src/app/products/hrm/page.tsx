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
import { ScreenTour, type TourStop } from "@/suite/finance/components/marketing/ScreenTour";
import { LifecycleRibbon } from "@/suite/hrm/components/marketing/LifecycleRibbon";
import { HUE, getProduct } from "@/lib/products";

/**
 * XwiftHQ HRM: the people module of the workspace.
 *
 * HRM owns people and every other module borrows them, so after the usual
 * opening (sky hero, figures, what it does, a tour of real screens) the page
 * is built around the employment lifecycle: one record from offer to exit.
 *
 * Violet marks this module on small accents only. Every button stays purple.
 */

const product = getProduct("hrm");

const TOUR: readonly TourStop[] = [
  {
    id: "people",
    label: "People",
    title: "Everyone who works for you, in one directory",
    body: "Staff, interns and contractors with their department, role, supervisor and status. Open anyone to see their contract, probation, leave, pay and documents.",
    screen: <ProductScreenshot screen="hrmPeople" hue={product.hue} />,
  },
  {
    id: "leave",
    label: "Leave",
    title: "Leave requests with the balance beside them",
    body: "Each request shows the balance it would leave and goes to the right supervisor first. Approved days land on the team calendar and never count as absence.",
    screen: <ProductScreenshot screen="hrmLeave" hue={product.hue} />,
  },
  {
    id: "payroll",
    label: "Payroll",
    title: "Every run, with its true cost",
    body: "Gross pay, statutory deductions, net pay and employer cost for each run. Once a run is approved, its journal posts straight to Finance.",
    screen: <ProductScreenshot screen="hrmPayroll" hue={product.hue} />,
  },
  {
    id: "recruitment",
    label: "Hiring",
    title: "From open role to signed offer",
    body: "Approved roles, candidates by stage, interview panels with their scores, and offers. Whoever accepts becomes an employee without retyping a thing.",
    screen: <ProductScreenshot screen="hrmRecruitment" hue={product.hue} />,
  },
  {
    id: "performance",
    label: "Performance",
    title: "Goals and reviews managers will actually use",
    body: "Goals and KPIs with readings against target, and appraisals that pull them in. Supervisors see exactly what is due for their own team.",
    screen: <ProductScreenshot screen="hrmPerformance" hue={product.hue} />,
  },
];

export const metadata: Metadata = {
  title: product.shortName,
  description:
    "HR for the whole company: staff directory, onboarding, contracts, leave, attendance, payroll with statutory deductions, hiring, performance and exits, all on one employee record.",
  openGraph: {
    title: `${product.name}: ${product.tagline}`,
    description:
      "One employee record from offer to exit. Payroll with PAYE, pension and NHF that posts to Finance, self service for every member of staff, and a My team view for every supervisor.",
    url: product.href,
  },
};

export default function HrmProductPage() {
  return (
    <>
      <ProductHero
        product={product}
        title={
          <>
            Every person, every payslip.
            <br className="hidden sm:block" /> One record.
          </>
        }
        roles={["HR manager", "Payroll officer", "Supervisor", "Every employee"]}
      >
        <ProductScreenshot screen="hrmDashboard" hue={product.hue} priority />
      </ProductHero>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            title="Why HR teams choose XwiftHQ"
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
            title="Six jobs XwiftHQ HRM is built to do"
            intro="The full list comes further down. These are the decisions that shaped the module."
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
            title="What your HR team opens every morning"
            intro="Real screens from a demo company running XwiftHQ. Nothing here is mocked up."
          />
          <div className="mt-12">
            <ScreenTour stops={TOUR} label="HRM screens" ruleClass={HUE[product.hue].rule} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="One record"
            title="The whole employment journey, end to end"
            intro="Seven stages, one employee record. Every stage writes to the same person, so nobody has to match a staff list against a payroll register at month end."
          />
          <div className="mt-14">
            <LifecycleRibbon />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeader
                eyebrow="The problem"
                title="People data splinters just when you need it"
                align="left"
              />
              <div className="xw-frame mt-8 aspect-[4/3] overflow-hidden">
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
                The staff list lives in one system, leave in a spreadsheet,
                payroll with a bureau and training somewhere else. Each choice
                makes sense on its own. Together they leave a company where no
                two systems agree on headcount, and the honest answer to
                &ldquo;how many people work here?&rdquo; is &ldquo;which number
                do you want?&rdquo;
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                The real cost is not the licences. It is that every useful
                question needs a reconciliation first. A leaver still on the
                payroll. A promotion the org chart never heard about. A
                compliance course finished in a training tool that never
                reached the employee record, so at audit time that person looks
                untrained.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                XwiftHQ HRM keeps one employee record for the whole company.
                The other modules read it instead of copying it: project teams
                are staffed from it, payroll posts its journal to the books
                Finance closes on, and a leaver&apos;s final pay waits until
                Operations confirms the laptop is back and Finance confirms the
                advance is settled. There is nothing to reconcile between the
                modules, because nothing sits between them.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="How it works"
            title="Four parts of the module, up close"
            intro="These figures are drawn rather than captured, and every number in them is illustrative."
          />
          <div className="mt-16">
            <HrmDeepDive />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Everything in it"
            title="The full feature list"
            intro="Every area of the module, grouped the way you will find it in the product."
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
            title="Four roles, four reasons to log in"
            intro="Everyone in the company has a place in HRM. These four work in it every day."
          />
          <div className="mt-14">
            <HrmAudience />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <CrossModuleFlows
            only="hrm"
            heading="Where HRM fits in the workspace"
            intro="Each of these starts in one module and finishes in another. They work because one organisation, one set of permissions and one audit trail sit under all five."
          />
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connected"
            title="How HRM works with the other modules"
            intro="People are what every module needs and what none of them should own."
          />
          <div className="mt-14">
            <ProductConnections product={product} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader eyebrow="Questions" title="What people ask about XwiftHQ HRM" />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={product.faqs} />
          </div>
        </div>
      </section>

      <CtaBanner
        title="Run your people operations on one record"
        intro="Onboarding, contracts, leave, attendance, hiring, performance, payroll and exits all share one employee record, so nothing is typed twice."
        primary={{ label: "Open XwiftHQ HRM", href: product.appHref }}
        secondary={{ label: "See how it all connects", href: "/platform" }}
      />
    </>
  );
}
