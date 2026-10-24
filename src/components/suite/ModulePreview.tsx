import { Check, Eye } from "lucide-react";
import { WelcomeBanner, type BannerArt } from "@/components/workspace/kit";
import { HUE as WS_HUE, type Hue } from "@/components/workspace/modules";
import type { Product } from "@/lib/products";
import type { SuiteModuleKey } from "@/lib/module-access";
import { ModuleActivation } from "./ModuleActivation";

/**
 * The preview page for a module an organisation hasn't switched on.
 *
 * It has one job: show somebody what the module would give them, honestly.
 * The example screen is the same illustrative mock the product page uses, and
 * it wears an "Example" label on its frame: a preview that could be mistaken
 * for the organisation's own figures would be the one thing this page must
 * never be. Below it, what the module does, from the product registry, so the
 * page and the product page can't drift apart.
 */
/* A server component: kit's `cx` lives in a "use client" file and can't be called from here. */
const cx = (...parts: string[]) => parts.join(" ");

/** The banner illustration for each module. */
const ART: Record<SuiteModuleKey, BannerArt> = {
  lms: "learning",
  hrm: "people",
  projects: "projects",
  finance: "money",
  admin: "operations",
};

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
      <WelcomeBanner
        eyebrow={`${product.shortName} · preview`}
        title={product.name}
        subtitle={product.summary}
        art={ART[module]}
      />

      <ModuleActivation module={module} openHref={openHref} />

      <figure className="ws-card overflow-hidden">
        <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
          <span className="flex items-center gap-2.5">
            <span className={cx("flex h-9 w-9 items-center justify-center rounded-xl", WS_HUE[hue].soft)} aria-hidden>
              <Eye size={16} />
            </span>
            <span className="text-sm font-bold tracking-tight text-neutral-900">Example screen</span>
          </span>
          <span className="rounded-full bg-sun-50 px-2.5 py-1 text-xs font-semibold text-sun-700">
            Sample data, not your organisation&apos;s
          </span>
        </figcaption>
        <div className="bg-canvas p-4 sm:p-8" aria-hidden>
          <div className="pointer-events-none mx-auto max-w-3xl select-none">{example}</div>
        </div>
      </figure>

      <section aria-labelledby={`${module}-what`}>
        <h2 id={`${module}-what`} className="mb-4 text-lg font-bold tracking-tight text-neutral-900">
          What {product.shortName} gives you
        </h2>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {product.pillars.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.title} className="ws-card p-5">
                <span className={cx("flex h-12 w-12 items-center justify-center rounded-2xl", WS_HUE[hue].soft)}>
                  <Icon size={22} aria-hidden />
                </span>
                <h3 className="mt-4 text-[15px] font-bold tracking-tight text-neutral-900">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">{p.description}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby={`${module}-caps`} className="ws-card p-5 sm:p-6">
        <h2 id={`${module}-caps`} className="text-lg font-bold tracking-tight text-neutral-900">
          Everything in it
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {product.capabilities.map((group) => (
            <div key={group.group} className="rounded-2xl bg-neutral-50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.group}</h3>
              <ul className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-neutral-700">
                    <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", WS_HUE[hue].soft)} aria-hidden>
                      <Check size={12} />
                    </span>
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
