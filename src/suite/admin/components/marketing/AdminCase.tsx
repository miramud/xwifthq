import Image from "next/image";
import { SectionHeader } from "@/components/platform/SectionHeader";

/**
 * The case: operations is the work that never got a system.
 *
 * The aside is numbered in mono against hairlines rather than iconified — four
 * places the work currently lives, and the one sentence that says why none of
 * them produce evidence. On a page with no accent hue, a numeral and a rule are
 * the emphasis, and they are enough.
 */

const LIVES_IN = [
  { place: "An email thread", problem: "Searchable only if you know the subject line" },
  { place: "A WhatsApp group", problem: "Decisions with no record and no owner" },
  { place: "A shared drive", problem: "Four versions, none of them marked current" },
  { place: "A spreadsheet", problem: "Maintained by whoever last had the time" },
];

export function AdminCase() {
  return (
    <>
      <SectionHeader
        eyebrow="The case"
        title="Operations is the work that never had a system"
        align="left"
        hue="neutral"
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
        <div className="max-w-prose space-y-4 text-lg leading-relaxed text-neutral-600">
          <p>
            Operations is the work most companies never give a system, so it
            lives in email, a WhatsApp group and a shared drive. Which vendor
            quoted lowest. Who is travelling on Thursday, and on what
            allowance. Who has the laptop. Which generator service is due, and
            whether the vehicle&apos;s insurance has lapsed.
          </p>
          <p>
            None of it is hard. All of it costs money, and all of it is
            invisible until it fails an audit, overspends a project, or until
            somebody leaves and nobody can say what they are holding.
          </p>
          <p>
            <span className="font-semibold text-neutral-900">
              Elevate Admin &amp; Operations runs that work for the whole
              company.
            </span>{" "}
            Purchasing, travel, events, assets, stores, maintenance, premises,
            fleet, documents and compliance — each request approved by your
            own rules, and everything charged to a project committed against
            that project&apos;s funds in Finance before the money moves.
          </p>
          <p>
            That is also why this page has no colour of its own. Operations is
            the chassis the other modules run on; its restraint is the
            argument.
          </p>
        </div>

        <aside className="flex flex-col gap-6">
          <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
            <Image
              src="/images/2151997031.jpg"
              alt="A secured data centre aisle with a glowing padlock icon over the server racks"
              width={800}
              height={500}
              sizes="(min-width: 1024px) 32vw, 90vw"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="label-mono text-neutral-500">Where it lives today</h3>

          <ol className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
            {LIVES_IN.map((entry, index) => (
              <li key={entry.place} className="flex items-baseline gap-4 py-3.5">
                <span className="tnum label-mono shrink-0 text-neutral-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-900">
                    {entry.place}
                  </span>
                  <span className="block text-sm text-neutral-500">
                    {entry.problem}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-neutral-700">
            <span
              className="mt-2 h-0.5 w-7 shrink-0 rounded-full bg-neutral-700"
              aria-hidden="true"
            />
            None of the four produce evidence. That is the whole gap, and it is
            the only thing an auditor ever asks you to close.
          </p>
          </div>
        </aside>
      </div>
    </>
  );
}
