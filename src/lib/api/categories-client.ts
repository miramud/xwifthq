"use client";

import { useEffect, useState } from "react";

export interface Category {
  name: string;
  slug: string;
  color?: string | null;
}

/**
 * The category taxonomy, read from the database rather than a hardcoded list.
 * Every filter dropdown and category picker in the app uses this.
 */
export function useCategories(): { categories: Category[]; loading: boolean } {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    fetch("/api/categories")
      .then((r) => r.json())
      .then((body: { categories?: Category[] }) => {
        if (alive) setCategories(body.categories ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { categories, loading };
}

/** Names only — what most `<select>` filters need. */
export function useCategoryNames(): string[] {
  return useCategories().categories.map((c) => c.name);
}
