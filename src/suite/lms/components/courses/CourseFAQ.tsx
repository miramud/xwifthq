"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "How long do I have access to the course?",
    answer:
      "Once enrolled, you have lifetime access to the course materials, including any future updates. Learn at your own pace with no time restrictions or deadlines.",
  },
  {
    question: "Is there a certificate of completion?",
    answer:
      "Yes. When you finish every module and assignment, you receive a verifiable certificate of completion from XwiftHQ that you can add to your CV and LinkedIn profile.",
  },
  {
    question: "What if I'm not satisfied with the course?",
    answer:
      "We offer a 30-day money-back guarantee. If the course does not meet your expectations within the first 30 days of purchase, you can request a full refund, no questions asked.",
  },
  {
    question: "Do I need prior experience to take this course?",
    answer:
      "Each course clearly states its prerequisites and recommended experience level. Beginner courses require no prior knowledge, while Intermediate and Advanced courses may require foundational skills. Check the Requirements section for specifics.",
  },
  {
    question: "Can I download the course resources?",
    answer:
      "Yes, all downloadable resources including project files, cheat sheets, and supplementary materials are available for offline use. Video content is available for streaming only.",
  },
  {
    question: "Is the course content updated regularly?",
    answer:
      "Yes. Our instructors regularly update course content to reflect the latest industry standards, tools, and best practices. You will always have access to the most current material.",
  },
];

function FAQAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className={`flex items-center justify-between w-full px-5 py-4 text-left transition-colors ${
          isOpen ? "bg-primary-50" : "bg-white hover:bg-neutral-50"
        }`}
        aria-expanded={isOpen}
      >
        <span
          className={`text-sm font-semibold pr-4 ${
            isOpen ? "text-primary-700" : "text-neutral-800"
          }`}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {item.question}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen
              ? "rotate-180 text-primary-600"
              : "text-neutral-400"
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="px-5 pb-4 pt-1 text-sm text-neutral-600 leading-relaxed">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

export default function CourseFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, i) => (
        <FAQAccordionItem
          key={i}
          item={item}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
        />
      ))}
    </div>
  );
}
