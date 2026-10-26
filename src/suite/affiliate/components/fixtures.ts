import type { Affiliate, Commission, MyAffiliate, Page } from "@/lib/api/affiliate-client";

/*
  Test fixtures for the affiliate's own pages. The figures follow the owner's
  worked example: a ₦50,000 price, ₦45,000 paid, ₦10,000 earned.
*/

export const AFFILIATE: Affiliate = {
  id: "aff1",
  name: "Amaka Obi",
  email: "amaka@example.com",
  code: "AMAKA10",
  link: "https://xwifthq.com/?ref=AMAKA10",
  status: "approved",
  statusLabel: "Approved",
  approvedAt: "2026-09-01T09:00:00Z",
  suspendedAt: null,
  createdAt: "2026-08-28T09:00:00Z",
  payoutDetails: { bankName: "Zenith Bank", accountNumber: "******6789", accountName: "Amaka Obi" },
};

export function myAffiliateOf(over: Partial<Affiliate> = {}): MyAffiliate {
  return {
    affiliate: { ...AFFILIATE, ...over },
    programme: { open: true, commissionPercent: 20, discountPercent: 10, cookieDays: 60, holdDays: 14 },
    stats: {
      clicks: 412,
      clicksLast30Days: 57,
      referrals: 8,
      payingReferrals: 3,
      conversionPercent: 37.5,
      earnings: { NGN: { pending: 1_000_000, approved: 2_000_000, paid: 1_500_000, reversed: 500_000 } },
      months: [
        { month: "2026-05", label: "May", clicks: 40, referrals: 1, firstPayments: 0, earned: {} },
        { month: "2026-06", label: "Jun", clicks: 55, referrals: 1, firstPayments: 1, earned: { NGN: 1_000_000 } },
        { month: "2026-07", label: "Jul", clicks: 61, referrals: 2, firstPayments: 0, earned: {} },
        { month: "2026-08", label: "Aug", clicks: 70, referrals: 1, firstPayments: 1, earned: { NGN: 1_500_000 } },
        { month: "2026-09", label: "Sep", clicks: 90, referrals: 2, firstPayments: 0, earned: {} },
        { month: "2026-10", label: "Oct", clicks: 96, referrals: 1, firstPayments: 1, earned: { NGN: 2_000_000 } },
      ],
    },
  };
}

export const COMMISSION: Commission = {
  id: "c1",
  organisation: { name: "Acme Holdings" },
  affiliate: null,
  sourceType: "seat_purchase",
  sourceLabel: "Seats",
  sourceReference: null,
  currency: "NGN",
  paidMinor: 4_500_000,
  discountMinor: 500_000,
  baseMinor: 5_000_000,
  ratePercent: 20,
  amountMinor: 1_000_000,
  status: "approved",
  statusLabel: "Ready to pay",
  earnedAt: "2026-10-01T09:00:00Z",
  availableAt: "2026-10-15T09:00:00Z",
  approvedAt: "2026-10-15T09:00:00Z",
  reversedAt: null,
  reversalNote: null,
  payout: null,
};

export function pageOf<T>(rows: T[]): Page<T> {
  return { data: rows, meta: { currentPage: 1, lastPage: 1, perPage: 20, total: rows.length } };
}
