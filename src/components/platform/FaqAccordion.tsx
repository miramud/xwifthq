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
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {faqs.map((faq, index) => {
        const open = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;

        return (
          <div key={faq.question}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 sm:px-7"
              >
                <span className="font-heading text-base font-semibold text-neutral-900">
                  {faq.question}
                </span>
                <Plus
                  className={`mt-0.5 h-5 w-5 shrink-0 text-primary-600 transition-transform duration-200 motion-reduce:transition-none ${
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
