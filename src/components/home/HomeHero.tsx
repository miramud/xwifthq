import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AppPreview } from "@/components/site/AppPreview";
import { Sky } from "@/components/site/Sky";

/**
 * The home hero: a two line promise on the lilac sky, two calls to action, and
 * the workspace itself rising out of the fold with the roles that use it
 * floating around its edges.
 */

const ROLES = [
  { label: "Finance lead", dot: "bg-accent-500", place: "left-[4%] top-[-1.25rem] lg:left-[6%]" },
  { label: "HR manager", dot: "bg-violet-500", place: "right-[4%] top-[-1.25rem] lg:right-[8%]" },
  { label: "Operations", dot: "bg-sky-500", place: "-left-3 top-[42%] hidden lg:inline-flex" },
  { label: "Project lead", dot: "bg-mint-500", place: "-right-3 top-[38%] hidden lg:inline-flex" },
];

export function HomeHero() {
  return (
    <Sky>
      <div className="section-container text-center">
        <p className="xw-eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-600" aria-hidden="true" />
          The all in one company workspace
        </p>

        <h1 className="xw-h1 mx-auto mt-6 max-w-3xl">
          Run your whole company.
          <br className="hidden sm:block" /> From one place.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
          Finance, operations, people, projects and training share one login,
          one approvals inbox and one record of everything that happened.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/get-started" className="btn-primary w-full sm:w-auto">
            Get started free
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/platform" className="btn-outline w-full sm:w-auto">
            See how it works
          </Link>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl sm:mt-16">
          {ROLES.map((role) => (
            <span key={role.label} className={`xw-chip absolute z-10 ${role.place}`} aria-hidden="true">
              <span className={`h-2 w-2 rounded-full ${role.dot}`} />
              {role.label}
            </span>
          ))}
          <AppPreview />
          {/* The preview sinks into the white page below. */}
          <div
            className="pointer-events-none absolute inset-x-[-1rem] bottom-0 h-28 bg-gradient-to-b from-transparent to-white"
            aria-hidden="true"
          />
        </div>
      </div>
    </Sky>
  );
}
