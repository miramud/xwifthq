"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Paperclip, X } from "lucide-react";
import { Button, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { ErrorNote, Field, Switch, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { getJobTitlesServerState, getJobTitlesState, subscribeJobTitles } from "@/lib/api/job-titles-client";
import {
  repoError,
  repoFieldErrors,
  repository,
  type Audience,
  type ControlledDetail,
  type ControlledInput,
  type ControlledRow,
  type DocumentVersion,
} from "@/lib/api/repository-client";
import { fileSize, useRepoPickers } from "./parts";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { richExcerpt } from "@/lib/richText";

/* The forms of a controlled document: set it up, draft a new version, review one. */

function Footer({ onClose, busy, label, busyLabel = "Saving…", danger = false }: { onClose: () => void; busy: boolean; label: string; busyLabel?: string; danger?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy}>
        {busy ? busyLabel : label}
      </Button>
    </div>
  );
}

type Reach = "everyone" | "units" | "titles";

function reachOf(a: Audience | null | undefined): Reach {
  if (!a || a.everyone) return "everyone";
  if ((a.jobTitleIds ?? []).length > 0 && (a.unitIds ?? []).length === 0) return "titles";
  return "units";
}

/** A removable chip in a picked list. */
function PickedChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-primary-700">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-primary-100 focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}

/** Set up a controlled document, or change who it is for. */
export function ControlledDialog({
  doc,
  kinds,
  onClose,
  onDone,
}: {
  doc?: ControlledDetail;
  kinds: Record<string, string>;
  onClose: () => void;
  onDone: (d: ControlledRow) => void;
}) {
  const uid = useId();
  const pickers = useRepoPickers();
  const titles = useSyncExternalStore(subscribeJobTitles, getJobTitlesState, getJobTitlesServerState);
  const [code, setCode] = useState(doc?.code ?? "");
  const [title, setTitle] = useState(doc?.title ?? "");
  const [kind, setKind] = useState(doc?.kind ?? "policy");
  const [ownerUnitId, setOwnerUnitId] = useState(doc?.ownerUnitId ?? "");
  const [ownerId, setOwnerId] = useState(doc?.ownerId ?? "");
  const [ack, setAck] = useState(doc?.requiresAcknowledgement ?? true);
  const [reach, setReach] = useState<Reach>(reachOf(doc?.audience));
  const [unitIds, setUnitIds] = useState<string[]>(doc?.audience?.unitIds ?? []);
  const [titleIds, setTitleIds] = useState<string[]>(doc?.audience?.jobTitleIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unitName = useMemo(() => new Map((pickers.units ?? []).map((u) => [u.value, u.label])), [pickers.units]);
  const titleName = useMemo(() => new Map(titles.titles.map((t) => [t.id, t.name])), [titles.titles]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!code.trim()) next.code = "Give it a code, like HR-POL-004.";
    if (!title.trim()) next.title = "Give it a title.";
    if (reach === "units" && unitIds.length === 0) next.audience = "Choose at least one department, or send it to everyone.";
    if (reach === "titles" && titleIds.length === 0) next.audience = "Choose at least one job title, or send it to everyone.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const audience: Audience = reach === "everyone" ? { everyone: true, unitIds: [], jobTitleIds: [] } : reach === "units" ? { everyone: false, unitIds, jobTitleIds: [] } : { everyone: false, unitIds: [], jobTitleIds: titleIds };
    const input: ControlledInput = { code: code.trim(), title: title.trim(), kind, ownerUnitId: ownerUnitId || null, ownerId: ownerId || null, requiresAcknowledgement: ack, audience };
    setBusy(true);
    setError(null);
    try {
      onDone(doc ? await repository.controlled.update(doc.id, input) : await repository.controlled.create(input));
    } catch (err) {
      setErrors(repoFieldErrors(err));
      setError(repoError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      size="lg"
      titleId={`${uid}-title`}
      title={doc ? "Edit this controlled document" : "New controlled document"}
      subtitle={doc ? "Who it is for applies to the next version that is approved." : "Set it up, then draft its first version with the file."}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={doc ? "Save changes" : "Create document"} />}
    >
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field id={`${uid}-code`} label="Code">
          <input id={`${uid}-code`} className={cx(inputClass, "font-mono uppercase")} value={code} maxLength={40} onChange={(e) => setCode(e.target.value)} placeholder="HR-POL-004" aria-invalid={errors.code ? true : undefined} />
          <FieldError message={errors.code} />
        </Field>
        <Field id={`${uid}-ttl`} label="Title">
          <input id={`${uid}-ttl`} className={inputClass} value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} placeholder="Leave policy" aria-invalid={errors.title ? true : undefined} />
          <FieldError message={errors.title} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${uid}-kind`} label="Kind">
          <SearchableSelect id={`${uid}-kind`} value={kind} onChange={setKind} options={Object.entries(kinds).map(([value, label]) => ({ value, label }))} searchPlaceholder="Search" />
        </Field>
        <Field id={`${uid}-unit`} label="Owning department" hint="Optional">
          <SearchableSelect
            id={`${uid}-unit`}
            value={ownerUnitId}
            onChange={setOwnerUnitId}
            options={pickers.units ?? []}
            clearable
            clearLabel="None"
            placeholder={pickers.units === null ? "Loading…" : "Choose"}
            searchPlaceholder="Search departments"
          />
        </Field>
        <Field id={`${uid}-owner`} label="Owner" hint="Optional">
          <SearchableSelect
            id={`${uid}-owner`}
            value={ownerId}
            onChange={setOwnerId}
            options={pickers.people ?? []}
            clearable
            clearLabel="Nobody"
            placeholder={pickers.people === null ? "Loading…" : "Choose"}
            searchPlaceholder="Search people"
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">Who must read it</legend>
        <Segmented
          label="Who must read it"
          value={reach}
          onChange={setReach}
          options={[
            { key: "everyone", label: "Everyone" },
            { key: "units", label: "Departments" },
            { key: "titles", label: "Job titles" },
          ]}
        />
        {reach === "units" && (
          <div className="mt-3">
            <SearchableSelect
              aria-label="Add a department"
              value=""
              onChange={(v) => v && setUnitIds((l) => (l.includes(v) ? l : [...l, v]))}
              options={(pickers.units ?? []).filter((u) => !unitIds.includes(u.value))}
              placeholder={pickers.units === null ? "Loading departments…" : "Add a department"}
              searchPlaceholder="Search departments"
            />
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Departments it is for">
              {unitIds.map((id) => (
                <li key={id}>
                  <PickedChip label={unitName.get(id) ?? "Department"} onRemove={() => setUnitIds((l) => l.filter((x) => x !== id))} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {reach === "titles" && (
          <div className="mt-3">
            <label htmlFor={`${uid}-titles`} className="sr-only">
              Add a job title
            </label>
            <JobTitlePicker
              id={`${uid}-titles`}
              mode="id"
              value=""
              allowCreate={false}
              placeholder="Add a job title"
              onChange={(v) => v && setTitleIds((l) => (l.includes(v) ? l : [...l, v]))}
            />
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Job titles it is for">
              {titleIds.map((id) => (
                <li key={id}>
                  <PickedChip label={titleName.get(id) ?? "Job title"} onRemove={() => setTitleIds((l) => l.filter((x) => x !== id))} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <FieldError message={errors.audience} />
      </fieldset>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-neutral-800">Each person confirms they have read it</p>
          <p className="text-xs text-neutral-500">It appears under Policies to read until they do</p>
        </div>
        <Switch checked={ack} onChange={setAck} label="Each person confirms they have read it" />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

/** The next version: its file, what changed, who reviews it. */
export function DraftVersionDialog({ doc, meId, onClose, onDone }: { doc: ControlledDetail; meId: string | null; onClose: () => void; onDone: (v: DocumentVersion) => void }) {
  const uid = useId();
  const pickers = useRepoPickers();
  const [file, setFile] = useState<File | null>(null);
  const [bump, setBump] = useState<"major" | "minor">(doc.current ? "minor" : "major");
  const [summary, setSummary] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [effectiveOn, setEffectiveOn] = useState("");
  const [nextReviewOn, setNextReviewOn] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [maj, min] = (doc.current?.version ?? "0.0").split(".").map(Number);
  const nextVersion = !doc.current ? "1.0" : bump === "major" ? `${maj + 1}.0` : `${maj}.${min + 1}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!file) next.file = "Choose the file of this version.";
    if (!summary.trim()) next.changeSummary = "Say what changed.";
    if (effectiveOn && nextReviewOn && nextReviewOn <= effectiveOn) next.nextReviewOn = "The review comes after it takes effect.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError(null);
    try {
      onDone(
        await repository.controlled.draft(doc.id, {
          file: file as File,
          bump,
          changeSummary: summary.trim(),
          reviewerId: reviewerId || null,
          effectiveOn: effectiveOn || null,
          nextReviewOn: nextReviewOn || null,
        }),
      );
    } catch (err) {
      setErrors(repoFieldErrors(err));
      setError(repoError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      titleId={`${uid}-title`}
      title={`Draft version ${nextVersion}`}
      subtitle={`${doc.code} ${doc.title}. It stays a draft until you send it on.`}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Save draft" busyLabel="Uploading…" />}
    >
      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">The file</p>
        {file ? (
          <p className="flex items-center justify-between gap-2 rounded-2xl border border-neutral-200/80 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Paperclip size={15} className="shrink-0 text-neutral-500" aria-hidden />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-neutral-500">{fileSize(file.size)}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
              Remove
            </Button>
          </p>
        ) : (
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 px-3 text-sm font-semibold text-neutral-700 focus-within:ring-2 focus-within:ring-primary-300 hover:border-primary-300 hover:bg-primary-50/30">
            <Paperclip size={16} aria-hidden />
            Choose the file
            <input type="file" className="sr-only" aria-label="Choose the file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
        <FieldError message={errors.file} />
      </div>
      {doc.current && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">How big a change</p>
          <Segmented
            label="How big a change"
            value={bump}
            onChange={setBump}
            options={[
              { key: "minor", label: `Minor (${maj}.${min + 1})` },
              { key: "major", label: `Major (${maj + 1}.0)` },
            ]}
          />
          <p className="mt-1.5 text-xs text-neutral-500">A major change asks everybody to read it again.</p>
        </div>
      )}
      <Field id={`${uid}-sum`} label="What changed">
        <RichTextEditor id={`${uid}-sum`} value={summary} onChange={setSummary} placeholder="Carry-over of annual leave capped at 5 days." invalid={Boolean(errors.changeSummary)} />
        <FieldError message={errors.changeSummary} />
      </Field>
      <Field id={`${uid}-rev`} label="Reviewer" hint="Optional: without one it goes straight to approval">
        <SearchableSelect
          id={`${uid}-rev`}
          value={reviewerId}
          onChange={setReviewerId}
          options={(pickers.people ?? []).filter((p) => p.value !== meId)}
          clearable
          clearLabel="No reviewer"
          placeholder={pickers.people === null ? "Loading people…" : "Choose a reviewer"}
          searchPlaceholder="Search people"
          aria-invalid={errors.reviewerId ? true : undefined}
        />
        <FieldError message={errors.reviewerId} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-eff`} label="Takes effect" hint="Optional">
          <input id={`${uid}-eff`} type="date" className={inputClass} value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} />
        </Field>
        <Field id={`${uid}-next`} label="Next review" hint="Optional">
          <input id={`${uid}-next`} type="date" className={inputClass} value={nextReviewOn} onChange={(e) => setNextReviewOn(e.target.value)} aria-invalid={errors.nextReviewOn ? true : undefined} />
          <FieldError message={errors.nextReviewOn} />
        </Field>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

/** The named reviewer passes the version on to approval, or returns it to its author. */
export function ReviewDialog({ version, onClose, onDone }: { version: DocumentVersion; onClose: () => void; onDone: (v: DocumentVersion) => void }) {
  const uid = useId();
  const [decision, setDecision] = useState<"pass" | "return">("pass");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (decision === "return" && !note.trim()) {
          setFieldError("Say what needs changing.");
          return;
        }
        setBusy(true);
        setError(null);
        repository.controlled.review(version.id, decision === "pass", note.trim() || null).then(onDone, (err: unknown) => {
          setError(repoError(err));
          setBusy(false);
        });
      }}
      titleId={`${uid}-title`}
      title={`Review version ${version.version}`}
      subtitle={version.changeSummary ? richExcerpt(version.changeSummary, 200) : undefined}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={decision === "pass" ? "Pass to approval" : "Return to the author"} danger={decision === "return"} />}
    >
      <Segmented
        label="Your decision"
        value={decision}
        onChange={setDecision}
        options={[
          { key: "pass", label: "Pass it on" },
          { key: "return", label: "Return it" },
        ]}
      />
      <Field id={`${uid}-note`} label={decision === "pass" ? "Note for the approver" : "What needs changing"} hint={decision === "pass" ? "Optional" : "Required"}>
        <textarea id={`${uid}-note`} className={textareaClass} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={fieldError ? true : undefined} />
        <FieldError message={fieldError} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
