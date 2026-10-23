import Link from "next/link";
import {
  Briefcase,
  Building2,
  Camera,
  Hash,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ThumbsUp,
} from "lucide-react";
import { ElevateLockup } from "@/components/shared/ElevateLogo";
import { EnterpriseEnquiryButton } from "@/components/pricing/EnterpriseEnquiryButton";
import { PRODUCT_LIST, type ProductHue } from "@/lib/products";

const CONTACT_EMAIL = "contact@elevate.example.com";

const companyLinks = [
  { label: "Home", href: "/" },
  { label: "Platform", href: "/platform" },
  { label: "Pricing", href: "/pricing" },
  // The requester side of the ticket system: anyone can raise one.
  { label: "Support", href: "/support" },
];

/**
 * Where a signed-in person goes next. The suite launcher opens every module
 * they can use, so the LMS's own learner and teaching pages are no longer
 * listed here one by one — the site is about the suite, not one module.
 */
const accountLinks = [
  { label: "Get started", href: "/get-started" },
  { label: "Sign in", href: "/login" },
  { label: "Open the suite", href: "/suite" },
  { label: "Forgot password", href: "/forgot-password" },
];

/**
 * Hue dots, on ink.
 *
 * `HUE[...].rule` is calibrated against white. On neutral-900 two of the five
 * disappear — Deep Teal is 1.6:1 against it and Admin's ink-on-ink is worse —
 * so the footer steps each hue up to its 400. It is the same label; only the
 * surface under it changed. The product name carries the meaning regardless,
 * which is why the dot can be aria-hidden.
 */
const FOOTER_DOT: Record<ProductHue, string> = {
  primary: "bg-primary-400",
  violet: "bg-violet-400",
  accent: "bg-accent-400",
  neutral: "bg-neutral-400",
  info: "bg-info-400",
};

/**
 * Link colours on ink, and why they run the opposite way to the rest of the
 * site.
 *
 * On white, a link gets *darker* to signal hover. On neutral-900 (#0E2224) it
 * has to get *lighter*, and the footer previously did neither: resting
 * `text-neutral-400` (#7E9494) measures 5.15:1, while `hover:text-primary-400`
 * (#4A8D91) measures 4.33:1 — pointing at a link made it harder to read and
 * dropped it under AA. `primary-300` (#7FB3B5) measures 7.09:1, so the hover
 * state is now the brighter of the two, which is the whole point of it.
 */
const FOOTER_LINK =
  "text-neutral-400 transition-colors hover:text-primary-300 focus-visible:text-primary-300";

/** Contact links inherit the footer's own neutral-300 (9.43:1) at rest. */
const CONTACT_LINK =
  "transition-colors hover:text-primary-300 focus-visible:text-primary-300";

/**
 * lucide v1 ships no brand marks, so four social destinations need four
 * generic glyphs. The previous set was two globes, a share arrow and a chain
 * link — unreadable as four distinct brands. These are picked to be
 * unmistakable from one another at 18px rather than to imitate a logo; the
 * `aria-label` is what actually names the destination.
 */
const socialLinks = [
  { icon: ThumbsUp, href: "https://facebook.com/elevate", label: "Facebook" },
  { icon: Camera, href: "https://instagram.com/elevate", label: "Instagram" },
  { icon: Hash, href: "https://x.com/elevate", label: "X (Twitter)" },
  {
    icon: Briefcase,
    href: "https://linkedin.com/company/elevate",
    label: "LinkedIn",
  },
];

