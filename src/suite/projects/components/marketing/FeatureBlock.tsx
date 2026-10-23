import { Check, type LucideIcon } from "lucide-react";

/**
 * One deep dive block: prose one side, a drawn visual the other, sides
 * alternating down the page.
 *
 * The reversal is done with `lg:order-*` rather than by reordering the markup,
 * so the reading order stays heading-then-visual for anybody who is not seeing
 * the two-column layout at all.
 */
export function FeatureBlock({
  icon: Glyph,
  eyebrow,
  title,
  paragraphs,
  points,
  visual,
  flip = false,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  points: string[];
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
      <div className={`min-w-0 ${flip ? "lg:order-2" : ""}`}>
        <p className="xw-eyebrow">{eyebrow}</p>

        <div className="mt-4 flex items-start gap-3.5">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)] ring-1 ring-neutral-200/70">
            <Glyph className="h-5 w-5 text-primary-600" aria-hidden="true" />
          </span>
          <h3 className="pt-1.5 font-heading text-2xl font-bold leading-snug tracking-[-0.02em] text-neutral-900">{title}</h3>
        </div>

        {paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="mt-4 max-w-prose leading-relaxed text-neutral-600"
          >
            {paragraph}
          </p>
        ))}

        <ul className="mt-6 space-y-2.5">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100" aria-hidden="true">
                <Check className="h-3 w-3 text-primary-700" />
              </span>
              <span className="max-w-prose text-sm leading-relaxed text-neutral-600">
                {point}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={`min-w-0 ${flip ? "lg:order-1" : ""}`}>{visual}</div>
    </div>
  );
}
