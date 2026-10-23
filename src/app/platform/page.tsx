import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Code,
  FileSpreadsheet,
  HardDrive,
  Landmark,
  Mail,
  MessageSquare,
  MessagesSquare,
  QrCode,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { AdoptionPath } from "@/components/platform/AdoptionPath";
import { ArchitectureStack } from "@/components/platform/ArchitectureStack";
import { CrossModuleFlows } from "@/components/platform/CrossModuleFlows";
import { CtaBanner } from "@/components/platform/CtaBanner";
import { FaqAccordion } from "@/components/platform/FaqAccordion";
import { ProductScreenshot } from "@/components/platform/ProductScreenshot";
import { SharedSpineGrid } from "@/components/platform/SharedSpine";
import { SectionHeader } from "@/components/platform/SectionHeader";
import { SecurityGrid } from "@/components/platform/SecurityGrid";
import { SpineDiagram } from "@/components/platform/SpineDiagram";
import { SuiteGrid } from "@/components/platform/SuiteGrid";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "How Elevate runs a company on one spine: one sign-in, one structure of units and cost centres, one approval engine and inbox with delegation, one audit trail, one recycle bin, verifiable PDFs and events between Finance, Operations, HR, Projects and Learning.",
  openGraph: {
    title: "Platform",
    description:
      "One sign-in, one approval engine, one set of books and one audit trail under Elevate Finance, Admin & Operations, HRM, Projects and LMS.",
    url: "https://elevate.example.com/platform",
  },
};

/**
 * What the suite connects to today. Every entry is a connection that exists in
 * the running product — no logo wall, and nothing listed "by design".
 */
const INTEGRATIONS: { icon: LucideIcon; label: string; note: string }[] = [
  { icon: MessagesSquare, label: "Slack", note: "Project assignments and updates to the team's channel" },
  { icon: MessageSquare, label: "WhatsApp", note: "Notifications to the people who asked for them" },
  { icon: Mail, label: "Gmail and Zoho Mail", note: "Outgoing project email from your own mailbox" },
  { icon: HardDrive, label: "Cloudinary, Google Drive and S3", note: "Your media library on your own storage" },
  { icon: Landmark, label: "Bank statements", note: "Imported, matched by your rules and reconciled" },
  { icon: Banknote, label: "Bank payment files", note: "Payment schedules and payroll net pay, ready to upload" },
  { icon: FileSpreadsheet, label: "Excel and PDF", note: "Reports, performance sheets and the company finance report" },
  { icon: QrCode, label: "Document verification", note: "A QR on every branded PDF, checkable by anyone" },
  { icon: Upload, label: "Bulk import", note: "Staff, backlogs and statements from a file" },
  { icon: Code, label: "One API", note: "The same API behind every screen, scoped to your organisation" },
];

const FAQS = [
  {
    question: "Are all five modules available?",
    answer:
      "Yes. Finance, Admin & Operations, HRM, Projects and LMS are all live and run against real data. Each can be switched on for your organisation on its own, and the shared spine comes with every one of them.",
  },
  {
    question: "Do we have to take all five?",
    answer:
      "No. Most of the value is in how they connect, but each module stands on its own. What you never pay for twice is the sign-in, the organisation structure, the approval engine or the audit trail — those come with the platform.",
  },
  {
    question: "How do approvals work across modules?",
    answer:
      "Through one approval engine. Your organisation defines the workflow for each process — levels, amount bands, who signs — once. Every request lands in the approver's single inbox, delegation covers absences, and high-value approvals ask for a second sign-in check.",
  },
  {
    question: "How does data move between modules?",
    answer:
      "Mostly it does not have to move, because it is one dataset. Where a step genuinely is an event — a payroll run posting its journal, an unreturned asset becoming a final-pay deduction — the event is delivered once, and only to modules your organisation has switched on.",
  },
  {
    question: "Is Elevate multi-tenant?",
    answer:
      "Yes. Every record in every module is scoped to an organisation, and the boundary is enforced in the API rather than in the interface. Two organisations on the same deployment cannot reach each other's records.",
  },
  {
    question: "What happens when someone deletes something?",
    answer:
      "Every delete asks for confirmation and the record goes to your organisation's recycle bin, from where it can be restored. Stored secrets such as integration keys are the exception: removing one really wipes it.",
  },
];

