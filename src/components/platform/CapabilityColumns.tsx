import { Check } from "lucide-react";
import { HUE, type ProductCapability, type ProductHue } from "@/lib/products";

/**
 * The deep list — the part of a product page that answers "but does it do X".
 *
 * It is a real heading plus a real list per group, so a screen reader gets the
 * structure rather than a wall of sentences. The check glyph is decoration on
 * top of that structure and is hidden: "check, check, check" before every line
 * is noise, and the list markup already says these are items.
 */
export function CapabilityColumns({
  capabilities,
  hue,
}: {
  capabilities: ProductCapability[];
  hue: ProductHue;
}) {
  const tokens = HUE[hue];

  return (
    <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {capabilities.map((capability) => (
        <div key={capability.group}>
          <h3 className="font-heading text-base font-semibold text-neutral-900">
            {capability.group}
          </h3>
          <span
            className={`mt-3 block h-0.5 w-8 rounded-full ${tokens.rule}`}
            aria-hidden="true"
          />
          <ul className="mt-4 space-y-2.5">
            {capability.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Check
                  className={`mt-0.5 h-4 w-4 shrink-0 ${tokens.icon}`}
                  aria-hidden="true"
                />
                <span className="text-sm leading-relaxed text-neutral-600">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
