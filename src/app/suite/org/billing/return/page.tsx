import type { Metadata } from "next";
import { BillingReturn } from "@/suite/org/components/billing/BillingReturn";

export const metadata: Metadata = {
  title: "Module payment",
};

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

/**
 * The gateway's redirect target after a module checkout. Paystack sends
 * `reference`/`trxref`; Flutterwave sends `tx_ref`, `status` and
 * `transaction_id`. See `BillingReturn`.
 */
export default async function BillingReturnPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const reference = first(params.reference) ?? first(params.tx_ref) ?? first(params.trxref) ?? "";
  return <BillingReturn reference={reference} gatewayStatus={first(params.status)} />;
}
