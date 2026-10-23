/* ------------------------------------------------------------------ */
/*  Browser-side client for the in-app notification inbox.             */
/*  Shared by the admin and instructor shells (the bell menu).          */
/* ------------------------------------------------------------------ */

"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./admin-client";

export type NotificationKind =
  | "purchase"
  | "sale"
  | "enrollment"
  | "payment_failed"
  | "refund"
  | "info";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  url: string | null;
  unread: boolean;
  createdAt: string;
  data: Record<string, unknown>;
}

async function request<T>(path: string, init: { method?: string } = {}): Promise<T> {
  const res = await fetch(`/api/notifications${path}`, {
    method: init.method ?? "GET",
    cache: "no-store",
  });

  if (res.status === 204) return {} as T;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors);
  return json as T;
}

export const notificationsApi = {
  list: (limit = 15) =>
    request<{ data: AppNotification[] }>(`?perPage=${limit}`).then((r) => r.data ?? []),
  unreadCount: () =>
    request<{ data: { unread: number } }>("/unread-count").then((r) => r.data?.unread ?? 0),
  markRead: (id: string) => request<unknown>(`/${id}/read`, { method: "POST" }),
  readAll: () => request<unknown>("/read-all", { method: "POST" }),
  remove: (id: string) => request<unknown>(`/${id}`, { method: "DELETE" }),
};

/** Poll interval for the bell badge. Long enough to be cheap, short enough to feel live. */
const POLL_MS = 60_000;

/**
 * Loads the notification list once, then refreshes the unread badge on an
 * interval. Optimistic on mark-as-read so the badge never lags the click.
 */
export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.unreadCount(),
      ]);
      setItems(list);
      setUnread(count);
      setError(null);
    } catch (err) {
      // A signed-out or expired session should not blow up the shell.
      setError(err instanceof ApiError ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const id = setInterval(() => {
      notificationsApi.unreadCount().then(setUnread).catch(() => {});
    }, POLL_MS);

    return () => clearInterval(id);
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    setUnread((n) => Math.max(0, n - 1));

    try {
      await notificationsApi.markRead(id);
    } catch {
      void load(); // reconcile with the server on failure
    }
  }, [load]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
    setUnread(0);

    try {
      await notificationsApi.readAll();
    } catch {
      void load();
    }
  }, [load]);

  return { items, unread, loading, error, refresh: load, markRead, markAllRead };
}

/** "3m ago", "2h ago", "5d ago" — no dependency on a date library. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(iso).toLocaleDateString();
}
