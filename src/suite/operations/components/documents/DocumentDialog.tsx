"use client";

import { useId, useMemo, useState } from "react";
import { Paperclip, Plus, X } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { repoError, repoFieldErrors, repository, type Confidentiality, type DocumentMetaInput, type RepoDocumentFull, type RetentionClass } from "@/lib/api/repository-client";
import { LEVEL, fileSize, useRepoPickers } from "./parts";

/**
 * File a document in the repository, or change what is recorded about one:
 * what it is, what it belongs to, its dates, who may see it and how long it
 * is kept.
 */

export interface RepoLists {
  categories: Record<string, string>;
  retention: Record<string, RetentionClass>;
}

export function retentionText(r: RetentionClass | undefined): string {
  if (!r) return "";
  if (r.years === null) return "Kept for good";
  return `${r.years} years from the ${r.from === "expiry" ? "expiry date" : "document date"}`;
}

export function DocumentDialog({ doc, lists, onClose, onDone }: { doc?: RepoDocumentFull; lists: RepoLists; onClose: () => void; onDone: (d: RepoDocumentFull) => void }) {
  const uid = useId();
  const pickers = useRepoPickers();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(doc?.title ?? "");
  const [category, setCategory] = useState(doc?.category ?? "");
  const [docType, setDocType] = useState(doc?.docType ?? "");
  const [reference, setReference] = useState(doc?.reference ?? "");
  const [projectId, setProjectId] = useState(doc?.projectId ?? "");
  const [counterpartyId, setCounterpartyId] = useState(doc?.counterpartyId ?? "");
  const [unitId, setUnitId] = useState(doc?.unitId ?? "");
  const [documentDate, setDocumentDate] = useState(doc?.documentDate ?? "");
  const [effectiveOn, setEffectiveOn] = useState(doc?.effectiveOn ?? "");
  const [expiresOn, setExpiresOn] = useState(doc?.expiresOn ?? "");
  const [level, setLevel] = useState<Confidentiality>(doc?.confidentiality ?? "public_internal");
  const [retention, setRetention] = useState(doc?.retentionClass ?? "general");
  const [allowed, setAllowed] = useState<string[]>(doc?.allowedUserIds ?? []);
  const [tags, setTags] = useState<string[]>(doc?.tags ?? []);
  const [tag, setTag] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const peopleName = useMemo(() => new Map((pickers.people ?? []).map((p) => [p.value, p.label])), [pickers.people]);

  const addTag = () => {
    const t = tag.trim().slice(0, 40);
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTag("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!doc && !file) next.file = "Choose the file to upload.";
    if (file && file.size > 25 * 1024 * 1024) next.file = "Files up to 25 MB.";
    if (!category) next.category = "Choose a category.";
    if (doc && !title.trim()) next.title = "Give it a title.";
    if (level === "restricted" && allowed.length === 0) next.allowedUserIds = "Name at least one person who may see it.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const meta: DocumentMetaInput = {
      title: title.trim() || undefined,
      category,
      docType: docType.trim() || null,
      reference: reference.trim() || null,
      projectId: projectId || null,
      counterpartyId: counterpartyId || null,
      unitId: unitId || null,
      documentDate: documentDate || null,
      effectiveOn: effectiveOn || null,
      expiresOn: expiresOn || null,
      confidentiality: level,
      retentionClass: retention,
      tags,
      allowedUserIds: level === "restricted" ? allowed : doc ? [] : undefined,
    };
    setBusy(true);
    setError(null);
    try {
      onDone(doc ? await repository.update(doc.id, meta) : await repository.upload(file as File, meta));
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
      title={doc ? "Edit the details" : "Upload a document"}
      subtitle={doc ? doc.fileName : "Up to 25 MB. PDFs and text files are searchable by what they say."}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? (doc ? "Saving…" : "Uploading…") : doc ? "Save details" : "Upload document"}
          </Button>
        </div>
      }
    >
      {!doc && (
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
            <label className="flex min-h-[4.5rem] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 px-3 text-sm font-semibold text-neutral-700 focus-within:ring-2 focus-within:ring-primary-300 hover:border-primary-300 hover:bg-primary-50/30">
              <Paperclip size={16} aria-hidden />
              Choose a file
              <input
                type="file"
                className="sr-only"
                aria-label="Choose a file"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
                }}
              />
            </label>
          )}
          <FieldError message={errors.file} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-ttl`} label="Title" hint={doc ? undefined : "Defaults to the file name"} className="sm:col-span-2">
          <input id={`${uid}-ttl`} className={inputClass} value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} aria-invalid={errors.title ? true : undefined} />
          <FieldError message={errors.title} />
        </Field>
        <Field id={`${uid}-cat`} label="Category">
          <SearchableSelect
            id={`${uid}-cat`}
            value={category}
            onChange={setCategory}
            options={Object.entries(lists.categories).map(([value, label]) => ({ value, label }))}
            placeholder="Choose a category"
            searchPlaceholder="Search categories"
            aria-invalid={errors.category ? true : undefined}
          />
          <FieldError message={errors.category} />
        </Field>
        <Field id={`${uid}-type`} label="Type" hint="Optional">
          <input id={`${uid}-type`} className={inputClass} value={docType} maxLength={64} onChange={(e) => setDocType(e.target.value)} placeholder="Contract, lease, licence…" />
        </Field>
        <Field id={`${uid}-ref`} label="Reference" hint="Optional">
          <input id={`${uid}-ref`} className={inputClass} value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="CTR/2026/014" />
        </Field>
        <Field id={`${uid}-proj`} label="Project" hint="Optional">
          <SearchableSelect
            id={`${uid}-proj`}
            value={projectId}
            onChange={setProjectId}
            options={pickers.projects ?? []}
            clearable
            clearLabel="No project"
            placeholder={pickers.projects === null ? "Loading projects…" : "Choose a project"}
            searchPlaceholder="Search projects"
            noOptionsText={pickers.projects === null ? "Loading projects…" : "No projects found."}
          />
        </Field>
        <Field id={`${uid}-cp`} label="Client or vendor" hint="Optional">
          <SearchableSelect
            id={`${uid}-cp`}
            value={counterpartyId}
            onChange={setCounterpartyId}
            options={pickers.counterparties ?? []}
            clearable
            clearLabel="None"
            placeholder={pickers.counterparties === null ? "Loading…" : "Choose a client or vendor"}
            searchPlaceholder="Search clients and vendors"
            noOptionsText={pickers.counterparties === null ? "Loading…" : "None found."}
          />
        </Field>
        <Field id={`${uid}-unit`} label="Department" hint="Optional">
          <SearchableSelect
            id={`${uid}-unit`}
            value={unitId}
            onChange={setUnitId}
            options={pickers.units ?? []}
            clearable
            clearLabel="None"
            placeholder={pickers.units === null ? "Loading…" : "Choose a department"}
            searchPlaceholder="Search departments"
            noOptionsText={pickers.units === null ? "Loading…" : "None found."}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${uid}-dd`} label="Document date">
          <input id={`${uid}-dd`} type="date" className={inputClass} value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
        </Field>
        <Field id={`${uid}-eff`} label="Effective from">
          <input id={`${uid}-eff`} type="date" className={inputClass} value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} />
        </Field>
        <Field id={`${uid}-exp`} label="Expires on">
          <input id={`${uid}-exp`} type="date" className={inputClass} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">Who can see it</legend>
        <div role="radiogroup" aria-label="Confidentiality" className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(LEVEL) as Confidentiality[]).map((l) => {
            const m = LEVEL[l];
            const on = level === l;
            const Icon = m.icon;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setLevel(l)}
                className={cx(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-2xl border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                  on ? "border-primary-500 bg-primary-50/70 ring-1 ring-primary-500" : "border-neutral-200/80 hover:border-neutral-300 hover:bg-neutral-50",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-neutral-900">
                  <Icon size={15} aria-hidden />
                  {m.label}
                </span>
                <span className="text-[11px] leading-snug text-neutral-500">{m.hint}</span>
              </button>
            );
          })}
        </div>
        {level === "restricted" && (
          <div className="mt-3 rounded-2xl bg-rose-50/60 p-3.5">
            <Field id={`${uid}-allowed`} label="People allowed to see it">
              <SearchableSelect
                id={`${uid}-allowed`}
                value=""
                onChange={(v) => v && setAllowed((a) => (a.includes(v) ? a : [...a, v]))}
                options={(pickers.people ?? []).filter((p) => !allowed.includes(p.value))}
                placeholder={pickers.people === null ? "Loading people…" : "Add a person"}
                searchPlaceholder="Search people"
                noOptionsText={pickers.people === null ? "Loading people…" : "No one else to add."}
                aria-invalid={errors.allowedUserIds ? true : undefined}
              />
            </Field>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="People allowed">
              {allowed.length === 0 && <li className="text-xs text-neutral-600">Nobody yet. Admins and the document desk always can.</li>}
              {allowed.map((id) => (
                <li key={id}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white py-1 pl-2.5 pr-1 text-xs font-semibold text-neutral-800 ring-1 ring-neutral-200">
                    {peopleName.get(id) ?? "Someone"}
                    <button
                      type="button"
                      aria-label={`Remove ${peopleName.get(id) ?? "this person"}`}
                      onClick={() => setAllowed((a) => a.filter((x) => x !== id))}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <FieldError message={errors.allowedUserIds} />
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-ret`} label="Kept for">
          <SearchableSelect
            id={`${uid}-ret`}
            value={retention}
            onChange={setRetention}
            options={Object.entries(lists.retention).map(([value, r]) => ({ value, label: r.label, hint: retentionText(r) }))}
            searchPlaceholder="Search retention classes"
          />
          <p className="mt-1.5 text-xs text-neutral-500">{retentionText(lists.retention[retention])}</p>
        </Field>
        <Field id={`${uid}-tag`} label="Tags" hint="Optional">
          <div className="flex gap-2">
            <input
              id={`${uid}-tag`}
              className={inputClass}
              value={tag}
              maxLength={40}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="lease, Abuja"
            />
            <Button icon={Plus} onClick={addTag} disabled={!tag.trim()} aria-label="Add tag" />
          </div>
          {tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
              {tags.map((t) => (
                <li key={t}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pl-2.5 pr-1 text-xs font-semibold text-neutral-700">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t}`}
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Field>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
