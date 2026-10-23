"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Hash, Info, ListOrdered, Loader2, Pencil, Save } from "lucide-react";
import { orgFoundations, type NumberSeries } from "@/lib/api/org-foundations-client";
import { Button, Card, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { RESETS, TOKENS, formatProblem, insertToken } from "./logic";
import { FieldError, LoadError, Notice, errorText, fieldErrors } from "./shared";

/**
 * Reference numbering: how each kind of document is numbered (INV/MPT/2026/0042).
 * A format is built from tokens; the running number resets on the rule chosen.
 * Changes apply to the next number issued — numbers already out keep theirs.
 */

const resetLabel = (r: NumberSeries["reset"]) => RESETS.find((x) => x.value === r)?.label ?? r;

export default function NumberingBoard() {
  const [rows, setRows] = useState<NumberSeries[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    orgFoundations.numbering
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e, "Reference numbering didn't load.")));
    return () => {
      alive = false;
    };
  }, [reload]);

  const editing = rows?.find((r) => r.id === editingId) ?? null;

  const columns: Column<NumberSeries>[] = [
    {
      key: "name",
      header: "Series",
      primary: true,
      sortable: true,
      value: (s) => `${s.name} ${s.code}`,
      render: (s) => (
        <span className="min-w-0">
          <span className="block font-medium text-neutral-900">{s.name}</span>
          <span className="block font-mono text-[11px] text-neutral-500">{s.code}</span>
        </span>
      ),
    },
    { key: "format", header: "Format", value: (s) => s.format, render: (s) => <code className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-700">{s.format}</code>, hideOnMobile: true },
    {
      key: "preview",
      header: "Next number",
      value: (s) => s.preview,
      render: (s) => <span className="font-mono text-[13px] font-semibold tabular-nums text-primary-700">{s.preview}</span>,
    },
    { key: "reset", header: "Restarts", sortable: true, value: (s) => resetLabel(s.reset), hideOnMobile: true },
    {
      key: "issued",
      header: "Issued",
      align: "right",
      sortable: true,
      value: (s) => s.issued,
      render: (s) => (
        <span className="tabular-nums text-neutral-700">
          {s.issued.toLocaleString()}
          {s.voided > 0 && <span className="ml-1 text-xs text-neutral-500">({s.voided} voided)</span>}
        </span>
      ),
    },
    {
      key: "edit",
      header: "",
      align: "right",
      tableOnly: true,
      render: (s) => (
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditingId(s.id)} aria-label={`Edit ${s.name}`}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Organisation"
        title="Reference numbering"
        subtitle="How invoices, orders, contracts and other documents are numbered. Changes affect the next number only."
      />

      <Notice text={notice} />
      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}

      {rows === null && !loadError ? (
        <div aria-busy="true" className="grid gap-5 lg:grid-cols-5">
          <p className="sr-only">Loading reference numbering…</p>
          <Skeleton className="h-[360px] lg:col-span-3" />
          <Skeleton className="h-[360px] lg:col-span-2" />
        </div>
      ) : rows !== null ? (
        <div className="grid items-start gap-5 lg:grid-cols-5">
          <div className="min-w-0 lg:col-span-3">
            <DataView
              rows={rows}
              columns={columns}
              rowKey={(s) => s.id}
              onRowClick={(s) => setEditingId(s.id)}
              storageKey="org.numbering"
              caption="Reference number series"
              searchPlaceholder="Search series"
              views={["table", "list"]}
              empty={<Empty icon={ListOrdered} title="No number series yet." hint="Series appear here as modules that issue documents are switched on." />}
            />
          </div>
          <div className="min-w-0 lg:sticky lg:top-20 lg:col-span-2">
            {editing ? (
              <SeriesEditor
                key={editing.id}
                series={editing}
                onCancel={() => setEditingId(null)}
                onSaved={(s) => {
                  setRows((list) => list?.map((x) => (x.id === s.id ? s : x)) ?? list);
                  setEditingId(null);
                  setNotice(`${s.name} saved. The next number is ${s.preview}.`);
                }}
              />
            ) : (
              <Card className="p-2">
                <Empty icon={Hash} hue="slate" title="Pick a series to edit." hint="You'll see the next number change as you build the format." />
              </Card>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Preview = { state: "idle" | "loading" | "ok" | "error"; text: string };

export function SeriesEditor({ series, onCancel, onSaved }: { series: NumberSeries; onCancel: () => void; onSaved: (s: NumberSeries) => void }) {
  const uid = useId();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(series.name);
  const [format, setFormat] = useState(series.format);
  const [reset, setReset] = useState<NumberSeries["reset"]>(series.reset);
  const [startAt, setStartAt] = useState(String(series.startAt));
  const [preview, setPreview] = useState<Preview>({ state: "ok", text: series.preview });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ticket = useRef(0);

  // The next number, asked of the server a moment after typing stops.
  useEffect(() => {
    if (format === series.format) {
      setPreview({ state: "ok", text: series.preview });
      return;
    }
    const problem = formatProblem(format);
    if (problem) {
      setPreview({ state: "error", text: problem });
      return;
    }
    const mine = ++ticket.current;
    setPreview((p) => ({ state: "loading", text: p.text }));
    const timer = setTimeout(() => {
      orgFoundations.numbering
        .preview(format)
        .then((r) => mine === ticket.current && setPreview({ state: "ok", text: r.preview }))
        .catch((e: unknown) => mine === ticket.current && setPreview({ state: "error", text: errorText(e, "That format can't be previewed.") }));
    }, 400);
    return () => clearTimeout(timer);
  }, [format, series.format, series.preview]);

  const insert = (token: string) => {
    const el = input.current;
    const { value, caret } = insertToken(format, token, el?.selectionStart, el?.selectionEnd);
    setFormat(value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    const problem = formatProblem(format);
    if (problem) found.format = problem;
    if (name.trim() === "") found.name = "Give the series a name.";
    const start = Number(startAt);
    if (!Number.isInteger(start) || start < 1 || start > 1_000_000) found.startAt = "Use a whole number from 1 to 1,000,000.";
    if (preview.state === "error" && !found.format) found.format = preview.text;
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const saved = await orgFoundations.numbering.update(series.id, { name: name.trim(), format, reset, startAt: start });
      onSaved({ ...series, name: name.trim(), startAt: start, ...saved });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err, "The series wasn't saved."));
    } finally {
      setBusy(false);
    }
  };

  const dirty = name !== series.name || format !== series.format || reset !== series.reset || startAt !== String(series.startAt);

  return (
    <Panel title={`Edit ${series.name}`} subtitle={series.code} icon={ListOrdered}>
      <form onSubmit={save} noValidate className="space-y-5" aria-label={`Edit ${series.name}`}>
        {error && <ErrorNote>{error}</ErrorNote>}

        {/* The next number, large: the thing every edit here changes. */}
        <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Next number</p>
          <p
            className={cx(
              "mt-1 flex min-h-8 items-center gap-2 break-all font-mono tabular-nums",
              preview.state === "error" ? "text-sm font-medium text-error-700" : "text-xl font-semibold text-neutral-900",
            )}
          >
            {preview.state === "loading" && <Loader2 size={16} className="animate-spin" aria-hidden />}
            <span>{preview.text}</span>
          </p>
          {preview.state === "loading" && <span className="sr-only">Working out the next number…</span>}
        </div>

        <div>
          <label htmlFor={`${uid}-name`} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Name
          </label>
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={255} aria-invalid={errors.name ? true : undefined} className={inputClass} />
          <FieldError message={errors.name} />
        </div>

        <div>
          <label htmlFor={`${uid}-format`} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Format
          </label>
          <input
            ref={input}
            id={`${uid}-format`}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            maxLength={96}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={errors.format ? true : undefined}
            aria-describedby={`${uid}-tokens-hint`}
            className={cx(inputClass, "font-mono")}
          />
          <FieldError message={errors.format} />
          <p id={`${uid}-tokens-hint`} className="mb-2 mt-3 text-xs text-neutral-500">
            Tap a token to put it where the cursor is. Anything else you type is printed as written.
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Tokens">
            {TOKENS.map((t) => (
              <li key={t.token}>
                <button
                  type="button"
                  onClick={() => insert(t.token)}
                  title={t.label}
                  aria-label={`Insert ${t.token}: ${t.label}`}
                  className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-primary-200 bg-primary-50 px-2.5 font-mono text-xs font-semibold text-primary-700 outline-none transition hover:border-primary-300 hover:bg-primary-100 focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  {t.token}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-reset`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Running number restarts
            </label>
            <SearchableSelect id={`${uid}-reset`} value={reset} onChange={(v) => setReset(v as NumberSeries["reset"])} options={RESETS.map((r) => ({ value: r.value, label: r.label }))} />
          </div>
          <div>
            <label htmlFor={`${uid}-start`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Starts at
            </label>
            <input
              id={`${uid}-start`}
              type="number"
              inputMode="numeric"
              min={1}
              max={1000000}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              aria-invalid={errors.startAt ? true : undefined}
              className={cx(inputClass, "tabular-nums")}
            />
            <FieldError message={errors.startAt} />
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3.5 py-3 text-xs text-sky-700">
          <Info size={15} aria-hidden className="mt-px shrink-0" />
          Changes apply from the next number issued. The {series.issued.toLocaleString()} already issued keep their numbers.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" icon={Save} disabled={busy || !dirty || preview.state === "loading"}>
            {busy ? "Saving…" : "Save series"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
