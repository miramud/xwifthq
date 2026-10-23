"use client";

import { useId, useState } from "react";
import { AlertTriangle, Check, CircleDashed, Download, FileText, Send, X } from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ErrorNote, FaceAvatar, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { UploadZone, fileSize, when } from "@/suite/finance/components/requests/ui";
import { day } from "@/suite/finance/lib/format";
import { attachmentHref, opsError, opsFieldErrors, type PackItem, type PackStatus, type StageEntry, type StageInput } from "@/lib/api/operations-travel-client";
import { MAIN_PATH, missingMandatory, needsApprovedPack, needsFollowUp, packSendable, stageMeta } from "./labels";

/* The pack's checklist, the road through the client's process, and recording a stage. */

/**
 * Each document the client wants, mandatory ones marked, with what is
 * attached and - while the pack can still change - a drop zone. Sending the
 * pack is refused until every mandatory document is in.
 */
export function PackChecklist({
  items,
  packStatus,
  canAttach,
  canSubmit,
  busyItem,
  itemErrors,
  onUpload,
  onSubmit,
}: {
  items: PackItem[];
  packStatus: PackStatus;
  canAttach: boolean;
  canSubmit: boolean;
  busyItem: string | null;
  itemErrors: Record<string, string>;
  onUpload: (itemId: string, file: File) => void;
  onSubmit: () => Promise<void>;
}) {
  const missing = missingMandatory(items);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendable = packSendable(packStatus);
  const attached = items.filter((i) => i.attachment).length;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
    } catch (e) {
      setError(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        <span className="font-semibold tabular-nums text-neutral-900">
          {attached} of {items.length}
        </span>{" "}
        documents attached{missing.length > 0 ? `; ${missing.length} mandatory still missing.` : "."}
      </p>
      <ul className="space-y-3">
        {items.map((item) => {
          const has = Boolean(item.attachment);
          const gap = item.mandatory && !has;
          return (
            <li
              key={item.id}
              className={cx("rounded-2xl border p-4", gap ? "border-sun-500/40 bg-sun-50/40" : has ? "border-mint-500/30 bg-mint-50/30" : "border-neutral-200/80 bg-white")}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cx(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    has ? "bg-mint-500 text-white" : gap ? "bg-sun-100 text-sun-700" : "bg-neutral-100 text-neutral-500",
                  )}
                >
                  {has ? <Check size={14} aria-hidden /> : gap ? <AlertTriangle size={14} aria-hidden /> : <CircleDashed size={14} aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
                    {item.label}
                    <Chip hue={item.mandatory ? (has ? "mint" : "sun") : "slate"} className="!px-2 !py-0.5 !text-[11px]">
                      {item.mandatory ? (has ? "Mandatory · attached" : "Mandatory") : has ? "Optional · attached" : "Optional"}
                    </Chip>
                  </p>
                  {item.attachment && (
                    <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-neutral-200/80 bg-white px-3 py-2">
                      <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", HUE.sky.soft)}>
                        <FileText size={15} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">{item.attachment.name}</span>
                        <span className="block truncate text-xs text-neutral-500">
                          {fileSize(item.attachment.size)}
                          {item.attachment.uploadedBy ? ` · ${item.attachment.uploadedBy}` : ""}
                          {item.attachment.uploadedAt ? ` · ${day(item.attachment.uploadedAt)}` : ""}
                        </span>
                      </span>
                      <a
                        href={attachmentHref(item.attachment.id)}
                        aria-label={`Download ${item.attachment.name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <Download size={16} aria-hidden />
                      </a>
                    </div>
                  )}
                  {canAttach && (
                    <div className="mt-3">
                      <UploadZone
                        compact
                        label={has ? `Replace the ${item.label.toLowerCase()}` : `Attach the ${item.label.toLowerCase()}`}
                        hint="Drag a file here, or choose one. Up to 50 MB."
                        busy={busyItem === item.id}
                        onFile={(f) => onUpload(item.id, f)}
                      />
                    </div>
                  )}
                  {itemErrors[item.id] && (
                    <p role="alert" className="mt-2 text-xs font-medium text-error-700">
                      {itemErrors[item.id]}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {sendable && canSubmit && (
        <div className="rounded-2xl bg-neutral-50 p-4">
          {missing.length > 0 ? (
            <p className="mb-3 flex items-start gap-2 text-sm text-sun-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              Attach every mandatory document before sending the pack: {missing.join(", ")}.
            </p>
          ) : (
            <p className="mb-3 text-sm text-neutral-600">Everything mandatory is attached. The pack goes for approval before it is submitted to the client.</p>
          )}
          {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
          <Button variant="primary" icon={Send} disabled={busy || missing.length > 0} onClick={() => void send()}>
            {busy ? "Sending…" : packStatus === "rejected" ? "Send the pack again" : "Send the pack for approval"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The client's process as a road: stages reached in mint with a tick, the
 * current one in blue, the rest dashed. A query or a resubmission is a
 * detour, shown beside the road in its own colour and words.
 */
export function StageRoad({ stage, history }: { stage: string; history: StageEntry[] }) {
  const reached = Math.max(0, ...history.map((h) => MAIN_PATH.indexOf(h.stage)), MAIN_PATH.indexOf(stage));
  const onRoad = MAIN_PATH.includes(stage);
  const detour = !onRoad ? stageMeta(stage) : null;
  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Where the request is with the client">
        {MAIN_PATH.map((s, i) => {
          const m = stageMeta(s);
          // Paid is the end of the road: reached, not "here now".
          const current = onRoad && s === stage && stage !== "paid";
          const done = i < reached || (i === reached && !current);
          return (
            <li key={s} className="flex items-center gap-1" aria-current={current ? "step" : undefined}>
              <span
                className={cx(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
                  current ? "bg-primary-600 text-white" : done ? HUE.mint.soft : "border border-dashed border-neutral-300 text-neutral-500",
                )}
              >
                {done ? <Check size={13} aria-hidden /> : <span className="tabular-nums" aria-hidden>{i + 1}</span>}
                {m.label}
                <span className="sr-only">{current ? " (here now)" : done ? " (done)" : " (not yet)"}</span>
              </span>
              {i < MAIN_PATH.length - 1 && <span aria-hidden className={cx("h-px w-3 sm:w-4", done ? "bg-mint-500" : "bg-neutral-200")} />}
            </li>
          );
        })}
      </ol>
      {detour && (
        <p className={cx("inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold", HUE[detour.hue].soft)}>
          {stage === "closed" ? <X size={15} aria-hidden /> : <detour.icon size={15} aria-hidden />}
          Now: {detour.label}
          {stage === "queried" ? ", answer the client and resubmit" : ""}
        </p>
      )}
    </div>
  );
}

/** Every stage recorded, newest first, with who, whom and the next chase. */
export function StageHistory({ history }: { history: StageEntry[] }) {
  if (history.length === 0) return <p className="text-sm text-neutral-500">Nothing recorded yet.</p>;
  const rows = [...history].reverse();
  return (
    <div className="relative">
      <span className="absolute bottom-2 left-[15px] top-2 w-px bg-neutral-200" aria-hidden />
      <ol className="relative space-y-5">
        {rows.map((h, i) => {
          const m = stageMeta(h.stage, h.label);
          return (
            <li key={`${h.stage}-${h.enteredAt}-${i}`} className="relative flex gap-3">
              <span className={cx("relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white", HUE[m.hue].soft)}>
                <m.icon size={15} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm text-neutral-700">
                  <span className="font-semibold text-neutral-900">{h.label}</span>
                  {h.contact && <span className="text-neutral-500"> · with {h.contact}</span>}
                </p>
                {h.notes && <p className="mt-0.5 text-sm text-neutral-600">{h.notes}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1.5">
                    <FaceAvatar name={h.by ?? "System"} size={18} />
                    {h.by ?? "Finance (receipt matched)"}
                  </span>
                  <span>{when(h.enteredAt)}</span>
                  {h.nextFollowUpOn && <span>Follow up {day(h.nextFollowUpOn)}</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Record where the request is now. Every stage but paid and closed needs the
 * next follow-up date; submitting to the client needs the pack approved.
 */
export function StageForm({
  stages,
  current,
  packApproved,
  onSave,
}: {
  stages: Record<string, string>;
  current: string;
  packApproved: boolean;
  onSave: (input: StageInput) => Promise<void>;
}) {
  const uid = useId();
  const [stage, setStage] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options: SelectOption[] = Object.entries(stages).map(([value, label]) => ({
    value,
    label,
    hint: value === current ? "Where it is now" : needsApprovedPack(value) && !packApproved ? "Needs the pack approved first" : undefined,
    disabled: needsApprovedPack(value) && !packApproved,
  }));
  const required = needsFollowUp(stage);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!stage) found.stage = "Choose the stage.";
    if (required && !followUp) found.nextFollowUpOn = "Set the next follow-up date.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ stage, contact: contact.trim() || null, notes: notes.trim() || null, nextFollowUpOn: required ? followUp : null });
      setStage("");
      setContact("");
      setNotes("");
      setFollowUp("");
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4" aria-label="Record a stage">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-stage`} label="Stage">
          <SearchableSelect
            id={`${uid}-stage`}
            value={stage}
            onChange={setStage}
            options={options}
            placeholder="Where is it now?"
            searchPlaceholder="Search stages"
            aria-invalid={errors.stage ? true : undefined}
          />
          <FieldError message={errors.stage} />
        </Field>
        <Field id={`${uid}-contact`} label="Who you dealt with" hint="Optional">
          <input id={`${uid}-contact`} className={inputClass} value={contact} maxLength={160} onChange={(e) => setContact(e.target.value)} placeholder="Mr Adigun, Head of Library Services" />
        </Field>
      </div>
      <Field id={`${uid}-notes`} label="Notes" hint="Optional">
        <textarea id={`${uid}-notes`} rows={2} className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Verifying the kiosk count and training register." />
      </Field>
      <Field id={`${uid}-follow`} label="Next follow-up" hint={stage === "" ? undefined : required ? "Required" : "Not needed once paid or closed"}>
        <input
          id={`${uid}-follow`}
          type="date"
          className={cx(inputClass, "sm:max-w-xs")}
          value={followUp}
          disabled={stage !== "" && !required}
          aria-required={required || undefined}
          onChange={(e) => setFollowUp(e.target.value)}
          aria-invalid={errors.nextFollowUpOn ? true : undefined}
          aria-describedby={errors.nextFollowUpOn ? `${uid}-follow-err` : undefined}
        />
        <FieldError id={`${uid}-follow-err`} message={errors.nextFollowUpOn} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Recording…" : "Record the stage"}
        </Button>
      </div>
    </form>
  );
}
