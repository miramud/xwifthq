/**
 * Text written in the suite's editor, and text written before it.
 *
 * The API stores editor text as HTML it has cleaned to an allowlist
 * (`App\Suite\Core\Support\RichText`). The browser cleans it again before
 * rendering, to the same allowlist, so a row that reached the database some
 * other way still cannot run code here. Plain text (everything written before
 * the editor, imports, API clients) is shown as text with its line breaks.
 *
 * Keep the lists below in step with the PHP class.
 */

/** Tag => attributes it may keep. */
const TAGS: Record<string, readonly string[]> = {
  p: ["style"], br: [], hr: [],
  h1: ["style"], h2: ["style"], h3: ["style"], h4: ["style"],
  strong: [], b: [], em: [], i: [], u: [], s: [], strike: [],
  sub: [], sup: [], mark: [], code: [], pre: [], blockquote: [],
  span: ["style"],
  ul: [], ol: ["start"], li: [],
  a: ["href"],
  table: [], thead: [], tbody: [], tr: [],
  th: ["colspan", "rowspan", "style"], td: ["colspan", "rowspan", "style"],
};

/** Removed with everything inside them; any other unknown tag is unwrapped. */
const DROP = new Set([
  "script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript",
  "title", "head", "meta", "link", "base", "form", "input", "button", "select", "textarea", "img", "video", "audio",
]);

const TAG_PATTERN =
  "p|br|hr|h[1-6]|ul|ol|li|strong|b|em|i|u|s|strike|a|blockquote|table|thead|tbody|tr|td|th|div|span|pre|code|mark|sub|sup" +
  "|script|style|iframe|object|embed|svg|math|template|noscript|meta|link|base|form|input|button|select|textarea|img|video|audio|body|html|head|title";

const MARKUP = new RegExp(`<\\s*\\/?\\s*(${TAG_PATTERN})\\b[^>]*>`, "i");

/** Does this text carry markup, or is it plain text written before the editor? */
export function isRichHtml(text: string | null | undefined): boolean {
  return typeof text === "string" && MARKUP.test(text);
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Plain text as editor paragraphs, so an old record opens in the editor with
 * its paragraphs and line breaks where the writer put them.
 */
export function plainToHtml(text: string): string {
  const trimmed = text.replace(/\r\n?/g, "\n").trim();
  if (trimmed === "") return "";

  return trimmed
    .split(/\n{2,}/)
    .map((para) => `<p>${escape(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** What the editor should open with: markup as it is, plain text as paragraphs. */
export function toEditorHtml(value: string | null | undefined): string {
  if (!value) return "";
  return isRichHtml(value) ? value : plainToHtml(value);
}

function safeHref(value: string): string | null {
  // Whitespace and control characters inside a scheme hide "javascript:".
  const compact = value.replace(/[\u0000- ]+/g, "");
  if (/^(https?:\/\/|mailto:)/i.test(compact)) return compact;
  if (/^www\.[a-z0-9-]+\.[a-z]{2,}/i.test(compact)) return `https://${compact}`;
  return null;
}

function safeStyle(tag: string, value: string): string | null {
  const kept: string[] = [];

  for (const declaration of value.split(";")) {
    const at = declaration.indexOf(":");
    if (at < 0) continue;
    const property = declaration.slice(0, at).trim().toLowerCase();
    const v = declaration.slice(at + 1).trim().toLowerCase();

    if (property === "text-align" && tag !== "span" && ["left", "center", "right", "justify"].includes(v)) {
      kept.push(`text-align: ${v}`);
    } else if (
      property === "color" &&
      tag === "span" &&
      /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/.test(v)
    ) {
      kept.push(`color: ${v}`);
    }
  }

  return kept.length === 0 ? null : kept.join("; ");
}

function attributes(tag: string, el: Element): string {
  let out = "";

  for (const name of TAGS[tag]) {
    const raw = el.getAttribute(name);
    if (raw === null) continue;
    const value = raw.trim();

    const safe =
      name === "href"
        ? safeHref(value)
        : name === "colspan" || name === "rowspan"
          ? (/^[1-9]\d?$/.test(value) ? value : null)
          : name === "start"
            ? (/^\d{1,5}$/.test(value) ? value : null)
            : name === "style"
              ? safeStyle(tag, value)
              : null;

    if (safe) out += ` ${name}="${escape(safe)}"`;
  }

  return out;
}

function serialize(node: Node): string {
  let out = "";

  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out += escape(child.nodeValue ?? "");
      return;
    }
    if (child.nodeType !== 1) return;

    const el = child as Element;
    const original = el.tagName.toLowerCase();
    if (DROP.has(original)) return;

    const tag = original === "h5" || original === "h6" ? "h4" : original === "div" ? "p" : original;

    if (!(tag in TAGS) || (original === "div" && el.querySelector(":scope > p, :scope > ul, :scope > ol, :scope > table, :scope > div, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > blockquote"))) {
      out += serialize(el);
      return;
    }

    let attrs = attributes(tag, el);

    if (tag === "a") {
      if (attrs === "") {
        out += serialize(el);
        return;
      }
      attrs += ' target="_blank" rel="noopener noreferrer nofollow"';
    }

    out += tag === "br" || tag === "hr" ? `<${tag}>` : `<${tag}${attrs}>${serialize(el)}</${tag}>`;
  });

  return out;
}

