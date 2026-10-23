"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * "Tour the module" — real screens, one at a time, with the reason each exists.
 *
 * Desktop: an index of stops down the left (title plus its two-line
 * explanation), the live screen large on the right. Below `lg` the index
 * collapses to a two-column grid of short labels and the explanation moves
 * above the screen, so a phone reads label → why → screen without any
 * horizontal scrolling.
 *
 * It is a real tablist (arrow keys, Home/End, roving tabindex) because a strip
 * of buttons that only looks like tabs is the kind of fake control a product
 * page should never ship. Every panel is server-rendered and kept in the DOM
 * behind `hidden`, so all of the copy is indexable and the inactive
 * screenshots are not fetched until they are shown.
 *
 * Shared by the Finance and Admin & Operations pages. The screens come in as
 * nodes rendered on the server, which keeps the product registry out of the
 * client bundle; the only colour this component takes is `ruleClass`, the
 * product's rule token (a bar, never text — gold may mark, it may not carry
 * words).
 */

export interface TourStop {
  id: string;
  /** Short name used on the compact (mobile) index. */
  label: string;
  title: string;
  /** Two lines at most: what the screen is for, in the reader's terms. */
  body: string;
  screen: ReactNode;
}

export function ScreenTour({
  stops,
  label,
  ruleClass,
}: {
  stops: readonly TourStop[];
  /** Accessible name for the tablist, e.g. "Finance screens". */
  label: string;
  ruleClass: string;
}) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  function select(index: number) {
    const next = (index + stops.length) % stops.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        select(active + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        select(active - 1);
        break;
      case "Home":
        event.preventDefault();
        select(0);
        break;
      case "End":
        event.preventDefault();
        select(stops.length - 1);
        break;
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-col lg:gap-1"
      >
        {stops.map((stop, index) => {
          const selected = index === active;
          return (
            <button
              key={stop.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${stop.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${stop.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={onKeyDown}
              className={`group relative flex min-h-11 cursor-pointer items-center rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 lg:block lg:rounded-none lg:rounded-r-xl lg:border-0 lg:py-4 lg:pl-6 lg:pr-4 ${
                selected
                  ? "border-neutral-900 bg-white shadow-sm lg:bg-white"
                  : "border-neutral-200 bg-white hover:border-neutral-300 lg:bg-transparent lg:hover:bg-white/70"
              }`}
            >
              {/* The rail: hue on the selected stop, hairline on the rest. */}
              <span
                className={`absolute inset-y-0 left-0 hidden w-0.5 rounded-full transition-colors duration-200 lg:block ${
                  selected ? ruleClass : "bg-neutral-200 group-hover:bg-neutral-300"
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-sm font-semibold lg:hidden ${
                  selected ? "text-neutral-900" : "text-neutral-600"
                }`}
              >
                {stop.label}
              </span>
              <span
                className={`hidden font-heading text-base font-semibold lg:block ${
                  selected ? "text-neutral-900" : "text-neutral-600"
                }`}
              >
                {stop.title}
              </span>
              <span
                className={`mt-1 hidden text-sm leading-relaxed lg:block ${
                  selected ? "text-neutral-600" : "text-neutral-500"
                }`}
              >
                {stop.body}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-w-0">
        {stops.map((stop, index) => (
          <div
            key={stop.id}
            role="tabpanel"
            id={`${base}-panel-${stop.id}`}
            aria-labelledby={`${base}-tab-${stop.id}`}
            hidden={index !== active}
            className="motion-safe:animate-fade-in"
          >
            <div className="mb-5 lg:hidden">
              <h3 className="font-heading text-lg font-semibold text-neutral-900">
                {stop.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                {stop.body}
              </p>
            </div>
            {stop.screen}
          </div>
        ))}
      </div>
    </div>
  );
}
