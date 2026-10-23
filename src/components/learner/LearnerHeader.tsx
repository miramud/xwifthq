import { Clouds } from "@/components/site/Sky";

/**
 * The header every learner page opens on: a short band of the same lilac sky
 * the public site uses, with a pill eyebrow, a bold tight title, a muted intro
 * and room for pill actions on the right.
 *
 * The marketing navbar does not float over these routes, so the band keeps a
 * normal top pad rather than the 7rem the `Sky` hero leaves for it.
 */
export function LearnerHeader({
  eyebrow,
  title,
  intro,
  actions,
  above,
  children,
  align = "left",
  narrow = false,
  tour,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  /** Pill buttons beside the title. */
  actions?: React.ReactNode;
  /** A breadcrumb or back link above the title. */
  above?: React.ReactNode;
  /** Anything that belongs on the sky under the title, such as stat cards. */
  children?: React.ReactNode;
  align?: "left" | "center";
  /** Match the max-w-3xl column the narrower learner pages use. */
  narrow?: boolean;
  /** `data-tour` hooks for the guided tour. */
  tour?: { header?: string; actions?: string };
}) {
  const centred = align === "center";

  return (
    <section className="xw-sky relative isolate overflow-hidden">
      <Clouds className="-z-10" />
      <div className="section-container pb-10 pt-10 sm:pb-14 sm:pt-14">
        <div className={narrow ? "mx-auto max-w-3xl" : ""}>
          {above && <div className={`mb-5 ${centred ? "flex justify-center" : ""}`}>{above}</div>}

          <div
            className={
              centred
                ? "mx-auto max-w-2xl text-center"
                : "flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
            }
            data-tour={tour?.header}
          >
            <div className="min-w-0">
              {eyebrow && <p className="xw-eyebrow mb-4">{eyebrow}</p>}
              <h1 className="font-heading text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-neutral-900 sm:text-4xl lg:text-[2.6rem]">
                {title}
              </h1>
              {intro && (
                <div
                  className={`mt-3 text-base leading-relaxed text-neutral-600 ${centred ? "mx-auto max-w-xl" : "max-w-2xl"}`}
                >
                  {intro}
                </div>
              )}
            </div>

            {actions && (
              <div
                className={`flex flex-wrap items-center gap-2 ${centred ? "mt-6 justify-center" : "shrink-0"}`}
                data-tour={tour?.actions}
              >
                {actions}
              </div>
            )}
          </div>

          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/** The rounded white card the learner pages list their things in. */
export const LEARNER_CARD =
  "rounded-[1.25rem] border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(16_18_31/0.04),0_24px_48px_-36px_rgb(150_56_205/0.35)]";

/** A small pill button for card and header actions. */
export const PILL_OUTLINE =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2";
