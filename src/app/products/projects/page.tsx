import type { Metadata } from "next";
import Image from "next/image";
import { ChartLine, FlaskConical, Sparkles, Wallet } from "lucide-react";
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
import { BurndownChart } from "@/suite/projects/components/marketing/BurndownChart";
import { FeatureBlock } from "@/suite/projects/components/marketing/FeatureBlock";
import {
  ModuleTour,
  type TourStop,
} from "@/suite/projects/components/marketing/ModuleTour";
import {
  ExpectedActualFigure,
  PlannerFigure,
  TestingFigure,
} from "@/suite/projects/components/marketing/ProjectsVisuals";
import { RoleCards } from "@/suite/projects/components/marketing/RoleCards";
import { getProduct } from "@/lib/products";

/**
 * Elevate Projects — delivery, testing and project money in one module.
 *
 * Owner, 9 Oct 2026: a company suite, every module complete, real dashboards
 * on the site. The page opens on the real projects overview, tours five real
 * screens (ending on the Projects ↔ Finance link), then draws four mechanisms
 * a screenshot cannot explain on its own: the planner, sprints, testing and
 * expected-against-actual expense.
 *
 * No competitor is named anywhere in the copy. Sky labels the module; both
 * CTAs stay teal like every other page.
 */

const product = getProduct("projects");

const TOUR: TourStop[] = [
  {
    screen: "projectsBoard",
    area: "Story board",
    title: "A backlog of stories, grouped by epic",
    body: "Cards are user stories with their tasks inside them, and progress is tasks done. Bugs and loose tasks sit beside them, so nothing falls outside the plan.",
  },
  {
    screen: "projectsPerformance",
    area: "Team performance",
    title: "Velocity and a forecast from real sprints",
    body: "Committed, completed and carried over for every closed sprint, and a finish date forecast from them. Export it all to Excel, charts included.",
  },
  {
    screen: "projectsFinance",
    area: "Finance tab",
    title: "Expected expense against actual, on the project",
    body: "The approved budget beside what has really been spent: logged hours at the rate card, travel, events, purchases and memos, down to who raised each request.",
  },
  {
    screen: "projectsSchedule",
    area: "Schedule",
    title: "The schedule, and the path that decides the end date",
    body: "Dated work and its dependencies on one chart, with the critical path marked. Slip a task on it and you can see what moves.",
  },
  {
    screen: "financeProjects",
    area: "With Finance",
    title: "The same projects, from the finance side",
    body: "Finance sees every project's funds released, committed, spent and available. It is the same money the project tab shows, not a second copy of it.",
  },
];

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Project delivery for your company: story board, sprints, an AI delivery planner, testing with findings that become bugs, team performance, the critical path, and expected expense against actual on every project.",
  openGraph: {
    title: "Elevate Projects",
    description:
      "Stories, sprints and the critical path, QA and security testing, velocity forecasts, and a Finance tab that reconciles each project's approved budget with hours, travel, events and purchases.",
    url: "/products/projects",
  },
};

