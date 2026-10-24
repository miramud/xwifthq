"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Check, CheckCircle2, Pencil, Plus, Power, PowerOff, Trash2, X } from "lucide-react";
import { ActionMenu } from "@/components/dashboard/ui";
import { Button, Chip, Empty, PageHeader, SearchField, Segmented, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ApiError, jobTitles, type JobTitle } from "@/lib/api/job-titles-client";
import { ErrorNote, IconTile, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";

/**
 * Job titles: the organisation's one list.
 *
 * Every form that asks for a job title (adding a user, hiring, raising a
 * role, making an offer, issuing a contract, placing an intern, Projects)
 * picks from this list, and people allowed to can add to it from the
 * dropdown itself. This is where the list is tidied: a title renamed here is
 * renamed everywhere, one no longer used is switched off (it stays on the
 * records that hold it, and stops being offered), and one nobody holds can
 * be deleted.
 */

type Filter = "active" | "inactive" | "all";

function message(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.errors?.name?.[0] ?? e.message;
  return fallback;
}

export default function JobTitlesBoard() {
  const confirm = useConfirm();

  const [rows, setRows] = useState<JobTitle[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    jobTitles
      .list({ all: true })
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(message(e, "Job titles didn't load.")));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const put = (t: JobTitle) => setRows((r) => (r ? (r.some((x) => x.id === t.id) ? r.map((x) => (x.id === t.id ? t : x)) : [...r, t]) : [t]));

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? [])
      .filter((t) => filter === "all" || (filter === "active" ? t.isActive : !t.isActive))
      .filter((t) => q === "" || t.name.toLowerCase().includes(q))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }, [rows, filter, search]);

  const counts = useMemo(
    () => ({
      active: (rows ?? []).filter((t) => t.isActive).length,
      inactive: (rows ?? []).filter((t) => !t.isActive).length,
    }),
    [rows],
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (name === "") return;
    setAdding(true);
    setError(null);
    try {
      const existed = (rows ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase());
      const made = await jobTitles.create(name);
      put(made);
      setDraft("");
      setNotice(existed ? `${made.name} is already on the list.` : `${made.name} added.`);
    } catch (err) {
      setError(message(err, `${name} wasn't added.`));
    } finally {
      setAdding(false);
    }
  };

  const saveName = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const current = rows?.find((t) => t.id === editing.id);
    if (!current || name === "" || name === current.name) {
      setEditing(null);
      return;
    }
    setBusyId(editing.id);
    setError(null);
    try {
      const saved = await jobTitles.update(editing.id, { name });
      put(saved);
      setEditing(null);
      setNotice(`Renamed to ${saved.name}.`);
    } catch (err) {
      setError(message(err, `${current.name} wasn't renamed.`));
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (t: JobTitle) => {
    setBusyId(t.id);
    setError(null);
    try {
      const saved = await jobTitles.update(t.id, { isActive: !t.isActive });
      put(saved);
      setNotice(saved.isActive ? `${saved.name} is offered again.` : `${saved.name} is no longer offered.`);
    } catch (err) {
      setError(message(err, `${t.name} wasn't changed.`));
    } finally {
      setBusyId(null);
    }
  };

  const remove = useCallback(
    async (t: JobTitle) => {
      const ok = await confirm({
        title: `Delete ${t.name}?`,
        body:
          t.peopleCount > 0 ? (
            <>
              {t.peopleCount === 1 ? "One person holds" : `${t.peopleCount} people hold`} this title, and a title
              can only be deleted once nobody does. To stop offering it, switch it off instead.
            </>
          ) : (
            <>Nobody holds it. It comes off every job-title list in the organisation.</>
          ),
        confirmLabel: "Delete job title",
      });
      if (!ok) return;
      setBusyId(t.id);
      setError(null);
      try {
        await jobTitles.remove(t.id);
        setRows((r) => (r ? r.filter((x) => x.id !== t.id) : r));
        setNotice(`${t.name} deleted.`);
      } catch (err) {
        // 422: somebody holds it. The API's message says who, or how many.
        setError(message(err, `${t.name} wasn't deleted.`));
      } finally {
        setBusyId(null);
      }
    },
    [confirm],
  );

  const actions = (t: JobTitle) => (
    <ActionMenu
      label={`Actions for ${t.name}`}
      items={[
        { label: "Rename", icon: Pencil, onClick: () => setEditing({ id: t.id, name: t.name }) },
        t.isActive
          ? { label: "Switch off", icon: PowerOff, onClick: () => void toggle(t) }
          : { label: "Switch on", icon: Power, onClick: () => void toggle(t) },
        { label: "Delete", icon: Trash2, danger: true, onClick: () => void remove(t) },
      ]}
    />
  );

  const nameCell = (t: JobTitle, big = false) =>
    editing?.id === t.id ? (
      <RenameField
        name={editing.name}
        original={t.name}
        busy={busyId === t.id}
        onChange={(name) => setEditing({ id: t.id, name })}
        onSave={() => void saveName()}
        onCancel={() => setEditing(null)}
      />
    ) : (
      <span className="flex min-w-0 items-center gap-3">
        <IconTile icon={Briefcase} hue={t.isActive ? "blue" : "slate"} size={big ? 40 : 34} />
        <span className={cx("truncate font-medium", t.isActive ? "text-neutral-900" : "text-neutral-500", big && "text-[15px] font-semibold")}>
          {t.name}
        </span>
      </span>
    );

  const people = (t: JobTitle) => (
    <span className="tabular-nums text-neutral-700">
      {t.peopleCount === 0 ? "Nobody" : `${t.peopleCount.toLocaleString()} ${t.peopleCount === 1 ? "person" : "people"}`}
    </span>
  );

  const status = (t: JobTitle) =>
    t.isActive ? (
      <Chip hue="mint" dot>
        Offered
      </Chip>
    ) : (
      <Chip hue="slate" dot>
        Switched off
      </Chip>
    );

  const columns: Column<JobTitle>[] = [
    { key: "name", header: "Job title", primary: true, sortable: true, value: (t) => t.name, render: (t) => nameCell(t) },
    { key: "people", header: "People", align: "right", sortable: true, value: (t) => t.peopleCount, render: people },
    { key: "status", header: "Status", value: (t) => (t.isActive ? "Offered" : "Switched off"), render: status },
    { key: "actions", header: "", align: "right", tableOnly: true, render: (t) => actions(t) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="User management"
        title="Job titles"
        subtitle="One list for your whole organisation. The user form, HR and Projects all pick from it."
      />

      <form
        onSubmit={add}
        className="ws-card xw-glow-card mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
        aria-label="Add a job title"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="job-title-new" className="mb-1.5 block text-sm font-medium text-neutral-700">
            New job title
          </label>
          <input
            id="job-title-new"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={255}
            autoComplete="off"
            placeholder="For example, Staff Accountant"
            className={inputClass}
          />
        </div>
        <Button type="submit" variant="primary" icon={Plus} disabled={adding || draft.trim() === ""}>
          {adding ? "Adding…" : "Add job title"}
        </Button>
      </form>

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && (
        <p className="mb-6 flex items-center gap-3 rounded-2xl bg-mint-50 px-4 py-3 text-sm font-medium text-mint-700">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden />
          {notice}
        </p>
      )}
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {loadError && (
        <ErrorNote className="mb-4">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {loadError}
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="min-h-11 cursor-pointer font-semibold underline underline-offset-2"
            >
              Try again
            </button>
          </span>
        </ErrorNote>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search job titles"
          label="Search job titles"
          className="sm:w-80"
        />
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "active", label: rows ? `Offered (${counts.active})` : "Offered" },
            { key: "inactive", label: rows ? `Switched off (${counts.inactive})` : "Switched off" },
            { key: "all", label: "All" },
          ]}
        />
      </div>

      {rows === null && !loadError ? (
        <div aria-busy="true">
          <p className="sr-only">Loading job titles…</p>
          <Skeleton className="h-[320px]" />
        </div>
      ) : rows !== null ? (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(t) => t.id}
          storageKey="org.job-titles"
          views={["table", "grid", "list"]}
          caption="Job titles in this organisation"
          searchable={false}
          empty={
            rows.length === 0 ? (
              <Empty
                icon={Briefcase}
                title="No job titles yet."
                hint="Add the first one above, or from any job title list in XwiftHQ."
              />
            ) : (
              <Empty icon={Briefcase} title="No job title matches." hint="Try another word or show all titles." />
            )
          }
          renderCard={(t) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">{nameCell(t, true)}</div>
                {editing?.id !== t.id && actions(t)}
              </div>
              <div className="mt-auto flex items-center justify-between rounded-xl bg-primary-50/40 px-3 py-2 text-xs">
                {people(t)}
                {status(t)}
              </div>
            </div>
          )}
          renderListItem={(t) => (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">{nameCell(t)}</div>
              <span className="hidden text-sm sm:inline">{people(t)}</span>
              {status(t)}
              {editing?.id !== t.id && actions(t)}
            </div>
          )}
        />
      ) : null}
    </div>
  );
}

/** Rename in place: Enter saves, Escape puts the old name back. */
function RenameField({
  name,
  original,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  name: string;
  original: string;
  busy: boolean;
  onChange: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <span className="flex w-full min-w-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        value={name}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        disabled={busy}
        maxLength={255}
        aria-label={`New name for ${original}`}
        className="h-11 min-w-0 flex-1 rounded-xl border border-primary-400 bg-white px-3 text-sm text-neutral-900 outline-none ring-4 ring-primary-100"
      />
      <button
        type="button"
        onClick={onSave}
        disabled={busy || name.trim() === ""}
        aria-label={`Save ${original}`}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white outline-none hover:from-primary-700 hover:to-primary-600 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check size={16} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        aria-label="Cancel renaming"
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <X size={16} aria-hidden />
      </button>
    </span>
  );
}
