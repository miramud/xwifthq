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
import { Sky } from "@/components/site/Sky";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "How XwiftHQ runs a company on one foundation: one login, one structure of units and cost centres, one approvals engine and inbox with delegation, one audit trail, one recycle bin, verifiable PDFs and events between Finance, Operations, HR, Projects and Learning.",
  openGraph: {
    title: "Platform",
    description:
      "One login, one approvals engine, one set of books and one audit trail under XwiftHQ Finance, Operations, HRM, Projects and Learning.",
    url: "https://xwifthq.example.com/platform",
  },
};

/**
 * What the workspace connects to today. Every entry exists in the running
 * product: no logo wall, and nothing listed "by design".
 */
const INTEGRATIONS: { icon: LucideIcon; label: string; note: string }[] = [
  { icon: MessagesSquare, label: "Slack", note: "Project assignments and updates in the team's channel" },
  { icon: MessageSquare, label: "WhatsApp", note: "Notifications for the people who ask for them" },
  { icon: Mail, label: "Gmail and Zoho Mail", note: "Project email sent from your own mailbox" },
  { icon: HardDrive, label: "Cloudinary, Google Drive and S3", note: "Your media library on your own storage" },
  { icon: Landmark, label: "Bank statements", note: "Imported, matched by your rules and reconciled" },
  { icon: Banknote, label: "Bank payment files", note: "Payment schedules and net pay, ready to upload" },
  { icon: FileSpreadsheet, label: "Excel and PDF", note: "Reports, performance sheets and the company finance report" },
  { icon: QrCode, label: "Document verification", note: "A QR code on every branded PDF that anyone can check" },
  { icon: Upload, label: "Bulk import", note: "Staff, backlogs and statements from a file" },
  { icon: Code, label: "One API", note: "The same API behind every screen, scoped to your organisation" },
];

const FAQS = [
  {
    question: "Are all five modules available?",
    answer:
      "Yes. Finance, Operations, HRM, Projects and Learning are all live and run on real data. Each can be switched on for your organisation by itself, and the shared foundation comes with every one.",
  },
  {
    question: "Do we have to take all five?",
    answer:
      "No. Most of the value is in how they connect, but each module stands on its own. You never pay twice for the login, the organisation structure, the approvals engine or the audit trail. Those come with the platform.",
  },
  {
    question: "How do approvals work across modules?",
    answer:
      "Through one approvals engine. Your organisation defines the workflow for each process once: the levels, the amount bands and who signs. Every request lands in the approver's single inbox, delegation covers absences, and large approvals ask for a second check at sign in.",
  },
  {
    question: "How does data move between modules?",
    answer:
      "Mostly it does not need to, because it is one dataset. Where a step really is an event (a payroll run posting its journal, or an unreturned asset becoming a final pay deduction) the event is delivered once, and only to modules your organisation has switched on.",
  },
  {
    question: "Is XwiftHQ multi tenant?",
    answer:
      "Yes. Every record in every module belongs to an organisation, and that boundary is enforced in the API, not just the interface. Two organisations on the same deployment cannot reach each other's records.",
  },
  {
    question: "What happens when someone deletes something?",
    answer:
      "Every delete asks for confirmation, and the record goes to your organisation's recycle bin where it can be restored. Stored secrets such as integration keys are the exception: removing one really wipes it.",
  },
];

