"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Check } from "lucide-react";

import { SectionIntro } from "@/components/home/SectionIntro";
import { ProductIcon } from "@/components/platform/ProductIcon";
import {
  ProductScreenshot,
  type ScreenKey,
} from "@/components/platform/ProductScreenshot";
import { HUE, PRODUCTS, type ProductSlug } from "@/lib/products";

/**
 * "See every module" — the real product, one module at a time.
 *
 * Owner, 9 October 2026: the site shows each module's actual dashboards. Every
 * frame here is a 1440 × 900 capture from the live demo organisation, not a
 * drawing. A tab per module keeps five full-width screenshots from turning the
 * page into a scroll of grey rectangles; the reader picks the part of the
 * company they run and sees where that work happens.
 *
 * Each panel is two frames, layered the way the hero layers them: the module's
 * overview in front and one working screen set behind it, offset up and to the
 * right. The back frame is decorative (`aria-hidden`) and drops below `md`,
 * where two overlapping screenshots at phone width only blur each other.
 *
 * Tabs follow the WAI-ARIA pattern: roving tabindex, arrow keys, Home and End.
 * Every panel is rendered and the inactive ones are `hidden`, so the copy is in
 * the document for search and for anyone reading without script.
 */

interface Showcase {
  slug: ProductSlug;
  /** The tab label — what a reader calls this part of the company. */
  label: string;
  front: ScreenKey;
  back: ScreenKey;
  caption: string;
  points: string[];
}

const SHOWCASES: Showcase[] = [
  {
    slug: "finance",
    label: "Finance",
    front: "financeDashboard",
    back: "financeProjects",
    caption: "The Finance overview: the month-by-month close, cash at bank, surplus and the work waiting on Finance.",
    points: [
      "Ledger, periods and the four financial statements",
      "Payment vouchers from memo to bank file, with withholding tax",
      "Project funds released, committed, spent and available",
    ],
  },
  {
    slug: "admin",
    label: "Operations",
    front: "operationsDashboard",
    back: "opsAssets",
    caption: "The Operations overview: purchasing, deliveries, trips, events and stock in one place.",
    points: [
      "Requisition, quotations, order and goods received",
      "Travel desk, events and workshops with budgets",
      "Assets, stores, fleet, facilities and the service desk",
    ],
  },
  {
    slug: "hrm",
    label: "People",
    front: "hrmDashboard",
    back: "hrmPayroll",
    caption: "The People overview: headcount, onboarding, probation and who is in today.",
    points: [
      "One employee record from offer to final pay",
      "Leave, rotas, timesheets and payroll with statutory deductions",
      "Recruitment, performance, cases and leavers",
    ],
  },
  {
    slug: "projects",
    label: "Projects",
    front: "projectsDashboard",
    back: "projectsPerformance",
    caption: "Every project with its schedule used and its team.",
    points: [
      "Story boards, sprints, testing and the critical path",
      "Velocity and a delivery forecast from real sprints",
      "Expected against actual expense on every project",
    ],
  },
  {
    slug: "lms",
    label: "Learning",
    front: "lmsDashboard",
    back: "lmsCourses",
    caption: "The Learning overview: staff in training, completions, courses and ratings.",
    points: [
      "Mandatory training with due dates and an overdue report",
      "Learning paths for each role",
      "Certificates anyone can verify by serial",
    ],
  },
];

export function ModuleShowcase() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const next = (index + SHOWCASES.length) % SHOWCASES.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(SHOWCASES.length - 1);
        break;
    }
  }

  return (
    <section className="section-padding overflow-hidden bg-neutral-100">
      <div className="section-container">
        <SectionIntro
          eyebrow="See every module"
          align="split"
          title="The real screens your teams will work in."
          intro="Captured from a live demo organisation, not drawn for the brochure. Pick the part of the company you run."
        />

        {/*
          The tab row scrolls sideways inside itself at phone width rather than
          wrapping to two ragged lines; the page itself never scrolls sideways.
        */}
        <div
          role="tablist"
          aria-label="Elevate modules"
          className="-mx-4 mt-12 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0 lg:mt-14"
        >
          {SHOWCASES.map((showcase, index) => {
            const product = PRODUCTS[showcase.slug];
            const selected = index === active;

            return (
              <button
                key={showcase.slug}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`showcase-tab-${showcase.slug}`}
                aria-selected={selected}
                aria-controls={`showcase-panel-${showcase.slug}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={`inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2.5 rounded-full border py-1.5 pe-5 ps-1.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-100 ${
                  selected
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:text-neutral-900"
                }`}
              >
                <span className="rounded-full bg-white">
                  <ProductIcon product={product} size="sm" />
                </span>
                {showcase.label}
              </button>
            );
          })}
        </div>

        {SHOWCASES.map((showcase, index) => {
          const product = PRODUCTS[showcase.slug];
          const hue = HUE[product.hue];

          return (
            <div
              key={showcase.slug}
              role="tabpanel"
              id={`showcase-panel-${showcase.slug}`}
              aria-labelledby={`showcase-tab-${showcase.slug}`}
              hidden={index !== active}
              tabIndex={0}
              className="mt-10 grid gap-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-4 focus-visible:ring-offset-neutral-100 lg:mt-12 lg:grid-cols-12 lg:gap-12"
            >
              <div className="min-w-0 lg:col-span-4 lg:pt-16">
                <p className={`label-mono flex items-center gap-2.5 ${hue.text}`}>
                  <span className={`h-0.5 w-7 rounded-full ${hue.rule}`} aria-hidden="true" />
                  {product.name}
                </p>
                <h3 className="mt-4 font-heading text-2xl font-semibold leading-snug text-neutral-900 sm:text-[1.75rem]">
                  {product.tagline}
                </h3>

                <ul className="mt-7 space-y-3 border-t border-dashed border-neutral-300 pt-7">
                  {showcase.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-base leading-relaxed text-neutral-700"
                    >
                      <Check
                        className="mt-1 h-4 w-4 shrink-0 text-primary-600"
                        aria-hidden="true"
                      />
                      {point}
                    </li>
                  ))}
                </ul>

                <Link
                  href={product.href}
                  className="group mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  Explore {showcase.label}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    aria-hidden="true"
                  />
                </Link>
              </div>

              <div className="relative min-w-0 lg:col-span-8">
                <div
                  className="pointer-events-none absolute -right-3 top-0 hidden w-[72%] md:block lg:-right-8"
                  aria-hidden="true"
                >
                  <div className="rotate-[1.25deg] opacity-80">
                    <ProductScreenshot screen={showcase.back} hue={product.hue} />
                  </div>
                </div>

                <div className="relative md:mr-12 md:mt-16 lg:mr-16">
                  <ProductScreenshot
                    screen={showcase.front}
                    hue={product.hue}
                    caption={showcase.caption}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
