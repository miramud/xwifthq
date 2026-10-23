"use client";

import { useMemo, useSyncExternalStore } from "react";
import { cx } from "./kit";
import { isRichHtml, richToPlain, sanitizeRichHtml } from "@/lib/richText";

/*
  Text written in the editor, shown the way it was written: headings, lists,
  bold, quotes, tables and links, like a published post. Plain text written
  before the editor keeps its paragraphs and line breaks.

  The HTML is cleaned again here to the same allowlist the API stores, so a
  row that reached the database some other way still cannot run code in the
  reader's browser.
*/

const noop = () => () => {};

/** False on the server and during hydration, true after: parsing needs the DOM. */
function useInBrowser(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function RichTextView({
  value,
  size = "md",
  inverse = false,
  className,
}: {
  value: string | null | undefined;
  /** `md` for documents and descriptions, `sm` for comments and notes in a timeline. */
  size?: "sm" | "md";
  /** On a coloured bubble (white text on blue): take its colour, not the page's ink. */
  inverse?: boolean;
  className?: string;
}) {
  const inBrowser = useInBrowser();
  const html = isRichHtml(value);
  const clean = useMemo(() => (html && inBrowser && value ? sanitizeRichHtml(value) : null), [html, inBrowser, value]);

  if (!value) return null;

  const classes = cx("rich-text", size === "sm" ? "rich-text-sm" : "rich-text-md", inverse && "rich-text-inverse", className);

  if (!html) {
    return <div className={cx(classes, "whitespace-pre-line")}>{value}</div>;
  }

  if (clean === null) {
    /* Server render and first paint: the words, never unparsed markup. */
    return <div className={cx(classes, "whitespace-pre-line")}>{richToPlain(value)}</div>;
  }

  return <div className={classes} dangerouslySetInnerHTML={{ __html: clean }} />;
}
