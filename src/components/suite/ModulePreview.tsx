import { Check } from "lucide-react";
import { PageHeader } from "@/components/workspace/kit";
import { HUE as WS_HUE, type Hue } from "@/components/workspace/modules";
import type { Product } from "@/lib/products";
import type { SuiteModuleKey } from "@/lib/module-access";
import { ModuleActivation } from "./ModuleActivation";

/**
 * The preview page for a module an organisation hasn't switched on.
 *
 * It has one job: show somebody what the module would give them, honestly.
 * The example screen is the same illustrative mock the product page uses, and
 * it wears an "Example" label on its frame — a preview that could be mistaken
 * for the organisation's own figures would be the one thing this page must
 * never be. Below it, what the module does, from the product registry, so the
 * page and the product page can't drift apart.
 */
/* A server component: kit's `cx` lives in a "use client" file and can't be called from here. */
const cx = (...parts: string[]) => parts.join(" ");

export function ModulePreview({
  module,
  product,
  hue,
  openHref,
  example,
}: {
  module: SuiteModuleKey;
  product: Product;
  hue: Hue;
  openHref: string;
  example: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${product.shortName} · preview`} title={product.name} subtitle={product.summary} />

      <ModuleActivation module={module} openHref={openHref} />

      <figure className="overflow-hidden rounded-[1.25rem] border border-neutral-200 bg-neutral-50">
        <figcaption className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Example screen</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
            Illustrative data — not your organisation&apos;s
          </span>
        </figcaption>
        <div className="p-4 sm:p-8" aria-hidden>
          <div className="pointer-events-none mx-auto max-w-3xl select-none">{example}</div>
        </div>
      </figure>

      <section aria-labelledby={`${module}-what`}>
        <h2 id={`${module}-what`} className="mb-4 text-lg font-semibold text-neutral-900">
          What {product.shortName} gives you
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {product.pillars.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.title} className="ws-card p-5">
                <span className={cx("flex h-10 w-10 items-center justify-center rounded-xl", WS_HUE[hue].tile)}>
                  <Icon size={19} aria-hidden />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-neutral-900">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">{p.description}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby={`${module}-caps`} className="ws-card p-5 sm:p-6">
        <h2 id={`${module}-caps`} className="text-lg font-semibold text-neutral-900">
          Everything in it
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {product.capabilities.map((group) => (
            <div key={group.group}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">{group.group}</h3>
              <ul className="mt-2 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed text-neutral-700">
                    <Check size={15} className={cx("mt-0.5 shrink-0", WS_HUE[hue].text)} aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