/**
 * Markup cleaned to the allowlist. Only for a browser: it parses with an
 * inert `<template>`, which never runs scripts or loads images.
 */
export function sanitizeRichHtml(html: string): string {
  if (typeof document === "undefined") return escape(richToPlain(html));

  const template = document.createElement("template");
  template.innerHTML = html;

  return serialize(template.content);
}

/** The words, for previews, counts and "is it empty?" — never for display as HTML. */
export function richToPlain(text: string | null | undefined): string {
  if (!text) return "";
  if (!isRichHtml(text)) return text.trim();

  return text
    .replace(/<(script|style|template|svg|math|iframe|noscript)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<li[^>]*>\s*<p[^>]*>/gi, "<li>")
    .replace(/<\/p>\s*<\/li>/gi, "</li>")
    .replace(/<\/(p|h[1-6]|blockquote|tr|pre|div|ul|ol|table)>/gi, "\n")
    .replace(/<\/t[hd]>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when there is nothing to read — an editor left empty sends `<p></p>`. */
export function isRichBlank(text: string | null | undefined): boolean {
  if (!text) return true;
  if (!isRichHtml(text)) return text.trim() === "";

  return text.replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/g, " ").trim() === "";
}

/** One line of the words, cut on a word boundary. */
export function richExcerpt(text: string | null | undefined, length = 160): string {
  const flat = richToPlain(text).replace(/\s+/g, " ").trim();
  if (flat.length <= length) return flat;

  const cut = flat.slice(0, length);
  const space = cut.lastIndexOf(" ");
  return `${(space > length * 0.6 ? cut.slice(0, space) : cut).replace(/[ ,.;:]+$/, "")}…`;
}

/**
 * One line per item, for fields that are a list underneath (a test case's
 * steps): the list items if the text is a list, otherwise its paragraphs or
 * lines. Each line is plain words.
 */
export function richToLines(text: string | null | undefined): string[] {
  if (!text) return [];

  if (!isRichHtml(text) || typeof document === "undefined") {
    return richToPlain(text)
      .split("\n")
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
      .filter(Boolean);
  }

  const template = document.createElement("template");
  template.innerHTML = text;
  const items = template.content.querySelectorAll("li");
  const blocks = items.length > 0 ? Array.from(items) : Array.from(template.content.querySelectorAll("p, h1, h2, h3, h4, blockquote"));

  return blocks
    .flatMap((el) => {
      // A nested list's items are lines of their own, not part of their parent's.
      const copy = el.cloneNode(true) as Element;
      copy.querySelectorAll("ul, ol").forEach((n) => n.remove());
      copy.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      return (copy.textContent ?? "").split("\n");
    })
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Lines as a numbered list for the editor. */
export function linesToRichList(lines: readonly string[]): string {
  const kept = lines.map((l) => l.trim()).filter(Boolean);
  return kept.length === 0 ? "" : `<ol>${kept.map((l) => `<li><p>${escape(l)}</p></li>`).join("")}</ol>`;
}
