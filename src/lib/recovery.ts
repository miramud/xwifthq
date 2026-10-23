/**
 * Where a broken or missing page should send somebody, given where they were.
 *
 * The root error and not-found screens catch every module, and both used to
 * point at the course catalogue — so a project page that failed to load
 * offered "Go to courses" to a delivery lead who has never taken a course.
 * The way back is the home of the module the reader was in.
 *
 * Longest prefix first: `/suite/lms/teach` before `/suite/lms`, a project
 * before the Projects home.
 */

export interface Recovery {
  /** The module's home — the way back. */
  home: { label: string; href: string };
  /** A second, wider way out, when there is a sensible one. */
  wider?: { label: string; href: string };
  /** What "not found" most likely means here, in this module's words. */
  missing: string;
}

const SUITE_HOME = { label: "Go to the suite home", href: "/suite" };

/** Projects' own pages, which are not project slugs. */
const PROJECT_SECTIONS = new Set(["me", "portfolios", "companies", "ai", "rates", "integrations", "notifications", "new"]);

export function recoveryFor(pathname: string | null | undefined): Recovery {
  const path = (pathname ?? "/").split("?")[0].replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  const under = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

  if (under("/suite/projects")) {
    const slug = parts[2];

    return slug !== undefined && !PROJECT_SECTIONS.has(slug)
      ? {
          home: { label: "Back to all projects", href: "/suite/projects" },
          wider: SUITE_HOME,
          missing: "The project may have been deleted or renamed, or you may not be on its team.",
        }
      : {
          home: { label: "Back to Projects", href: "/suite/projects" },
          wider: SUITE_HOME,
          missing: "The link may be out of date. Everything you work on is under Projects.",
        };
  }

  if (under("/suite/hrm")) {
    return {
      home: { label: "Back to HR", href: "/suite/hrm" },
      wider: SUITE_HOME,
      missing: "The record may have been removed, or the link may be out of date.",
    };
  }

  if (under("/suite/lms/teach")) {
    return {
      home: { label: "Back to the teaching studio", href: "/suite/lms/teach" },
      wider: SUITE_HOME,
      missing: "The course or lesson may have been deleted, or the link may be out of date.",
    };
  }

  if (under("/suite/lms")) {
    return {
      home: { label: "Back to the learning dashboard", href: "/suite/lms" },
      wider: SUITE_HOME,
      missing: "The course, path or report may have been removed, or the link may be out of date.",
    };
  }

  if (under("/suite/org")) {
    return {
      home: { label: "Back to organisation settings", href: "/suite/org" },
      wider: SUITE_HOME,
      missing: "The link may be out of date.",
    };
  }

  if (under("/suite")) {
    return {
      home: SUITE_HOME,
      missing: "The link may be out of date. Every module you use is on the suite home.",
    };
  }

  if (under("/platform")) {
    return {
      home: { label: "Back to the platform console", href: "/platform" },
      missing: "The organisation or record may have been removed, or the link may be out of date.",
    };
  }

  if (under("/account")) {
    return {
      home: { label: "Back to your account", href: "/account" },
      missing: "The link may be out of date.",
    };
  }

  /* A learner's own pages: back to their learning, not the shop window. */
  if (["/learn", "/my-courses", "/my-learning-paths", "/my-certificates", "/achievements"].some(under)) {
    return {
      home: { label: "Back to my courses", href: "/my-courses" },
      wider: { label: "Browse courses", href: "/courses" },
      missing: "The course may have been unpublished, or you may no longer be enrolled.",
    };
  }

  /* A mistyped course URL still wants a course. */
  if (["/courses"].some(under)) {
    return {
      home: { label: "Browse courses", href: "/courses" },
      wider: { label: "Go to the home page", href: "/" },
      missing: "The course may have been unpublished, or the link may be out of date.",
    };
  }

  /* The rest of the public site is about the suite, not one module. */
  return {
    home: { label: "Go to the home page", href: "/" },
    wider: { label: "Explore the suite", href: "/platform" },
    missing: "The link may be out of date, or the page may have moved.",
  };
}

/**
 * Whether the page belongs to the workspace (the suite modules and the
 * platform console), and so should wear its theme.
 *
 * The root error and not-found screens render outside every module shell, so
 * without this a broken HR page was drawn in the marketing site's teal and
 * Poppins — a different product, as far as the reader could tell.
 */
export function inWorkspace(pathname: string | null | undefined): boolean {
  const path = pathname ?? "/";

  return ["/suite", "/platform"].some((p) => path === p || path.startsWith(`${p}/`));
}
