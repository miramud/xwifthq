import type { Metadata } from "next";
import WhtMonthDetail from "@/suite/finance/components/wht/WhtMonthDetail";

export const metadata: Metadata = { title: "WHT schedule" };

export default async function WhtMonthPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  return <WhtMonthDetail key={period} period={period} />;
}
