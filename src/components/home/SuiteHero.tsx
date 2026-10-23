import Link from "next/link";
import {
  ArrowUpRight,
  Inbox,
  Layers,
  Landmark,
  ScrollText,
  Star,
  LogIn,
} from "lucide-react";

import { PillLink } from "@/components/home/PillLink";
import { SectionEyebrow } from "@/components/home/SectionIntro";
import { ProductScreenshot } from "@/components/platform/ProductScreenshot";

/**
 * The front door, rebuilt to the corporate template's opening.
 *
 * The previous hero was a deep teal field with the argument on the left and a
 * diagram on the right. This one follows the template: the statement is set as
 * a wall of display type across the full measure, the supporting matter drops
 * into a narrow left column underneath it, and a single wide photograph carries
 * the right two thirds with a turning seal pinned to its corner.
 *
 * The ground is Mist rather than Deep Teal, and that is the one place this
 * redesign moves the brand rather than rearranging it. It is deliberate and it
 * is paid back immediately: the marquee directly below is a full-bleed teal
 * band, and the page still closes on teal. Teal bookends the page instead of
 * opening it, which is what lets 84px of Ink display type be the first thing
 * the reader meets — the template's whole effect depends on that type having
 * nothing to compete with.
 *
 * Owner, 9 October 2026: the hero sells a company suite, not a learning
 * portal. The stock photograph is gone; the right two thirds now carry the
 * real product — the suite home a person lands on after signing in, captured
 * from the live demo organisation — with the Finance overview set behind it
 * as a second, offset frame. Two layers say "there is more than one module"
 * before a word of copy does.
 *
 * Gold still appears exactly twice in this section, and for the same reason it
 * did before: the bracketed year and the rating star. Gold means the moment of
 * mastery; a third gold object here would make all three mean nothing. Neither
 * of the two carries white text — the year is Ink inside a gold rule, the star
 * is a fill with no text on it at all.
 */

/** Four suite-level facts about how the company runs on it — not adoption numbers. */
const STATS = [
  { icon: Layers, value: "5", label: "Modules, all live" },
  { icon: Inbox, value: "1", label: "Approval inbox for every request" },
  { icon: Landmark, value: "1", label: "Set of books every module posts to" },
  { icon: ScrollText, value: "1", label: "Audit trail and recycle bin" },
] as const;

/**
 * The template puts customer photographs here. We do not have releases for four
 * faces, and inventing them on a page whose argument is "we do not quote a
 * figure we cannot stand behind" would be the wrong first impression. These are
 * the five modules instead, stacked the way the template stacks avatars — the
 * same shape, carrying something true.
 *
 * They overlap by less than the template's avatars do, and they have to: an
 * avatar is a face and stays recognisable with its right third covered, while
 * these carry two letters that have to be read. The overlap is tuned to the
 * point where the ring still reads as a stack and no glyph is clipped.
 */
const MODULE_CHIPS = [
  {
    short: "FI",
    name: "Elevate Finance",
    fill: "bg-accent-500 text-neutral-900",
  },
  { short: "OP", name: "Elevate Admin & Operations", fill: "bg-neutral-900 text-white" },
  { short: "HR", name: "Elevate HRM", fill: "bg-violet-500 text-white" },
  { short: "PR", name: "Elevate Projects", fill: "bg-info-600 text-white" },
  { short: "LE", name: "Elevate LMS", fill: "bg-primary-600 text-white" },
] as const;

/**
 * The turning seal.
 *
 * A ring of words on a circular path with a glyph in the middle, which is the
 * template's badge exactly. The ring is `aria-hidden` and the link carries its
 * own accessible name, because a screen reader handed a circular textPath reads
 * out the separators and has no punctuation to breathe on.
 */
function ExploreSeal() {
  return (
    <Link
      href="/platform"
      aria-label="Explore the Elevate suite"
      className="group relative grid h-28 w-28 place-items-center rounded-full bg-neutral-900 text-white shadow-xl transition-transform duration-300 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:h-32 sm:w-32"
    >
      <svg
        viewBox="0 0 120 120"
        className="animate-spin-slow absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <path
            id="seal-ring"
            d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"
            fill="none"
          />
        </defs>
        <text fill="currentColor" fontSize="10" letterSpacing="2.4">
          <textPath href="#seal-ring" startOffset="0">
            EXPLORE THE SUITE &#183; FIVE MODULES, ONE COMPANY &#183;
          </textPath>
        </text>
      </svg>
      <ArrowUpRight
        className="relative h-6 w-6 text-accent-400 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
        aria-hidden="true"
      />
    </Link>
  );
}

