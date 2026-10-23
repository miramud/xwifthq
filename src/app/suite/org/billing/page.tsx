import type { Metadata } from "next";
import { BillingBoard } from "@/suite/org/components/billing/BillingBoard";

export const metadata: Metadata = {
  title: "Plan & billing",
};

/**
 * Buying (or, while online payment is off, requesting) modules. `?module=hrm`
 * arrives from a module's preview page ("Get HR") and starts with that module
 * selected. See `BillingBoard`.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ module?: string | string[] }> }) {
  const { module } = await searchParams;
  const initial = Array.isArray(module) ? module[0] : module;
  return <BillingBoard initialModule={initial ?? null} />;
}
