"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Loader2, UsersRound } from "lucide-react";
import { Chip, Panel, PersonAvatar, SearchField, Segmented } from "@/components/workspace/kit";
import { SearchableSelect, foldText } from "@/components/workspace/SearchableSelect";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { opsError, travel, type StaffGrade, type StaffGrades as Grades } from "@/lib/api/operations-travel-client";

/**
 * Who travels at which grade. Every trip and every event's travel starts
 * each person at the grade on their record; somebody with none set travels
 * at the default (officer) until one is. Search by name or job title, and
 * change a grade in place - it saves as soon as it is picked.
 */

type Show = "all" | "unset";

export default function StaffGrades({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<Grades | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ userId: string; text: string } | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    travel.desk.grades().then(
      (g) => {
        if (!alive) return;
        setData(g);
        setError(null);
      },
      (e: unknown) => alive && setError(`The staff grades didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const options = useMemo(() => Object.entries(data?.grades ?? {}).map(([value, label]) => ({ value, label })), [data]);
  const unset = data?.staff.filter((s) => !s.onRecord).length ?? 0;
  const rows = useMemo(() => {
    const q = foldText(query.trim());
    return (data?.staff ?? []).filter((s) => (show === "unset" ? !s.onRecord : true) && (!q || foldText(`${s.name} ${s.jobTitle ?? ""}`).includes(q)));
  }, [data, query, show]);

  const label = (g: string) => data?.grades[g] ?? g;

  const change = async (s: StaffGrade, grade: string) => {
    if (grade === s.grade && s.onRecord) return;
    setSaving(s.userId);
    setRowError(null);
    try {
      setData(await travel.desk.setGrade(s.userId, grade));
      setStatus(`${s.name} now travels as ${label(grade)}.`);
    } catch (e) {
      setRowError({ userId: s.userId, text: `${s.name}'s grade wasn't changed. ${opsError(e)}` });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Panel
      title="Staff grades"
      subtitle="Each trip starts a traveller at the grade on their record. Nobody set travels as an officer."
      icon={UsersRound}
      hue="mint"
      bodyClassName="p-0"
    >
      {error && !data && (
        <div className="p-5">
          <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />
        </div>
      )}
      {!data && !error && (
        <div className="p-5" aria-busy="true">
          <p className="sr-only">Loading the staff grades…</p>
          <Skeleton className="h-48" />
        </div>
      )}
      {data && (
        <>
          <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <SearchField value={query} onChange={setQuery} label="Search staff" placeholder="Search name or job title" className="sm:w-72" />
            <Segmented
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { key: "all", label: `Everyone (${data.staff.length})` },
                { key: "unset", label: `No grade set (${unset})` },
              ]}
            />
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {status}
          </p>
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">
              {query ? "Nobody matches that search. Try a shorter word." : show === "unset" ? "Everyone has a grade on record." : "No staff yet."}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100" aria-label="Staff and their travel grades">
              {rows.map((s) => {
                const busy = saving === s.userId;
                const err = rowError?.userId === s.userId ? rowError.text : null;
                const selectId = `grade-${s.userId}`;
                return (
                  <li key={s.userId} className="px-5 py-3">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <PersonAvatar name={s.name} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900">{s.name}</p>
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                            <span className="truncate">{s.jobTitle ?? "No job title"}</span>
                            {s.onRecord ? (
                              <span className="inline-flex items-center gap-1 text-mint-700">
                                <BadgeCheck size={12} aria-hidden /> On record
                              </span>
                            ) : (
                              <span className="text-sun-700">Default, not set</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:w-60">
                        {canEdit ? (
                          <>
                            <label htmlFor={selectId} className="sr-only">
                              Travel grade for {s.name}
                            </label>
                            <SearchableSelect
                              id={selectId}
                              value={s.grade}
                              onChange={(g) => void change(s, g)}
                              options={options}
                              disabled={busy}
                              searchPlaceholder="Search grades"
                              aria-invalid={err ? true : undefined}
                              aria-describedby={err ? `${selectId}-err` : undefined}
                              className="flex-1"
                            />
                            <span className="flex w-5 justify-center" aria-hidden>
                              {busy && <Loader2 size={16} className="animate-spin text-primary-600 motion-reduce:animate-none" />}
                            </span>
                          </>
                        ) : (
                          <Chip hue={s.onRecord ? "mint" : "slate"}>{label(s.grade)}</Chip>
                        )}
                      </div>
                    </div>
                    {err && (
                      <p id={`${selectId}-err`} role="alert" className="mt-1.5 text-xs font-medium text-error-700 sm:pl-12">
                        {err}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}
