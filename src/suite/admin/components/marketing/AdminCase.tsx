import Image from "next/image";
import { SectionHeader } from "@/components/platform/SectionHeader";

/**
 * The case: operations is the work that never got a system.
 *
 * Prose on the left; on the right a photo in a white frame on a purple glow
 * and a pale tile listing the four places the work lives today, each numbered
 * in a white circle. The closing line sits in a lilac wash because it is the
 * sentence the whole section is building to.
 */

const LIVES_IN = [
  { place: "An email thread", problem: "Findable only if you remember the subject line" },
  { place: "A WhatsApp group", problem: "Decisions get made, but nobody records or owns them" },
  { place: "A shared drive", problem: "Four versions, and none of them marked current" },
  { place: "A spreadsheet", problem: "Kept up to date by whoever last had a spare hour" },
];

export function AdminCase() {
  return (
    <>
      <SectionHeader
        eyebrow="The case"
        title="Operations never had a system. Now it does"
        align="left"
        hue="neutral"
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
        <div className="max-w-prose space-y-4 text-lg leading-relaxed text-neutral-600">
          <p>
            Most companies never give operations a system, so the work ends up
            in email, a WhatsApp group and a shared drive. Which vendor quoted
            lowest? Who travels on Thursday, and on what allowance? Who has the
            laptop? Is the generator service due, and has the vehicle&apos;s
            insurance lapsed?
          </p>
          <p>
            None of it is hard. All of it costs money. And all of it stays out
            of sight until it fails an audit, overspends a project, or someone
            leaves and nobody knows what they were holding.
          </p>
          <p>
            <span className="font-semibold text-neutral-900">
              XwiftHQ Admin &amp; Operations runs that work for your whole
              company.
            </span>{" "}
            Purchasing, travel, events, assets, stores, maintenance, premises,
            fleet, documents and compliance. Every request follows your own
            approval rules, and anything charged to a project is committed
            against that project&apos;s funds in Finance before any money moves.
          </p>
          <p>
            Operations is the chassis every other module runs on. When it is
            solid, nobody notices it, and that is exactly how it should feel.
          </p>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <div className="xw-frame aspect-[16/10] overflow-hidden p-1.5">
            <Image
              src="/images/2151997031.jpg"
              alt="A secured data centre aisle with a glowing padlock icon over the server racks"
              width={800}
              height={500}
              sizes="(min-width: 1024px) 32vw, 90vw"
              className="h-full w-full rounded-[1rem] object-cover"
            />
          </div>

          <div className="xw-tile p-6">
            <h3 className="xw-h3 text-base">Where the work lives today</h3>

            <ol className="mt-5 space-y-3">
              {LIVES_IN.map((entry, index) => (
                <li key={entry.place} className="flex items-start gap-3.5">
                  <span
                    className="tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary-700 shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-neutral-900">
                      {entry.place}
                    </span>
                    <span className="block text-sm text-neutral-600">
                      {entry.problem}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-5 rounded-2xl bg-primary-50 px-4 py-3 text-sm leading-relaxed text-primary-900">
              None of the four produces evidence. That is the whole gap, and it
              is the one thing an auditor always asks you to close.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
