import type { Metadata } from "next";
import { ModulePreview } from "@/components/suite/ModulePreview";
import { ProjectsHeroMock } from "@/suite/projects/components/marketing/ProjectsHeroMock";
import { PRODUCTS } from "@/lib/products";

export const metadata: Metadata = {
  title: "Elevate Projects preview",
  description: "What Elevate Projects does, for an organisation that hasn't switched it on yet.",
  robots: { index: false, follow: false },
};

/** Elevate Projects, for an organisation that doesn't have it switched on. */
export default function ProjectsPreviewPage() {
  return (
    <ModulePreview
      module="projects"
      product={PRODUCTS.projects}
      hue="blue"
      openHref="/suite/projects"
      example={<ProjectsHeroMock />}
    />
  );
}
