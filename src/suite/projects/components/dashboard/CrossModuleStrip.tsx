import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { Chip } from "@/components/workspace/kit";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { PRODUCTS, type ProductSlug } from "@/lib/products";
import { SectionHeading } from "../ui/pkit";

/**
 * What crosses the boundary, and which way.
 *
 * Projects sits in the middle of the spine rather than at one end of it: time
 * leaves for Finance, capacity and competency arrive from HRM and the LMS. The
 * direction is spelled out in words in the kicker rather than left to an arrow
 * glyph, because an arrow is the one thing on a card a screen reader will not
 * read out. (The chip carries an arrow too, but only beside those words.)
 */

interface Exchange {
  with: ProductSlug;
  /** True when the record leaves Projects. */
  outbound: boolean;
  artefact: string;
  detail: string;
}

const EXCHANGES: readonly Exchange[] = [
  {
    with: "finance",
    outbound: true,
    artefact: "Billable time",
    detail:
      "A billable entry becomes an invoice line in one step, and the receipt reconciles against the bank. Hour worked to cash received is one record, not three exports.",
  },
  {
    with: "hrm",
    outbound: false,
    artefact: "Capacity and leave",
    detail:
      "Contracted hours less approved leave is what the plan schedules against, so nobody is booked for a week they are away.",
  },
  {
    with: "lms",
    outbound: false,
    artefact: "The competency a task needs",
    detail:
      "When a task needs a skill the assignee does not hold, the gap points at the pathway that closes it rather than at whoever happens to be free.",
  },
];

export function CrossModuleStrip() {
  return (
    <section aria-labelledby="projects-exchanges">
      <SectionHeading
        title={<span id="projects-exchanges">What Projects exchanges</span>}
        hint="Delivery is where the suite meets itself: people from HRM, skills from the LMS, money out to Finance — all against the one org tree and the one audit log."
      />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXCHANGES.map((exchange) => {
          const product = PRODUCTS[exchange.with];
          const kicker = exchange.outbound
            ? `Projects sends to ${product.shortName}`
            : `${product.shortName} sends to Projects`;

          return (
            <li key={exchange.with}>
              <Link
                href={product.appHref}
                className="ws-card group flex h-full flex-col p-5 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <div className="flex items-center gap-3">
                  <ProductIcon product={product} size="sm" />
                  <span className="min-w-0 truncate text-sm font-semibold text-neutral-900">{product.name}</span>
                </div>
                <div className="mt-3">
                  <Chip hue={exchange.outbound ? "coral" : "mint"} icon={exchange.outbound ? ArrowUpRight : ArrowDownLeft}>
                    {kicker}
                  </Chip>
                </div>
                <p className="mt-3 text-[15px] font-semibold text-neutral-900">{exchange.artefact}</p>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-600">{exchange.detail}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700">
                  Open {product.shortName}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
