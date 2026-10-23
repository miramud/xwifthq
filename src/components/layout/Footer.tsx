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
import { XwiftLockup } from "@/components/shared/BrandLogo";
import { EnterpriseEnquiryButton } from "@/components/pricing/EnterpriseEnquiryButton";
import { HUE, PRODUCT_LIST } from "@/lib/products";

const CONTACT_EMAIL = "hello@xwifthq.example.com";

const ADDRESS = "2 Thames Road, Walsall, West Midlands, WS3 1PJ, UK";

/** `tel` is the dialable form of `display`. */
const phones = [
  { display: "+44 7915 228374", tel: "+447915228374" },
  { display: "+234 808 300 0807", tel: "+2348083000807" },
];

const companyLinks = [
  { label: "Home", href: "/" },
  { label: "Platform", href: "/platform" },
  { label: "Pricing", href: "/pricing" },
  // The requester side of the ticket system: anyone can raise one.
  { label: "Help centre", href: "/support" },
];

/**
 * Where a signed-in person goes next. The suite launcher opens every module
 * they can use, so module pages are not listed here one by one.
 */
const accountLinks = [
  { label: "Get started", href: "/get-started" },
  { label: "Log in", href: "/login" },
  { label: "Open your workspace", href: "/suite" },
  { label: "Reset your password", href: "/forgot-password" },
];

const FOOTER_LINK =
  "text-neutral-600 transition-colors hover:text-primary-700 focus-visible:text-primary-700";

/**
 * lucide v1 ships no brand marks, so four social destinations need four
 * generic glyphs, picked to be unmistakable from one another at 18px. The
 * `aria-label` is what actually names the destination.
 */
const socialLinks = [
  { icon: ThumbsUp, href: "https://facebook.com/xwifthq", label: "Facebook" },
  { icon: Camera, href: "https://instagram.com/xwifthq", label: "Instagram" },
  { icon: Hash, href: "https://x.com/xwifthq", label: "X (Twitter)" },
  { icon: Briefcase, href: "https://linkedin.com/company/xwifthq", label: "LinkedIn" },
];

export default function Footer() {
  return (
    <>
      <footer className="relative overflow-hidden border-t border-neutral-200/80 bg-neutral-50 text-neutral-600">
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6 lg:px-8 lg:pt-20">
          {/*
            Five columns only from xl. At lg the contact column's address would
            crush to two words a line, so lg holds at three and the brand block
            spans the gap.
          */}
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1.3fr]">
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="mb-5 inline-flex" aria-label="XwiftHQ home">
                <XwiftLockup markClassName="h-9 w-9" wordClassName="text-2xl" />
              </Link>
              <p className="mb-6 max-w-xs text-sm leading-relaxed text-neutral-600">
                The workspace your whole company runs on. Money, operations,
                people, projects and training, all behind one login.
              </p>

              <div className="flex items-center gap-2.5">
                {socialLinks.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-5 text-sm font-semibold text-neutral-900">Modules</h3>
              <ul className="space-y-3">
                {PRODUCT_LIST.map((product) => (
                  <li key={product.slug}>
                    <Link href={product.href} className={`inline-flex items-center gap-2.5 text-sm ${FOOTER_LINK}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${HUE[product.hue].rule}`} aria-hidden="true" />
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-5 text-sm font-semibold text-neutral-900">Company</h3>
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

            <div>
              <h3 className="mb-5 text-sm font-semibold text-neutral-900">Account</h3>
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

            <div>
              <h3 className="mb-5 text-sm font-semibold text-neutral-900">Talk to us</h3>
              <ul className="space-y-4 text-sm">
                {phones.map(({ display, tel }) => (
                  <li key={tel} className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                    <a href={`tel:${tel}`} className={FOOTER_LINK}>
                      {display}
                    </a>
                  </li>
                ))}
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                  <a href={`mailto:${CONTACT_EMAIL}`} className={`break-all ${FOOTER_LINK}`}>
                    {CONTACT_EMAIL}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                  <EnterpriseEnquiryButton className={FOOTER_LINK} />
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                  <p className="leading-relaxed">{ADDRESS}</p>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-neutral-200 pt-6 text-sm sm:flex-row">
            <p>&copy; 2026 XwiftHQ. All rights reserved.</p>
            <p className="text-neutral-500">One workspace. Every team. Moving swiftly.</p>
          </div>
        </div>

        {/* The oversized wordmark sinking into the bottom edge. Decorative. */}
        <p
          aria-hidden="true"
          className="pointer-events-none select-none text-center font-heading text-[22vw] font-bold leading-[0.75] tracking-[-0.06em] text-primary-100/70 lg:text-[16rem]"
        >
          XwiftHQ
        </p>
      </footer>

      {/*
        success-600 carries a white glyph at 5.01:1. It has no lighter hover
        state that would also pass, so hover moves the button instead of
        recolouring it.
      */}
      <a
        href="https://wa.me/2348124973035"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-success-600 shadow-lg transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-success-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        <MessageCircle className="h-7 w-7 text-white" aria-hidden="true" />
      </a>
    </>
  );
}
