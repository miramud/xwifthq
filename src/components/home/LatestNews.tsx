import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PillLink } from "@/components/home/PillLink";
import { SectionIntro } from "@/components/home/SectionIntro";

/**
 * What's new in the suite, in the template's blog layout.
 *
 * The template's arrangement is the reason this section changed shape: the
 * heading sits in a narrow left column and sticks there while the posts scroll
 * past it on the right, and each post is a wide horizontal card with the date
 * printed on its thumbnail. Three posts in a three-up grid is the layout every
 * marketing page uses; this one reads like a publication, which is what a news
 * section is.
 *
 * `position: sticky` needs no JavaScript and degrades to a normal block wherever
 * it is not supported or wherever the column is too short to have anywhere to
 * stick. It is applied from `lg` up only, because on a phone the two columns
 * stack and a heading pinned to the top of the viewport would sit on top of the
 * posts it introduces.
 *
 * Each item carries a machine-readable `dateTime` alongside the printed date.
 * The badge shows the day and month, which is the template's shape, and the
 * full date stays available to anything that parses the page.
 */

/**
 * Only capabilities that have shipped, each linking to a page that explains
 * it. There is no blog, so nothing here links to one.
 */
const NEWS = [
  {
    id: "project-financials",
    title: "Expected against actual expense on every project",
    excerpt:
      "Each project now shows its approved budget against real spend — labour from logged hours, travel, events and purchases — and Finance prints one company report, as PDF and Excel, down to who raised each request.",
    category: "Finance",
    href: "/products/finance",
    dateTime: "2026-10-09",
    day: "09",
    month: "Oct",
    image: "/images/finance-2.jpg",
    alt: "A team reviewing financial charts on a large screen in a meeting room",
  },
  {
    id: "operations",
    title: "Admin & Operations: from purchase request to fleet",
    excerpt:
      "Procurement, the travel desk, events, assets, stores, maintenance, facilities, fleet, the service desk and the compliance calendar — on the same approval engine and the same books as Finance.",
    category: "Operations",
    href: "/products/admin",
    dateTime: "2026-10-07",
    day: "07",
    month: "Oct",
    image: "/images/operations.jpg",
    alt: "An officer reviewing paperwork at her desk while a colleague works on a laptop",
  },
  {
    id: "testing",
    title: "Testing inside Projects",
    excerpt:
      "QA sprints, a test-case library, AI-drafted test cases per story and findings that land on the board as bugs with severity and steps to reproduce.",
    category: "Projects",
    href: "/products/projects",
    dateTime: "2026-10-05",
    day: "05",
    month: "Oct",
    image: "/images/125469.jpg",
    alt: "A team working together around a table with laptops",
  },
] as const;

export default function LatestNews() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <SectionIntro
                eyebrow="What's new"
                align="start"
                title="Recently added to the suite."
                intro="Capabilities that have shipped, and where to read about them."
                action={<PillLink href="/platform#modules" label="All modules" />}
              />
            </div>
          </div>

          <ul className="lg:col-span-8">
            {NEWS.map((item, index) => (
              <li
                key={item.id}
                className={`border-b border-dashed border-neutral-300 py-8 first:pt-0 last:border-b-0 last:pb-0 ${
                  index === 0 ? "lg:pt-0" : ""
                }`}
              >
                <article className="group grid gap-6 sm:grid-cols-12 sm:items-center">
                  <div className="relative h-52 overflow-hidden rounded-2xl sm:col-span-5 sm:h-44">
                    <Image
                      src={item.image}
                      alt={item.alt}
                      fill
                      sizes="(min-width: 640px) 26vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                    <time
                      dateTime={item.dateTime}
                      className="absolute left-4 top-4 flex flex-col items-center rounded-xl bg-white px-3 py-2 shadow-md"
                    >
                      <span className="tnum font-heading text-lg font-bold leading-none text-neutral-900">
                        {item.day}
                      </span>
                      <span className="label-mono mt-1 text-neutral-500">
                        {item.month}
                      </span>
                    </time>
                  </div>

                  <div className="sm:col-span-7">
                    <p className="label-mono flex flex-wrap items-center gap-x-2.5 gap-y-1 text-neutral-500">
                      <span className="text-primary-600">{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.month} {item.day}, 2026</span>
                    </p>

                    <h3 className="mt-3 font-heading text-xl font-semibold leading-snug text-neutral-900 sm:text-2xl">
                      <Link
                        href={item.href}
                        className="transition-colors duration-200 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                      >
                        {item.title}
                      </Link>
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                      {item.excerpt}
                    </p>

                    <span className="mt-5 inline-flex items-center gap-2.5 text-sm font-semibold text-primary-600">
                      Learn more
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 transition-colors duration-200 group-hover:bg-primary-600 group-hover:text-white"
                        aria-hidden="true"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
