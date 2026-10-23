import { Check, type LucideIcon } from "lucide-react";

/**
 * One deep-dive block: prose one side, a drawn visual the other, sides
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
        <p className="label-mono flex items-center gap-2.5 text-neutral-500">
          <span
            className="h-0.5 w-7 rounded-full bg-info-500"
            aria-hidden="true"
          />
          {eyebrow}
        </p>

        <div className="mt-4 flex items-start gap-3.5">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info-500/10">
            <Glyph className="h-5 w-5 text-info-600" aria-hidden="true" />
          </span>
          <h3 className="heading-4 pt-1 text-neutral-900">{title}</h3>
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
            <li key={point} className="flex items-start gap-2.5">
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-info-600"
                aria-hidden="true"
              />
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
