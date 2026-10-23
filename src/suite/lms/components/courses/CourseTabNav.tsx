"use client";

import { useState, useEffect } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "curriculum", label: "Curriculum" },
  { id: "instructor", label: "Instructor" },
  { id: "reviews", label: "Reviews" },
  { id: "faq", label: "FAQ" },
] as const;

export default function CourseTabNav() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const nav = document.getElementById("course-tab-nav-anchor");
      if (nav) {
        const rect = nav.getBoundingClientRect();
        setIsSticky(rect.top <= 0);
      }

      // Determine which section is currently in view
      const offset = 120;
      for (let i = TABS.length - 1; i >= 0; i--) {
        const el = document.getElementById(TABS[i].id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= offset) {
            setActiveTab(TABS[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setActiveTab(id);
  }

  return (
    <>
      <div id="course-tab-nav-anchor" />
      <nav
        aria-label="Course sections"
        className={`bg-white border-b border-neutral-200 z-40 transition-shadow duration-200 ${
          isSticky
            ? "sticky top-0 shadow-md"
            : ""
        }`}
      >
        <div className="section-container">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                className={`px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200 ${
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
                }`}
                aria-current={activeTab === tab.id ? "true" : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
