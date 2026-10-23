"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";

/**
 * The pricing questions, one open at a time, each in its own rounded white
 * card. A real `<button>` per row with `aria-expanded`, and the closed panel is
 * `hidden`, so nobody can tab into an answer they cannot see.
 */
export function PricingFaq({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <ul className="space-y-3">
      {faqs.map((faq, index) => {
        const open = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;

        return (
          <li
            key={faq.question}
            className={`overflow-hidden rounded-[1.25rem] border transition-colors ${
              open ? "border-primary-200 bg-white shadow-[0_24px_48px_-32px_rgb(150_56_205/0.45)]" : "border-neutral-200/80 bg-neutral-50"
            }`}
          >
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-start justify-between gap-4 rounded-[1.25rem] px-5 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 sm:px-6"
              >
                <span className="font-heading text-base font-semibold text-neutral-900">{faq.question}</span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                    open ? "bg-primary-600 text-white" : "bg-white text-primary-600 ring-1 ring-neutral-200"
                  }`}
                  aria-hidden="true"
                >
                  <Plus
                    className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-45" : ""}`}
                  />
                </span>
              </button>
            </h3>

            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="px-5 pb-5 sm:px-6">
              <p className="max-w-3xl text-sm leading-relaxed text-neutral-600">{faq.answer}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
