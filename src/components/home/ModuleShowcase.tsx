"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Check } from "lucide-react";

import { SectionHeading } from "@/components/site/SectionHeading";
import { ProductIcon } from "@/components/platform/ProductIcon";
import {
  ProductScreenshot,
  type ScreenKey,
} from "@/components/platform/ProductScreenshot";
import { HUE, PRODUCTS, type ProductSlug } from "@/lib/products";

/**
 * The real product, one module at a time. Every frame is a capture from the
 * running demo organisation. A tab per module keeps five screenshots from
 * turning the page into a long scroll; the reader picks the part of the
 * company they run.
 *
 * Tabs follow the WAI-ARIA pattern: roving tabindex, arrow keys, Home and End.
 * Every panel is rendered and the inactive ones are `hidden`, so the copy is
 * in the document for search and for anyone reading without script.
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
    caption: "Finance at a glance: each month's close, cash in the bank, surplus and what is waiting on the team.",
    points: [
      "A ledger with periods and all four financial statements",
      "Vouchers from memo to bank file, withholding tax included",
      "Project funds tracked as released, committed, spent and left",
    ],
  },
  {
    slug: "admin",
    label: "Operations",
    front: "operationsDashboard",
    back: "opsAssets",
    caption: "Operations at a glance: buying, deliveries, trips, events and stock on one screen.",
    points: [
      "Requisitions, quotes, orders and goods received",
      "A travel desk plus events and workshops, each with a budget",
      "Assets, stores, fleet, facilities and a service desk",
    ],
  },
  {
    slug: "hrm",
    label: "People",
    front: "hrmDashboard",
    back: "hrmPayroll",
    caption: "People at a glance: headcount, onboarding, probation and who is in today.",
    points: [
      "One employee record, from the offer to the final payslip",
      "Leave, rotas, timesheets and payroll with statutory deductions",
      "Hiring, performance reviews, cases and exits",
    ],
  },
  {
    slug: "projects",
    label: "Projects",
    front: "projectsDashboard",
    back: "projectsPerformance",
    caption: "Every project with its team and how much of the schedule is used.",
    points: [
      "Story boards, sprints, testing and the critical path",
      "Velocity and delivery forecasts built from real sprints",
      "Planned against actual spend on every project",
    ],
  },
  {
    slug: "lms",
    label: "Learning",
    front: "lmsDashboard",
    back: "lmsCourses",
    caption: "Learning at a glance: who is in training, completions, courses and ratings.",
    points: [
      "Required training with due dates and an overdue report",
      "A learning path for every role",
      "Certificates anyone can check by serial number",
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
    <section className="section-padding overflow-hidden bg-neutral-50">
      <div className="section-container">
        <SectionHeading
          eyebrow="Inside the product"
          title="See the screens your teams will use"
          intro="Real captures from a working demo company. Pick the part of the business you look after."
        />

        {/*
          The tab row scrolls sideways inside itself at phone width rather than
          wrapping to two ragged lines; the page itself never scrolls sideways.
        */}
        <div
          role="tablist"
          aria-label="XwiftHQ modules"
          className="-mx-4 mt-12 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-auto sm:w-fit sm:flex-wrap sm:justify-center sm:rounded-full sm:border sm:border-neutral-200 sm:bg-white sm:p-1.5 lg:mt-14"
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
                className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-full border py-1 pe-5 ps-1 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                  selected
                    ? "border-primary-600 bg-primary-600 text-white shadow-[0_8px_20px_-10px_rgb(150_56_205/0.8)]"
                    : "border-neutral-200 bg-white text-neutral-700 hover:text-primary-700 sm:border-transparent"
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
              className="mt-10 grid gap-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-4 lg:mt-14 lg:grid-cols-12 lg:gap-12"
            >
              <div className="min-w-0 lg:col-span-4 lg:pt-16">
                <p className={`flex items-center gap-2 text-sm font-semibold ${hue.text}`}>
                  <span className={`h-2 w-2 rounded-full ${hue.rule}`} aria-hidden="true" />
                  {product.name}
                </p>
                <h3 className="mt-4 font-heading text-2xl font-bold leading-snug tracking-[-0.02em] text-neutral-900 sm:text-[1.75rem]">
                  {product.tagline}
                </h3>

                <ul className="mt-7 space-y-3.5">
                  {showcase.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-base leading-relaxed text-neutral-700"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100" aria-hidden="true">
                        <Check className="h-3 w-3 text-primary-700" />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>

                <Link
                  href={product.href}
                  className="btn-outline group mt-8"
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