export default function PlatformPage() {
  return (
    <>
      <Sky>
        <div className="section-container text-center">
          <p className="xw-eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-600" aria-hidden="true" />
            The platform
          </p>

          <h1 className="xw-h1 mx-auto mt-6 max-w-3xl">
            One company system.
            <br className="hidden sm:block" /> Not five logins.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            Finance, Operations, HR, Projects and Learning run on one API and
            one application. The login, the company structure, the roles, the
            approvals engine, the audit trail and the recycle bin exist once.
            That is the difference between a suite and a bundle.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="#modules" className="btn-primary w-full sm:w-auto">
              Explore the modules
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/pricing" className="btn-outline w-full sm:w-auto">
              View pricing
            </Link>
          </div>

          <div className="relative mx-auto mt-14 max-w-5xl text-left sm:mt-16">
            <span className="xw-chip absolute left-[4%] top-[-1.25rem] z-10 lg:left-[6%]" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              One login
            </span>
            <span className="xw-chip absolute right-[4%] top-[-1.25rem] z-10 lg:right-[8%]" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-mint-500" />
              Every module you own
            </span>
            <ProductScreenshot screen="suiteHome" hue="primary" priority />
            <div
              className="pointer-events-none absolute inset-x-[-1rem] bottom-0 h-28 bg-gradient-to-b from-transparent to-white"
              aria-hidden="true"
            />
          </div>
        </div>
      </Sky>

      <section className="section-padding overflow-hidden bg-white">
        <div className="section-container">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeader
                eyebrow="The foundation"
                title="Five modules standing on one base"
                intro="Each module is its own column. All five stand on the same foundation, and that foundation is what makes them one product."
                align="left"
              />

              <div className="mt-8 space-y-5 text-neutral-600">
                <p className="leading-relaxed">
                  The base is drawn wider than the columns because it holds
                  them up. A person is added once and every module knows them.
                  Units, cost centres and job titles are set once in the
                  organisation console, and nobody keeps a second copy.
                  Approval workflows are defined once, so a limit changed for
                  purchasing changes everywhere it applies.
                </p>
                <p className="leading-relaxed">
                  Above the base the five modules differ, and their colours
                  tell them apart. Below it nothing differs at all. That is
                  why payroll, purchases and project spend land in one set of
                  books, and why month end is a review rather than a rebuild.
                </p>
              </div>
            </div>

            <div className="xw-glow-card p-6 sm:p-8">
              <SpineDiagram />
            </div>
          </div>
        </div>
      </section>

      <section id="shared" className="scroll-mt-24 section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Shared by every module"
            title="Set it up once. Use it everywhere."
            intro="One login, one company structure, one set of roles, one approvals engine with a single inbox and delegation, one audit trail, one recycle bin, verifiable documents and events between modules."
          />

          <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-8">
            <ProductScreenshot
              screen="approvals"
              hue="primary"
              caption="The approvals inbox: every request waiting on you, from every module, with delegation while you are away."
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

      <section id="modules" className="scroll-mt-24 section-padding bg-white">
        <div className="section-container">
          <SuiteGrid
            heading="The five modules"
            intro="Finance, Operations, HRM, Projects and Learning. Each is a full product and all five are live. They share the foundation above, which is why running two of them feels nothing like buying two tools."
          />
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Architecture"
            title="What sits under the five modules"
            intro="Four layers: what people open, what every module shares, where the guarantees are enforced, and what it all runs on."
          />
          <div className="mt-14">
            <ArchitectureStack />
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Security"
            title="Where the guarantees are enforced"
            intro="Each of these is a mechanism, not a promise, and each one can be checked. Tenancy comes first because everything else depends on it."
          />
          <div className="mt-14">
            <SecurityGrid />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <CrossModuleFlows
            heading="Five flows that cross the modules"
            intro="A module that cannot name what it hands to the next is just an app sharing a login. These are the handovers, in the order they happen."
          />
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader
            eyebrow="Getting started"
            title="Switch on all five, or grow into them"
            intro="Many companies start with the whole workspace on day one. Others begin where it hurts most and add the rest later. Either way, each new module picks up what the earlier ones created."
          />
          <div className="mt-14">
            <AdoptionPath />
          </div>
        </div>
      </section>

      <section className="section-padding bg-neutral-50">
        <div className="section-container">
          <SectionHeader
            eyebrow="Integrations"
            title="What XwiftHQ connects to"
            intro="Every connection below works today, from your team's Slack channel to the bank file your treasury uploads."
          />

          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.map((integration) => {
              const Glyph = integration.icon;

              return (
                <li
                  key={integration.label}
                  className="flex items-start gap-4 rounded-[1.25rem] border border-neutral-200 bg-white p-5"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-100">
                    <Glyph className="h-5 w-5 text-primary-600" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-heading text-sm font-semibold text-neutral-900">
                      {integration.label}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-neutral-600">
                      {integration.note}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="section-container">
          <SectionHeader eyebrow="Questions" title="Good questions to ask first" />
          <div className="mx-auto mt-14 max-w-3xl">
            <FaqAccordion faqs={FAQS} />
          </div>
        </div>
      </section>

      <CtaBanner
        title="Run the whole company from one workspace"
        intro="All five modules are live on the same foundation. Switch on what you need today and add the rest without moving a single record."
        primary={{ label: "Get started free", href: "/get-started" }}
        secondary={{ label: "View pricing", href: "/pricing" }}
      />
    </>
  );
}
