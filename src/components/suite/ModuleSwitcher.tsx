"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { PRODUCT_LIST, type ProductSlug } from "@/lib/products";
import { useAuth } from "@/lib/auth-store";
import { moduleStatus, previewHref, type SuiteModuleKey } from "@/lib/module-access";

/**
 * The grid-of-apps control in the suite top bar.
 *
 * Every module in the list goes somewhere real: the LMS to the console that
 * ships today, the other four to their preview dashboard. Nothing in here is
 * decorative, so nothing in here is inert.
 *
 * The keyboard contract is the whole reason this is hand-rolled rather than a
 * hover menu: Enter or Space opens it (a real `<button>` does that for free),
 * Escape closes it and puts focus back on the trigger, and Tab cycles inside
 * the panel instead of escaping into the page behind it.
 */
export function ModuleSwitcher({
  /** Highlighted as the module you are already in. */
  currentSlug,
}: {
  currentSlug?: ProductSlug;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Outside click dismisses. Pointer-down rather than click so the panel is
  // gone before the click lands on whatever is underneath it.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Opening moves focus into the panel, otherwise a keyboard user opens a
  // list they then have to Tab past the whole top bar to reach.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("a[href]");
    first?.focus();
  }, [open]);

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("a[href]") ?? [],
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Switch module"
        /*
          `true`, not `"menu"`. The panel is a list of links, not a menu
          widget, there is no `role="menu"`, no roving tabindex and no
          arrow-key navigation. Announcing "menu" promises a keyboard contract
          this does not implement, and the user who presses Down expecting it
          gets nothing. `true` says only "this opens something".
        */
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) close(true);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        <LayoutGrid className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          onKeyDown={onPanelKeyDown}
          className="animate-fade-in absolute right-0 top-full z-50 mt-2 w-[19rem] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl sm:w-[21rem]"
        >
          <p className="label-mono border-b border-neutral-100 px-4 py-3 text-neutral-500">
            XwiftHQ suite
          </p>

          <ul className="p-2">
            {PRODUCT_LIST.map((product) => {
              const current = product.slug === currentSlug;
              // Per organisation: "Preview" only for a module it does not hold (owner, 9 Oct 2026).
              const live = moduleStatus(user, product.slug as SuiteModuleKey) === "active";
              return (
                <li key={product.slug}>
                  <Link
                    href={live ? product.appHref : previewHref(product.slug as SuiteModuleKey)}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      current ? "bg-neutral-100" : "hover:bg-neutral-50"
                    }`}
                  >
                    <ProductIcon product={product} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-sm font-semibold text-neutral-900">
                          {product.name}
                        </span>
                        {/*
                          "Live" and "Preview" are words first. The four preview
                          modules do not share a hue, so a tint alone would say
                          nothing about which state a row is in.
                        */}
                        <span
                          className={`label-mono rounded-full px-2 py-0.5 ${
                            live
                              ? "bg-success-500/10 text-success-600"
                              : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {live ? "Live" : "Preview"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                        {product.tagline}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-neutral-100 p-2">
            <Link
              href="/suite"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-primary-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              All modules and activity
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
