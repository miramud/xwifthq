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
import { ScreenTour, type TourStop } from "@/suite/finance/components/marketing/ScreenTour";
import {
  ExpectedActualFigure,
  PlannerFigure,
  TestingFigure,
} from "@/suite/projects/components/marketing/ProjectsVisuals";
import { RoleCards } from "@/suite/projects/components/marketing/RoleCards";
import { HUE, getProduct } from "@/lib/products";

/**
 * XwiftHQ Projects: delivery, testing and project money in one module.
 *
 * Same rhythm as every module page: the sky hero with the live projects
 * overview, the figures, what it does, a tabbed tour of real screens (ending
 * on the link to Finance), then four drawn mechanisms a screenshot cannot
 * explain alone: the planner, sprints, testing and expected against actual.
 *
 * No competitor is named anywhere in the copy.
 */

const product = getProduct("projects");

const TOUR: readonly TourStop[] = [
  {
    id: "board",
    label: "Story board",
    title: "A backlog of stories, grouped by epic",
    body: "Each card is a user story with its tasks inside, and progress is tasks done. Bugs and loose tasks sit beside them, so nothing falls outside the plan.",
    screen: <ProductScreenshot screen="projectsBoard" hue={product.hue} />,
  },
  {
    id: "performance",
    label: "Performance",
    title: "Velocity and a forecast from real sprints",
    body: "Committed, completed and carried over for every closed sprint, plus a finish date forecast from them. Export it all to Excel with the charts included.",
    screen: <ProductScreenshot screen="projectsPerformance" hue={product.hue} />,
  },
  {
    id: "finance",
    label: "Project money",
    title: "Expected spend beside actual, on the project",
    body: "The approved budget next to what has really been spent: hours at the rate card, travel, events, purchases and memos, down to who raised each request.",
    screen: <ProductScreenshot screen="projectsFinance" hue={product.hue} />,
  },
  {
    id: "schedule",
    label: "Schedule",
    title: "The schedule and the path that sets the end date",
    body: "Dated work and its dependencies on one chart, with the critical path marked. Move a task and you can see what moves with it.",
    screen: <ProductScreenshot screen="projectsSchedule" hue={product.hue} />,
  },
  {
    id: "with-finance",
    label: "With Finance",
    title: "The same projects, seen by Finance",
    body: "Finance sees each project's funds released, committed, spent and available. It is the same money the project shows, not a second copy.",
    screen: <ProductScreenshot screen="financeProjects" hue={product.hue} />,
  },
];

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Project delivery for your company: story board, sprints, an AI delivery planner, testing with findings that become bugs, team performance, the critical path, and expected spend against actual on every project.",
  openGraph: {
    title: "XwiftHQ Projects",
    description:
      "Stories, sprints and the critical path, QA and security testing, velocity forecasts, and a money tab that checks each project's approved budget against hours, travel, events and purchases.",
    url: "/products/projects",
  },
};

