/*
  A live preview of a statement rule in the browser. The API matches with
  PHP's PCRE (`~pattern~u`) against the *normalised* narration - upper case,
  runs of space collapsed - so the preview does the same with a JavaScript
  RegExp. Named groups `cp` (counterparty) and `purpose` read the same in
  both. PCRE-only syntax (inline flags, possessive quantifiers, atomic
  groups) cannot be previewed here; the API is still the judge of whether the
  pattern is valid.
*/

/** The narration as the classifier sees it (`StatementText::normalise`). */
export function normaliseNarration(text: string): string {
  return text.replace(/\s+/gu, " ").trim().toUpperCase().slice(0, 500);
}

export type RuleTest =
  | { status: "empty" }
  | { status: "unsupported"; message: string }
  | { status: "no_match"; normalised: string; reason?: string }
  | { status: "match"; normalised: string; matched: string; cp: string | null; purpose: string | null };

export function testRule(
  pattern: string,
  narration: string,
  options: { direction?: "DR" | "CR" | null; lineDirection?: "DR" | "CR"; amountMin?: number | null; amountMax?: number | null; amount?: number | null } = {},
): RuleTest {
  if (pattern.trim() === "" || narration.trim() === "") return { status: "empty" };

  let re: RegExp;
  try {
    re = new RegExp(pattern, "u");
  } catch (e) {
    return {
      status: "unsupported",
      message: `The preview can't read this pattern (${e instanceof Error ? e.message.replace(/^Invalid regular expression: /, "") : "invalid"}). If it uses PCRE-only syntax it may still work on the server; saving will say for sure.`,
    };
  }

  const normalised = normaliseNarration(narration);

  if (options.direction && options.lineDirection && options.direction !== options.lineDirection) {
    return { status: "no_match", normalised, reason: options.direction === "DR" ? "This rule only looks at money going out." : "This rule only looks at money coming in." };
  }
  if (options.amount != null) {
    if (options.amountMin != null && options.amount < options.amountMin) return { status: "no_match", normalised, reason: "The amount is below the rule's minimum." };
    if (options.amountMax != null && options.amount > options.amountMax) return { status: "no_match", normalised, reason: "The amount is above the rule's maximum." };
  }

  const m = re.exec(normalised);
  if (!m) return { status: "no_match", normalised };
  return {
    status: "match",
    normalised,
    matched: m[0],
    cp: m.groups?.cp?.trim() ?? null,
    purpose: m.groups?.purpose?.trim() ?? null,
  };
}
