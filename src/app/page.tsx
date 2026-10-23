import type { Metadata } from "next";

import SuiteHero from "@/components/home/SuiteHero";
import { SuiteMarquee } from "@/components/home/SuiteMarquee";
import { SuiteIntro } from "@/components/home/SuiteIntro";
import { ModuleShowcase } from "@/components/home/ModuleShowcase";
import { WhyElevate } from "@/components/home/WhyElevate";
import { SuiteOverview } from "@/components/home/SuiteOverview";
import { OneSpine } from "@/components/home/OneSpine";
import { SuiteFlows } from "@/components/home/SuiteFlows";
import { SuiteInNumbers } from "@/components/home/SuiteInNumbers";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import LatestNews from "@/components/home/LatestNews";
import { ClosingCta } from "@/components/home/ClosingCta";

/*
  The title is spelled out in full here rather than leaning on the root
  layout's `%s | Elevate — …` template. `title.template` applies to *child*
  route segments and not to the segment it is declared in, so a bare "Five
  products…" on this page would render with no brand in the tab at all. Every
  other page in this work is a child segment and does use the template.

  The description is the suite's, not any one module's: it is what a search
  result shows. Since 9 October 2026 Elevate is sold as a company all-in-one
  suite with all five modules live, led by running the business.
*/
const TITLE =
  "Elevate — The all-in-one company suite | Finance, Operations, HR, Projects and Learning";

const DESCRIPTION =
  "Elevate runs a company on one suite: finance, admin and operations, HR and payroll, projects and staff training — one sign-in, one approval engine and inbox, one set of books, one audit trail and one recycle bin across every module.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://elevate.example.com",
  },
};

/*
  The suite is the whole argument (owner, 26 September 2026), and since
  9 October 2026 it is argued as a company suite: money, operations, people,
  delivery, then training. Real screenshots carry the hero, the module
  showcase and the spine. The page makes no call to any API. The grounds
  alternate Mist / white, and the teal bands sit at chapter breaks — the
  marquee one screen in, and the close.
*/
export default function HomePage() {
  return (
    <>
      <SuiteHero />

      <SuiteMarquee />

      <SuiteIntro />

      <ModuleShowcase />

      <SuiteOverview />

      <OneSpine />

      <SuiteFlows />

      <WhyElevate />

      <SuiteInNumbers />

      <TestimonialsSection />

      <LatestNews />

      <ClosingCta />
    </>
  );
}
