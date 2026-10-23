/* ------------------------------------------------------------------ */
/*  Allowlist HTML sanitiser for instructor-authored article lessons.  */
/* ------------------------------------------------------------------ */

/**
 * Article HTML is written by instructors and admins, then rendered into a
 * learner's page with `dangerouslySetInnerHTML`. A compromised author account
 * would otherwise be a stored-XSS vector against every student on the course.
 *
 * This is an allowlist: anything not explicitly permitted is dropped. Elements
 * outside the list are unwrapped (their text survives), attributes outside the
 * list are removed, and `javascript:`-style URLs are rejected.
 *
 * It runs in the browser (it needs DOMParser). On the server it returns "" so a
 * server render never emits unsanitised markup.
 */

const ALLOWED_TAGS = new Set([
  "P", "BR", "HR",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "SUB", "SUP", "MARK", "SMALL",
  "UL", "OL", "LI",
  "BLOCKQUOTE", "PRE", "CODE",
  "A", "IMG",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "CAPTION",
  "DIV", "SPAN", "FIGURE", "FIGCAPTION",
]);

/** Per-tag attribute allowlist. Everything else — including every `on*` — goes. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(["href", "title", "target", "rel"]),
  IMG: new Set(["src", "alt", "title", "width", "height"]),
  TD: new Set(["colspan", "rowspan"]),
  TH: new Set(["colspan", "rowspan", "scope"]),
};

/** Tags whose *contents* are dropped too, not just the tag. */
const STRIP_ENTIRELY = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT",
  "BUTTON", "TEXTAREA", "SELECT", "LINK", "META", "BASE", "NOSCRIPT", "SVG", "MATH",
]);

const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";

  // No DOMParser during SSR — render nothing rather than something unchecked.
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return "";

  const doc = new DOMParser().parseFromString(dirty, "text/html");

  clean(doc.body);

  return doc.body.innerHTML;
}

function clean(root: Element): void {
  // Snapshot first: we mutate the tree as we go.
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (!el.isConnected) continue;

    const tag = el.tagName.toUpperCase();

    if (STRIP_ENTIRELY.has(tag)) {
      el.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      unwrap(el);
      continue;
    }

    scrubAttributes(el, tag);
  }
}

function scrubAttributes(el: Element, tag: string): void {
  const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();

    if (!allowed.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }

    if ((name === "href" || name === "src") && !SAFE_URL.test(attr.value.trim())) {
      el.removeAttribute(attr.name);
    }
  }

  // Links that open a new tab must not hand the opener over.
  if (tag === "A" && el.getAttribute("target") === "_blank") {
    el.setAttribute("rel", "noopener noreferrer");
  }
}

/** Replace an element with its children, keeping the text content. */
function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) {
    el.remove();
    return;
  }
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}
