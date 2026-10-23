import type { Metadata } from "next";
import VoucherEditor from "@/suite/finance/components/vouchers/VoucherEditor";

export const metadata: Metadata = { title: "Prepare a voucher" };

/** `/vouchers/new?memo={memoId}`: a voucher is only ever prepared from a cleared request. */
export default async function NewVoucherPage({ searchParams }: { searchParams: Promise<{ memo?: string | string[] }> }) {
  const { memo } = await searchParams;
  return <VoucherEditor memoId={typeof memo === "string" && memo ? memo : undefined} />;
}
