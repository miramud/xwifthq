import type { Metadata } from "next";
import PayrollPostingsBoard from "@/suite/finance/components/payroll/PayrollPostingsBoard";

export const metadata: Metadata = { title: "Payroll postings" };

export default function FinancePayrollPage() {
  return <PayrollPostingsBoard />;
}
