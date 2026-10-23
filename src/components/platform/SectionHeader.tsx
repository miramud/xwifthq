import { HUE, type ProductHue } from "@/lib/products";

/**
 * The standard section opener: eyebrow, title, intro.
 *
 * The eyebrow's rule is the one place a product hue appears in running layout,
 * and it is a *rule* rather than coloured text on purpose — a short bar carries
 * the label without asking a colour to do the job of a word. Where no hue is
 * passed the section belongs to the suite rather than to a product, so it gets
 * teal.
 */
export function SectionHeader({
  eyebrow,
  title,
  intro,
  align = "center",
  hue,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: "center" | "left";
  hue?: ProductHue;
}) {
  const tokens = HUE[hue ?? "primary"];
  const centred = align === "center";

  return (
    <div
      className={
        centred ? "mx-auto max-w-2xl text-center" : "max-w-2xl text-left"
      }
    >
      {eyebrow && (
        <p
          className={`label-mono flex items-center gap-2.5 text-neutral-500 ${
            centred ? "justify-center" : ""
          }`}
        >
          <span
            className={`h-0.5 w-7 rounded-full ${tokens.rule}`}
            aria-hidden="true"
          />
          {eyebrow}
        </p>
      )}

      <h2 className="heading-2 mt-3 text-neutral-900">{title}</h2>

      {intro && (
        <p className="mt-4 text-lg leading-relaxed text-neutral-500">{intro}</p>
      )}
    </div>
  );
}
