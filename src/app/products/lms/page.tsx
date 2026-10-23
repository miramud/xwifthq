import type { Metadata } from "next";
import Image from "next/image";
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
import { LmsAudience } from "@/suite/lms/components/marketing/LmsAudience";
import { LmsDeepDive } from "@/suite/lms/components/marketing/LmsDeepDive";
import { ScreenTour, type TourStop } from "@/suite/finance/components/marketing/ScreenTour";
import { HUE, getProduct } from "@/lib/products";

/**
 * XwiftHQ Learning: staff training and compliance for a company.
 *
 * The page speaks to an organisation training its own people (induction, role
 * paths, required courses with due dates, certificates an auditor can check),
 * never to students or schools. It follows the same rhythm as every module
 * page: sky hero, figures, what it does, a tour of real screens, the depth,
 * questions and the purple closing panel.
 */

const product = getProduct("lms");

const TOUR: readonly TourStop[] = [
  {
    id: "courses",
    label: "Courses",
    title: "Your company's own course catalogue",
    body: "Induction, policies, tools and skills, written by your own people and published once your approval policy allows. Staff see what is assigned to them first.",
    screen: <ProductScreenshot screen="lmsCourses" hue={product.hue} />,
  },
  {
    id: "hrm",
    label: "With HRM",
    title: "Training that starts on day one",
    body: "A new hire's onboarding checklist in HRM can include their induction courses, and finished required training shows on their record at review time.",
    screen: <ProductScreenshot screen="hrmDashboard" hue={product.hue} />,
  },
  {
    id: "home",
    label: "One login",
    title: "Right next to everything else your staff use",
    body: "Learning sits beside HR, Projects, Finance and Operations on one account. Nobody needs a separate login for the training their job requires.",
    screen: <ProductScreenshot screen="suiteHome" hue={product.hue} />,
  },
];

export const metadata: Metadata = {
  title: product.shortName,
  description:
    "Staff training and compliance for your company: courses, learning paths by team, required training with due dates and an overdue list, and certificates anyone can verify by serial number.",
  openGraph: {
    title: `${product.name}: ${product.tagline}`,
    description:
      "Induction and role paths assigned to a person, a team or everyone. Quizzes with pass marks, recurring compliance training with expiring certificates, and leaderboards that stay inside your organisation.",
    url: product.href,
  },
};

export default function LmsProductPage() {
  return (
    <>
      <ProductHero
        product={product}
        title={
          <>
            Train your people.
            <br className="hidden sm:block" /> Prove it at audit.
          </>
        }
        roles={["Learning lead", "Course author", "Line manager", "New hire"]}
      >
        <ProductScreenshot screen="lmsDashboard" hue={product.hue} priority />
      </ProductHero>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            title="Why learning teams choose XwiftHQ"
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
            title="Built for training that has to count"
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
            title="Training your staff will actually finish"
            intro="Real screens from a demo company running XwiftHQ. Nothing here is mocked up."
          />
          <div className="mt-12">
            <ScreenTour stops={TOUR} label="Learning screens" ruleClass={HUE[product.hue].rule} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeader
                eyebrow="The problem"
                title="Every company trains its staff. Few can prove it."
                align="left"
              />
              <div className="xw-frame mt-8 aspect-[4/3] overflow-hidden">
                <Image
                  src="/images/lms-2.jpeg"
                  alt="A member of staff working through a security awareness course on her laptop at the office"
                  width={800}
                  height={600}
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-5 lg:col-span-7">
              <p className="max-w-prose leading-relaxed text-neutral-600">
                Training is usually bought as a separate tool. It fills up with
                real completions and then sits alone, because the record of
                who was trained lives somewhere HR, the auditor and the line
                manager never look.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                A completion that never reaches the employee record is a
                compliance risk, not an achievement. At audit the person looks
                untrained, and the only proof is a spreadsheet someone swears
                is current. Meanwhile the new hire waits two weeks for someone
                to remember which courses the job needs.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                {product.name} is part of the workspace, not bolted onto it.
                Induction courses ride on the HRM onboarding checklist,
                required training has a due date and an overdue list, and
                recurring courses issue certificates that expire on schedule,
                so renewals come round without a tracking spreadsheet. Every
                certificate carries a serial number anyone can check.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="How it works"
            title="Four parts of the module, up close"
            intro="These figures are drawn to show how each part works. The names and numbers in them are illustrative."
          />
          <div className="mt-16">
            <LmsDeepDive />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
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

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Who uses it"
            title="Four roles, four reasons to log in"
            intro="Everyone in the company can learn here. These four run it."
          />
          <div className="mt-14">
            <LmsAudience />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <CrossModuleFlows
            only="lms"
            heading="Where training fits in the workspace"
            intro="Each of these starts in one module and finishes in another. They work because one organisation, one set of permissions and one audit trail sit under all five."
          />
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connected"
            title="How Learning works with the other modules"
            intro="A completion only matters where someone is asking the question it answers."
          />
          <div className="mt-14">
            <ProductConnections product={product} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader eyebrow="Questions" title={`What companies ask about ${product.name}`} />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={product.faqs} />
          </div>
        </div>
      </section>

      <CtaBanner
        title="Train your staff and keep the proof"
        intro="Induction and role paths, required courses with due dates, and certificates that land on the employee record, all on the same XwiftHQ account."
        primary={{ label: `Open ${product.shortName}`, href: product.appHref }}
        secondary={{ label: "See how it all connects", href: "/platform" }}
      />
    </>
  );
}
