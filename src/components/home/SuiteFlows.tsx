import { PillLink } from "@/components/home/PillLink";
import { SectionIntro } from "@/components/home/SectionIntro";
import { CrossModuleFlows } from "@/components/platform/CrossModuleFlows";

/**
 * The handovers, in the template's project-section frame.
 *
 * `CrossModuleFlows` still draws the flows — it is used on `/platform` and on
 * all five product pages, and a second copy of that markup living here is a
 * guarantee that the two will disagree eventually. What this wrapper owns is
 * the frame: the split heading the template puts above a showcase, the ground
 * the cards sit on, and the action parked beside the title.
 *
 * Its heading prop is left unset on purpose, so the section gets this page's
 * opener rather than the site-wide one.
 */
export function SuiteFlows() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-8">
            <SectionIntro
              eyebrow="One dataset"
              align="start"
              title="What one module hands to the next."
              intro="Five flows that cross the modules end to end, from a purchase request to the bank file and from an accepted offer to final pay. A suite is not a shared login; it is a handover that does not need an export."
            />
          </div>

          <div className="lg:col-span-4 lg:justify-self-end lg:pb-2">
            <PillLink href="/platform" label="All five flows" tone="outline" />
          </div>
        </div>

        <div className="mt-12 lg:mt-14">
          <CrossModuleFlows />
        </div>
      </div>
    </section>
  );
}
