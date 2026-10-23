import Link from "next/link";

import { ProductIcon } from "@/components/platform/ProductIcon";
import { PRODUCT_LIST } from "@/lib/products";

/**
 * The band under the hero. Where a template would put customer logos, this
 * names the five modules one login opens, each a link to its own page.
 */
export function ModuleStrip() {
  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="section-container flex flex-col items-center gap-6 lg:flex-row lg:gap-10">
        <p className="max-w-[13rem] shrink-0 text-center text-sm leading-snug text-neutral-600 lg:border-r lg:border-neutral-200 lg:pr-10 lg:text-left">
          Five modules. One login. Zero copy and paste.
        </p>
        <ul className="flex flex-wrap justify-center gap-3 lg:flex-1 lg:justify-between">
          {PRODUCT_LIST.map((product) => (
            <li key={product.slug}>
              <Link
                href={product.href}
                className="inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white py-1.5 pe-5 ps-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <ProductIcon product={product} size="sm" className="rounded-full!" />
                {product.shortName === "Admin" ? "Operations" : product.shortName}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
