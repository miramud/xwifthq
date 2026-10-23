import { type ProductHue } from "@/lib/products";
import { SectionHeading } from "@/components/site/SectionHeading";

/**
 * The section opener on module and platform pages. It is the public site's
 * SectionHeading under its older name, so every page shares one lilac pill
 * eyebrow, one bold title and one muted intro. `hue` is accepted for the
 * callers that still pass it; the heading itself stays purple on every page.
 */
export function SectionHeader({
  eyebrow,
  title,
  intro,
  align = "center",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: "center" | "left";
  hue?: ProductHue;
}) {
  return <SectionHeading eyebrow={eyebrow} title={title} intro={intro} align={align} />;
}
