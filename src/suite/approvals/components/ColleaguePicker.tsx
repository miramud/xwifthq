"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { orgFoundations } from "@/lib/api/org-foundations-client";

/**
 * Choose a colleague: for "refer to" and "who covers for me".
 *
 * Everybody in the organisation who can sign in, from the people lookup any
 * member may read (name, job title, unit). Should that fail, the picker falls
 * back to the people this request already involves (`known`), and says so,
 * rather than showing an empty box.
 */
export function ColleaguePicker({
  id,
  value,
  onChange,
  known = [],
  excludeIds = [],
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  known?: { id: string; name: string }[];
  excludeIds?: string[];
  invalid?: boolean;
  describedBy?: string;
}) {
  const [people, setPeople] = useState<{ id: string; name: string; hint?: string }[] | null>(null);
  const [limited, setLimited] = useState(false);

  useEffect(() => {
    let alive = true;
    orgFoundations.lookups
      .people()
      .then((rows) => {
        if (!alive) return;
        setPeople(rows.map((u) => ({ id: u.id, name: u.name, hint: [u.jobTitle, u.unit].filter(Boolean).join(" · ") || undefined })));
      })
      .catch(() => {
        if (!alive) return;
        setLimited(true);
        setPeople([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>(excludeIds);
    const out: SelectOption[] = [];
    for (const p of [...(people ?? []), ...known]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ value: p.id, label: p.name, hint: "hint" in p ? (p as { hint?: string }).hint : undefined });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [people, known, excludeIds]);

  return (
    <>
      <SearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={people === null ? "Loading colleagues…" : "Choose a colleague"}
        searchPlaceholder="Search by name"
        noOptionsText={people === null ? "Loading…" : "Nobody to choose yet."}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      {limited && (
        <p className="mt-1.5 text-xs text-neutral-500">
          Showing the people on this request. Ask an admin if the colleague you need isn&apos;t listed.
        </p>
      )}
    </>
  );
}
