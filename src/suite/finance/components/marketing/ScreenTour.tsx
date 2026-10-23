"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * "Tour the module": real screens, one at a time, with the reason each exists.
 *
 * A row of pill tabs sits on top (it scrolls sideways inside itself on a
 * phone, the page never does). Under it the chosen screen sits on a lilac
 * plate with its title and a line on what it is for beside it.
 *
 * It is a real tablist (arrow keys, Home and End, roving tabindex). Every
 * panel is server rendered and kept in the DOM behind `hidden`, so all of the
 * copy is indexable and the inactive screenshots are not fetched until shown.
 *
 * Shared by the Finance and Admin and Operations pages. The screens come in
 * as nodes rendered on the server, which keeps the product registry out of the
 * client bundle; `ruleClass` is the module's accent, used for one small dot.
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
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-auto sm:w-fit sm:flex-wrap sm:justify-center sm:rounded-full sm:border sm:border-neutral-200 sm:bg-white sm:p-1.5"
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
              className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full border px-5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                selected
                  ? "border-primary-600 bg-primary-600 text-white shadow-[0_8px_20px_-10px_rgb(150_56_205/0.8)]"
                  : "border-neutral-200 bg-white text-neutral-700 hover:text-primary-700 sm:border-transparent"
              }`}
            >
              {stop.label}
            </button>
          );
        })}
      </div>

      {stops.map((stop, index) => (
        <div
          key={stop.id}
          role="tabpanel"
          id={`${base}-panel-${stop.id}`}
          aria-labelledby={`${base}-tab-${stop.id}`}
          hidden={index !== active}
          className="mt-10 grid items-center gap-8 motion-safe:animate-fade-in lg:mt-12 lg:grid-cols-12 lg:gap-12"
        >
          <div className="min-w-0 lg:col-span-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary-700">
              <span className={`h-2 w-2 rounded-full ${ruleClass}`} aria-hidden="true" />
              {stop.label}
            </p>
            <h3 className="mt-3 font-heading text-2xl font-bold leading-snug tracking-[-0.02em] text-neutral-900">
              {stop.title}
            </h3>
            <p className="mt-3 leading-relaxed text-neutral-600">{stop.body}</p>
          </div>
          <div className="min-w-0 rounded-[1.75rem] bg-gradient-to-br from-primary-100 via-primary-50 to-white p-3 sm:p-6 lg:col-span-8">
            {stop.screen}
          </div>
        </div>
      ))}
    </div>
  );
}
