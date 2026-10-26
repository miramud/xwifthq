/**
 * The referral code a visitor arrived with (`?ref=CODE`), kept in a
 * first-party cookie for as long as the affiliate programme remembers a
 * click (`cookieDays`). The last link followed wins.
 *
 * Read when somebody sets up their organisation, so the affiliate who sent
 * them is credited and they get the first-payment discount. The cookie holds
 * the code and nothing else; the API decides whether it still works.
 */

export const REFERRAL_COOKIE = "xw_ref";

const CODE = /^[A-Za-z0-9]{3,32}$/;

/** A code as the API stores it, or null for anything that cannot be one. */
export function normaliseReferralCode(value: string | null | undefined): string | null {
  const code = (value ?? "").trim();
  return CODE.test(code) ? code.toUpperCase() : null;
}

export function storedReferralCode(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${REFERRAL_COOKIE}=`));
  return match ? normaliseReferralCode(decodeURIComponent(match.slice(REFERRAL_COOKIE.length + 1))) : null;
}

export function storeReferralCode(code: string, days: number): void {
  if (typeof document === "undefined") return;
  const maxAge = Math.max(1, Math.round(days)) * 24 * 60 * 60;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; samesite=lax${secure}`;
}

/** Spent: an organisation was set up with it. */
export function clearReferralCode(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${REFERRAL_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