export default function PlatformPage() {
  return (
    <>
      {/* 1. Hero — the same furniture every hero on this site uses. */}
      <section className="relative overflow-hidden bg-primary-600">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
          viewBox="0 0 800 500"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g fill="#ffffff">
            <rect x="40" y="360" width="34" height="70" rx="6" />
            <rect x="92" y="320" width="34" height="110" rx="6" />
            <rect x="144" y="272" width="34" height="158" rx="6" />
            <rect x="196" y="212" width="34" height="218" rx="6" />
            <rect x="560" y="330" width="34" height="100" rx="6" />
            <rect x="612" y="286" width="34" height="144" rx="6" />
            <rect x="664" y="230" width="34" height="200" rx="6" />
            <rect x="716" y="160" width="34" height="270" rx="6" />
          </g>
        </svg>

        <div className="section-container relative z-10">
          <div className="max-w-3xl py-16 md:py-20 lg:py-24">
            <p className="label-mono flex items-center gap-2.5 text-white/70">
              <span
                className="h-0.5 w-7 rounded-full bg-white/40"
                aria-hidden="true"
              />
              The platform
            </p>

            <h1 className="mt-5 font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              One company system, not five logins.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
              Finance, Admin &amp; Operations, HR, Projects and Learning run on one
              API and one application. The sign-in, the organisation structure,
              the roles, the approval engine, the audit trail and the recycle
              bin are singular — which is the difference between a suite and a
              bundle.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="#modules"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-primary-700 shadow-lg transition-all duration-200 hover:bg-primary-50 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600 active:scale-[0.98]"
              >
                See the modules
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-lg border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600 active:scale-[0.98]"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>

        <svg
          className="relative -mb-px block w-full"
          viewBox="0 0 1440 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 60V20C240 0 480 40 720 30C960 20 1200 0 1440 20V60H0Z"
            fill="white"
          />
        </svg>
      </section>

      {/*
        2. Where a person lands, then the spine under it.

        The suite home is the first real screen after sign-in: every module
        the person can open, on one account. It sits directly under the hero
        so the first thing this page shows is the product, not a diagram of it.
      */}
      <section className="section-padding overflow-hidden bg-white">
        <div className="section-container">
          <div className="mx-auto max-w-5xl">
            <ProductScreenshot
              screen="suiteHome"
              hue="primary"
              priority
              caption="The suite home: one sign-in, and every module the person has been given."
            />
          </div>

          <div className="mt-20 grid items-center gap-12 lg:mt-24 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeader
                eyebrow="The spine"
                title="Five columns, one bar"
                intro="Elevate's mark is three rising columns. Scaled up it explains the suite: five modules, each its own column, all standing on the same foundation."
                align="left"
              />

              <div className="mt-8 space-y-5 text-neutral-600">
                <p className="leading-relaxed">
                  The bar is drawn wider than the columns because it is what
                  holds them up. A person is created once and every module
                  inherits them. Units, cost centres and job titles are set once
                  in the organisation console and nobody keeps a second copy.
                  Approval workflows are defined once, so a band changed for
                  purchasing is changed wherever it applies.
                </p>
                <p className="leading-relaxed">
                  Above the bar the five modules differ, and their hues are how
                  you tell them apart. Below it nothing differs at all — which
                  is why payroll, purchases and project spend land in one set of
                  books, and why month-end is a review rather than a rebuild.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <SpineDiagram />
            </div>
          </div>
        </div>
      </section>

      {/*
        2a. Everything shared, shown and then listed.

        Two of the shared services are screens in their own right — the
        approvals inbox and the organisation console — so they are shown as
        they are before the full list names all nine.
      */}
      <section id="shared" className="scroll-mt-24 section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Shared by every module"
            title="What you set up once and every module uses"
            intro="One sign-in, one organisation structure, one set of roles, one approval engine with a single inbox and delegation, one audit trail, one recycle bin, verifiable documents and events between modules."
          />

          <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-8">
            <ProductScreenshot
              screen="approvals"
              hue="primary"
              caption="The approvals inbox: every request waiting on you, from every module, with delegation when you are away."
            />
            <ProductScreenshot
              screen="orgConsole"
              hue="neutral"
              caption="The organisation console: structure, cost centres, roles, approval workflows and numbering."
            />
          </div>

          <SharedSpineGrid className="mt-14" />
        </div>
      </section>

      {/*
        2b. The five, with a way in. All five are live (owner, 9 Oct 2026),
        listed company-first in registry order.
      */}
      <section id="modules" className="scroll-mt-24 section-padding bg-white">
        <div className="section-container">
          <SuiteGrid
            heading="The five modules"
            intro="Finance, Admin & Operations, HRM, Projects and LMS — each a full product, all live. They share the spine above, which is what makes running two of them different from buying two of them."
          />
        </div>
      </section>

      {/* 3. The stack */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Architecture"
            title="What sits under the five modules"
            intro="Four layers: what a person opens, what every module shares, where the guarantees are enforced, and what the whole thing runs on."
          />
          <div className="mt-14">
            <ArchitectureStack />
          </div>
        </div>
      </section>

      {/* 4. Security and tenancy */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Trust"
            title="Where the guarantees are enforced"
            intro="Each of these is a mechanism rather than a reassurance, and each one is checkable. Tenancy is the first because everything else depends on it."
          />
          <div className="mt-14">
            <SecurityGrid />
          </div>
        </div>
      </section>

      {/* 5. The flows that make it a suite */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <CrossModuleFlows
            heading="Five flows that cross the modules"
            intro="A module that cannot name what it hands to the next one is an app that happens to share a login. These are the handovers, in the order they happen."
          />
        </div>
      </section>

      {/* 6. How an organisation gets here */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Adoption"
            title="Switch on all five, or grow into them"
            intro="Many companies take the whole suite on day one; others start where the pain is and add the rest. Either way, each module inherits what the ones before it created."
          />
          <div className="mt-14">
            <AdoptionPath />
          </div>
        </div>
      </section>

      {/* 7. Integrations */}
      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Extensibility"
            title="What the suite connects to"
            intro="Every connection below works today, from the team's Slack channel to the bank file your treasury uploads."
          />

          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.map((integration) => {
              const Glyph = integration.icon;

              return (
                <li
                  key={integration.label}
                  className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                    <Glyph
                      className="h-5 w-5 text-primary-600"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-heading text-sm font-semibold text-neutral-900">
                      {integration.label}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-neutral-500">
                      {integration.note}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Questions"
            title="The ones worth asking first"
          />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={FAQS} />
          </div>
        </div>
      </section>

      {/* 9. Close */}
      <CtaBanner
        title="Run the whole company on one suite."
        intro="Finance, Admin & Operations, HR, Projects and Learning are all live on the same spine. Switch on what you need, and add the rest without moving a record."
        primary={{ label: "See the modules", href: "#modules" }}
        secondary={{ label: "See pricing", href: "/pricing" }}
      />
    </>
  );
}
