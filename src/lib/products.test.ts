import { describe, it, expect } from "vitest";
import {
  HUE,
  PRODUCTS,
  PRODUCT_LIST,
  PRODUCT_ORDER,
  SUITE_FLOWS,
  getProduct,
  type ProductSlug,
} from "./products";

/**
 * The registry is the contract five product pages, the nav, the footer and the
 * platform page all derive from. Nothing here tests rendering — these are the
 * invariants that rot silently: a slug that stops matching its key, a product
 * that quietly loses half its capability list in a merge, a connection pointing
 * at itself, and the gold pair that a tidy-minded refactor will try to unify.
 */

const SLUGS: ProductSlug[] = ["lms", "hrm", "finance", "admin", "projects"];

describe("PRODUCT_ORDER", () => {
  it("covers all five slugs with no duplicates", () => {
    expect([...PRODUCT_ORDER].sort()).toEqual([...SLUGS].sort());
    expect(new Set(PRODUCT_ORDER).size).toBe(PRODUCT_ORDER.length);
  });

  it("is company-first: finance, admin, hrm, projects, then lms", () => {
    // Owner, 9 Oct 2026: the suite leads with running the business.
    expect([...PRODUCT_ORDER]).toEqual(["finance", "admin", "hrm", "projects", "lms"]);
  });

  it("is what PRODUCT_LIST is built from, in order", () => {
    expect(PRODUCT_LIST.map((p) => p.slug)).toEqual([...PRODUCT_ORDER]);
  });
});

describe("PRODUCTS", () => {
  it.each(SLUGS)("%s is keyed by its own slug", (slug) => {
    expect(PRODUCTS[slug].slug).toBe(slug);
    expect(getProduct(slug)).toBe(PRODUCTS[slug]);
  });

  it.each(SLUGS)("%s has at least 6 pillars", (slug) => {
    expect(PRODUCTS[slug].pillars.length).toBeGreaterThanOrEqual(6);
  });

  it.each(SLUGS)("%s has at least 6 capability groups", (slug) => {
    expect(PRODUCTS[slug].capabilities.length).toBeGreaterThanOrEqual(6);
  });

  it.each(SLUGS)("%s gives every capability group at least 4 items", (slug) => {
    for (const group of PRODUCTS[slug].capabilities) {
      expect(group.items.length, group.group).toBeGreaterThanOrEqual(4);
    }
  });

  it.each(SLUGS)("%s has 4 stats and 4–5 FAQs", (slug) => {
    expect(PRODUCTS[slug].stats).toHaveLength(4);
    expect(PRODUCTS[slug].faqs.length).toBeGreaterThanOrEqual(4);
    expect(PRODUCTS[slug].faqs.length).toBeLessThanOrEqual(5);
  });

  it.each(SLUGS)("%s connects only to other real products", (slug) => {
    const { connections } = PRODUCTS[slug];
    expect(connections.length).toBeGreaterThanOrEqual(3);
    for (const connection of connections) {
      expect(SLUGS).toContain(connection.to);
      // A product that lists itself as an integration is a copy-paste, not a
      // claim — and it would render as a card pointing back at the page.
      expect(connection.to).not.toBe(slug);
    }
    expect(new Set(connections.map((c) => c.to)).size).toBe(connections.length);
  });

  it.each(SLUGS)("%s has a marketing href that matches its slug", (slug) => {
    expect(PRODUCTS[slug].href).toBe(`/products/${slug}`);
  });

  it("marks every module live", () => {
    // Owner, 9 Oct 2026: all five modules are done. `live` is what SuiteShell
    // reads to decide whether a module gets a preview banner, so a module
    // flipped back to false would put a "preview" label over real data.
    for (const slug of SLUGS) {
      expect(PRODUCTS[slug].live, slug).toBe(true);
    }
  });

  it("points every module at its console", () => {
    expect(PRODUCTS.lms.appHref).toBe("/suite/lms");
    expect(PRODUCTS.hrm.appHref).toBe("/suite/hrm");
    expect(PRODUCTS.projects.appHref).toBe("/suite/projects");
    expect(PRODUCTS.finance.appHref).toBe("/suite/finance");
    expect(PRODUCTS.admin.appHref).toBe("/suite/operations");
  });

  it("never says a module is coming soon or a preview", () => {
    const pattern = /coming soon|on the way|preview|ships today/i;
    for (const product of PRODUCT_LIST) {
      const copy = JSON.stringify({ ...product, icon: undefined, pillars: product.pillars.map((p) => ({ ...p, icon: undefined })) });
      expect(copy, product.slug).not.toMatch(pattern);
    }
  });

  it("names every product exactly once, prefixed with XwiftHQ", () => {
    const names = PRODUCT_LIST.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const product of PRODUCT_LIST) {
      expect(product.name).toBe(`XwiftHQ ${product.shortName}`);
    }
  });
});

