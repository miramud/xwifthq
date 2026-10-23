import type { Metadata } from "next";

import { HomeHero } from "@/components/home/HomeHero";
import { ModuleStrip } from "@/components/home/ModuleStrip";
import { FeatureBento } from "@/components/home/FeatureBento";
import { ModuleShowcase } from "@/components/home/ModuleShowcase";
import { WhyTeams } from "@/components/home/WhyTeams";
import { ThreeSteps } from "@/components/home/ThreeSteps";
import { FlowsSection } from "@/components/home/FlowsSection";
import { TeamsSection } from "@/components/home/TeamsSection";
import { CtaPanel } from "@/components/site/CtaPanel";

/*
  The title is spelled out in full rather than leaning on the root layout's
  template: `title.template` applies to child segments only, so a bare title
  here would render with no brand in the tab.
*/
const TITLE = "XwiftHQ | The all in one workspace for finance, operations, HR, projects and learning";

const DESCRIPTION =
  "XwiftHQ runs your whole company from one workspace: finance, operations, HR and payroll, projects and staff training, with one login, one approvals inbox, one set of books and one audit trail.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://xwifthq.example.com",
  },
};

/*
  The page makes no call to any API. It opens on the lilac sky with the
  workspace rising out of it, then argues the suite: what it replaces, the real
  screens, the facts underneath, how to start, how work flows between teams and
  who uses it, before closing on the purple panel.
*/
export default function HomePage() {
  return (
    <>
      <HomeHero />
      <ModuleStrip />
      <FeatureBento />
      <ModuleShowcase />
      <WhyTeams />
      <ThreeSteps />
      <FlowsSection />
      <TeamsSection />
      <CtaPanel />
    </>
  );
}
