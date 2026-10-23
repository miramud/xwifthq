import type { Metadata } from "next";
import ContractsBoard from "@/suite/operations/components/facilities/ContractsBoard";

export const metadata: Metadata = { title: "Service contracts" };

/** Service contracts and the month-by-month confirmations that release payment. */
export default function Page() {
  return <ContractsBoard />;
}
