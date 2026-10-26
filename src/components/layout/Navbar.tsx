"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  User,
  UserCog,
  BookOpen,
  LayoutDashboard,
  LayoutGrid,
  GraduationCap,
  LogOut,
  Award,
  type LucideIcon,
} from "lucide-react";
import { XwiftLockup } from "@/components/shared/BrandLogo";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { HUE, PRODUCT_LIST } from "@/lib/products";
import { useAuth, type AuthUser } from "@/lib/auth-store";
import { administersLms, holdsStudio, isAdminRole } from "@/lib/roles";
import { isModuleActive } from "@/lib/module-access";

/* ------------------------------------------------------------------ */
/*  Role → primary dashboard destination                               */
/* ------------------------------------------------------------------ */

interface Dashboard {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The suite launcher, and why it is not part of `dashboardsFor`.
 *
 * `dashboardsFor` answers "where does *this person* work?": an admin wants the
 * console, somebody who teaches the studio, and everybody their learning. The suite
 * launcher answers a different question: "what else is there?" Folding it into
 * the role switch would hand every signed-in person one destination and hide
 * the other, and the launcher is the only place the four new modules are
 * reachable at all. So it sits beside the role destination, not instead of it.
 *
 * Signed-in only: /suite redirects to /login for everyone else, and a nav link
 * that bounces you to a login screen is a worse offer than no link.
 */
const SUITE_HREF = "/suite";

/**
 * Where this person works, most administrative first.
 *
 * Every member is a User, and what they do comes from the roles they hold;
 * teaching is a role with `lmsInstructor`. So a person can have more
 * than one destination: an admin's console, the studio if they hold a
 * teaching role, and their own learning, which every member has (an admin can
 * take a course too). Learning drops out when the organisation hasn't switched
 * the LMS on; the platform's own people have no learning space.
 */
function dashboardsFor(user: AuthUser): Dashboard[] {
  const out: Dashboard[] = [];

  if (user.role === "super_admin" || user.role === "platform_staff") {
    return [{ href: "/suite/platform", label: "Platform console", icon: LayoutDashboard }];
  }
  if (isAdminRole(user)) {
    out.push({ href: "/suite/org", label: "Admin Dashboard", icon: LayoutDashboard });
  } else if (isModuleActive(user, "lms") && administersLms(user)) {
    out.push({ href: "/suite/lms", label: "Learning console", icon: LayoutDashboard });
  }

  if (holdsStudio(user) && isModuleActive(user, "lms")) {
    out.push({ href: "/suite/lms/teach", label: "Instructor Studio", icon: GraduationCap });
  }

  if (isModuleActive(user, "lms")) {
    out.push({ href: "/my-courses", label: "My learning", icon: BookOpen });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NavLink {
  label: string;
  href: string;
  /**
   * Products is generated from the registry rather than listed here, so a sixth
   * module would appear in the nav the moment it appears in `PRODUCT_LIST`.
   * `href` is only used for the active-state test; the trigger is a button.
   */
  mega?: boolean;
  children?: { label: string; href: string }[];
}

const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products", mega: true },
  { label: "Platform", href: "/platform" },
  { label: "Pricing", href: "/pricing" },
];

/** The slim row under the five products in the mega-menu. */
const MEGA_FOOTER_LINKS = [
  { label: "See how the modules connect", href: "/platform" },
  { label: "Pricing", href: "/pricing" },
];

/* ------------------------------------------------------------------ */
/*  Logo                                                               */
/* ------------------------------------------------------------------ */

function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group flex items-center shrink-0"
      aria-label="XwiftHQ home"
    >
      <XwiftLockup
        markClassName={`transition-transform duration-300 group-hover:scale-[1.03] ${
          compact ? "h-8 w-8" : "h-9 w-9"
        }`}
        wordClassName={compact ? "text-xl" : "text-2xl"}
      />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop dropdown                                                    */
/* ------------------------------------------------------------------ */

/**
 * The same mechanics as the mega-menu below, and for the same reason.
 *
 * This panel used to carry `role="menu"` with `role="menuitem"` children while
 * implementing none of what those roles promise: no arrow keys, no Escape, no
 * focus return. A half-built menu widget is worse than none: it tells a screen
 * reader to expect one set of keys and then answers to another. These are
 * plain links, so they are now described as plain links, and the behaviour a
 * disclosure *does* owe (open on Enter/Space, close on Escape, hand focus
 * back) is implemented rather than announced.
 */
function DesktopDropdown({
  link,
  active,
}: {
  link: NavLink;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timeout.current);
    setOpen(true);
  };
  const hide = () => {
    timeout.current = setTimeout(() => setOpen(false), 150);
  };

  const close = useCallback((returnFocus: boolean) => {
    clearTimeout(timeout.current);
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => () => clearTimeout(timeout.current), []);

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) close(true);
      }}
      onBlur={(e) => {
        // Only close when focus has actually left the panel, otherwise tabbing
        // from the trigger to the first link would shut it immediately.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          close(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1 text-sm font-medium transition-colors duration-200 py-1 ${
          active
            ? "text-primary-600"
            : "text-neutral-700 hover:text-primary-600"
        }`}
      >
        {link.label}
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {/* Underline indicator */}
      <span
        className={`absolute -bottom-[1px] left-0 h-0.5 rounded-full bg-primary-600 transition-all duration-300 ${
          active ? "w-full" : "w-0"
        }`}
        aria-hidden="true"
      />

      {/* Dropdown panel */}
      <div
        /*
          `invisible`, not just `opacity-0`: a visibility:hidden subtree leaves
          the tab order, so a closed panel cannot be tabbed into. This is the
          fix the mega-menu below already carried and this one never received.
        */
        className={`absolute top-full left-0 z-40 mt-2 w-56 origin-top-left rounded-xl border border-neutral-200 bg-white py-2 shadow-xl shadow-neutral-900/8 transition-all duration-200 ${
          open
            ? "visible scale-100 opacity-100 pointer-events-auto"
            : "invisible scale-95 opacity-0 pointer-events-none"
        }`}
      >
        {link.children?.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            onClick={() => close(false)}
            className="block px-4 py-2.5 text-sm text-neutral-700 transition-colors duration-150 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
          >
            {child.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Products mega-menu                                                  */
/* ------------------------------------------------------------------ */

/**
 * Five products do not fit in a 14rem dropdown, and a panel this size cannot be
 * hover-only: a keyboard user has to be able to open it deliberately and get
 * back out again. So the trigger is a real toggle button (Enter and Space open
 * it because it is a `<button>`, Escape closes it and hands focus back), with
 * hover layered on top for the mouse, not instead of it.
 *
 * The panel is centred under its trigger and capped at `min(44rem, viewport)`
 * so it cannot push a scrollbar onto the page at 1024px.
 */
function ProductsMegaMenu({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timeout.current);
    setOpen(true);
  };
  const hide = () => {
    timeout.current = setTimeout(() => setOpen(false), 150);
  };

  const close = useCallback((returnFocus: boolean) => {
    clearTimeout(timeout.current);
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => () => clearTimeout(timeout.current), []);

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) close(true);
      }}
      onBlur={(e) => {
        // Only close when focus has actually left the panel, otherwise tabbing
        // from the trigger to the first product would shut it immediately.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          close(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        // Deliberately no onFocus={show}: opening on focus would mean tabbing
        // to the trigger opens the panel and then Enter (the key that is meant
        // to open it) shuts it again. Hover is for the mouse; the keyboard
        // opens this the way it opens any button.
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1 py-1 text-sm transition-colors duration-200 ${
          active ? "font-semibold text-neutral-900" : "font-medium text-neutral-600 hover:text-primary-700"
        }`}
      >
        Products
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div
        /*
          `invisible` rather than just `opacity-0`: a visibility:hidden subtree
          is out of the tab order, so a closed panel cannot be tabbed into. It
          still transitions, which `hidden` would not.
        */
        className={`absolute left-1/2 top-full z-40 mt-3 w-[min(44rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-[0_30px_70px_-30px_rgb(150_56_205/0.45)] transition-all duration-200 ${
          open
            ? "visible pointer-events-auto scale-100 opacity-100"
            : "invisible pointer-events-none scale-95 opacity-0"
        }`}
      >
        <ul className="grid gap-1 p-3 sm:grid-cols-2">
          {PRODUCT_LIST.map((product) => (
            <li key={product.slug}>
              <Link
                href={product.href}
                onClick={() => close(false)}
                className="flex items-start gap-3 rounded-2xl p-3 transition-colors duration-150 hover:bg-primary-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <ProductIcon product={product} size="sm" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">
                      {product.name}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                    {product.tagline}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-100 bg-primary-50/50 px-6 py-3.5">
          {MEGA_FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => close(false)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 transition-colors hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {link.label}
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile menu                                                         */
/* ------------------------------------------------------------------ */

function MobileMenu({
  open,
  onClose,
  activePath,
  isAuthenticated,
  dashes,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  activePath: string;
  isAuthenticated: boolean;
  dashes: Dashboard[];
  onLogout: () => void;
}) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <nav
        id="mobile-menu"
        /*
          `inert` while closed, which is what actually removes the panel from
          the tab order. `translate-x-full` only moves it off screen: on a
          desktop viewport, where this menu can never be opened, its links, its
          close button, its logo and the whole CTA block were still eight
          permanent invisible tab stops. The `tabIndex={-1}` on the accordion
          children below stays: that guards a *collapsed section inside an
          open menu*, which is a different problem.
        */
        inert={!open}
        className={`fixed top-0 right-0 z-50 h-full w-[85vw] max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Mobile navigation"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <Logo compact />
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center h-11 w-11 rounded-full hover:bg-neutral-100 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Close menu"
          >
            <X size={22} className="text-neutral-600" aria-hidden="true" />
          </button>
        </div>

        {/* Nav links */}
        <div className="overflow-y-auto h-[calc(100%-72px)] pb-8">
          <ul className="px-3 py-4 space-y-1">
            {NAV_LINKS.map((link) => {
              // Every disclosure owes aria-controls, which needs the panel to
              // have an id; the label is already unique across NAV_LINKS.
              const panelId = `mobile-nav-${link.label.toLowerCase()}`;
              return (
              <li key={link.label}>
                {link.mega ? (
                  /* Same accordion mechanics as a `children` entry; the rows just carry an
                     icon tile, because on a phone the tile is what tells five
                     modules apart faster than five near-identical names do. */
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedItem(
                          expandedItem === link.label ? null : link.label
                        )
                      }
                      className={`flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        activePath.startsWith(link.href)
                          ? "text-primary-700 bg-primary-50"
                          : "text-neutral-700 hover:bg-neutral-50"
                      }`}
                      aria-expanded={expandedItem === link.label}
                      aria-controls={panelId}
                    >
                      {link.label}
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${
                          expandedItem === link.label ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    <ul
                      id={panelId}
                      className={`overflow-hidden transition-all duration-300 ${
                        expandedItem === link.label
                          ? "max-h-[32rem] opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      {PRODUCT_LIST.map((product) => (
                        <li key={product.slug}>
                          <Link
                            href={product.href}
                            onClick={onClose}
                            tabIndex={expandedItem === link.label ? 0 : -1}
                            className="flex items-center gap-3 rounded-lg py-2.5 pl-6 pr-4 transition-colors duration-200 hover:bg-primary-50"
                          >
                            <ProductIcon product={product} size="sm" />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-neutral-800">
                                {product.name}
                              </span>
                              <span className="block text-xs text-neutral-500">
                                {product.tagline}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : link.children ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedItem(
                          expandedItem === link.label ? null : link.label
                        )
                      }
                      className={`flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        activePath.startsWith(link.href)
                          ? "text-primary-700 bg-primary-50"
                          : "text-neutral-700 hover:bg-neutral-50"
                      }`}
                      aria-expanded={expandedItem === link.label}
                      aria-controls={panelId}
                    >
                      {link.label}
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${
                          expandedItem === link.label ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    <ul
                      id={panelId}
                      className={`overflow-hidden transition-all duration-300 ${
                        expandedItem === link.label
                          ? "max-h-96 opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      {link.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onClose}
                            // A collapsed max-height still leaves its links
                            // tabbable; this is what actually takes them out.
                            tabIndex={expandedItem === link.label ? 0 : -1}
                            className="block pl-10 pr-4 py-2.5 text-sm text-neutral-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors duration-200"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      activePath === link.href
                        ? "text-primary-700 bg-primary-50"
                        : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
              );
            })}
          </ul>

          {/* Mobile CTA section */}
          <div className="px-5 pt-4 mt-2 border-t border-neutral-100 space-y-3">
            {isAuthenticated ? (
              <>
                {/*
                  The front door to the whole suite, and on a phone it is the
                  only one. It sits above the role destination because it is
                  the broader answer: the role console is one module, this is
                  all of them. The dot row is drawn from PRODUCT_LIST rather
                  than typed out, so a sixth module shows a sixth dot the day
                  it lands in the registry, and `HUE[...].rule` is the
                  white-surface calibration, which is the surface here.
                */}
                <Link
                  href={SUITE_HREF}
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 px-4 py-3 transition-colors hover:border-primary-300 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <LayoutGrid
                    size={18}
                    className="shrink-0 text-primary-600"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-neutral-900">
                      Open the suite
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      Every module, one launcher
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                    {PRODUCT_LIST.map((product) => (
                      <span
                        key={product.slug}
                        className={`h-1.5 w-1.5 rounded-full ${HUE[product.hue].rule}`}
                      />
                    ))}
                  </span>
                </Link>

                {dashes.map((d) => {
                  const DashIcon = d.icon;
                  return (
                    <Link
                      key={d.href}
                      href={d.href}
                      onClick={onClose}
                      className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <DashIcon size={16} aria-hidden="true" />
                      {d.label}
                    </Link>
                  );
                })}
                <Link
                  href="/my-certificates"
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                >
                  <Award size={16} aria-hidden="true" />
                  My certificates
                </Link>
                <Link
                  href="/account"
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                >
                  <UserCog size={16} />
                  Account
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="btn-outline w-full text-center border-error-200 text-error-600 hover:bg-error-50"
                >
                  <LogOut size={16} className="mr-2" />
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/get-started"
                  onClick={onClose}
                  className="btn-primary w-full text-center"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  onClick={onClose}
                  className="btn-outline w-full text-center"
                >
                  <User size={16} className="mr-2" />
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

/**
 * Routes whose first section is the lilac sky. The bar floats over those and
 * each of their heroes leaves room for it at the top.
 */
const SKY_ROUTES = ["/", "/platform", "/pricing", "/support", "/get-started", "/affiliates"];

function isSkyRoute(pathname: string): boolean {
  return SKY_ROUTES.includes(pathname) || pathname.startsWith("/products/");
}

/* ------------------------------------------------------------------ */
/*  Main Navbar                                                         */
/* ------------------------------------------------------------------ */

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const dashes = user ? dashboardsFor(user) : [];

  const handleLogout = useCallback(async () => {
    await logout();
    setMobileOpen(false);
    router.push("/");
  }, [logout, router]);

  // The real route. This was hardcoded to "/", which meant the active state was
  // decorative: Home stayed lit on every page and nothing else ever lit at all.
  const activePath = usePathname();

  /* Scroll listener */
  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 20);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Sync initial state off the effect body (not a synchronous setState).
    const raf = requestAnimationFrame(handleScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  /* Close mobile menu on Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const compact = scrolled;
  const overlay = isSkyRoute(activePath);

  return (
    <>
      {/* Main navbar */}
      {/*
        On pages that open with the lilac sky, the bar floats over it: it pulls
        the page up underneath itself by its own height and stays clear until
        the reader scrolls. Everywhere else it is a frosted white bar.
      */}
      <header
        className={`sticky top-0 z-30 w-full border-b transition-all duration-300 ${
          overlay ? "-mb-[72px]" : ""
        } ${
          compact || !overlay
            ? "border-neutral-200/70 bg-white/85 backdrop-blur-md"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="section-container relative">
          <div
            className="flex h-[72px] items-center justify-between gap-4"
          >
            {/* Left: Logo */}
            <Logo compact />

            {/* Center: Desktop nav links */}
            <nav
              className="hidden lg:flex items-center gap-8"
              aria-label="Main navigation"
            >
              {NAV_LINKS.map((link) =>
                link.mega ? (
                  <ProductsMegaMenu
                    key={link.label}
                    active={activePath.startsWith(link.href)}
                  />
                ) : link.children ? (
                  <DesktopDropdown
                    key={link.label}
                    link={link}
                    active={activePath.startsWith(link.href) && link.href !== "/"}
                  />
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    aria-current={activePath === link.href ? "page" : undefined}
                    className={`relative py-1 text-sm transition-colors duration-200 ${
                      activePath === link.href
                        ? "font-semibold text-neutral-900"
                        : "font-medium text-neutral-600 hover:text-primary-700"
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/*
                Suite launcher. It carries a word rather than a glyph because
                it is the only route to four of the five modules, and an
                unlabelled tile is not a thing anyone goes looking for. It is
                a quiet link rather than a filled button: for signed-out
                visitors "Get started" is the one solid call to action in this
                bar, and a second fill beside it would compete with it.
              */}
              {isAuthenticated && (
                <Link
                  href={SUITE_HREF}
                  className="hidden md:inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-neutral-700 transition-colors duration-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <LayoutGrid size={18} aria-hidden="true" />
                  Suite
                </Link>
              )}

              {/* Role dashboard + Account, only for the signed-in user's own role */}
              {isAuthenticated && (
                <>
                  {dashes.map((d) => {
                    const DashIcon = d.icon;
                    return (
                      <Link
                        key={d.href}
                        href={d.href}
                        className="hidden md:flex items-center justify-center h-11 w-11 rounded-full text-neutral-600 hover:bg-primary-50 hover:text-primary-700 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        aria-label={d.label}
                        title={d.label}
                      >
                        <DashIcon size={20} aria-hidden="true" />
                      </Link>
                    );
                  })}

                  <Link
                    href="/account"
                    className="hidden md:flex items-center justify-center h-11 w-11 rounded-full text-neutral-600 hover:bg-neutral-100 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label="Account"
                    title="Account"
                  >
                    <UserCog size={20} aria-hidden="true" />
                  </Link>
                </>
              )}

              {/* Cart */}

              {/* Login / Logout - desktop only */}
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-all duration-200 hover:border-error-300 hover:text-error-600 hover:bg-error-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="hidden lg:inline-flex items-center rounded-full px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors duration-200 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    Log in
                  </Link>
                  {/* The bar's one call to action: set up a new organisation. */}
                  <Link
                    href="/get-started"
                    className="hidden lg:inline-flex items-center rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-[0.98]"
                  >
                    Get started
                  </Link>
                </>
              )}

              {/* Hamburger - mobile only */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden flex items-center justify-center h-11 w-11 rounded-full text-neutral-600 hover:bg-neutral-100 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
              >
                <Menu size={22} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

      </header>

      {/* Mobile menu */}
      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activePath={activePath}
        isAuthenticated={isAuthenticated}
        dashes={dashes}
        onLogout={handleLogout}
      />
    </>
  );
}
