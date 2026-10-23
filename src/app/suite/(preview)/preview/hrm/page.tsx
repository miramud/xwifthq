import type { Metadata } from "next";
import { ModulePreview } from "@/components/suite/ModulePreview";
import { HrmHeroMock } from "@/suite/hrm/components/marketing/HrmHeroMock";
import { PRODUCTS } from "@/lib/products";

export const metadata: Metadata = {
  title: "XwiftHQ HRM preview",
  description: "What XwiftHQ HRM does, for an organisation that hasn't switched it on yet.",
  robots: { index: false, follow: false },
};

/** XwiftHQ HRM, for an organisation that doesn't have it switched on. */
export default function HrmPreviewPage() {
  return (
    <ModulePreview
      module="hrm"
      product={PRODUCTS.hrm}
      hue="coral"
      openHref="/suite/hrm"
      example={<HrmHeroMock />}
    />
  );
}
