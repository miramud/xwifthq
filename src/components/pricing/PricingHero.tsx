/**
 * The pricing hero.
 *
 * It borrows the furniture every other hero on the site uses — deep teal, the
 * mark's ascending rectangles at wallpaper scale, the white wave to close —
 * because a pricing page that opened differently would read as a different
 * company at the exact moment the reader is deciding whether to trust one.
 *
 * `ProductHero` is not reusable here: it is keyed to a product in the registry
 * and pricing is not a product. The shared furniture is duplicated rather than
 * generalised, since a two-caller abstraction over a hero is usually just a
 * harder hero.
 */
export function PricingHero() {
  return (
    <section className="relative overflow-hidden bg-primary-600">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g fill="#ffffff">
          <rect x="40" y="360" width="34" height="70" rx="6" />
          <rect x="92" y="320" width="34" height="110" rx="6" />
          <rect x="144" y="272" width="34" height="158" rx="6" />
          <rect x="196" y="212" width="34" height="218" rx="6" />
          <rect x="560" y="330" width="34" height="100" rx="6" />
          <rect x="612" y="286" width="34" height="144" rx="6" />
          <rect x="664" y="230" width="34" height="200" rx="6" />
          <rect x="716" y="160" width="34" height="270" rx="6" />
        </g>
      </svg>

      <div className="section-container relative z-10">
        <div className="flex max-w-3xl flex-col items-start gap-6 py-16 md:py-20 lg:py-24">
          <p className="label-mono flex items-center gap-2.5 text-white/70">
            <span
              className="h-0.5 w-7 rounded-full bg-white/40"
              aria-hidden="true"
            />
            Elevate Suite
          </p>

          <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
            Pricing
          </h1>

          <p className="max-w-2xl text-xl leading-relaxed text-white/85">
            Buy the modules you need once, and keep them. No subscriptions, no
            renewals — the more modules you take, the less each one costs.
          </p>

          <p className="max-w-2xl leading-relaxed text-white/70">
            Prefer to own everything? The full source code is available too, and
            a dedicated server on your own domain can be arranged.
          </p>
        </div>
      </div>

      <svg
        className="relative -mb-px block w-full"
        viewBox="0 0 1440 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 60V20C240 0 480 40 720 30C960 20 1200 0 1440 20V60H0Z"
          fill="white"
        />
      </svg>
    </section>
  );
}
