import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize-html";

/**
 * The sanitiser is the only thing between an instructor-authored article and
 * `dangerouslySetInnerHTML` on a learner's page. A compromised or malicious
 * author account is otherwise stored XSS against everyone on the course.
 *
 * These are attack cases, not formatting cases: each one is something that
 * would execute if the allowlist leaked.
 */
describe("sanitizeHtml — script execution", () => {
  it("removes a script tag and its contents", () => {
    const out = sanitizeHtml('<p>Hello</p><script>alert("xss")</script>');

    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("Hello");
  });

  it("strips inline event handlers from an allowed element", () => {
    const out = sanitizeHtml('<p onclick="steal()">Click me</p>');

    expect(out).not.toContain("onclick");
    expect(out).not.toContain("steal");
    expect(out).toContain("Click me");
  });

  it("strips the onerror handler that survives a broken image", () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)">');

    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
  });

  it("strips handlers regardless of attribute casing", () => {
    const out = sanitizeHtml('<p OnClIcK="steal()">Text</p>');

    expect(out.toLowerCase()).not.toContain("onclick");
  });

  it("removes iframes outright rather than unwrapping them", () => {
    const out = sanitizeHtml('<iframe src="https://evil.example"></iframe><p>After</p>');

    expect(out).not.toContain("iframe");
    expect(out).not.toContain("evil.example");
    expect(out).toContain("After");
  });

  it("removes svg, which can carry script", () => {
    const out = sanitizeHtml("<svg><script>alert(1)</script></svg>");

    expect(out).not.toContain("svg");
    expect(out).not.toContain("alert");
  });

  it("removes form controls that could phish for credentials", () => {
    const out = sanitizeHtml(
      '<form action="https://evil.example"><input name="password"><button>Sign in</button></form>',
    );

    expect(out).not.toContain("form");
    expect(out).not.toContain("input");
    expect(out).not.toContain("evil.example");
  });
});

describe("sanitizeHtml — dangerous URLs", () => {
  it("drops a javascript: href", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">Click</a>');

    expect(out).not.toContain("javascript:");
    expect(out).toContain("Click");
  });

  it("drops a javascript: href hidden behind leading whitespace", () => {
    const out = sanitizeHtml('<a href="  javascript:alert(1)">Click</a>');

    expect(out).not.toContain("javascript:");
  });

  it("drops a data: URL on an image", () => {
    const out = sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">');

    expect(out).not.toContain("data:");
  });

  it("keeps ordinary https, mailto, relative and anchor links", () => {
    for (const href of ["https://example.com/x", "mailto:a@b.co", "/courses", "#section"]) {
      expect(sanitizeHtml(`<a href="${href}">link</a>`)).toContain(href);
    }
  });
});

describe("sanitizeHtml — structure", () => {
  it("keeps the formatting an instructor actually uses", () => {
    const out = sanitizeHtml(
      "<h2>Heading</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><pre><code>npm i</code></pre>",
    );

    for (const tag of ["<h2>", "<p>", "<strong>", "<em>", "<ul>", "<li>", "<pre>", "<code>"]) {
      expect(out).toContain(tag);
    }
  });

  it("unwraps an unknown element but keeps its text", () => {
    const out = sanitizeHtml("<marquee>Still readable</marquee>");

    expect(out).not.toContain("marquee");
    expect(out).toContain("Still readable");
  });

  it("keeps nested text when unwrapping through several unknown levels", () => {
    const out = sanitizeHtml("<custom-a><custom-b><p>Deep</p></custom-b></custom-a>");

    expect(out).toContain("Deep");
    expect(out).not.toContain("custom-");
  });

  it("forces rel=noopener on links that open a new tab", () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_blank">Out</a>');

    expect(out).toContain("noopener");
    expect(out).toContain("noreferrer");
  });

  it("drops style attributes, which can be used to overlay the page", () => {
    const out = sanitizeHtml('<p style="position:fixed;inset:0">Overlay</p>');

    expect(out).not.toContain("style");
    expect(out).toContain("Overlay");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("does not choke on malformed markup", () => {
    expect(() => sanitizeHtml("<p><strong>unclosed")).not.toThrow();
  });
});