export default function Footer() {
  return (
    <>
      {/*
        This band used to hold a newsletter form whose submit handler cleared
        the field and did nothing else — indistinguishable from success, which
        is worse than no form at all. There is nowhere for an address to be
        posted yet, so the section keeps its place in the layout and offers the
        one channel that does work today. When a list exists, the form comes
        back here.
      */}
      <section className="relative bg-gradient-to-r from-primary-700 via-primary-600 to-primary-700 overflow-hidden">
        {/* Decorative blurred circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-primary-400/20 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">
            Stay in the loop
          </h2>
          <p className="text-primary-100 text-sm sm:text-base max-w-xl mx-auto mb-8">
            The mailing list is not running yet. Until it is, write to us and
            we will add you by hand — and answer whatever brought you here.
          </p>

          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Keep%20me%20posted`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent-500 px-7 py-3 font-semibold text-neutral-900 transition-colors hover:bg-accent-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            Email the team
          </a>
        </div>
      </section>

      {/* Main Footer */}
      <footer className="bg-neutral-900 text-neutral-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          {/*
            Five columns only from xl. At lg the contact column's address would
            crush to two words a line, so lg holds at three and the brand block
            spans the gap.
          */}
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12 xl:grid-cols-5">
            {/* Column 1 - Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="mb-4 inline-flex" aria-label="Elevate home">
                <ElevateLockup
                  variant="reversed"
                  markClassName="h-9 w-9"
                  wordClassName="text-2xl"
                />
              </Link>
              <p className="text-neutral-400 text-sm leading-relaxed mb-6">
                Elevate is the all-in-one suite for running a company: finance,
                operations, people, projects and staff training — on one
                sign-in, one approval engine and one audit trail.
              </p>

              {/* Social Icons */}
              <div className="flex items-center gap-3">
                {socialLinks.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800 transition-colors hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <Icon className="w-[18px] h-[18px] text-neutral-300" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>

            {/* Column 2 - Products */}
            <div>
              <h3 className="text-white font-semibold text-lg mb-5">Products</h3>
              <ul className="space-y-3">
                {PRODUCT_LIST.map((product) => (
                  <li key={product.slug}>
                    <Link
                      href={product.href}
                      className={`inline-flex items-center gap-2.5 text-sm ${FOOTER_LINK}`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${FOOTER_DOT[product.hue]}`}
                        aria-hidden="true"
                      />
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3 - Company */}
            <div>
              <h3 className="text-white font-semibold text-lg mb-5">Company</h3>
              <ul className="space-y-3">
                {companyLinks.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className={`text-sm ${FOOTER_LINK}`}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4 - Account */}
            <div>
              <h3 className="text-white font-semibold text-lg mb-5">Account</h3>
              <ul className="space-y-3">
                {accountLinks.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className={`text-sm ${FOOTER_LINK}`}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 5 - Contact */}
            <div>
              <h3 className="text-white font-semibold text-lg mb-5">Contact</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <Phone className="w-4 h-4 mt-0.5 shrink-0 text-primary-400" aria-hidden="true" />
                  <div>
                    <p>
                      {/*
                        neutral-500 is the caption colour on white. On ink it
                        measures 3.08:1 and fails; neutral-400 is the
                        accessible choice here (5.15:1). The ladder runs the
                        other way on a dark surface.
                      */}
                      <span className="text-neutral-400">MD:</span>{" "}
                      <a href="tel:+2348124973035" className={CONTACT_LINK}>
                        +234 812 497 3035
                      </a>
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-0.5 shrink-0 text-primary-400" aria-hidden="true" />
                  <a href={`mailto:${CONTACT_EMAIL}`} className={CONTACT_LINK}>
                    {CONTACT_EMAIL}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-primary-400" aria-hidden="true" />
                  <EnterpriseEnquiryButton className={CONTACT_LINK} />
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary-400" aria-hidden="true" />
                  <p className="text-neutral-400 leading-relaxed">
                    16 Ilarabe Avenue, Ikoyi, Lagos, Nigeria
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-neutral-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-center">
            <p className="text-neutral-400 text-sm text-center">
              Copyright &copy; 2026 Elevate. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/*
        green-500 is a raw Tailwind default and off-palette, and a white glyph
        on it measures 2.28:1 — under the 3:1 a UI glyph is judged against.
        success-600 carries the same white glyph at 5.01:1. It has no lighter
        hover state available that would also pass, so hover moves the button
        instead of recolouring it.
      */}
      <a
        href="https://wa.me/2348124973035"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-success-600 shadow-lg transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-success-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        <MessageCircle className="w-7 h-7 text-white" aria-hidden="true" />
      </a>
    </>
  );
}