export default function ProjectsPage() {
  return (
    <>
      <ProductHero
        product={product}
        title={
          <>
            Deliver projects on time.
            <br className="hidden sm:block" /> Know what they cost.
          </>
        }
        roles={["Project manager", "Developer", "QA analyst", "Director"]}
      >
        <ProductScreenshot screen="projectsDashboard" hue={product.hue} priority />
      </ProductHero>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            title="Why project teams choose XwiftHQ"
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
            title="Plan it, ship it, test it, cost it"
            intro="The decisions that shaped the module. The full list comes further down."
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
            title="From the board to the books"
            intro="Real screens from a demo company running XwiftHQ. Nothing here is mocked up."
          />
          <div className="mt-12">
            <ScreenTour stops={TOUR} label="Projects screens" ruleClass={HUE[product.hue].rule} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <SectionHeader
                eyebrow="The problem"
                title="A project is work, people and money at once"
                align="left"
              />
              <div className="xw-frame mt-8 aspect-[4/3] overflow-hidden">
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
                board, the people are in HR, and the money sits in a finance
                system the team cannot open. Ask whether the project is on
                budget and the answer takes a week, because someone has to
                piece hours, travel claims and purchase orders together first.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                XwiftHQ Projects keeps all three on the project. The team comes
                from the same staff records HRM keeps. Hours are logged against
                stories and priced at the project&apos;s rate card. Travel and
                event requests raised in Operations are charged to the project
                as they happen, purchases and staff memos follow it through
                Finance, and the approved budget comes from Finance as well. So
                expected against actual is a tab, not a month end exercise.
              </p>
              <p className="max-w-prose leading-relaxed text-neutral-600">
                Around that sits the delivery work: a story board and sprints,
                an AI planner that drafts the backlog, test sprints whose
                findings become bugs, a schedule with the critical path, and a
                performance workbook a director can read without a walkthrough.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="How it works"
            title="Four things worth seeing up close"
            intro="Each drawing isolates one mechanism; the real screens are in the tour above. Names and figures are illustrative."
          />

          <div className="mt-16 space-y-20 lg:space-y-24">
            <FeatureBlock
              icon={Sparkles}
              eyebrow="Planning"
              title="A dated backlog on day one"
              paragraphs={[
                "Bring the backlog you already have in Excel. Epics and stories are matched by title, so importing again never creates duplicates. Or describe the project and let the AI delivery planner draft epics, stories, tasks, points and blockers for you to edit.",
                "Dates are never the model's guess. A scheduler fits the tasks to the team's real capacity by role, so the first plan is one you can stand behind.",
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
                "Each card on the board is a user story, and its tasks move with it into a sprint, so a story is never split across two. Closing a sprint saves a snapshot of what was committed, completed, carried over and added part way through.",
                "Those snapshots drive velocity, variability and a forecast finish date, and the whole picture exports to an Excel workbook with the charts already drawn.",
              ]}
              points={[
                "Story board, list and item views over the same backlog",
                "A snapshot of every sprint, saved when it closes",
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
                "QA and security analysts are roles on the project. They run test sprints beside delivery sprints, from a library of test cases written by hand or drafted by AI from each story.",
                "A failed case becomes a finding with a severity, steps to reproduce and a recommendation. Findings are bugs on the same board, so the project manager assigns, dates and schedules the fix like any other work.",
              ]}
              points={[
                "Test sprints that never skew delivery velocity",
                "A reusable library of test cases per project",
                "Test cases drafted by AI, one story at a time",
                "Findings that become bugs the project manager assigns",
              ]}
              visual={<TestingFigure />}
            />

            <FeatureBlock
              icon={Wallet}
              eyebrow="Money"
              flip
              title="Expected spend against actual, down to the person"
              paragraphs={[
                "The expected figure is the project budget Finance approved, and a project manager can draft and submit that budget from the project itself. The actual figure adds logged hours at the rate card to every trip, event, purchase and memo charged to the project.",
                "Each line shows who raised it. People allowed to see cost also get a finance analysis in the performance workbook, so the delivery story and the money story arrive in one file.",
              ]}
              points={[
                "The approved budget is the expected spend",
                "Labour from logged hours × the project rate card",
                "Travel, events, purchases and memos, each with who raised it",
                "Finance analysis in the workbook, for cost viewers only",
              ]}
              visual={<ExpectedActualFigure />}
            />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Everything in it"
            title="The full feature list"
            intro="Every area of the module and what sits inside each one."
          />
          <div className="mt-14">
            <CapabilityColumns capabilities={product.capabilities} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader eyebrow="Who uses it" title="Four people, four reasons to log in" />
          <div className="mt-14">
            <RoleCards />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <CrossModuleFlows
            only={product.slug}
            heading="Where Projects fits in the workspace"
            intro="Flows that pass through this module. Each step names the module that acts."
          />
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Connected"
            title="How Projects works with the other modules"
            intro="One identity, one organisation, one set of permissions and one audit log. That is why these are handovers, not integrations."
          />
          <div className="mt-14">
            <ProductConnections product={product} />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader eyebrow="Questions" title="Before you ask" />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={product.faqs} />
          </div>
        </div>
      </section>

      <CtaBanner
        title="Run your next project on XwiftHQ"
        intro="Story board, sprints, testing, the critical path and the project's money in one place, with updates to your team's Slack, WhatsApp, Gmail or Zoho Mail."
        primary={{ label: "Open Projects", href: product.appHref }}
        secondary={{ label: "See how it all connects", href: "/platform" }}
      />
    </>
  );
}
