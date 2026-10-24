"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { ApiError, hrm, type Employee } from "@/lib/api/hrm-client";
import { Button } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ModalFrame, Notice, hintCls, labelCls } from "../ui2/kit";

/*
  "Reports to" (S9/H12): HR sets somebody's line manager.

  The line is what My team is bounded by, and the first report makes the
  manager a Supervisor automatically, so this picker is where a supervisor's
  team actually comes from. The API owns the rules, not yourself, somebody
  here, somebody still here, no loop, and its sentences are shown under the
  field as they come back, rather than re-implemented here and drifting.
*/

/** The API's sentence for a refused line, wherever it put it. */
export function reportsToError(e: unknown): string {
  if (e instanceof ApiError) {
    return e.errors?.manager_id?.[0] ?? e.errors?.managerId?.[0] ?? e.message;
  }

  return "That did not save.";
}

/** Everybody still employed, as picker options, leaving out `excludeId`. */
export function useManagerOptions(excludeId?: string | null): { options: SelectOption[]; loading: boolean; failed: boolean } {
  const [people, setPeople] = useState<Employee[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hrm.employees
      .listAll()
      .then((all) => {
        if (!cancelled) setPeople(all.filter((p) => p.isCurrent));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const options = (people ?? [])
    .filter((p) => p.id !== excludeId)
    .map((p) => ({
      value: p.id,
      label: p.person.name ?? p.person.email ?? "Unnamed",
      hint: [p.jobTitle, p.department].filter(Boolean).join(" · "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { options, loading: people === null && !failed, failed };
}

/** The field itself: a searchable people picker with "Nobody" to clear. */
export function ReportsToField({
  id,
  value,
  onChange,
  excludeId,
  error,
  hint = "Their line manager decides their leave, timesheets and swaps on My team, and writes the manager half of their reviews.",
}: {
  id: string;
  value: string;
  onChange: (managerId: string) => void;
  excludeId?: string | null;
  error?: string | null;
  hint?: string;
}) {
  const { options, loading, failed } = useManagerOptions(excludeId);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        Reports to
      </label>
      <SearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        clearable
        clearLabel="Nobody"
        placeholder={loading ? "Loading people…" : "Nobody"}
        searchPlaceholder="Search by name or title"
        noOptionsText={failed ? "People could not be loaded." : "Nobody else works here yet."}
        disabled={loading}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-error-700">
          {error}
        </p>
      )}
      <span id={hintId} className={hintCls}>
        {hint}
      </span>
    </div>
  );
}

/** Change somebody's line manager from their record. */
export function ReportsToDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [managerId, setManagerId] = useState(employee.manager?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unchanged = managerId === (employee.manager?.id ?? "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unchanged) return onClose();

    setBusy(true);
    setError(null);

    try {
      await hrm.employees.update(employee.id, { managerId: managerId === "" ? null : managerId });
      onSaved();
    } catch (err) {
      setError(reportsToError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title="Change who they report to"
      subtitle={employee.person.name ?? undefined}
      icon={Users}
      hue="blue"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || unchanged}>
            {busy ? "Saving…" : "Save reporting line"}
          </Button>
        </>
      }
    >
      <ReportsToField
        id="reports-to"
        value={managerId}
        onChange={(v) => {
          setManagerId(v);
          setError(null);
        }}
        excludeId={employee.id}
        error={error}
      />
      <Notice tone="info">
        Somebody gains the Supervisor role with their first direct report, and loses it with their last unless it
        was given to them by hand.
      </Notice>
    </ModalFrame>
  );
}
