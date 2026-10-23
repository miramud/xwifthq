"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";

/**
 * Questions, one open at a time.
 *
 * A real `<button>` per row rather than a div with a click handler: this is the
 * pattern people reach for a mouse to use and a keyboard to leave, and the only
 * way both work is if the browser already knows it is a control.
 *
 * The closed panel is `hidden` rather than merely transparent or zero-height.
 * A panel you cannot see but can still tab into is worse than no panel at all,
 * and it is the failure the animated-max-height version of this component ships
 * by default.
 */
export function FaqAccordion({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div className="space-y-3">
      {faqs.map((faq, index) => {
        const open = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;

        return (
          <div
            key={faq.question}
            className={`overflow-hidden rounded-[1.25rem] border transition-colors ${
              open ? "border-primary-200 bg-primary-50/60" : "border-neutral-200 bg-white"
            }`}
          >
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 sm:px-7"
              >
                <span className="font-heading text-base font-semibold text-neutral-900">
                  {faq.question}
                </span>
                <Plus
                  className={`h-7 w-7 shrink-0 rounded-full bg-primary-600 p-1.5 text-white transition-transform duration-200 motion-reduce:transition-none ${
                    open ? "rotate-45" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>
            </h3>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!open}
              className="px-5 pb-5 sm:px-7"
            >
              <p className="max-w-3xl text-sm leading-relaxed text-neutral-600">
                {faq.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
