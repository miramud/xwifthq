import { ProductCard } from "@/components/platform/ProductCard";
import { SectionHeader } from "@/components/platform/SectionHeader";
import { PRODUCT_LIST, type ProductSlug } from "@/lib/products";

/**
 * The five products, in registry order.
 *
 * Five cards in a three-column grid leaves a gap on the last row. Featuring one
 * product fills it honestly: the featured card is two columns wide and carries
 * more pillars, so the row is full because there is more to read, not because
 * something was stretched to fit.
 */
export function SuiteGrid({
  featuredSlug,
  heading,
  intro,
}: {
  featuredSlug?: ProductSlug;
  heading?: string;
  intro?: string;
}) {
  return (
    <div>
      {heading && (
        <SectionHeader eyebrow="The modules" title={heading} intro={intro} />
      )}

      <div
        className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${
          heading ? "mt-14" : ""
        }`}
      >
        {PRODUCT_LIST.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            featured={product.slug === featuredSlug}
          />
        ))}
      </div>
    </div>
  );
}
