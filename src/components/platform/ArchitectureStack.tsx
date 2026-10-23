import { HUE, PRODUCT_LIST } from "@/lib/products";

/**
 * The platform, drawn as four layers.
 *
 * Someone asking "is this one system or five logos on a website?" is asking an
 * architecture question, and the honest answer is a picture of the architecture
 * rather than another paragraph of adjectives. Four bands, top to bottom: what
 * a person touches, what every module shares, what holds the data, and what it
 * all runs on.
 *
 * Marked up as a real ordered list of real headings and lists rather than as
 * one `role="img"` blob. A stack has a top and a bottom and that order is the
 * content, so the list carries it; a single aria-label would have to flatten
 * thirty chips into one sentence nobody would finish.
 *
 * The Foundation band is deep teal because that is what the spine diagram uses
 * for the bar the columns stand on. Same idea, same colour, one page apart.
 */

interface Layer {
  /** "Surface", "Shared services" and so on: the small label above the title. */
  kicker: string;
  title: string;
  description: string;
  chips: string[];
  /** Only the bottom band inverts; see the note above. */
  inverted?: boolean;
  /** True for the product row, which is the one place hues appear here. */
  products?: boolean;
}

const LAYERS: Layer[] = [
  {
    kicker: "Layer 1",
    title: "Surface",
    description:
      "What a person opens. Finance, Admin & Operations, HRM, Projects and LMS, and the launcher that moves between them without a second sign-in.",
    chips: ["In-app suite launcher"],
    products: true,
  },
  {
    kicker: "Layer 2",
    title: "Shared services",
    description:
      "Written once, called by all five. This layer is the difference between a suite and a bundle.",
    chips: [
      "One sign-in, step-up check",
      "Roles & permissions",
      "Units & cost centres",
      "Approval engine",
      "Unified inbox & delegation",
      "Audit trail",
      "Recycle bin",
      "Branded PDFs with QR",
      "Numbering",
      "Document repository",
      "Clients & vendors",
      "Notifications in app, by email, Slack and WhatsApp",
    ],
  },
  {
    kicker: "Layer 3",
    title: "Platform core",
    description:
      "Where the guarantees live. Tenancy is enforced here, not in the interface, so a request that escapes its scope fails at the source.",
    chips: [
      "Multi-tenant data model",
      "Per-organisation isolation",
      "Idempotent money transitions",
      "Cross-module event outbox",
      "Job queue",
    ],
  },
  {
    kicker: "Layer 4",
    title: "Foundation",
    description:
      "One API and one application in front of it. The session token is set and read server-side and never reaches browser JavaScript.",
    chips: [
      "Laravel API",
      "Next.js BFF",
      "Token in an httpOnly cookie",
      "Never readable by browser JavaScript",
    ],
    inverted: true,
  },
];

export function ArchitectureStack() {
  return (
    <ol className="space-y-4">
      {LAYERS.map((layer) => (
        <li
          key={layer.title}
          className={`rounded-[1.25rem] p-6 sm:p-8 ${
            layer.inverted
              ? "bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700"
              : "xw-tile"
          }`}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,15rem)_1fr] lg:gap-10">
            <div>
              <p
                className={`text-xs font-semibold ${
                  layer.inverted ? "text-primary-100" : "text-primary-700"
                }`}
              >
                {layer.kicker}
              </p>
              <h3
                className={`mt-2 font-heading text-lg font-semibold ${
                  layer.inverted ? "text-white" : "text-neutral-900"
                }`}
              >
                {layer.title}
              </h3>
              <p
                className={`mt-2 text-sm leading-relaxed ${
                  layer.inverted ? "text-primary-100" : "text-neutral-600"
                }`}
              >
                {layer.description}
              </p>
            </div>

            <ul className="flex flex-wrap content-start gap-2">
              {/*
                The product row is the one place on this diagram where five
                hues appear at once, and it is legitimate: telling the five
                modules apart is exactly what the reader is doing here.
              */}
              {layer.products &&
                PRODUCT_LIST.map((product) => {
                  const hue = HUE[product.hue];
                  const Glyph = product.icon;

                  return (
                    <li
                      key={product.slug}
                      className="inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white py-1.5 pe-4 ps-1.5 text-sm font-medium text-neutral-900"
                    >
                      <span
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${hue.tile}`}
                      >
                        <Glyph
                          className={`h-4 w-4 ${hue.icon}`}
                          aria-hidden="true"
                        />
                      </span>
                      {product.name}
                    </li>
                  );
                })}

              {layer.chips.map((chip) => (
                <li
                  key={chip}
                  className={`inline-flex items-center rounded-full border px-4 py-2 text-sm ${
                    layer.inverted
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-neutral-200 bg-white text-neutral-700"
                  }`}
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  );
}
