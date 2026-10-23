import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { SCREENS, type ScreenKey } from "@/components/platform/ProductScreenshot";
import { HUE, type Product, type ProductSlug } from "@/lib/products";

/**
 * One real screen per module — its overview, captured from the live demo
 * organisation (owner, 9 October 2026: the site shows the actual product).
 * Kept here rather than on the registry: a card-sized thumbnail is a
 * presentation detail of this component alone. The crop is anchored top-left,
 * where each dashboard keeps its title and first figures.
 */
const CARD_SCREEN: Record<ProductSlug, ScreenKey> = {
  finance: "financeDashboard",
  admin: "operationsDashboard",
  hrm: "hrmDashboard",
  projects: "projectsDashboard",
  lms: "lmsDashboard",
};

/**
 * One product, as a card.
 *
 * The whole card is the link rather than a "Learn more" at the bottom — the
 * hover lift promises the whole surface is clickable, so it has to be. That
 * also keeps one tab stop per product instead of two.
 *
 * `featured` widens the card and shows more pillars. It does not recolour
 * anything: the featured product is the one with more to say, not the one with
 * a louder hue.
 */
export function ProductCard({
  product,
  featured = false,
}: {
  product: Product;
  featured?: boolean;
}) {
  const hue = HUE[product.hue];
  const pillars = product.pillars.slice(0, featured ? 5 : 3);
  const photo = SCREENS[CARD_SCREEN[product.slug]];

  return (
    <Link
      href={product.href}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        featured ? "lg:col-span-2" : ""
      }`}
    >
      <div className="relative h-36 shrink-0 overflow-hidden border-b border-neutral-200 bg-neutral-50">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={featured ? "(min-width: 1024px) 40vw, 90vw" : "(min-width: 1024px) 20vw, 90vw"}
          className="object-cover object-left-top transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <ProductIcon product={product} size={featured ? "lg" : "md"} />
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold text-neutral-900">
            {product.name}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">{product.tagline}</p>
        </div>
      </div>


      <p className="mt-4 text-sm leading-relaxed text-neutral-600">
        {product.summary}
      </p>

      <ul
        className={`mt-5 grid gap-x-6 gap-y-2 ${
          featured ? "sm:grid-cols-2" : ""
        }`}
      >
        {pillars.map((pillar) => (
          <li
            key={pillar.title}
            className="flex items-start gap-2.5 text-sm text-neutral-700"
          >
            <span
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${hue.rule}`}
              aria-hidden="true"
            />
            {pillar.title}
          </li>
        ))}
      </ul>

      {/* mt-auto so the affordance sits on the same line across a row of cards. */}
      <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-primary-600 transition-colors group-hover:text-primary-700">
        Explore {product.shortName}
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
      </div>
    </Link>
  );
}
