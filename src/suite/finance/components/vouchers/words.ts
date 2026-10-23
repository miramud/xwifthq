/*
  An amount the way a cheque or a printed voucher writes it: "Two million,
  three hundred and fifty thousand naira and fifty kobo only". British
  usage ("and" before the tens), which is how Nigerian vouchers read.
*/

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", "thousand", "million", "billion", "trillion"];

const UNITS: Record<string, [string, string]> = {
  NGN: ["naira", "kobo"],
  USD: ["dollars", "cents"],
  GBP: ["pounds", "pence"],
  EUR: ["euros", "cents"],
};

/** 0–999 in words; "" for zero. */
function hundreds(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (rest) {
    const t = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ""}`;
    parts.push(h ? `and ${t}` : t);
  }
  return parts.join(" ");
}

/** A whole number in words: 1_250_000 → "one million, two hundred and fifty thousand". */
export function integerWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "zero";
  const groups: number[] = [];
  let x = Math.floor(n);
  while (x > 0) {
    groups.push(x % 1000);
    x = Math.floor(x / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    // "one million and five": a trailing group under a hundred takes "and".
    const words = hundreds(g);
    const lead = i === 0 && g < 100 && groups.length > 1 && parts.length ? `and ${words}` : words;
    parts.push(SCALES[i] ? `${lead} ${SCALES[i]}` : lead);
  }
  return parts.join(", ").replace(/, and /g, " and ");
}

/** Minor units → "Two hundred and fifty thousand naira and fifty kobo only". */
export function amountInWords(minor: number, currency = "NGN"): string {
  if (!Number.isFinite(minor)) return "";
  const [major, sub] = UNITS[currency.toUpperCase()] ?? [currency, "hundredths"];
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  let text = `${integerWords(whole)} ${major}`;
  if (frac) text += ` and ${integerWords(frac)} ${sub}`;
  text = `${minor < 0 ? "minus " : ""}${text} only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
