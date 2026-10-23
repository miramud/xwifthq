import type { Metadata } from "next";
import SpendSettingsBoard from "@/suite/finance/components/settings/SpendSettingsBoard";

export const metadata: Metadata = { title: "Spend settings" };

export default function FinanceSpendSettingsPage() {
  return <SpendSettingsBoard />;
}
