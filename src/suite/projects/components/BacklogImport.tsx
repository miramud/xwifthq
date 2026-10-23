"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Columns3,
  Download,
  FileSpreadsheet,
  History,
  Layers,
  ListChecks,
  Loader2,
  PencilLine,
  Search,
  Upload,
  UploadCloud,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Button, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import {
  ApiError,
  imports as importsApi,
  type BacklogImport as Import,
  type ImportField,
  type ImportRow,
  type Project,
  type RowVerdict,
  type Sprint,
} from "@/lib/api/projects-client";
import {
  IconTile,
  ItemRef,
  MiniStat,
  NameAvatar,
  Notice,
  Skeleton,
  fmtDate,
  hintCls,
  labelCls,
  sayJobTitle,
  smallInputCls,
} from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * A mapping field's name as shown. The server's `discipline` field now holds
 * the organisation's job title, and "Job title" is the word people know.
 */
function fieldLabel(field: { value: ImportField; label: string }): string {
  return field.value === "discipline" ? "Job title" : sayJobTitle(field.label);
}

const VERDICT: Record<RowVerdict, { label: string; hue: Hue; icon: LucideIcon }> = {
  import: { label: "Will import", hue: "mint", icon: CheckCircle2 },
  warn: { label: "With a note", hue: "sun", icon: AlertTriangle },
  skip: { label: "Skipped", hue: "slate", icon: CircleSlash },
};

/**
 * Bringing a backlog in from a spreadsheet.
 *
 * **Four steps, and the middle two are the product.** Upload, read what the
 * importer thinks the file says, correct any column it got wrong, then commit.
 * A one-shot import would be a smaller screen and would put a hundred wrong
 * work items on a board, which somebody then deletes one at a time.
 *
 * The preview shows **every row, including the ones that will not be
 * imported**, with the reason beside each. That is not completeness for its
 * own sake: the sheet this was built against has a second table pasted under
 * the backlog — QA findings whose review comments sit in the *assignee* column
 * — and the only acceptable outcome is that those rows are skipped *and said
 * out loud*. Dropping them silently loses six review findings and tells nobody.
 *
 * Nothing is paginated. A person who cannot see all 118 rows cannot spot the
 * six that are wrong, which is the entire reason this screen exists.
 */