describe("HUE", () => {
  /**
   * This test exists because the asymmetry looks like an oversight.
   *
   * Every other hue uses one value for `icon` and `text`; gold uses two. A
   * well-meaning refactor that "unifies" them ships a WCAG failure in whichever
   * direction it unifies: accent-600 is 3.4:1, fine for a glyph and far short
   * of the 4.5:1 text needs; accent-700 is 5.5:1 and correct for text. Neither
   * value is right for both jobs, so there have to be two.
   */
  it("keeps Summit Gold's icon and text values apart", () => {
    expect(HUE.accent.icon).toBe("text-accent-600");
    expect(HUE.accent.text).toBe("text-accent-700");
    expect(HUE.accent.icon).not.toBe(HUE.accent.text);
  });

  it("never lets accent-500 be a text colour", () => {
    for (const tokens of Object.values(HUE)) {
      expect(tokens.icon).not.toBe("text-accent-500");
      expect(tokens.text).not.toBe("text-accent-500");
    }
  });

  it("gives every hue a full token set", () => {
    for (const [name, tokens] of Object.entries(HUE)) {
      expect(tokens.tile, name).toMatch(/^bg-/);
      expect(tokens.icon, name).toMatch(/^text-/);
      expect(tokens.text, name).toMatch(/^text-/);
      expect(tokens.rule, name).toMatch(/^bg-/);
      expect(tokens.border, name).toMatch(/^border-/);
      expect(tokens.hex, name).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it.each(SLUGS)("%s resolves to a hue that exists", (slug) => {
    expect(HUE[PRODUCTS[slug].hue]).toBeDefined();
  });
});

describe("SUITE_FLOWS", () => {
  it("carries the five cross-module flows", () => {
    expect(SUITE_FLOWS).toHaveLength(5);
    expect(SUITE_FLOWS.map((f) => f.title)).toEqual([
      "Request → payment",
      "Payroll → ledger",
      "Work → cost",
      "Hire → productive",
      "Exit → final pay",
    ]);
  });

  it("names a real module in every step", () => {
    for (const flow of SUITE_FLOWS) {
      expect(flow.steps.length, flow.title).toBeGreaterThanOrEqual(3);
      for (const step of flow.steps) {
        expect(SLUGS, flow.title).toContain(step.module);
        expect(step.action.length).toBeGreaterThan(0);
      }
    }
  });

  it("crosses a module boundary in every flow", () => {
    // A "cross-module flow" that stays inside one module proves nothing about
    // the suite, which is the only thing these exist to prove.
    for (const flow of SUITE_FLOWS) {
      expect(new Set(flow.steps.map((s) => s.module)).size, flow.title)
        .toBeGreaterThan(1);
    }
  });

  it("touches every product at least once", () => {
    const touched = new Set(
      SUITE_FLOWS.flatMap((f) => f.steps.map((s) => s.module)),
    );
    expect([...touched].sort()).toEqual([...SLUGS].sort());
  });
});
