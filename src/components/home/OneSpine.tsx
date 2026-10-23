import { SectionIntro } from "@/components/home/SectionIntro";
import { SharedSpineGrid } from "@/components/platform/SharedSpine";
import { ProductScreenshot } from "@/components/platform/ProductScreenshot";

/**
 * The argument section — the one place on the page making a structural claim
 * rather than listing features.
 *
 * Five modules are a company suite only because the things underneath them are
 * singular. The section shows two of them as they really are — the approvals
 * inbox every request lands in, and the organisation console where the
 * structure, roles and workflows are set — and then names all nine.
 *
 * The nine come from `SharedSpine`, which `/platform` prints too.
 *
 * It sits on Mist: teal is reserved for the marquee and the closing CTA.
 */
export function OneSpine() {
  return (
    <section className="section-padding overflow-hidden bg-neutral-100">
      <div className="section-container">
        <SectionIntro
          eyebrow="The spine"
          align="split"
          title="What makes five modules one company system."
          intro="Every record is scoped to your organisation, and that boundary is enforced in the API rather than in the interface. Underneath the modules, these things are singular — and singular is the whole argument."
        />

        {/*
          The approvals inbox in front, the organisation console behind and to
          the left — the reverse of the hero's offset, so the two layered
          moments on the page do not read as the same picture twice.
        */}
        <div className="relative mt-12 lg:mt-16">
          <div
            className="pointer-events-none absolute -left-3 top-0 hidden w-[62%] md:block lg:-left-8"
            aria-hidden="true"
          >
            <div className="-rotate-[1.25deg] opacity-80">
              <ProductScreenshot screen="orgConsole" hue="primary" />
            </div>
          </div>

          <div className="relative md:ml-auto md:mt-20 md:w-[82%]">
            <ProductScreenshot
              screen="approvals"
              hue="primary"
              caption="The approvals inbox: purchases, trips, payments and memos from every module, waiting on one person."
            />
          </div>
        </div>

        <SharedSpineGrid className="mt-14 lg:mt-16" />
      </div>
    </section>
  );
}
