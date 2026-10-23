"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, House, Lock, LogOut, Menu, type LucideIcon } from "lucide-react";
import NotificationBell from "@/components/shared/NotificationBell";
import { useAuth } from "@/lib/auth-store";
import { moduleStatus, previewHref, type SuiteModuleKey } from "@/lib/module-access";
import { ElevateLockup } from "@/components/shared/ElevateLogo";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { ModuleSwitcher } from "@/components/suite/ModuleSwitcher";
import { PreviewBanner } from "@/components/suite/PreviewBanner";
import {
  HUE,
  PRODUCTS,
  PRODUCT_LIST,
  type Product,
} from "@/lib/products";
import {
  SUITE_NAV,
  SUITE_PAGE_TITLE,
  type PreviewSlug,
  type SuiteNavGroup,
  type SuiteNavItem,
} from "@/lib/suite-data";
import { roleLabel } from "@/lib/roles";

/**
 * The chrome every `/suite/*` page sits in.
 *
 * Same skeleton as `AdminShell` — desktop rail, mobile drawer, sticky top bar,
 * one scrolling column — with two deliberate differences.
 *
 * **The rail is light, not ink.** Not for want of a dark palette: `Footer`
 * already paints all five hues on `neutral-900` by stepping each to its 400,
 * and Summit Gold does fine there — `accent-400` on ink is 9.47:1. The reason
 * is what the two surfaces are for. `/suite/lms` is a console you work inside all
 * day, and its ink rail recedes so a dense screen of tables can hold your
 * attention. The suite rail is a launcher: it is the thing you are looking at,
 * it sits over a `neutral-50` page, and an ink slab down the left of an
 * otherwise light shell would read as the heavier half of the screen. It also
 * keeps the active item on the same white ground `HUE`'s tokens are already
 * calibrated against, so the module hue needs no second set of values.
 *
 * **There is no `/suite/lms`.** The LMS ships today and already has a console
 * at `/suite/lms`; building it a preview shell would mean maintaining two front
 * doors to the same product and inviting someone to mistake the fixture for
 * the real thing. Every link to the LMS in this shell points at `/suite/lms`,
 * which is what `Product.appHref` already says.
 */

/* ------------------------------------------------------------------ */
/*  Route model                                                        */
/* ------------------------------------------------------------------ */

/*
  Derived, never typed out. A sixth module added to the registry as not-yet-live
  would otherwise get a shell that fails to recognise its own route: no nav, no
  breadcrumb and — the part that matters — no preview banner, which is the one
  thing standing between a fixture and a figure someone quotes in a meeting.
  `live` is the single fact that decides it, so read it from the registry.

  The `lms` guard narrows the type rather than adding a second rule: `PreviewSlug`
  excludes the LMS by construction, because it has a console at `/suite/lms` and
  never needs a preview shell.
*/
const PREVIEW_SLUGS: readonly PreviewSlug[] = PRODUCT_LIST.filter(
  (entry): entry is Product & { slug: PreviewSlug } =>
    !entry.live && entry.slug !== "lms",
).map((entry) => entry.slug);

function slugFor(pathname: string): PreviewSlug | null {
  for (const slug of PREVIEW_SLUGS) {
    if (pathname === `/suite/${slug}` || pathname.startsWith(`/suite/${slug}/`)) {
      return slug;
    }
  }
  return null;
}

function titleFor(pathname: string, slug: PreviewSlug | null): string {
  if (!slug) return "Your suite";

  const groups: SuiteNavGroup[] = SUITE_NAV[slug];
  for (const group of groups) {
    for (const item of group.items) {
      if (item.href !== `/suite/${slug}` && pathname.startsWith(item.href)) {
        return item.label;
      }
    }
  }
  return SUITE_PAGE_TITLE[slug];
}

/* ------------------------------------------------------------------ */
/*  Rail                                                               */
/* ------------------------------------------------------------------ */

