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
import {
  ModuleTour,
  type TourStop,
} from "@/suite/projects/components/marketing/ModuleTour";
import { getProduct } from "@/lib/products";

/**
 * Elevate LMS — staff training and compliance for a company.
 *
 * Owner, 9 Oct 2026: "This is not a student portal. This is a company
 * all-in-one suite." So the page speaks to an organisation training its own
 * people — induction, role paths, mandatory courses with due dates, and
 * certificates an auditor can check — and never to students or schools.
 *
 * It opens on the real Learning overview and tours real screens before the
 * argument. Teal is both the site's lead colour and this module's label, so
 * gold is spent only inside the drawn figures (the step in progress, the
 * certificate).
 */

const product = getProduct("lms");

const TOUR: TourStop[] = [
  {
    screen: "lmsCourses",
    area: "Courses",
    title: "Your company's own course catalogue",
    body: "Induction, policies, tools and skills, written by your own people and published when your approval policy says so. Staff see what is assigned to them first.",
  },
  {
    screen: "hrmDashboard",
    area: "With HRM",
    title: "Training that starts on the first day",
    body: "A new hire's onboarding checklist in HRM can include their induction courses, and finished mandatory training shows on their record at appraisal.",
  },
  {
    screen: "suiteHome",
    area: "One sign-in",
    title: "Next to everything else your staff use",
    body: "Learning sits beside HR, Projects, Finance and Admin on one account. Nobody needs a separate login to do the training their job requires.",
  },
];

export const metadata: Metadata = {
  title: product.shortName,
  description:
    "Staff training and compliance for your company: courses, learning paths by team, mandatory training with due dates and an overdue list, and certificates anyone can verify by serial.",
  openGraph: {
    title: `${product.name} — ${product.tagline}`,
    description:
      "Induction and role paths assigned to a person, a team or everyone; quizzes with pass marks; recurring compliance training with expiring certificates; leaderboards that stay inside your organisation.",
    url: product.href,
  },
};

export default function LmsProductPage() {
  return (
    <>
      <ProductHero product={product}>
        <ProductScreenshot
          screen="lmsDashboard"
          hue={product.hue}
          priority
          caption="The Learning overview: people learning, completions, courses and ratings."
          className="[&_figcaption]:text-white/75"
        />
      </ProductHero>

      {/* Stat strip */}
      <section className="bg-white py-14 sm:py-16">
        <div className="section-container">
          <StatStrip stats={product.stats} hue={product.hue} />
        </div>
      </section>

      {/* Tour — real screens */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Tour the module"
            title="Training your staff will actually finish"
            intro="Real screens from a demo company running the suite. Nothing here is mocked up."
            hue={product.hue}
          />
          <div className="mt-16">
            <ModuleTour stops={TOUR} hue={product.hue} />
          </div>
        </div>
      </section>

      {/* The case */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeader
                eyebrow="The case"
                title="Every company trains its staff. Few can prove it."
                align="left"
                hue={product.hue}
              />
              <div className="mt-8 aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
                <Image
                  src="/images/lms-2.jpeg"
                  alt="A member of staff working through a security-awareness course on her laptop at the office"
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
                real completions and then sits on its own, because the record
                of who was trained lives somewhere the HR system, the auditor
                and the line manager have never heard of.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                A completion that never reaches the employee record is a
                compliance risk, not an achievement. At audit the person counts
                as untrained, and the only way to prove otherwise is somebody
                exporting a spreadsheet and swearing it is current. Meanwhile
                the new hire waits a fortnight for someone to remember which
                courses their job requires.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                {product.name} is part of the suite rather than bolted to it.
                Induction courses ride on the HRM onboarding checklist,
                mandatory training carries a due date and an overdue list, and
                recurring courses issue certificates that expire on schedule,
                so the obligation comes back round without a renewal
                spreadsheet. Every certificate carries a serial anyone can check.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="What it is for"
            title="What the module is built to do"
            intro="Not a feature list — the inventory further down does that. These are the decisions the module is shaped by."
            hue={product.hue}
          />
          <div className="mt-14">
            <PillarGrid pillars={product.pillars} hue={product.hue} />
          </div>
        </div>
      </section>

      {/* Deep dive */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="In depth"
            title="Four parts of the module, in detail"
            intro="The figures below are drawn to show how each part works; the names and numbers in them are illustrative."
            hue={product.hue}
          />
          <div className="mt-16">
            <LmsDeepDive />
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="The inventory"
            title={`Everything in ${product.name}`}
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
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Who opens it"
            title="Four roles, four reasons"
            intro="Everyone in the company can learn here. These four run it."
            hue={product.hue}
          />
          <div className="mt-14">
            <LmsAudience />
          </div>
        </div>
      </section>

      {/* Cross-module flows */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <CrossModuleFlows
            only="lms"
            heading="Where training sits in a flow that crosses modules"
            intro="Each of these starts in one module and finishes in another. They work because there is one organisation, one permission model and one audit trail underneath all five."
          />
        </div>
      </section>

      {/* Connections */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connections"
            title="How Learning meets the other four"
            intro="A completion is only useful where somebody is asking the question it answers."
            hue={product.hue}
          />
          <div className="mt-14">
            <ProductConnections product={product} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Questions"
            title={`What companies ask about ${product.name}`}
            hue={product.hue}
          />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={product.faqs} />
          </div>
        </div>
      </section>

      <CtaBanner
        title="Train your staff, and keep the proof"
        intro="Induction and role paths, mandatory courses with due dates, and certificates that land on the employee record — on the same account as the rest of the suite."
        primary={{ label: `Open ${product.shortName}`, href: product.appHref }}
        secondary={{ label: "How the suite fits together", href: "/platform" }}
      />
    </>
  );
}
