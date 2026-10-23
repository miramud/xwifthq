import type { Metadata } from "next";
import { ModulePreview } from "@/components/suite/ModulePreview";
import { LmsHeroMock } from "@/suite/lms/components/marketing/LmsHeroMock";
import { PRODUCTS } from "@/lib/products";

export const metadata: Metadata = {
  title: "Elevate LMS preview",
  description: "What Elevate LMS does, for an organisation that hasn't switched it on yet.",
  robots: { index: false, follow: false },
};

/** Elevate LMS, for an organisation that doesn't have it switched on. */
export default function LmsPreviewPage() {
  return (
    <ModulePreview
      module="lms"
      product={PRODUCTS.lms}
      hue="grape"
      openHref="/suite/lms"
      example={<LmsHeroMock />}
    />
  );
}
