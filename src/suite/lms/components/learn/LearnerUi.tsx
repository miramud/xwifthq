"use client";

import { BookOpen, ClipboardCheck, Sparkles, type LucideIcon } from "lucide-react";
import { cx, orbClass } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";

/*
  The learner's own pages (My courses, My certificates, My learning paths,
  Achievements) sit in the public site's chrome, outside the workspace shell,
  so the `.ws` classes do not reach them. These pieces draw the same dashboard
  language with plain Tailwind: a deep purple greeting hero, white 20px cards
  with a faint purple glow on a pale canvas, and stat cards led by a round
  gradient icon.
*/

/** The white card every learner page lists its things in. */
export const LEARNER_PANEL =
  "rounded-[1.25rem] border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgb(16_18_31/0.03),0_10px_28px_-14px_rgb(150_56_205/0.22)]";

/** A button on the hero's purple: solid white, or frosted glass. */
export function heroButtonClass(kind: "solid" | "glass" = "glass"): string {
  return cx(
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-white/70",
    kind === "solid"
      ? "bg-white text-primary-700 shadow-md shadow-primary-900/20 hover:bg-primary-50"
      : "bg-white/15 text-white ring-1 ring-inset ring-white/30 hover:bg-white/25",
  );
}

/**
 * The page's opening: a deep purple card with the page heading, one line on
 * what the page is for, and the page's actions, with floating tiles on the
 * right. Anything passed as children (a stat row, say) sits under it on the
 * canvas.
 */
export function LearnerHero({
  eyebrow,
  title,
  intro,
  actions,
  above,
  children,
  icons = [BookOpen, Sparkles, ClipboardCheck],
  narrow = false,
  tour,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  actions?: React.ReactNode;
  /** A breadcrumb or back link above the card. */
  above?: React.ReactNode;
  children?: React.ReactNode;
  /** The three icons of the illustration on the right. */
  icons?: [LucideIcon, LucideIcon, LucideIcon];
  /** Match the max-w-3xl column the narrower learner pages use. */
  narrow?: boolean;
  /** `data-tour` hooks for the guided tour. */
  tour?: { header?: string; actions?: string };
}) {
  const [A, B, C] = icons;

  return (
    <section className="bg-canvas">
      <div className="section-container pb-2 pt-8 sm:pt-10">
        <div className={narrow ? "mx-auto max-w-3xl" : ""}>
          {above && <div className="mb-4">{above}</div>}

          <div
            data-tour={tour?.header}
            className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500 p-6 text-white shadow-xl shadow-primary-700/20 sm:p-8"
          >
            {/* Soft light behind the content. Decorative. */}
            <span className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-28 right-1/4 h-72 w-72 rounded-full bg-primary-300/25 blur-3xl" aria-hidden="true" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 max-w-2xl">
                {eyebrow && (
                  <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
                    {eyebrow}
                  </p>
                )}
                <h1 className="font-heading text-2xl font-bold tracking-[-0.02em] sm:text-[30px] sm:leading-tight">
                  {title}
                </h1>
                {intro && <div className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">{intro}</div>}

                {actions && (
                  <div className="mt-6 flex flex-wrap items-center gap-2.5" data-tour={tour?.actions}>
                    {actions}
                  </div>
                )}
              </div>

              <div className="relative hidden h-36 w-56 shrink-0 lg:block" aria-hidden="true">
                <span className="absolute right-6 top-0 flex h-20 w-20 rotate-6 items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/25">
                  <A size={34} />
                </span>
                <span className="absolute bottom-0 right-0 flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-xl shadow-primary-900/30">
                  <B size={28} />
                </span>
                <span className="absolute bottom-4 left-6 flex h-14 w-14 -rotate-3 items-center justify-center rounded-2xl bg-sun-300 text-neutral-900 shadow-lg shadow-primary-900/30">
                  <C size={24} />
                </span>
                <span className="absolute left-20 top-6 h-3 w-3 rounded-full bg-white/60" />
              </div>
            </div>
          </div>

          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/**
 * One figure: a round gradient icon on the left, the label, the number and a
 * quiet line under it when there is one.
 */
export function LearnerStat({
  icon: Icon,
  label,
  value,
  hint,
  hue = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  hue?: Hue;
}) {
  return (
    <div className={cx(LEARNER_PANEL, "flex h-full items-center gap-4 p-4 sm:p-5")}>
      <span className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-14 sm:w-14", orbClass(hue))} aria-hidden="true">
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-neutral-500">{label}</p>
        <p className="tnum mt-0.5 font-heading text-2xl font-bold leading-tight tracking-[-0.02em] text-neutral-900 sm:text-[26px]">
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-xs text-neutral-500">{hint}</p>}
      </div>
    </div>
  );
}

/** The pale canvas the rest of a learner page sits on. */
export function LearnerBody({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <section className="min-h-[50vh] bg-canvas">
      <div className="section-container pb-16 pt-6 sm:pb-20">
        <div className={narrow ? "mx-auto max-w-3xl" : ""}>{children}</div>
      </div>
    </section>
  );
}