export default function ProjectsPage() {
  return (
    <>
      <ProductHero product={product}>
        <ProductScreenshot
          screen="projectsDashboard"
          hue={product.hue}
          priority
          caption="Every project, with the schedule used and the team on it."
          className="[&_figcaption]:text-white/75"
        />
      </ProductHero>

      {/* The figures */}
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
            title="From the board to the books"
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
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <SectionHeader
                eyebrow="The case"
                title="A project is work, people and money at once"
                align="left"
                hue={product.hue}
              />
              <div className="mt-8 aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
                <Image
                  src="/images/planning.jpg"
                  alt="A project lead reviewing a delivery plan on a laptop in an open office"
                  width={800}
                  height={600}
                  sizes="(min-width: 1024px) 36vw, 90vw"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-5">
              <p className="max-w-prose leading-relaxed text-neutral-600">
                Most companies run a project in three places. The work is on a
                board, the people are in HR, and the money is in a finance
                system nobody on the team can open. Ask whether the project is
                on budget and the answer takes a week, because somebody has to
                stitch hours, travel claims and purchase orders together first.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                Elevate Projects keeps all three on the project. The team is
                drawn from the same staff records HRM keeps. Hours are logged
                against stories and priced at the project&apos;s rate card.
                Travel and event requests raised in Admin are charged to the
                project as they are made, purchases and staff memos follow it
                through Finance, and the approved budget comes from Finance too
                — so expected against actual is a tab, not a month-end exercise.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                Around that sits the delivery work itself: a story board and
                sprints, an AI planner that drafts the backlog, test sprints
                whose findings become bugs, a schedule with the critical path,
                and a performance workbook a director can read without a
                walkthrough.
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
            title="What Projects is built to do"
            intro="The decisions the module is shaped by. The full inventory is further down."
            hue={product.hue}
          />
          <div className="mt-14">
            <PillarGrid pillars={product.pillars} hue={product.hue} />
          </div>
        </div>
      </section>

      {/* The deep dive */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="In detail"
            title="Four things worth seeing up close"
            intro="Drawn to isolate one mechanism each; the real screens are in the tour above. Names and figures are illustrative."
            hue={product.hue}
          />

          <div className="mt-16 space-y-20 lg:space-y-24">
            <FeatureBlock
              icon={Sparkles}
              eyebrow="Planning"
              title="A dated backlog on the first afternoon"
              paragraphs={[
                "Bring the backlog you already have from Excel — epics and stories are matched by title, so re-importing does not duplicate them. Or describe the project and let the AI delivery planner draft epics, stories, tasks, points and blockers for you to edit.",
                "Dates are not the model's guess. A scheduler fits the tasks to the team's real capacity, by role, so the first plan is one you can defend.",
              ]}
              points={[
                "Backlog import from Excel, with epics optional",
                "AI delivery planner: epics, stories, tasks and estimates",
                "Dates scheduled from team capacity, not invented",
                "A project assistant that answers questions about the plan",
              ]}
              visual={<PlannerFigure />}
            />

            <FeatureBlock
              icon={ChartLine}
              eyebrow="Delivery"
              flip
              title="Sprints measured from the work itself"
              paragraphs={[
                "Each card on the board is a user story; its tasks travel with it into a sprint, so a story is never half in one sprint and half in another. Closing a sprint takes a snapshot of what was committed, completed, carried over and added mid-sprint.",
                "Those snapshots drive velocity, variability and a forecast finish date, and the whole picture exports to an Excel workbook with its charts already drawn.",
              ]}
              points={[
                "Story board, list and item views over the same backlog",
                "A snapshot of every sprint, taken when it closes",
                "Velocity, forecast and burndown from real sprints",
                "Schedule with dependencies and the critical path",
                "Performance workbook export, charts included",
              ]}
              visual={<BurndownChart />}
            />

            <FeatureBlock
              icon={FlaskConical}
              eyebrow="Testing"
              title="QA and security testing inside the project"
              paragraphs={[
                "QA and security analysts are roles on the project. They run test sprints alongside delivery sprints, from a library of test cases — written by hand or drafted by AI from each story.",
                "A failed case becomes a finding with severity, steps to reproduce and a recommendation. Findings are bugs on the same board, so the project manager assigns, dates and schedules the fix like any other work.",
              ]}
              points={[
                "Test sprints that never distort delivery velocity",
                "A reusable test-case library per project",
                "AI-drafted test cases, one story at a time",
                "Findings that become bugs the PM assigns",
              ]}
              visual={<TestingFigure />}
            />

            <FeatureBlock
              icon={Wallet}
              eyebrow="Money"
              flip
              title="Expected expense against actual, down to the person"
              paragraphs={[
                "The expected figure is the project budget Finance approved — and a project manager can draft and submit that budget from the project itself. The actual figure adds logged hours at the rate card to every travel, event, purchase and memo charged to the project.",
                "Each line shows who raised it. People who can see cost also get a finance analysis in the performance workbook, so the delivery story and the money story come in the same file.",
              ]}
              points={[
                "Approved budget as the expected expense",
                "Labour from logged hours × the project rate card",
                "Travel, events, purchases and memos, each with who raised it",
                "Finance analysis in the workbook for cost viewers only",
              ]}
              visual={<ExpectedActualFigure />}
            />
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Capabilities"
            title="The full inventory"
            intro="Every area of the module, and what sits inside each one."
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
            eyebrow="Who it is for"
            title="Four people, four reasons to open it"
            hue={product.hue}
          />
          <div className="mt-14">
            <RoleCards />
          </div>
        </div>
      </section>

      {/* Cross-module flows */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <CrossModuleFlows
            only={product.slug}
            heading="Where Projects sits in the chain"
            intro="Flows that pass through this module. Each step names the module that acts."
          />
        </div>
      </section>

      {/* Connections */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connections"
            title="How Projects meets the other four"
            intro="One identity, one organisation, one permission model, one audit log — which is why these are handovers rather than integrations."
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
            title="Before you ask"
            hue={product.hue}
          />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={product.faqs} />
          </div>
        </div>
      </section>

      <CtaBanner
        title="Run your next project on it."
        intro="Story board, sprints, testing, the critical path and the project's money in one place — with notifications to your team's Slack, WhatsApp, Gmail or Zoho Mail, on the same accounts as the rest of the suite."
        primary={{ label: "Open Projects", href: product.appHref }}
        secondary={{ label: "How the suite fits together", href: "/platform" }}
      />
    </>
  );
}
