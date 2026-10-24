"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  ApiError,
  getJobTitlesServerState,
  getJobTitlesState,
  jobTitles,
  loadJobTitles,
  subscribeJobTitles,
  type JobTitle,
} from "@/lib/api/job-titles-client";
import { SearchableSelect, type SelectOption } from "./SearchableSelect";

/**
 * The organisation's job titles as a dropdown, the same list on the users
 * form, in HR and in Projects, with "Add “…” as a job title" at the bottom
 * when what somebody typed isn't there yet.
 *
 * Two value modes, because the forms differ:
 *
 * - `mode="name"`: value and onChange carry the title's **name**. HR and the
 *   users form send a string, and a record saved before the list existed may
 *   hold a name that isn't on it; that name is still shown and kept.
 * - `mode="id"`: value is the job title's **id**, for fields that store one.
 *
 * The list is loaded once per session and shared by every picker on the
 * page. Adding needs permission: a 403 says to ask an admin, beside the field,
 * and leaves the value alone.
 */

export interface JobTitlePickerProps {
  mode: "name" | "id";
  value: string;
  /** The new value (a name or an id, by mode) and the title it came from; null when cleared. */
  onChange: (value: string, title: JobTitle | null) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Adds a "No job title" option. */
  clearable?: boolean;
  /** Offer "Add …" from the dropdown. On by default; the API still decides who may. */
  allowCreate?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  className?: string;
  size?: "sm" | "md";
}

export function JobTitlePicker({
  mode,
  value,
  onChange,
  placeholder,
  clearable = false,
  allowCreate = true,
  ...rest
}: JobTitlePickerProps) {
  const state = useSyncExternalStore(subscribeJobTitles, getJobTitlesState, getJobTitlesServerState);

  useEffect(() => {
    // Failures are shown from the shared state; nothing to do with them here.
    loadJobTitles().catch(() => {});
  }, []);

  const options = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = state.titles.map((t) => ({ value: mode === "id" ? t.id : t.name, label: t.name }));
    // A name saved before the list existed (or since retired) is still this
    // record's title: show it, and keep it unless somebody picks another.
    if (mode === "name" && value.trim() !== "" && !list.some((o) => o.value.toLowerCase() === value.toLowerCase())) {
      list.unshift({ value, label: value, hint: "Not on the organisation's list" });
    }
    return list;
  }, [state.titles, mode, value]);

  // In name mode a case-only difference ("analyst" vs "Analyst") is the same title.
  const shownValue = useMemo(() => {
    if (mode !== "name") return value;
    return options.find((o) => o.value.toLowerCase() === value.toLowerCase())?.value ?? value;
  }, [mode, value, options]);

  const titleFor = useCallback(
    (v: string) => state.titles.find((t) => (mode === "id" ? t.id === v : t.name === v)) ?? null,
    [state.titles, mode],
  );

  const create = useCallback(
    async (text: string) => {
      try {
        const title = await jobTitles.create(text);
        onChange(mode === "id" ? title.id : title.name, title);
        return undefined;
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          throw new Error("Ask an admin to add this job title.");
        }
        const field = e instanceof ApiError ? e.errors?.name?.[0] : undefined;
        throw new Error(field ?? (e instanceof ApiError ? e.message : `“${text}” wasn't added. Try again.`));
      }
    },
    [mode, onChange],
  );

  const loading = state.status === "loading" || state.status === "idle";
  const failed = state.status === "error";

  return (
    <SearchableSelect
      {...rest}
      value={shownValue}
      onChange={(v) => onChange(v, v === "" ? null : titleFor(v))}
      options={options}
      placeholder={
        placeholder ?? (loading && state.titles.length === 0 ? "Loading job titles…" : "Choose a job title")
      }
      clearable={clearable}
      clearLabel="No job title"
      searchPlaceholder="Search job titles"
      emptyText={failed ? "Job titles didn't load. Close this list and open it again to retry." : "No job title matches."}
      noOptionsText={
        failed
          ? "Job titles didn't load. Close this list and open it again to retry."
          : loading
            ? "Loading job titles…"
            : allowCreate
              ? "No job titles yet. Type one to add it."
              : "No job titles yet."
      }
      onCreate={allowCreate ? create : undefined}
      onOpenChange={(open) => {
        if (open && failed) loadJobTitles().catch(() => {});
      }}
      createLabel={(text) => `Add “${text}” as a job title`}
    />
  );
}

export default JobTitlePicker;
