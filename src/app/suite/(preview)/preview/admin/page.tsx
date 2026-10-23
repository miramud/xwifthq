import type { Metadata } from "next";
import { ModulePreview } from "@/components/suite/ModulePreview";
import { ProductScreenshot } from "@/components/platform/ProductScreenshot";
import { PRODUCTS } from "@/lib/products";

export const metadata: Metadata = {
  title: "XwiftHQ Admin & Operations preview",
  description: "What XwiftHQ Admin & Operations does, for an organisation that hasn't switched it on yet.",
  robots: { index: false, follow: false },
};

/*
  The registry slug is "admin", but the module is "Operations" everywhere a
  user meets it (sidebar, switcher, /suite/operations), so the preview names
  it the same way.
*/
const product = { ...PRODUCTS.admin, name: "XwiftHQ Admin & Operations", shortName: "Operations" };

/** XwiftHQ Admin & Operations, for an organisation that doesn't have it switched on. */
export default function OperationsPreviewPage() {
  return (
    <ModulePreview
      module="admin"
      product={product}
      hue="slate"
      openHref="/suite/operations"
      example={<ProductScreenshot screen="operationsDashboard" hue={product.hue} />}
    />
  );
}
