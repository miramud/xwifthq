import type { Metadata } from "next";
import { ModulePreview } from "@/components/suite/ModulePreview";
import { ProductScreenshot } from "@/components/platform/ProductScreenshot";
import { PRODUCTS } from "@/lib/products";

export const metadata: Metadata = {
  title: "Elevate Finance preview",
  description: "What Elevate Finance does, for an organisation that hasn't switched it on yet.",
  robots: { index: false, follow: false },
};

/** Elevate Finance, for an organisation that doesn't have it switched on. */
export default function FinancePreviewPage() {
  return (
    <ModulePreview
      module="finance"
      product={PRODUCTS.finance}
      hue="sun"
      openHref="/suite/finance"
      example={<ProductScreenshot screen="financeDashboard" hue={PRODUCTS.finance.hue} />}
    />
  );
}
