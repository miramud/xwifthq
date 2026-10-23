"use client";

import { useEffect, useSyncExternalStore } from "react";
import { approvals, type InboxCounts } from "@/lib/api/approvals-client";

/*
  The approval counts, shared by everything that shows them: the top-bar
  button, the approvals sidebar badge and the inbox's tabs. One store, one
  poll every 60 seconds however many of them are mounted, and a `set` for the
  inbox to hand over the counts each list call already returns, so the badge
  moves the moment somebody approves something.

  A failed poll is silent: a badge is a convenience, never an error.
*/

const POLL_MS = 60_000;

let counts: InboxCounts | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let users = 0;

function emit() {
  for (const l of listeners) l();
}

export function setApprovalCounts(next: InboxCounts) {
  counts = next;
  emit();
}

export async function refreshApprovalCounts(): Promise<void> {
  try {
    setApprovalCounts(await approvals.counts());
  } catch {
    /* silent: the badge keeps its last number */
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** For tests: forget the cached counts. */
export function resetApprovalCounts() {
  counts = null;
  if (timer) clearInterval(timer);
  timer = null;
  users = 0;
  emit();
}

/**
 * The current counts, polled while mounted. Pass `enabled: false` for people
 * with no organisation: there is no inbox to count.
 */
export function useApprovalCounts(enabled = true): InboxCounts | null {
  const value = useSyncExternalStore(
    subscribe,
    () => counts,
    () => null,
  );

  useEffect(() => {
    if (!enabled) return;
    users += 1;
    if (users === 1) {
      void refreshApprovalCounts();
      timer = setInterval(() => void refreshApprovalCounts(), POLL_MS);
    }
    return () => {
      users -= 1;
      if (users <= 0 && timer) {
        clearInterval(timer);
        timer = null;
        users = 0;
      }
    };
  }, [enabled]);

  return enabled ? value : null;
}
