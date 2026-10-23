"use client";

import { useEffect, type RefObject } from "react";

/**
 * Close a popover on an outside pointer-down or Escape, returning focus to
 * its trigger on Escape so a keyboard user is not left stranded.
 *
 * Pointer-down rather than click, so the panel is gone before the click lands
 * on whatever is underneath it.
 */
export function useDismiss(
  open: boolean,
  close: (returnFocus: boolean) => void,
  refs: RefObject<HTMLElement | null>[],
): void {
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (refs.some((r) => r.current?.contains(target))) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // refs are stable objects; listing them would re-bind on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close]);
}