function NavLink({
  item,
  active,
  hueTile,
  hueText,
  onNavigate,
}: {
  item: SuiteNavItem;
  active: boolean;
  hueTile: string;
  hueText: string;
  onNavigate?: () => void;
}) {
  const Icon: LucideIcon = item.icon;
  const reasonId = useId();

  /*
    A section with nowhere to go is a disabled row, not a link that shrugs. A
    control that looks live and does nothing is the fastest way to make a
    preview feel fake — so the lock, the muted type and the reason all say the
    same thing three ways.

    A real `<button disabled>`, exactly like `PreviewAction`, and for the same
    reason. `aria-disabled` on a bare `<span>` has no role to attach itself to
    and is not reliably exposed; a disabled button is announced as a button and
    as unavailable by every screen reader, and browse mode reaches it even
    though the tab order skips it. The reason travels with it via
    `aria-describedby` rather than a `title`, because `title` only ever reaches
    a pointer — the one input that does not need the explanation.

    The reason is sr-only here where `PreviewAction` shows it: a 260px rail has
    room for a label, and the lock glyph is the visible half of the message.
  */
  if (!item.available) {
    return (
      <>
        <button
          type="button"
          disabled
          aria-describedby={reasonId}
          className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-500"
        >
          <Icon size={18} className="shrink-0" aria-hidden="true" />
          <span className="flex-1">{item.label}</span>
          <Lock size={13} className="shrink-0" aria-hidden="true" />
        </button>
        <span id={reasonId} className="sr-only">
          {item.label} is part of this module but is not in the preview.
        </span>
      </>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      /*
        The active item is the fourth and last place a product's hue is allowed
        to appear, and only inside that product's own shell. Teal leads and gold
        rewards; if Finance recoloured its buttons gold and Projects recoloured
        its buttons sky, Elevate would stop reading as one company. The hue is a
        label for where you are, not a theme.
      */
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        active
          ? `${hueTile} ${hueText} font-semibold`
          : "font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      <Icon size={18} className="shrink-0" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}


function RailContent({
  pathname,
  slug,
  product,
  onNavigate,
}: {
  pathname: string;
  slug: PreviewSlug | null;
  product: Product | null;
  onNavigate?: () => void;
}) {
  const hue = HUE[product ? product.hue : "primary"];
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  /* `/auth/me` has not answered on first paint; the row must not pop in. */
  const displayName = user?.name ?? "Your account";
  const secondary = user
    ? user.organisationName
      ? `${roleLabel(user.role)} · ${user.organisationName}`
      : roleLabel(user.role)
    : "Signed in";
  const initials =
    displayName
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "EL";

  return (
    <div className="flex h-full flex-col border-r border-neutral-200 bg-white">
      {/* header */}
      <div className="border-b border-neutral-200 px-4 py-4">
        {product ? (
          <>
            <Link
              href="/suite"
              onClick={onNavigate}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              All modules
            </Link>
            <div className="mt-1 flex items-center gap-3">
              <ProductIcon product={product} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-semibold text-neutral-900">
                  {product.name}
                </p>
                <p className="label-mono text-neutral-500">
                  {moduleStatus(user, product.slug as SuiteModuleKey) === "active" ? "Live" : "Preview"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <Link
            href="/suite"
            onClick={onNavigate}
            className="inline-flex min-h-11 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ElevateLockup markClassName="h-7 w-7" wordClassName="text-lg" />
            <span className="sr-only">suite launcher</span>
          </Link>
        )}
      </div>

      {/* nav */}
      <nav
        aria-label={product ? `${product.name} sections` : "Elevate suite"}
        className="flex-1 overflow-y-auto px-2.5 py-2"
      >
        {product && slug ? (
          SUITE_NAV[slug].map((group) => (
            <div key={group.heading}>
              <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {group.heading}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                  hueTile={hue.tile}
                  hueText={hue.text}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))
        ) : (
          <div>
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Modules
            </p>
            {PRODUCT_LIST.map((entry) => {
              const tokens = HUE[entry.hue];
              const Glyph = entry.icon;
              const live = moduleStatus(user, entry.slug as SuiteModuleKey) === "active";
              return (
                <Link
                  key={entry.slug}
                  href={live ? entry.appHref : previewHref(entry.slug as SuiteModuleKey)}
                  onClick={onNavigate}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <Glyph size={18} className={`shrink-0 ${tokens.icon}`} aria-hidden="true" />
                  <span className="flex-1">{entry.shortName}</span>
                  <span className="label-mono text-neutral-500">
                    {live ? "Live" : "Preview"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* footer */}
      <div className="border-t border-neutral-200 p-2.5">
        {/*
          Who you are and how to stop being them. A signed-in surface with no
          sign-out is a dead end, and the suite is the front door to five
          modules — the place a shared machine is most likely to be left open.

          The avatar is teal, not the admin console's gold gradient: that
          gradient carries white initials, which is the one thing Summit Gold
          may never do (2.15:1). Teal takes white at 9.28:1. Same idea, the
          colour the light rail allows.
        */}
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white"
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-neutral-900">
              {displayName}
            </p>
            <p className="truncate text-[11px] text-neutral-500">{secondary}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
        <Link
          href="/"
          onClick={onNavigate}
          className="mt-1 flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to the public site
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell                                                              */
/* ------------------------------------------------------------------ */

export default function SuiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const slug: PreviewSlug | null = slugFor(pathname);
  const product: Product | null = slug ? PRODUCTS[slug] : null;
  const title = titleFor(pathname, slug);

  // Lock body scroll while the drawer is open, and hand focus back to the
  // button that opened it when it closes — otherwise focus lands at the top of
  // the document and a keyboard user starts the page again.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  /*
    Opening moves focus into the drawer. Without this the drawer is a trap in
    the wrong direction: it precedes the header in the DOM, so Tab from the
    still-focused menu button walks into the header links sitting behind the
    overlay, and the drawer itself is only reachable by Shift+Tab. Same
    contract `ModuleSwitcher` already implements for its panel.
  */
  useEffect(() => {
    if (!drawerOpen) return;
    const first = drawerRef.current?.querySelector<HTMLElement>("a[href]");
    first?.focus();
  }, [drawerOpen]);

  const FOCUSABLE = "a[href], button:not([disabled])";

  /*
    Tab only — Escape is handled once, at the document, so it still works if
    focus somehow ends up outside the panel. Locked nav rows are `disabled`, so
    the selector skips them exactly as the browser's own tab order does.
  */
  const onDrawerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-[60] flex bg-neutral-50">
      {/* desktop rail */}
      <aside className="hidden w-[260px] shrink-0 lg:block">
        <RailContent pathname={pathname} slug={slug} product={product} />
      </aside>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/*
            Pointer affordance only, and `tabIndex={-1}` on purpose. It sits
            outside the dialog, so `aria-modal` hides it from assistive tech
            anyway; leaving it in the tab order would give a sighted keyboard
            user a stop that a screen reader user cannot hear. Escape closes,
            and every route out of the drawer is inside the drawer.
          */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={closeDrawer}
            className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={product ? `${product.name} sections` : "Elevate suite menu"}
            onKeyDown={onDrawerKeyDown}
            className="animate-fade-in absolute left-0 top-0 h-full w-[270px] shadow-2xl"
          >
            <RailContent
              pathname={pathname}
              slug={slug}
              product={product}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 lg:hidden"
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <div className="min-w-0">
            {/*
              The module, and only the module. The heading directly below is
              the page title; repeating it here made the top bar read the same
              words twice and told a screen reader the same thing twice.
            */}
            <p className="hidden text-[11px] text-neutral-500 sm:block">
              {product ? product.name : "Elevate suite"}
            </p>
            {/*
              A <p>, not an <h1>. The page below owns the single <h1> — through
              ModuleHeader inside a module, through the launcher's own greeting
              on /suite — and two <h1>s on one screen is a heading-order fail.
            */}
            <p className="truncate font-heading text-lg font-semibold text-neutral-900">
              {title}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              aria-label="Back to the public site"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <House size={17} aria-hidden="true" />
              <span className="hidden md:inline">Public site</span>
            </Link>

            <ModuleSwitcher currentSlug={product?.slug} />

            {/* Real, and API-backed — the one live control on a preview page. */}
            <NotificationBell />
          </div>
        </header>

        {/*
          A <div>, not a <main>: the root layout already wraps every route in
          one, and nesting a second main landmark inside it is invalid.
        */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
            {/*
              Rendered here rather than left to each dashboard, so a module page
              cannot ship without it. Preview honesty is a property of the shell.
            */}
            {product && !product.live && <PreviewBanner product={product} />}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
