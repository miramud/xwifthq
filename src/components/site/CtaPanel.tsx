import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The closing call to action every public page ends on: a deep purple panel
 * with clouds at its edges, a short line and two pill buttons.
 */
export function CtaPanel({
  title = "Bring your whole company into one workspace",
  intro = "Set up in minutes. Invite your team. Retire the spreadsheets.",
  primary = { label: "Get started free", href: "/get-started" },
  secondary = { label: "View pricing", href: "/pricing" },
}: {
  title?: string;
  intro?: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="section-container">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 px-6 py-16 text-center sm:px-12 sm:py-20">
          <span className="xw-cloud -left-20 -top-10 -z-10 h-40 w-96 opacity-25" aria-hidden="true" />
          <span className="xw-cloud -bottom-14 -right-16 -z-10 h-44 w-[28rem] opacity-25" aria-hidden="true" />
          <h2 className="xw-h2 mx-auto max-w-2xl text-white">{title}</h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/90 sm:text-lg">{intro}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primary.href}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600 sm:w-auto"
            >
              {primary.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={secondary.href}
              className="inline-flex w-full items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
            >
              {secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
