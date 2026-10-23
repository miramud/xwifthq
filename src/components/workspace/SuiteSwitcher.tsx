"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { cx } from "./kit";
import { HUE, WORKSPACE_MODULES, availability, canAdministerLms, hrefFor, moduleByKey, type WorkspaceModuleKey } from "./modules";
import { useDismiss } from "./useDismiss";
import { normaliseRole } from "@/lib/roles";
import { admitsToOrgConsole } from "@/lib/org-access";

/**
 * The "Suites" menu in the top bar: which module you are in, and every other
 * one you can open, each with the pages worth jumping straight to.
 *
 * Only modules this person can actually open are listed. A tile that leads to
 * a 403 teaches somebody the menu cannot be trusted.
 */
const HIDDEN_FROM_ORG_USERS: readonly WorkspaceModuleKey[] = ["lms", "learn", "org"];

export function SuiteSwitcher({ current }: { current: WorkspaceModuleKey }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  useDismiss(open, close, [triggerRef, panelRef]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
  }, [open]);

  const here = moduleByKey(current);
  const HereIcon = here.icon;
  // Open modules first, then the ones this organisation has as previews.
  // An organisation's users don't get Learning, My learning or Organisation
  // here (the owner's ruling of 26 September 2026): their learning space is a
  // link in the site navbar, and the organisation console is the admin's.
  //
  // Two exceptions (2 Oct 2026): Learning for whoever runs the LMS console
  // (`lmsAdmin`, e.g. the HR Manager - O12), and Organisation for whoever a
  // custom role admits to the organisation console (S8).
  const orgUser = Boolean(user?.organisationId) && normaliseRole(user?.role) === "user";
  const hiddenForThem = (key: WorkspaceModuleKey) =>
    HIDDEN_FROM_ORG_USERS.includes(key) &&
    !(key === "lms" && canAdministerLms(user)) &&
    !(key === "org" && admitsToOrgConsole(user));
  const modules = WORKSPACE_MODULES.filter(
    (m) => m.key !== "home" && m.listed !== false && !(orgUser && hiddenForThem(m.key)),
  )
    .map((m) => ({ m, state: availability(m, user) }))
    .filter((x) => x.state !== "hidden")
    .sort((a, b) => Number(a.state === "preview") - Number(b.state === "preview"));

  return (
    <div className="relative" data-tour="suite-switcher">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white pl-1.5 pr-2.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50"
      >
        <span className={cx("flex h-7 w-7 items-center justify-center rounded-lg", HUE[here.hue].tile)}>
          <HereIcon size={15} aria-hidden />
        </span>
        <span className="hidden sm:inline">{here.key === "home" ? "Suites" : here.name}</span>
        <ChevronDown size={15} className={cx("text-neutral-500 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="fixed inset-x-3 top-[4.5rem] z-50 flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[min(92vw,640px)] border border-neutral-200 bg-white shadow-2xl shadow-neutral-900/10 animate-fade-in"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-3.5">
            <p className="text-sm font-semibold text-neutral-900">Switch suite</p>
            <Link
              href="/suite"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50"
            >
              <LayoutGrid size={14} aria-hidden />
              All modules
            </Link>
          </div>
          <ul className="grid min-h-0 flex-1 gap-2 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:grid-cols-2">
            {modules.map(({ m, state }) => {
              const preview = state === "preview";
              const Icon = m.icon;
              const active = m.key === current;
              return (
                <li
                  key={m.key}
                  className={cx(
                    "min-w-0 rounded-xl border p-3 transition",
                    active ? "border-primary-200 bg-primary-50/50" : "border-transparent hover:border-neutral-200 hover:bg-neutral-50",
                  )}
                >
                  <Link
                    href={hrefFor(m, state)}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[m.hue].tile)}>
                      <Icon size={19} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                        {m.name}
                        {preview && <PreviewTag />}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">{m.blurb}</span>
                    </span>
                  </Link>
                  {!preview && m.links.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[52px]">
                      {m.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The badge a module wears everywhere while its organisation hasn't switched it on. */
export function PreviewTag() {
  return (
    <span className="rounded-full border border-info-500/30 bg-info-500/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-info-700">
      Preview
    </span>
  );
}
