"use client";

import { useId, useState } from "react";
import { Lock, Mailbox, Send, Upload } from "lucide-react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import {
  CHANNELS,
  correspondence,
  opsError,
  opsFieldErrors,
  type Channel,
  type Confidentiality,
  type Direction,
  type LetterFull,
  type LetterInput,
  type RegisterOptions,
} from "@/lib/api/operations-correspondence-client";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Log a letter on receipt (numbered at once, the scan filed, routed in the
 * same step if you know who acts on it), draft a letter to send (numbered
 * when it goes for approval), or edit either one's details.
 */
export default function LetterDialog({
  direction,
  options,
  registry,
  replyTargets = [],
  initial,
  presetReplyTo,
  onClose,
  onDone,
}: {
  direction: Direction;
  options: RegisterOptions | null;
  /** May mark it confidential. */
  registry: boolean;
  /** Letters received that this one may answer (outgoing only). */
  replyTargets?: SelectOption[];
  /** Editing this letter rather than adding one. */
  initial?: LetterFull;
  /** A new reply: the letter received it answers. */
  presetReplyTo?: string;
  onClose: () => void;
  onDone: (l: LetterFull) => void;
}) {
  const uid = useId();
  const incoming = direction === "incoming";
  const editing = Boolean(initial);
  const [f, setF] = useState({
    subject: initial?.subject ?? "",
    summary: initial?.summary ?? "",
    counterpartyId: initial?.counterpartyId ?? "",
    partyName: initial && !initial.counterpartyId ? (initial.party ?? "") : "",
    partyOrganisation: initial?.partyOrganisation ?? "",
    partyReference: initial?.partyReference ?? "",
    channel: (initial?.channel ?? "") as Channel | "",
    letterDate: initial?.letterDate ?? "",
    receivedOn: initial?.receivedOn ?? today(),
    addressee: initial?.addressee ?? "",
    orgUnitId: initial?.orgUnitId ?? "",
    projectId: initial?.projectId ?? "",
    confidentiality: (initial?.confidentiality ?? "normal") as Confidentiality,
    assigneeId: "",
    assignedUnitId: "",
    dueOn: "",
    note: "",
    signatoryId: initial?.signatoryId ?? "",
    inReplyToId: initial?.inReplyToId ?? presetReplyTo ?? "",
  });
  const [scan, setScan] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const staff: SelectOption[] = (options?.staff ?? []).map((s) => ({ value: s.id, label: s.name }));
  const units: SelectOption[] = (options?.units ?? []).map((u) => ({ value: u.id, label: u.name, hint: u.code ?? undefined }));
  const parties: SelectOption[] = (options?.parties ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined }));
  const projects: SelectOption[] = (options?.projects ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined }));
  const channels: SelectOption[] = Object.entries(options?.channels ?? CHANNELS).map(([value, label]) => ({ value, label }));
  const loading = options ? undefined : "Loading…";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!f.subject.trim()) next.subject = "Give the subject of the letter.";
    if (!f.counterpartyId && !f.partyName.trim()) next.counterpartyId = incoming ? "Choose who sent it, or type their name." : "Choose who it goes to, or type their name.";
    if (incoming && !f.channel) next.channel = "Say how it came.";
    if (incoming && f.receivedOn > today()) next.receivedOn = "It cannot have been received in the future.";
    if (scan && scan.size > 25 * 1024 * 1024) next.scan = "Files up to 25 MB.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const body: LetterInput = {
      subject: f.subject.trim(),
      summary: f.summary.trim() || null,
      counterpartyId: f.counterpartyId || null,
      partyName: f.counterpartyId ? null : f.partyName.trim() || null,
      partyOrganisation: f.partyOrganisation.trim() || null,
      partyReference: f.partyReference.trim() || null,
      channel: (f.channel || null) as Channel | null,
      letterDate: f.letterDate || null,
      addressee: f.addressee.trim() || null,
      orgUnitId: f.orgUnitId || null,
      projectId: f.projectId || null,
    };
    if (incoming) body.receivedOn = f.receivedOn || null;
    else {
      body.signatoryId = f.signatoryId || null;
      body.inReplyToId = f.inReplyToId || null;
    }
    if (!editing) {
      body.direction = direction;
      if (registry) body.confidentiality = f.confidentiality;
      if (incoming && (f.assigneeId || f.assignedUnitId)) {
        body.assigneeId = f.assigneeId || null;
        body.assignedUnitId = f.assignedUnitId || null;
        body.dueOn = f.dueOn || null;
        body.note = f.note.trim() || null;
      }
    }

    setBusy(true);
    setError(null);
    try {
      let saved = editing && initial ? await correspondence.update(initial.id, body) : await correspondence.create(body);
      if (scan) {
        try {
          saved = await correspondence.upload(saved.id, scan, incoming ? "scan" : "copy");
        } catch (err) {
          // The letter is logged; only the file needs another try, from its page.
          setError(`Saved as ${saved.reference ?? "a draft"}, but the file didn't upload: ${opsError(err)}`);
        }
      }
      onDone(saved);
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  const title = editing ? `Edit ${initial?.reference ?? "the draft"}` : incoming ? "Log a letter received" : "Draft a letter to send";
  const subtitle = editing
    ? "Change the details. The reference number stays."
    : incoming
      ? "It is numbered as soon as you save. Route it now if you know who acts on it."
      : "It takes its number when you send it for approval.";

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      size="lg"
      titleId={`${uid}-t`}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={incoming ? Mailbox : Send} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : incoming ? "Log the letter" : "Save the draft"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      <Field id={`${uid}-s`} label="Subject">
        <input id={`${uid}-s`} className={inputClass} value={f.subject} maxLength={255} onChange={(e) => set("subject", e.target.value)} placeholder={incoming ? "Accreditation visit: documents required" : "Re: Accreditation visit"} aria-invalid={errors.subject ? true : undefined} />
        <FieldError message={errors.subject} />
      </Field>

      <fieldset className="space-y-4 rounded-2xl border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-semibold text-neutral-900">{incoming ? "From" : "To"}</legend>
        <Field id={`${uid}-cp`} label="Client, vendor or agency" hint="Or type a name below">
          <SearchableSelect
            id={`${uid}-cp`}
            value={f.counterpartyId}
            onChange={(v) => set("counterpartyId", v)}
            options={parties}
            clearable
            placeholder="Choose from the register"
            noOptionsText={loading ?? "No clients or vendors on record"}
            aria-invalid={errors.counterpartyId ? true : undefined}
          />
          <FieldError message={errors.counterpartyId} />
        </Field>
        {!f.counterpartyId && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${uid}-pn`} label="Name">
              <input id={`${uid}-pn`} className={inputClass} value={f.partyName} maxLength={200} onChange={(e) => set("partyName", e.target.value)} placeholder="Mrs Funmi Adeyemi" />
            </Field>
            <Field id={`${uid}-po`} label="Organisation" hint="Optional">
              <input id={`${uid}-po`} className={inputClass} value={f.partyOrganisation} maxLength={200} onChange={(e) => set("partyOrganisation", e.target.value)} />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-pr`} label="Their reference" hint="Optional">
            <input id={`${uid}-pr`} className={inputClass} value={f.partyReference} maxLength={100} onChange={(e) => set("partyReference", e.target.value)} placeholder="NBTE/ACC/2026/118" />
          </Field>
          <Field id={`${uid}-ld`} label="Date on the letter" hint="Optional">
            <input id={`${uid}-ld`} type="date" className={inputClass} value={f.letterDate} onChange={(e) => set("letterDate", e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {incoming && (
          <Field id={`${uid}-ro`} label="Received on">
            <input id={`${uid}-ro`} type="date" className={inputClass} value={f.receivedOn} max={today()} onChange={(e) => set("receivedOn", e.target.value)} aria-invalid={errors.receivedOn ? true : undefined} />
            <FieldError message={errors.receivedOn} />
          </Field>
        )}
        <Field id={`${uid}-ch`} label={incoming ? "How it came" : "How it will go"} hint={incoming ? undefined : "Optional"}>
          <SearchableSelect id={`${uid}-ch`} value={f.channel} onChange={(v) => set("channel", v as Channel)} options={channels} placeholder="Choose" clearable={!incoming} aria-invalid={errors.channel ? true : undefined} />
          <FieldError message={errors.channel} />
        </Field>
        <Field id={`${uid}-ad`} label={incoming ? "Addressed to" : "Attention of"} hint="Optional">
          <input id={`${uid}-ad`} className={inputClass} value={f.addressee} maxLength={200} onChange={(e) => set("addressee", e.target.value)} placeholder={incoming ? "The Rector" : "The Executive Secretary"} />
        </Field>
        <Field id={`${uid}-un`} label={incoming ? "Unit it is for" : "Sending unit"} hint="Optional">
          <SearchableSelect id={`${uid}-un`} value={f.orgUnitId} onChange={(v) => set("orgUnitId", v)} options={units} clearable placeholder="None" noOptionsText={loading ?? "No units set up"} />
        </Field>
        <Field id={`${uid}-pj`} label="Project" hint="Optional">
          <SearchableSelect id={`${uid}-pj`} value={f.projectId} onChange={(v) => set("projectId", v)} options={projects} clearable placeholder="None" noOptionsText={loading ?? "No projects"} />
        </Field>
        {!incoming && (
          <Field id={`${uid}-sg`} label="Signed by" hint="Optional">
            <SearchableSelect id={`${uid}-sg`} value={f.signatoryId} onChange={(v) => set("signatoryId", v)} options={staff} clearable placeholder="Choose the signatory" noOptionsText={loading ?? "No staff"} />
          </Field>
        )}
      </div>

      {!incoming && (
        <Field id={`${uid}-rt`} label="In reply to" hint="Dispatching it closes that letter">
          <SearchableSelect id={`${uid}-rt`} value={f.inReplyToId} onChange={(v) => set("inReplyToId", v)} options={replyTargets} clearable placeholder="Not a reply" noOptionsText="No letters received to answer" aria-invalid={errors.inReplyToId ? true : undefined} />
          <FieldError message={errors.inReplyToId} />
        </Field>
      )}

      <Field id={`${uid}-su`} label={incoming ? "What it says" : "What it says, in brief"} hint="Optional">
        <RichTextEditor id={`${uid}-su`} minHeight={102} value={f.summary} onChange={(html) => set("summary", html)} />
      </Field>

      {!editing && (
        <Field id={`${uid}-sc`} label={incoming ? "Scanned copy" : "Copy of the letter"} hint="Optional, but keep one on file">
          <label htmlFor={`${uid}-sc`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-neutral-300 px-4 py-2.5 text-sm text-neutral-600 hover:border-primary-300 hover:bg-primary-50/40 focus-within:ring-2 focus-within:ring-primary-300">
            <Upload size={16} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{scan ? scan.name : "Choose a PDF or image"}</span>
            <input id={`${uid}-sc`} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.eml,.msg" onChange={(e) => setScan(e.target.files?.[0] ?? null)} />
          </label>
          <FieldError message={errors.scan} />
        </Field>
      )}

      {!editing && registry && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
            <Lock size={14} aria-hidden /> Confidentiality
          </p>
          <Segmented
            label="Confidentiality"
            value={f.confidentiality}
            onChange={(v) => set("confidentiality", v)}
            options={[
              { key: "normal", label: "Normal" },
              { key: "confidential", label: "Confidential" },
            ]}
          />
          <p className="mt-1.5 text-xs text-neutral-500">A confidential letter is seen only by the registry and whoever it is routed to.</p>
        </div>
      )}

      {!editing && incoming && (
        <fieldset className="space-y-4 rounded-2xl border border-neutral-200 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-900">Route it for action</legend>
          <p className="-mt-1 text-xs text-neutral-500">Optional now. Choose a person, or a unit and its head gets it.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${uid}-as`} label="Action officer">
              <SearchableSelect id={`${uid}-as`} value={f.assigneeId} onChange={(v) => set("assigneeId", v)} options={staff} clearable placeholder="Nobody yet" noOptionsText={loading ?? "No staff"} aria-invalid={errors.assigneeId ? true : undefined} />
              <FieldError message={errors.assigneeId} />
            </Field>
            <Field id={`${uid}-au`} label="Or a unit">
              <SearchableSelect id={`${uid}-au`} value={f.assignedUnitId} onChange={(v) => set("assignedUnitId", v)} options={units} clearable placeholder="None" noOptionsText={loading ?? "No units"} aria-invalid={errors.assignedUnitId ? true : undefined} />
              <FieldError message={errors.assignedUnitId} />
            </Field>
            <Field id={`${uid}-du`} label="Due by" hint="A week if left blank">
              <input id={`${uid}-du`} type="date" className={inputClass} value={f.dueOn} min={today()} onChange={(e) => set("dueOn", e.target.value)} aria-invalid={errors.dueOn ? true : undefined} />
              <FieldError message={errors.dueOn} />
            </Field>
            <Field id={`${uid}-no`} label="Minute" hint="Optional">
              <input id={`${uid}-no`} className={inputClass} value={f.note} maxLength={2000} onChange={(e) => set("note", e.target.value)} placeholder="Please treat and advise." />
            </Field>
          </div>
        </fieldset>
      )}
    </DialogFrame>
  );
}