export default function BacklogImport({
  project,
  sprints,
  onImported,
}: {
  project: Project;
  sprints: Sprint[];
  onImported?: () => void;
}) {
  const confirm = useConfirm();
  const [history, setHistory] = useState<Import[] | null>(null);
  const [fields, setFields] = useState<{ value: ImportField; label: string }[]>([]);
  const [current, setCurrent] = useState<Import | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [showSkipped, setShowSkipped] = useState(true);
  const [rowQuery, setRowQuery] = useState("");
  const [template, setTemplate] = useState<
    { state: "idle" } | { state: "busy" } | { state: "done"; filename: string } | { state: "failed"; message: string }
  >({ state: "idle" });

  const fileInput = useRef<HTMLInputElement>(null);
  /**
   * The file the browser still holds, so another tab can be read.
   *
   * The upload is deliberately never stored server-side, which means switching
   * sheets cannot be done by re-reading it there. Keeping the `File` here costs
   * nothing and makes the choice one click instead of a re-pick.
   */
  const picked = useRef<File | null>(null);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    importsApi
      .list(project.slug)
      .then((res) => {
        if (cancelled) return;

        setHistory(res.data);
        setFields(res.meta.fields);

        /*
          An import left mid-review is picked up where it was. Somebody who
          uploaded a sheet, went to ask a colleague about a column and came
          back should not have to upload it again.
        */
        const open = res.data.find((i) => i.isOpen);

        if (open !== undefined) {
          importsApi
            .get(project.slug, open.id)
            .then((full) => {
              if (!cancelled) setCurrent(full.data);
            })
            .catch(() => undefined);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setHistory([]);
      });

    return () => {
      cancelled = true;
    };
  }, [project.slug, reloads]);

  const upload = async (file: File, sheet?: string) => {
    setBusy("upload");
    setError(null);
    picked.current = file;

    try {
      const res = await importsApi.upload(project.slug, file, sheet === undefined ? {} : { sheet });

      setCurrent(res.data);
      setFields(res.meta.fields);
      reload();
    } catch (e) {
      /* The recorded reason is written to be read; show it. */
      setError(e instanceof ApiError ? e.message : "That file could not be read.");
      reload();
    } finally {
      setBusy(null);
    }
  };

  /**
   * Read a different tab of the same workbook.
   *
   * The reader has always read every sheet and the API has always accepted a
   * sheet name; there was simply no way for anybody to find out what the
   * choices were, so a workbook whose backlog was not its fullest tab could
   * not be imported at all.
   */
  const switchSheet = async (name: string) => {
    const file = picked.current;

    if (file === null) {
      setError("Pick the file again to read another sheet.");

      return;
    }

    /* The old preview is replaced, so it is discarded rather than left open. */
    if (current !== null && current.isOpen) {
      await importsApi.discard(project.slug, current.id).catch(() => undefined);
    }

    await upload(file, name);
  };

  const remap = async (column: string, field: ImportField) => {
    if (current === null) return;

    setBusy(`map-${column}`);
    setError(null);

    try {
      const res = await importsApi.remap(project.slug, current.id, {
        mapping: { [column]: field },
      });

      setCurrent(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const setSprint = async (sprintId: string) => {
    if (current === null) return;

    setBusy("sprint");
    setError(null);

    try {
      const res = await importsApi.remap(project.slug, current.id, {
        sprintId: sprintId === "" ? null : sprintId,
      });

      setCurrent(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (current === null) return;

    setBusy("commit");
    setError(null);

    try {
      const done = await importsApi.commit(project.slug, current.id);

      setCurrent(done);
      reload();
      onImported?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That import did not run.");
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (current === null) return;

    const ok = await confirm({
      title: "Discard this import?",
      /* Marked discarded and kept (ProjectImportController::discard); it is not deleted, so not binned either. */
      body: "Nothing from the file is added to the backlog. The import is kept as a discarded record.",
      confirmLabel: "Discard import",
    });
    if (!ok) return;

    setBusy("discard");
    setError(null);

    try {
      await importsApi.discard(project.slug, current.id);

      setCurrent(null);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  /**
   * Download the backlog template, with this project's members on its second tab.
   *
   * The template is the fix for the assignee column. A name typed from memory
   * ("Shadrach", "QA/QC") often matches nobody; a User ID copied from the
   * Members tab always matches the person it was copied from, and the preview
   * turns it back into their name. Fetched as a blob and handed to the browser
   * through an object URL, because the route needs the session cookie a plain
   * link to the API would not carry.
   */
  const downloadTemplate = async () => {
    setTemplate({ state: "busy" });

    try {
      const { blob, filename } = await importsApi.template(project.slug);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      /* After the click has been handled, so the download has what it needs. */
      window.setTimeout(() => URL.revokeObjectURL(url), 0);

      setTemplate({ state: "done", filename });
    } catch (e) {
      setTemplate({
        state: "failed",
        message: e instanceof ApiError ? e.message : "The template could not be downloaded.",
      });
    }
  };

  /*
    Filtered in the browser. The preview is already in hand - it arrives whole,
    because a preview somebody has to paginate is one they scroll past - so
    searching it should not be a request, and a twenty-thousand-row ceiling is
    still nothing to filter client-side.

    Searched across the row number, the reference, the title, the epic, the
    story and the assignee, because "find row 147" and "find the metadata ones" are both
    things somebody does with a spreadsheet open beside them.
  */
  const rows = useMemo(() => current?.rows ?? [], [current]);

  const shown = useMemo(() => {
    const needle = rowQuery.trim().toLowerCase();

    return rows.filter((row) => {
      if (!showSkipped && row.verdict === "skip") return false;
      if (needle === "") return true;

      return (
        String(row.row) === needle ||
        (row.taskRef ?? "").toLowerCase().includes(needle) ||
        (row.title ?? "").toLowerCase().includes(needle) ||
        (row.epic ?? "").toLowerCase().includes(needle) ||
        (row.story ?? "").toLowerCase().includes(needle) ||
        (row.assignee ?? "").toLowerCase().includes(needle) ||
        (row.assigneeName ?? "").toLowerCase().includes(needle) ||
        row.reasons.some((reason) => reason.toLowerCase().includes(needle))
      );
    });
  }, [rows, rowQuery, showSkipped]);

  if (!(project.can.importBacklog ?? project.can.manageBoard)) {
    return (
      <Panel title="Import a backlog" icon={FileSpreadsheet} hue="sky" bodyClassName="p-0">
        <Empty
          icon={FileSpreadsheet}
          hue="slate"
          title="You cannot import into this project"
          hint="Bringing a backlog in adds work to everybody's board, so it is the project manager's or the engineering lead's to do."
        />
      </Panel>
    );
  }

  if (history === null) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-56" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const columns = current === null ? [] : orderedColumns(current);
  /*
    Defaulted rather than read straight off the import. The API always sends
    this, but during a deploy an older server is briefly paired with this
    client, and an absent array here would throw on `.length` and white-screen
    the whole tab rather than hiding one dropdown.
  */
  const sheets = current?.sheets ?? [];

  return (
    <div className="space-y-5">
      {error !== null && <Notice tone="error">{error}</Notice>}

      {/* ---------------------------- upload ---------------------------- */}

      {(current === null || !current.isOpen) && (
        <Panel
          title="Import a backlog"
          subtitle="An .xlsx or .csv. Nothing is created until you have seen what it would do."
          icon={FileSpreadsheet}
          hue="sky"
        >
          {/*
            Three steps, in the order somebody does them. The template is step
            one because it is what makes step three quiet: its Members tab
            carries every User ID on this project, so an assignee filled in from
            it is recognised on upload instead of reported as a stranger.
          */}
          <ol className="grid gap-4 lg:grid-cols-3">
            <Step n={1} icon={Download} hue="blue" title="Download the template">
              <p>
                A Backlog tab whose headings are read without correction, and a
                Members tab listing everybody on this project with their User ID.
              </p>
              <div className="mt-4">
                <Button
                  variant="primary"
                  icon={template.state === "busy" ? Loader2 : Download}
                  onClick={() => void downloadTemplate()}
                  disabled={template.state === "busy"}
                  aria-busy={template.state === "busy"}
                >
                  {template.state === "busy" ? "Preparing template…" : "Download template"}
                </Button>
              </div>
              <div aria-live="polite">
                {template.state === "done" && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-mint-700">
                    <CheckCircle2 size={13} aria-hidden />
                    Downloaded {template.filename}
                  </p>
                )}
              </div>
              {template.state === "failed" && (
                <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-error-700">
                  <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden />
                  {template.message}
                </p>
              )}
            </Step>

            <Step n={2} icon={PencilLine} hue="grape" title="Fill it in">
              <p>
                One row per task. In <strong className="font-semibold text-neutral-800">Assignee</strong>,
                paste a User ID from the Members tab — it is matched to that person
                and shown by name when you upload.
              </p>
              <p className="mt-2">
                Repeat the <strong className="font-semibold text-neutral-800">User Story</strong> on
                each of its tasks. <strong className="font-semibold text-neutral-800">Epic</strong> is
                optional — fill it in to group stories, or leave it blank.
              </p>
            </Step>

            <Step n={3} icon={UploadCloud} hue="mint" title="Upload and review">
              <label
                className={cx(
                  "mt-1 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-neutral-200 bg-white px-4 py-5 text-center transition",
                  "hover:border-primary-300 hover:bg-primary-50/40 focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-100",
                  busy === "upload" && "pointer-events-none opacity-70",
                )}
              >
                {busy === "upload" ? (
                  <Loader2 size={20} className="animate-spin text-primary-600" aria-hidden />
                ) : (
                  <Upload size={20} className="text-primary-600" aria-hidden />
                )}
                <span className="text-sm font-semibold text-neutral-800">
                  {busy === "upload" ? "Reading the file…" : "Choose a spreadsheet"}
                </span>
                <span className="text-xs text-neutral-500">.xlsx or .csv</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  aria-label="Spreadsheet to import"
                  onChange={(e) => {
                    const file = e.target.files?.[0];

                    if (file !== undefined) void upload(file);
                  }}
                  className="sr-only"
                />
              </label>
            </Step>
          </ol>

          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            Your own spreadsheet works too. The columns are worked out from the
            header row and shown for correction — nothing is guessed silently. A
            user story or epic merged down a block of tasks is read as belonging
            to all of them, a story already on the board is added to rather than
            copied, and anything that does not read as a task is listed with
            the reason rather than dropped.
          </p>
        </Panel>
      )}

      {/* ---------------------------- preview --------------------------- */}

      {current !== null && current.status === "failed" && (
        <Notice tone="error" title={current.filename}>
          {current.error ?? "That file could not be read."}
        </Notice>
      )}

      {current !== null && current.status === "committed" && (
        <Panel title="Imported" icon={CheckCircle2} hue="mint">
          <p className="text-sm text-neutral-700">
            {current.counts.created} items created from {current.filename}
            {current.counts.skipped > 0 && `, ${current.counts.skipped} rows skipped`}.
          </p>
          <Button size="sm" className="mt-4" icon={Upload} onClick={() => setCurrent(null)}>
            Import another
          </Button>
        </Panel>
      )}

      {current !== null && current.isOpen && (
        <>
          <Panel
            title={current.filename}
            subtitle={
              current.sheetName === null
                ? undefined
                : `Sheet "${current.sheetName}" · ${current.counts.rows} rows read · ${hierarchyLine(current)}`
            }
            icon={FileSpreadsheet}
            hue="sky"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Will import" value={current.verdicts.import} hue="mint" />
              <MiniStat
                label="With a note"
                value={current.verdicts.warn}
                hue={current.verdicts.warn > 0 ? "sun" : undefined}
              />
              <MiniStat label="Skipped" value={current.verdicts.skip} />
              <MiniStat
                label="Stories"
                value={current.counts.stories}
                hint={epicHint(epicsOf(current))}
                hue="grape"
              />
            </div>

            {/*
              Said once about the file. The sheet this was built against has an
              estimate column with nothing in it, which is why cost reporting
              will have nothing to work with until somebody estimates.
            */}
            {current.estimatesAllEmpty && (
              <Notice tone="info" className="mt-4">
                There is an estimate column in this sheet and nothing in it, so
                these tasks arrive unestimated. Cost and velocity stay blank
                until somebody estimates them — they are not zero.
              </Notice>
            )}

            {current.counts.importable === 0 && (
              <Notice tone="warn" className="mt-4">
                Nothing here can be imported. Check the columns below — if the
                task column is wrong, every row will look empty.
              </Notice>
            )}

            {(sheets.length > 1 || sprints.length > 0) && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {/*
                  Only when there is a choice. On a single-sheet workbook this
                  would be a control with one option, which reads as a decision
                  somebody has to make and is not one.
                */}
                {sheets.length > 1 && (
                  <div>
                    <label htmlFor="import-sheet" className={labelCls}>
                      Which sheet
                    </label>
                    <SearchableSelect
                      id="import-sheet"
                      value={current.sheetName ?? ""}
                      onChange={(value) => void switchSheet(value)}
                      disabled={busy !== null}
                      searchPlaceholder="Search sheets"
                      options={sheets.map((sheet) => ({
                        value: sheet.name,
                        label: sheet.name,
                        hint: `${sheet.rows} ${sheet.rows === 1 ? "row" : "rows"}`,
                      }))}
                    />
                    <p className={hintCls}>
                      This workbook has {sheets.length} sheets. The fullest
                      one was read; switching re-reads the file.
                    </p>
                  </div>
                )}

                {sprints.length > 0 && (
                  <div>
                    <label htmlFor="import-sprint" className={labelCls}>
                      Where the tasks go
                    </label>
                    <SearchableSelect
                      id="import-sprint"
                      value={current.sprintId ?? ""}
                      onChange={(value) => void setSprint(value)}
                      disabled={busy !== null}
                      searchPlaceholder="Search sprints"
                      options={[
                        { value: "", label: "Product backlog" },
                        ...sprints
                          .filter((s) => s.acceptsChanges)
                          .map((s) => ({ value: s.id, label: `Sprint ${s.sequence} — ${s.name}` })),
                      ]}
                    />
                    {/*
                      Stories always go to the backlog. Said here because it is
                      otherwise a surprise: a sprint should hold the work, not
                      the headings the work sits under.
                    */}
                    <p className={hintCls}>
                      The user stories stay in the backlog either way; only the
                      tasks move.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/*
              At the foot of the summary rather than beside the file name, so
              the file name keeps its width on a phone and the decision comes
              after the figures it is made on.
            */}
            <div className="-mx-5 -mb-5 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3.5">
              <ReviewActions current={current} busy={busy} onDiscard={discard} onCommit={commit} />
            </div>
          </Panel>

          {/* --------------------------- mapping -------------------------- */}

          <Panel
            title="Columns"
            subtitle="Worked out from the header row. Change anything that is wrong — every row is read again."
            icon={Columns3}
            hue="grape"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {columns.map((column) => (
                <div key={column}>
                  <label
                    htmlFor={`map-${column}`}
                    className="mb-1.5 flex items-center gap-2 truncate text-[13px] font-semibold text-neutral-700"
                    title={current.headers[column] ?? `Column ${column}`}
                  >
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-neutral-500">
                      {column}
                    </span>
                    {current.headers[column] ?? "(no header)"}
                  </label>
                  <SearchableSelect
                    id={`map-${column}`}
                    value={current.mapping[column] ?? "ignore"}
                    onChange={(value) => void remap(column, value as ImportField)}
                    disabled={busy !== null}
                    searchPlaceholder="Search fields"
                    options={fields.map((field) => ({ value: field.value, label: fieldLabel(field) }))}
                  />
                </div>
              ))}
            </div>
          </Panel>

          {/* ---------------------------- rows ---------------------------- */}

          <section aria-labelledby="import-rows-title">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div className="flex items-center gap-3">
                <IconTile icon={ListChecks} hue="mint" size={36} />
                <div>
                  <h3 id="import-rows-title" className="text-[15px] font-semibold text-neutral-900">
                    Every row
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Including the ones that will not be imported, and why.
                  </p>
                </div>
              </div>
            </div>

            <DataView
              rows={shown}
              columns={rowColumns}
              rowKey={(r) => String(r.row)}
              storageKey="projects.import.rows"
              caption="Rows read from the spreadsheet"
              /*
                The search is this screen's own, not the view's: it also matches
                a row number exactly and searches the reasons, and the skipped
                toggle filters before it.
              */
              searchable={false}
              toolbar={
                <div className="flex flex-wrap items-center gap-3">
                  <label className="relative">
                    <span className="sr-only">Search the rows</span>
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={rowQuery}
                      onChange={(e) => setRowQuery(e.target.value)}
                      placeholder="Row, reference, task, story…"
                      className={cx(smallInputCls, "w-full pl-9 sm:w-60")}
                    />
                  </label>

                  {current.verdicts.skip > 0 && (
                    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-700">
                      <input
                        type="checkbox"
                        checked={showSkipped}
                        onChange={(e) => setShowSkipped(e.target.checked)}
                        className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
                      />
                      Show the {current.verdicts.skip} skipped
                    </label>
                  )}
                </div>
              }
              empty={<Empty icon={Search} hue="slate" title="Nothing matches that." hint="Try a row number, a reference or a word from the task." />}
              renderCard={(r) => <RowCard row={r} />}
              renderListItem={(r) => <RowListItem row={r} />}
            />
          </section>
        </>
      )}

      {/* ---------------------------- history --------------------------- */}

      {history.length > 0 && (
        <section aria-labelledby="import-history-title">
          <div className="mb-3 flex items-center gap-3">
            <IconTile icon={History} hue="sun" size={36} />
            <div>
              <h3 id="import-history-title" className="text-[15px] font-semibold text-neutral-900">
                Past imports
              </h3>
              <p className="text-xs text-neutral-500">Where the work on this board came from.</p>
            </div>
          </div>

          <DataView
            rows={history}
            columns={historyColumns({
              currentId: current?.id ?? null,
              onResume: (id) =>
                void importsApi
                  .get(project.slug, id)
                  .then((res) => setCurrent(res.data))
                  .catch(() => setError("That import did not load.")),
            })}
            rowKey={(r) => r.id}
            storageKey="projects.import.history"
            caption="Earlier imports into this project"
            searchPlaceholder="Search files"
            gridCols={3}
          />
        </section>
      )}

      {history.length === 0 && current === null && (
        <Panel bodyClassName="p-0">
          <Empty
            icon={Upload}
            hue="sky"
            title="Nothing has been imported yet"
            hint="A sprint backlog spreadsheet is usually the fastest way to fill a new board."
          />
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pieces                                                             */
/* ------------------------------------------------------------------ */

function Step({
  n,
  icon,
  hue,
  title,
  children,
}: {
  n: number;
  icon: LucideIcon;
  hue: Hue;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex flex-col rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-4">
      <div className="mb-3 flex items-center gap-3">
        <IconTile icon={icon} hue={hue} size={38} />
        <div className="min-w-0">
          <p className={cx("text-[11px] font-semibold uppercase tracking-wide", HUE[hue].text)}>
            Step {n}
          </p>
          <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
        </div>
      </div>
      <div className="flex-1 text-[13px] leading-relaxed text-neutral-600">{children}</div>
    </li>
  );
}

function ReviewActions({
  current,
  busy,
  onDiscard,
  onCommit,
}: {
  current: Import;
  busy: string | null;
  onDiscard: () => Promise<void>;
  onCommit: () => Promise<void>;
}) {
  const label =
    busy === "commit"
      ? "Importing…"
      : `Import ${current.counts.importable} ${current.counts.importable === 1 ? "task" : "tasks"}`;

  return (
    <>
      <Button onClick={() => void onDiscard()} disabled={busy !== null}>
        Discard
      </Button>
      <Button
        variant="primary"
        icon={busy === "commit" ? Loader2 : CheckCircle2}
        onClick={() => void onCommit()}
        disabled={busy !== null || current.counts.importable === 0}
      >
        {label}
      </Button>
    </>
  );
}

function VerdictChip({ verdict }: { verdict: RowVerdict }) {
  const v = VERDICT[verdict];

  return (
    <Chip hue={v.hue} icon={v.icon} className="!px-2 !py-0.5 text-[11px]">
      {v.label}
    </Chip>
  );
}

/**
 * The note about the assignee, when the assignee is what it is about.
 *
 * Pulled out of the row's reasons so it sits in the assignee cell, beside the
 * name that did not match, rather than under the task title where somebody
 * has to connect the two. Every note is still shown exactly once.
 */
function assigneeNote(row: ImportRow): string | null {
  if (row.verdict === "skip" || row.assignee === null || row.assigneeId !== null) return null;

  return row.reasons.find((r) => /unassigned/i.test(r)) ?? null;
}

function otherReasons(row: ImportRow): string[] {
  const note = assigneeNote(row);

  return note === null ? row.reasons : row.reasons.filter((r) => r !== note);
}

/**
 * Who a row goes to, as a person.
 *
 * A User ID from the template's Members tab arrives as an opaque string; the
 * preview shows the person it resolved to, with what was written kept beneath
 * in small type so a wrong paste can still be spotted. An assignee that
 * matched nobody is flagged in words, with the reason, and comes in unassigned.
 */
function AssigneeCell({ row }: { row: ImportRow }) {
  const raw = row.assignee;

  if (row.assigneeId !== null) {
    const name = row.assigneeName ?? raw ?? "Project member";
    const showRaw = raw !== null && raw.trim().toLowerCase() !== name.trim().toLowerCase();

    return (
      <div className="flex min-w-0 max-w-[12rem] items-center gap-2.5">
        <NameAvatar name={name} size={28} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">{name}</p>
          {showRaw && (
            <p className="truncate font-mono text-[11px] text-neutral-500" title="As written in the sheet">
              {raw}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (raw === null) return <span className="text-neutral-400">—</span>;

  if (row.verdict === "skip") {
    return <span className="line-clamp-2 max-w-[12rem] text-xs text-neutral-500">{raw}</span>;
  }

  const note = assigneeNote(row);

  return (
    <div className="min-w-0 max-w-[12rem]">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip hue="coral" icon={UserX} className="!px-2 !py-0.5 text-[11px]">
          Not matched
        </Chip>
        <span className="truncate font-mono text-[11px] text-neutral-600">{raw}</span>
      </div>
      {note !== null && <p className="mt-1 text-[11px] leading-snug text-coral-700">{note}</p>}
    </div>
  );
}

/*
  The reason, beside the row it is about. A summary count would tell somebody
  six rows were skipped; this tells them which and why, which is the only
  version they can act on.
*/
function Reasons({ row }: { row: ImportRow }) {
  const reasons = otherReasons(row);

  if (reasons.length === 0) return null;

  return (
    <ul className="mt-1 space-y-0.5">
      {reasons.map((reason) => (
        <li
          key={reason}
          className={cx(
            "text-[11px] leading-snug",
            row.verdict === "skip" ? "text-neutral-500" : "text-sun-700",
          )}
        >
          {reason}
        </li>
      ))}
    </ul>
  );
}

/*
  Epics are optional, and most sheets have none - so the counts only mention
  them when there is one, rather than reading "0 epics" on every flat backlog.
*/
function epicsOf(i: Import): number {
  return i.counts.epics ?? i.epicCount ?? 0;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function hierarchyLine(i: Import): string {
  const stories = plural(i.counts.stories, "story", "stories");
  const epics = epicsOf(i);

  return epics > 0 ? `${plural(epics, "epic", "epics")} · ${stories}` : stories;
}

function epicHint(epics: number): string {
  return epics > 0 ? `under ${plural(epics, "epic", "epics")}` : "No epics — they are optional";
}

/**
 * The epic above a row's story, as a tag in the epic's own colour.
 *
 * `hueFor` keeps one epic one colour down the whole preview, so a block of
 * rows under the same epic reads as a block without anybody comparing names.
 */
function EpicTag({ epic }: { epic: string }) {
  return (
    <Chip hue={hueFor(epic)} icon={Layers} className="max-w-[12rem]">
      <span className="sr-only">Epic: </span>
      <span className="truncate" title={epic}>
        {epic}
      </span>
    </Chip>
  );
}

/** Epic over story: the hierarchy the row will land in, top down. */
function StoryCell({ row }: { row: ImportRow }) {
  if (!row.story && !row.epic) {
    return <span className="text-neutral-400">—</span>;
  }

  return (
    <div className="flex max-w-[12rem] flex-col items-start gap-1">
      {row.epic && <EpicTag epic={row.epic} />}
      {row.story ? (
        <span className="line-clamp-2 text-[13px] text-neutral-600">{row.story}</span>
      ) : (
        <span className="text-[13px] text-neutral-400">—</span>
      )}
    </div>
  );
}

function RowTitle({ row }: { row: ImportRow }) {
  const skipped = row.verdict === "skip";

  return (
    <div className="min-w-[12rem] max-w-[20rem]">
      <span className={cx("text-sm", skipped ? "text-neutral-500" : "font-medium text-neutral-900")}>
        {row.title ?? "—"}
      </span>
      <Reasons row={row} />
    </div>
  );
}

/*
  Sized to fit a 1440px screen without scrolling sideways (P24): the row and
  its ref share a column, status and due date share one, and every free-text
  cell is capped so a long title or a pasted user id wraps or truncates
  instead of pushing Due and Verdict off the right edge.
*/
const rowColumns: Column<ImportRow>[] = [
  {
    key: "row",
    header: "Row",
    value: (r) => r.row,
    sortable: true,
    render: (r) => (
      <span className="flex flex-col items-start gap-1">
        <span className="font-mono text-[11px] text-neutral-500">{r.row}</span>
        {r.taskRef && (
          <span className="whitespace-nowrap">
            <ItemRef value={r.taskRef} />
          </span>
        )}
      </span>
    ),
    tableOnly: true,
  },
  {
    key: "title",
    header: "Task",
    primary: true,
    value: (r) => r.title,
    sortable: true,
    render: (r) => <RowTitle row={r} />,
  },
  {
    key: "story",
    header: "Epic · story",
    value: (r) => [r.epic, r.story].filter(Boolean).join(" \u203a ") || null,
    hideOnMobile: true,
    render: (r) => <StoryCell row={r} />,
  },
  {
    key: "assignee",
    header: "Assignee",
    value: (r) => r.assigneeName ?? r.assignee,
    sortable: true,
    render: (r) => <AssigneeCell row={r} />,
  },
  {
    key: "due",
    header: "Status · due",
    value: (r) => r.dueOn,
    sortable: true,
    hideOnMobile: true,
    render: (r) => (
      <span className="flex flex-col gap-0.5">
        {r.statusText ? (
          <span className="whitespace-nowrap text-[13px] text-neutral-700">{r.statusText}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
        {r.dueOn && <span className="whitespace-nowrap text-[11px] text-neutral-500">Due {fmtDate(r.dueOn)}</span>}
      </span>
    ),
  },
  {
    key: "verdict",
    header: "Verdict",
    value: (r) => VERDICT[r.verdict].label,
    render: (r) => <VerdictChip verdict={r.verdict} />,
  },
];

function RowCard({ row }: { row: ImportRow }) {
  return (
    <div className={cx("flex h-full flex-col gap-3 p-5", row.verdict === "skip" && "bg-neutral-50/60")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-neutral-500">Row {row.row}</span>
          {row.taskRef && <ItemRef value={row.taskRef} />}
        </span>
        <VerdictChip verdict={row.verdict} />
      </div>
      <RowTitle row={row} />
      {(row.story || row.epic) && (
        <div className="flex flex-col items-start gap-1.5">
          {row.epic && <EpicTag epic={row.epic} />}
          {row.story && <p className="line-clamp-2 text-xs text-neutral-500">{row.story}</p>}
        </div>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-neutral-100 pt-3">
        <AssigneeCell row={row} />
        {row.dueOn && (
          <span className="shrink-0 text-xs text-neutral-500">Due {fmtDate(row.dueOn)}</span>
        )}
      </div>
    </div>
  );
}

function RowListItem({ row }: { row: ImportRow }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-start">
      <span className="w-10 shrink-0 font-mono text-[11px] text-neutral-500">{row.row}</span>
      <div className="min-w-0 flex-1">
        <RowTitle row={row} />
      </div>
      <div className="shrink-0 sm:w-56">
        <AssigneeCell row={row} />
      </div>
      <div className="shrink-0">
        <VerdictChip verdict={row.verdict} />
      </div>
    </div>
  );
}

function historyColumns({
  currentId,
  onResume,
}: {
  currentId: string | null;
  onResume: (id: string) => void;
}): Column<Import>[] {
  return [
    {
      key: "file",
      header: "File",
      primary: true,
      value: (r) => r.filename,
      sortable: true,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={FileSpreadsheet} hue={r.status === "committed" ? "mint" : r.status === "failed" ? "coral" : "sky"} size={30} />
          <span className="truncate font-medium text-neutral-900">{r.filename}</span>
        </span>
      ),
    },
    {
      key: "result",
      header: "Result",
      value: (r) => (r.status === "committed" ? `${r.counts.created} created` : r.statusLabel),
      render: (r) =>
        r.status === "committed" ? (
          <Chip hue="mint" icon={Layers}>{`${r.counts.created} created`}</Chip>
        ) : (
          <Chip hue={r.status === "failed" ? "coral" : "slate"}>{r.statusLabel}</Chip>
        ),
    },
    {
      key: "by",
      header: "Uploaded by",
      value: (r) => r.uploadedBy ?? null,
      render: (r) =>
        r.uploadedBy != null ? (
          <span className="flex items-center gap-2">
            <NameAvatar name={r.uploadedBy} size={24} />
            <span className="text-[13px] text-neutral-700">{r.uploadedBy}</span>
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (r) =>
        r.isOpen && r.id !== currentId ? (
          <Button size="sm" onClick={() => onResume(r.id)}>
            Resume
          </Button>
        ) : null,
    },
  ];
}

/**
 * The sheet's columns, left to right.
 *
 * Taken from the mapping and the headers together, and sorted by spreadsheet
 * column order rather than by object key order — `AA` sorts before `B`
 * alphabetically and after it in a spreadsheet, and a mapping form whose
 * columns are in a different order from the file is one nobody can check.
 */
function orderedColumns(current: Import): string[] {
  const letters = new Set([...Object.keys(current.mapping), ...Object.keys(current.headers)]);

  return [...letters].sort((a, b) => index(a) - index(b));
}

function index(column: string): number {
  let n = 0;

  for (const letter of column.toUpperCase()) {
    n = n * 26 + (letter.charCodeAt(0) - 64);
  }

  return n;
}
