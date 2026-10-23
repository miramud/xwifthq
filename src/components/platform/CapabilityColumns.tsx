import { Check } from "lucide-react";
import { type ProductCapability, type ProductHue } from "@/lib/products";

/**
 * The full list, the part of a module page that answers "but does it do X".
 * Each group is a white card with a real heading and a real list, so a screen
 * reader gets the structure. The check glyphs are decoration on top of it.
 */
export function CapabilityColumns({
  capabilities,
}: {
  capabilities: ProductCapability[];
  hue?: ProductHue;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {capabilities.map((capability) => (
        <div key={capability.group} className="rounded-[1.25rem] border border-neutral-200 bg-white p-6">
          <h3 className="xw-h3 text-base">{capability.group}</h3>
          <ul className="mt-4 space-y-3">
            {capability.items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100"
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3 text-primary-700" />
                </span>
                <span className="text-sm leading-relaxed text-neutral-600">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
