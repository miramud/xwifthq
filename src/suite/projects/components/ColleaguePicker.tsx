"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { PersonAvatar, cx } from "@/components/workspace/kit";
import {
  ApiError,
  projects as projectsApi,
  type MemberCandidate,
} from "@/lib/api/projects-client";
import { hintCls, inputCls, labelCls } from "./ui/pkit";

/**
 * Find a colleague by name, email or job title, and pick one.
 *
 * Replaces a box that asked for a **user id** "from the people directory",
 * which nobody has to hand, so adding somebody to a project meant leaving for
 * another module and copying a UUID back.
 *
 * An ARIA combobox: type to search, ↑/↓ to move, Enter to pick, Escape to
 * close. The list shows job titles and emails as well as names, because two
 * colleagues can share a name and a picker that cannot tell them apart is a
 * way to staff the wrong person.
 */
export default function ColleaguePicker({
  slug,
  value,
  onChange,
}: {
  slug: string;
  value: MemberCandidate | null;
  onChange: (person: MemberCandidate | null) => void;
}) {
  const inputId = useId();
  const listId = useId();
  const hintId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<MemberCandidate[] | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  /* Debounced, and the last answer wins: a slow reply for "ad" must not overwrite "ada". */
  useEffect(() => {
    if (!open) return;

    let current = true;

    const timer = window.setTimeout(() => {
      setLoading(true);
      projectsApi
        .memberCandidates(slug, query)
        .then((found) => {
          if (!current) return;
          setOptions(found);
          setActive(0);
          setError(null);
        })
        .catch((e: unknown) => {
          if (current)
            setError(
              e instanceof ApiError
                ? e.message
                : "Colleagues could not be loaded.",
            );
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 200);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [slug, query, open]);

  const pick = (person: MemberCandidate) => {
    onChange(person);
    setOpen(false);
    setQuery("");
  };

  if (value !== null) {
    return (
      <div className="min-w-0">
        <span className={labelCls}>Person</span>
        <div className="flex min-h-11 items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/50 py-1.5 pl-2 pr-1.5">
          <PersonAvatar name={value.name} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-neutral-900">
              {value.name}
            </span>
            <span className="block truncate text-xs text-neutral-500">
              {[value.jobTitle, value.email].filter(Boolean).join(" · ")}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              window.setTimeout(() => input.current?.focus(), 0);
            }}
            aria-label={`Choose somebody other than ${value.name ?? "this person"}`}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none transition hover:bg-white hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const list = options ?? [];
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className={labelCls}>
        Person
      </label>
      <div>
        {/* The field and its icons get their own box, so the list below cannot shift them. */}
        <div className="relative">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            ref={input}
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-describedby={hintId}
            aria-activedescendant={
              open && list.length > 0 ? optionId(active) : undefined
            }
            autoComplete="off"
            value={query}
            placeholder="Search by name, email or job title"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((i) => Math.min(i + 1, Math.max(0, list.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (
                e.key === "Enter" &&
                open &&
                list[active] !== undefined
              ) {
                e.preventDefault();
                pick(list[active]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className={cx(inputCls, "pl-10")}
          />
          {loading && (
            <Loader2
              size={15}
              aria-hidden
              className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-neutral-400"
            />
          )}
        </div>
        {open && (
          /*
            In the flow, not floating: the form sits in a card that clips
            overflow, and a floating list was cut off after its first name.
          */
          <ul
            id={listId}
            role="listbox"
            aria-label="Colleagues"
            className="relative mt-1.5 max-h-72 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-neutral-200"
          >
            {error !== null ? (
              <li className="px-3 py-3 text-sm text-coral-700">{error}</li>
            ) : options === null ? (
              <li className="px-3 py-3 text-sm text-neutral-500">Looking…</li>
            ) : list.length === 0 ? (
              <li className="px-3 py-3 text-sm text-neutral-500">
                {query.trim() === ""
                  ? "Everybody here is already on this project."
                  : `Nobody matching “${query.trim()}” who isn't already on it.`}
              </li>
            ) : (
              list.map((person, i) => (
                <li
                  key={person.userId}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  /* mousedown, not click: it lands before the input's blur closes the list. */
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(person);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cx(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                    i === active ? "bg-primary-50" : "hover:bg-neutral-50",
                  )}
                >
                  <PersonAvatar name={person.name} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-900">
                      {person.name}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {[person.jobTitle, person.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <p id={hintId} className={hintCls}>
        Colleagues already on this project are not listed.
      </p>
    </div>
  );
}
