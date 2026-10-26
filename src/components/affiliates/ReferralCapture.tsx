"use client";

import { useEffect } from "react";
import { publicAffiliates } from "@/lib/api/affiliate-client";
import { normaliseReferralCode, storeReferralCode } from "@/lib/referral";

/**
 * Notices an affiliate link (`?ref=CODE`) on any page, records the visit for
 * the affiliate's figures and remembers the code in a cookie, then takes the
 * parameter off the address so a shared or bookmarked page does not count
 * again. Renders nothing.
 *
 * Only a code the API says is live is remembered: a stale link sets nothing,
 * so it can never displace a working one.
 */
export default function ReferralCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = normaliseReferralCode(url.searchParams.get("ref"));
    if (!code) return;

    url.searchParams.delete("ref");
    // The native history API keeps the router in step (see Next's
    // "Linking and navigating" guide).
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    publicAffiliates
      .click({ code, path: url.pathname, referrer: document.referrer || undefined })
      .then((check) => {
        if (check.valid && check.code) storeReferralCode(check.code, check.cookieDays);
      })
      .catch(() => {
        // A referral is a courtesy to the affiliate; it never gets in the visitor's way.
      });
  }, []);

  return null;
}
