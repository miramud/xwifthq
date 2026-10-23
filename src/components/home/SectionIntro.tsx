import type { ReactNode } from "react";

/**
 * The landing page's section opener.
 *
 * `SectionHeader` in `components/platform` is the rest of the site's opener and
 * stays exactly as it is — this is the home page's own, built to the corporate
 * template's proportions: a glyphed uppercase eyebrow, a display-weight title
 * that runs two or three lines wide, and an optional action parked on the
 * title's baseline.
 *
 * The difference that matters is `align="split"`. The template's signature move
 * is to drop the eyebrow into a narrow left column and let the title occupy the
 * remaining two thirds, which gives a section a diagonal entry instead of a
 * centred stack. Below `lg` the two columns collapse and it degrades to the
 * stacked form, because a four-column eyebrow on a phone is just a line of text
 * with a large indent.
 *
 * The eyebrow is teal rather than Slate here. On this page it is doing the job
 * the template gives it — a colour cue that a new section has started — and it
 * sits at `.label-mono`'s 11px on Mist or white, where Deep Teal is 8.1:1.
 */

/** The template's box glyph, drawn rather than pulled from an icon set. */
function EyebrowGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={`h-3.5 w-3.5 ${className}`}
      aria-hidden="true"
    >
      <rect x="0.75" y="0.75" width="6" height="6" rx="1.4" fill="currentColor" />
      <rect
        x="9.25"
        y="0.75"
        width="6"
        height="6"
        rx="1.4"
        fill="currentColor"
        opacity="0.45"
      />
      <rect
        x="0.75"
        y="9.25"
        width="6"
        height="6"
        rx="1.4"
        fill="currentColor"
        opacity="0.45"
      />
      <rect x="9.25" y="9.25" width="6" height="6" rx="1.4" fill="currentColor" />
    </svg>
  );
}

export function SectionEyebrow({
  children,
  tone = "dark",
  className = "",
}: {
  children: ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <p
      className={`label-mono inline-flex items-center gap-2 ${
        tone === "light" ? "text-white/70" : "text-primary-600"
      } ${className}`}
    >
      <EyebrowGlyph />
      {children}
    </p>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  intro,
  align = "center",
  tone = "dark",
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  /**
   * `center` stacks and centres. `start` stacks and left-aligns. `split` puts
   * the eyebrow in a narrow left column and the title in a wide right one —
   * the template's default, and the one this page uses most.
   */
  align?: "center" | "start" | "split";
  tone?: "dark" | "light";
  /** Sits under the intro on `split`, and under the title otherwise. */
  action?: ReactNode;
}) {
  const titleClass = `font-heading text-[2rem] font-bold leading-[1.14] tracking-[-0.02em] sm:text-4xl lg:text-[2.6rem] ${
    tone === "light" ? "text-white" : "text-neutral-900"
  }`;

  const introClass = `text-lg leading-relaxed ${
    tone === "light" ? "text-white/70" : "text-neutral-600"
  }`;

  if (align === "split") {
    return (
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <SectionEyebrow tone={tone}>{eyebrow}</SectionEyebrow>
        </div>
        <div className="lg:col-span-8">
          <h2 className={titleClass}>{title}</h2>
          {intro && <p className={`mt-5 max-w-2xl ${introClass}`}>{intro}</p>}
          {action && <div className="mt-8">{action}</div>}
        </div>
      </div>
    );
  }

  const centred = align === "center";

  return (
    <div className={centred ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <SectionEyebrow tone={tone}>{eyebrow}</SectionEyebrow>
      <h2 className={`mt-4 ${titleClass}`}>{title}</h2>
      {intro && (
        <p className={`mt-5 ${introClass} ${centred ? "mx-auto" : ""}`}>
          {intro}
        </p>
      )}
      {action && <div className={`mt-8 ${centred ? "flex justify-center" : ""}`}>{action}</div>}
    </div>
  );
}
