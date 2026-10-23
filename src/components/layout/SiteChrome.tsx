"use client";

import { usePathname } from "next/navigation";

/**
 * Decides whether the marketing chrome belongs on the current route.
 *
 * `SuiteShell` and `AdminShell` both paint `fixed inset-0 z-[60]`, which hides
 * the navbar and footer from the eye but not from the keyboard: every promo
 * link, nav trigger, search field, cart, CTA, the whole off-screen mobile menu
 * and the entire footer stayed in the tab order underneath them — roughly
 * thirty invisible stops before a keyboard user reached the suite rail. Paint
 * order cannot fix that; only not rendering can.
 *
 * The root layout is a Server Component and must stay one, so the route test
 * lives here instead. The navbar and footer arrive as already-rendered
 * elements, which keeps `Footer` a Server Component — a client boundary here
 * would otherwise drag it across.
 */
/*
  One root now, where there used to be two. Every app shell — the launcher,
  the four previews, the LMS console, the instructor studio and the
  organisation console — lives under /suite since the suite restructure, so
  the single prefix covers all of them.

  It also closed a gap by accident: the instructor studio was never listed
  here, so /instructor carried the whole marketing tab order behind it. It is
  /suite/lms/teach now, and covered.
*/
const APP_SHELL_ROOTS = ["/suite"] as const;

/*
  Routes that are neither marketing nor an app shell.

  /shared is a client-facing project status page opened from a link, by
  somebody with no account. The marketing navbar would offer them a course
  catalogue, a cart and a sign-in prompt, none of which they can use and all of
  which say this page was not meant for them. It carries its own minimal
  header instead.
*/
const BARE_ROOTS = ["/shared"] as const;

function isBareRoute(pathname: string): boolean {
  // Exact match or a real path segment — a hypothetical "/suitecase" is
  // marketing surface and must keep its chrome.
  return [...APP_SHELL_ROOTS, ...BARE_ROOTS].some(
    (root) => pathname === root || pathname.startsWith(`${root}/`)
  );
}

export function SiteChrome({
  navbar,
  footer,
  children,
}: {
  navbar: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const appShell = isBareRoute(pathname);

  /*
    `<main>` is rendered on every route, app shells included: `SuiteShell`
    documents that it deliberately ships a <div> because the root layout
    already provides the landmark.
  */
  return (
    <>
      {!appShell && navbar}
      <main className="flex-1">{children}</main>
      {!appShell && footer}
    </>
  );
}