export default function SuiteHero() {
  return (
    <section className="relative overflow-hidden bg-neutral-100 pt-12 sm:pt-16 lg:pt-20">
      {/* The mark's motif, at wallpaper scale. Decorative only. */}
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] w-full opacity-[0.045]"
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g fill="#0c4f54">
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
        {/* The wall of type. */}
        <SectionEyebrow>The all-in-one company suite</SectionEyebrow>

        <h1 className="display-1 mt-5 max-w-5xl text-neutral-900">
          Run the whole company
          <span className="text-neutral-400"> &mdash; </span>
          on one suite{" "}
          <span
            className="ms-1 inline-flex -translate-y-1.5 items-center rounded-lg border-2 border-accent-500 px-3 py-0.5 align-middle text-[0.34em] font-bold tracking-[0.06em] text-neutral-900 sm:px-4"
            aria-hidden="true"
          >
            2026
          </span>
        </h1>

        {/* Supporting matter left, photograph right — the template's proportion. */}
        <div className="mt-12 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-12">
          <div className="flex flex-col gap-7 lg:col-span-4">
            <div className="flex items-center">
              {MODULE_CHIPS.map((chip, index) => (
                <span
                  key={chip.short}
                  className={`label-mono flex h-12 w-12 items-center justify-center rounded-full ring-4 ring-neutral-100 ${chip.fill} ${
                    index === 0 ? "" : "-ms-2"
                  }`}
                >
                  <span className="sr-only">{chip.name}</span>
                  <span aria-hidden="true">{chip.short}</span>
                </span>
              ))}
            </div>

            <div>
              <Star
                className="h-7 w-7 fill-accent-500 text-accent-500"
                aria-hidden="true"
              />
              <p className="mt-4 max-w-sm text-lg leading-relaxed text-neutral-700">
                Finance, Admin &amp; Operations, HR, Projects and staff
                training — five modules on one sign-in, one approval inbox, one
                set of books and one audit trail. Every one of them is live.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <PillLink href="/platform" label="Explore the suite" />
              <PillLink
                href="/login"
                label="Sign in"
                tone="outline"
                icon={LogIn}
              />
            </div>
          </div>

          {/*
            The product, layered. The Finance overview sits behind and above,
            offset to the right, so the suite home in front reads as the first
            of several screens rather than the only one. Below `sm` the back
            frame is dropped: at 375px two overlapping screenshots are just
            noise, and the one that stays is the one a person lands on.
          */}
          <div className="relative lg:col-span-8">
            <div
              className="pointer-events-none absolute -right-2 -top-6 hidden w-[78%] opacity-90 sm:block lg:-right-6 lg:-top-10"
              aria-hidden="true"
            >
              <div className="animate-fade-in-delay-2 rotate-[1.5deg]">
                <ProductScreenshot screen="financeDashboard" hue="accent" />
              </div>
            </div>

            <div className="animate-fade-in-delay-1 relative sm:mr-10 sm:mt-14 lg:mr-14 lg:mt-16">
              <ProductScreenshot screen="suiteHome" hue="primary" priority />
            </div>

            <div className="absolute -top-6 left-4 sm:left-8">
              <ExploreSeal />
            </div>
          </div>
        </div>

        {/*
          The under-hero strip. Dashed rules rather than a card, because the
          template uses the dash as its divider everywhere and a shadowed slab
          here would be the one object on the page that floats.
        */}
        <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-8 border-t border-dashed border-neutral-300 pt-10 sm:mt-16 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-dashed lg:divide-neutral-300">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex items-start gap-4 ${
                index === 0 ? "lg:pe-8" : "lg:px-8"
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500/10">
                <stat.icon
                  className="h-5 w-5 text-primary-600"
                  aria-hidden="true"
                />
              </span>
              <div>
                <dd className="tnum font-heading text-3xl font-bold leading-none text-neutral-900">
                  {stat.value}
                </dd>
                <dt className="mt-2 text-sm leading-snug text-neutral-600">
                  {stat.label}
                </dt>
              </div>
            </div>
          ))}
        </dl>
      </div>

      <div className="h-14 sm:h-16 lg:h-20" />
    </section>
  );
}
