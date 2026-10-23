import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PillLink } from "@/components/home/PillLink";
import { SectionEyebrow } from "@/components/home/SectionIntro";

/**
 * The band that closes the page.
 *
 * `CtaBanner` still closes `/platform`, `/pricing` and the five product pages
 * and is untouched. This one exists because the home page now sets its titles
 * at a display scale that the shared banner does not have, and because the
 * template's closing block is a full-height statement rather than a strip — a
 * `heading-3` on a teal bar after 84px of hero would read as the page giving up
 * at the end.
 *
 * Deep Teal at 800 rather than 700. The marquee band near the top is teal too,
 * and a step darker here reads as a close rather than a repeat.
 *
 * The three links under the rule are the questions a reader who got this far
 * actually has next, in the order they tend to ask them.
 */

const NEXT_STEPS = [
  {
    label: "What it costs",
    description: "A one-time price, set by how many modules you take",
    href: "/pricing",
  },
  {
    label: "How the suite fits together",
    description: "The spine, the five modules and what they hand each other",
    href: "/platform",
  },
  {
    label: "Ask a question",
    description: "Talk to the team before you commit to anything",
    href: "/support",
  },
] as const;

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden bg-primary-800">
      {/* The mark's motif, once more, at closing scale. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 800 360"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g fill="#ffffff">
          <rect x="556" y="246" width="32" height="70" rx="6" />
          <rect x="604" y="212" width="32" height="104" rx="6" />
          <rect x="652" y="168" width="32" height="148" rx="6" />
          <rect x="700" y="112" width="32" height="204" rx="6" />
        </g>
      </svg>

      <div className="section-container section-padding relative z-10">
        <div className="max-w-3xl">
          <SectionEyebrow tone="light">Where to start</SectionEyebrow>

          <h2 className="display-1 mt-5 text-white">
            One company. One suite.{" "}
            <span className="text-accent-400">Run all of it from here.</span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            Finance, Admin &amp; Operations, HR, Projects and Learning are all
            live on the same sign-in, the same approval engine and the same
            audit trail. Switch on the whole suite, or start with the modules
            you need and add the rest without moving a record.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <PillLink href="/platform" label="Explore the suite" tone="light" />
            <PillLink href="/login" label="Sign in" tone="accent" />
          </div>
        </div>

        <ul className="mt-16 grid gap-px border-t border-dashed border-white/25 sm:grid-cols-3">
          {NEXT_STEPS.map((step) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className="group flex h-full flex-col gap-2 py-8 transition-colors duration-200 sm:px-6 sm:first:ps-0"
              >
                <span className="flex items-center gap-2.5 font-heading text-lg font-semibold text-white">
                  {step.label}
                  <ArrowUpRight
                    className="h-4 w-4 text-accent-400 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-sm leading-relaxed text-white/60">
                  {step.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
