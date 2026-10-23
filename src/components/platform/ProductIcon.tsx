import { HUE, type Product } from "@/lib/products";

/**
 * A product's icon tile — the one place its hue is allowed to be a fill.
 *
 * The glyph is decorative: every caller puts the product's name next to it, so
 * announcing the icon as well would read the same thing twice. Colour is never
 * the only carrier here for the same reason.
 */

const SIZE: Record<"sm" | "md" | "lg", { box: string; glyph: string }> = {
  sm: { box: "h-9 w-9 rounded-lg", glyph: "h-4.5 w-4.5" },
  md: { box: "h-12 w-12 rounded-xl", glyph: "h-6 w-6" },
  lg: { box: "h-16 w-16 rounded-2xl", glyph: "h-8 w-8" },
};

export function ProductIcon({
  product,
  size = "md",
  className = "",
}: {
  product: Product;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hue = HUE[product.hue];
  const dims = SIZE[size];
  const Glyph = product.icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${dims.box} ${hue.tile} ${className}`}
    >
      <Glyph className={`${dims.glyph} ${hue.icon}`} aria-hidden="true" />
    </span>
  );
}
