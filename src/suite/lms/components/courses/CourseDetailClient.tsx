"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  BarChart3,
  Clock,
  Globe,
  Award,
  CalendarDays,
} from "lucide-react";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richToPlain } from "@/lib/richText";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CourseDetailClientProps {
  description: string;
  level: string;
  duration: string;
  language: string;
  hasCertificate: boolean;
  lastUpdated: string;
}

/* ------------------------------------------------------------------ */
/*  Feature Badge                                                      */
/* ------------------------------------------------------------------ */

function FeatureBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm transition-colors duration-200 hover:border-primary-200 hover:bg-primary-50/50 group">
      <Icon
        size={16}
        className="text-primary-500 shrink-0 group-hover:text-primary-600 transition-colors duration-200"
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5">
        <span className="text-neutral-500 text-xs font-medium">{label}</span>
        <span className="text-neutral-800 font-semibold">{value}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CourseDetailClient({
  description,
  level,
  duration,
  language,
  hasCertificate,
  lastUpdated,
}: CourseDetailClientProps) {
  const [expanded, setExpanded] = useState(false);
  /* Written in the editor (or plain text from before it): measured by its words. */
  const words = richToPlain(description);
  const isLong = words.includes("\n\n") || words.length > 300;

  const badges = [
    { icon: BarChart3, label: "Skill level", value: level, show: true },
    { icon: Clock, label: "Duration", value: duration, show: true },
    { icon: Globe, label: "Language", value: language, show: true },
    {
      icon: Award,
      label: "Certificate",
      value: "Included",
      show: hasCertificate,
    },
    {
      icon: CalendarDays,
      label: "Last updated",
      value: lastUpdated,
      show: true,
    },
  ];

  return (
    <div>
      {/* Description text with show more/less */}
      <div className="relative">
        <div
          className={`relative overflow-hidden transition-[max-height] duration-500 ease-out ${
            !expanded && isLong ? "max-h-36" : "max-h-[4000px]"
          }`}
        >
          <RichTextView value={description} className="text-neutral-600" />

          {/* Gradient fade overlay */}
          {!expanded && isLong && (
            <div
              className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Toggle button */}
        {isLong && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded px-1 py-0.5 -mx-1"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                Show less
                <ChevronUp size={16} className="transition-transform duration-200" />
              </>
            ) : (
              <>
                Show more
                <ChevronDown size={16} className="transition-transform duration-200" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Feature Badges */}
      <div
        className="mt-6 pt-6 border-t border-neutral-100"
        aria-label="Course details"
      >
        <div className="flex flex-wrap gap-3">
          {badges
            .filter((b) => b.show)
            .map((badge) => (
              <FeatureBadge
                key={badge.label}
                icon={badge.icon}
                label={badge.label}
                value={badge.value}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
