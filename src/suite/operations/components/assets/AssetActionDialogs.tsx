"use client";

import { useId, useState } from "react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { assets, opsError, opsFieldErrors, type AssetCondition, type AssetFull, type StatusChange } from "@/lib/api/operations-assets-client";
import { CONDITION, CONDITION_ORDER } from "./labels";
import { usePickerOptions } from "./parts";

/* The register's actions on one asset, each a small form. */

const conditionOptions = CONDITION_ORDER.map((c) => ({ value: c, label: CONDITION[c].label }));

function useAction(onDone: (a: AssetFull) => void) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<AssetFull>) => {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      onDone(await fn());
    } catch (e) {
      setErrors(opsFieldErrors(e));
      setError(opsError(e));
      setBusy(false);
    }
  };
  return { errors, error, busy, run, setErrors };
}

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

/** Tag a received asset: it gets its number and goes into store (and onto Finance's books if it is capital). */
export function TagDialog({ asset, onDone, onClose }: { asset: AssetFull; onDone: (a: AssetFull) => void; onClose: () => void }) {
  const uid = useId();
  const [location, setLocation] = useState(asset.location ?? "");
  const { error, busy, run } = useAction(onDone);
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => assets.tag(asset.id, location.trim() || null));
      }}
      titleId={`${uid}-title`}
      title="Tag this asset"
      subtitle={`${asset.name} gets the next ${asset.categoryCode ?? ""} tag number and goes into store.`}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Tag it" busyLabel="Tagging…" />}
    >
      <Field id={`${uid}-loc`} label="Where it is kept" hint="Optional">
        <input id={`${uid}-loc`} className={inputClass} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} placeholder="Abuja office, store room" />
      </Field>
      <p className="text-sm text-neutral-600">A capital asset in a category with a Finance class goes onto Finance&rsquo;s books at its cost when it is tagged.</p>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

/** Hand an asset in store to somebody; it is in transit until they sign the handover note. */
export function AllocateDialog({ asset, onDone, onClose }: { asset: AssetFull; onDone: (a: AssetFull) => void; onClose: () => void }) {
  const uid = useId();
  const { staff, projects } = usePickerOptions();
  const [toUserId, setToUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [location, setLocation] = useState("");
  const [accessories, setAccessories] = useState("");
  const [cond, setCond] = useState<AssetCondition>(asset.condition);
  const [note, setNote] = useState("");
  const { errors, error, busy, run, setErrors } = useAction(onDone);
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!toUserId) {
          setErrors({ toUserId: "Choose who receives it." });
          return;
        }
        void run(() =>
          assets.allocate(asset.id, {
            toUserId,
            projectId: projectId || null,
            location: location.trim() || null,
            accessories: accessories.trim() || null,
            condition: cond,
            note: note.trim() || null,
          }),
        );
      }}
      titleId={`${uid}-title`}
      title="Hand over this asset"
      subtitle="It shows as in transit until they sign the handover note in My assets."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Hand it over" busyLabel="Handing over…" />}
    >
      <Field id={`${uid}-to`} label="Who receives it">
        <SearchableSelect
          id={`${uid}-to`}
          value={toUserId}
          onChange={setToUserId}
          options={staff ?? []}
          placeholder={staff === null ? "Loading staff…" : "Choose a member of staff"}
          searchPlaceholder="Search staff"
          noOptionsText={staff === null ? "Loading staff…" : "No staff found."}
          aria-invalid={errors.toUserId ? true : undefined}
          aria-describedby={errors.toUserId ? `${uid}-to-err` : undefined}
        />
        <FieldError id={`${uid}-to-err`} message={errors.toUserId} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-project`} label="For a project" hint="Optional">
          <SearchableSelect
            id={`${uid}-project`}
            value={projectId}
            onChange={setProjectId}
            options={projects ?? []}
            clearable
            clearLabel="No project"
            placeholder={projects === null ? "Loading projects…" : "No project"}
            searchPlaceholder="Search projects"
          />
          <FieldError message={errors.projectId} />
        </Field>
        <Field id={`${uid}-cond`} label="Condition at handover">
          <SearchableSelect id={`${uid}-cond`} value={cond} onChange={(v) => setCond(v as AssetCondition)} options={conditionOptions} searchPlaceholder="Search conditions" />
        </Field>
      </div>
      <Field id={`${uid}-acc`} label="Accessories" hint="Optional">
        <input id={`${uid}-acc`} className={inputClass} value={accessories} maxLength={255} onChange={(e) => setAccessories(e.target.value)} placeholder="Charger, laptop bag, mouse" />
      </Field>
      <Field id={`${uid}-loc`} label="Where it will be" hint="Optional">
        <input id={`${uid}-loc`} className={inputClass} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} placeholder={asset.location ?? "Lagos office"} />
      </Field>
      <Field id={`${uid}-note`} label="Note" hint="Optional">
        <textarea id={`${uid}-note`} rows={2} className={textareaClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

/** Move an allocated asset to another person (they sign for it), a project or a place (at once). */
export function TransferDialog({ asset, onDone, onClose }: { asset: AssetFull; onDone: (a: AssetFull) => void; onClose: () => void }) {
  const uid = useId();
  const { staff, projects } = usePickerOptions();
  const [to, setTo] = useState<"person" | "place">("person");
  const [toUserId, setToUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [location, setLocation] = useState("");
  const [accessories, setAccessories] = useState("");
  const [cond, setCond] = useState<AssetCondition>(asset.condition);
  const [note, setNote] = useState("");
  const { errors, error, busy, run, setErrors } = useAction(onDone);
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (to === "person" && !toUserId) {
          setErrors({ toUserId: "Choose who receives it." });
          return;
        }
        if (to === "place" && !projectId && !location.trim()) {
          setErrors({ toUserId: "Say which project or where it is going." });
          return;
        }
        void run(() =>
          assets.transfer(asset.id, {
            toUserId: to === "person" ? toUserId : null,
            projectId: projectId || null,
            location: location.trim() || null,
            accessories: accessories.trim() || null,
            condition: cond,
            note: note.trim() || null,
          }),
        );
      }}
      titleId={`${uid}-title`}
      title="Transfer this asset"
      subtitle={asset.custodian ? `From ${asset.custodian}.` : undefined}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Transfer it" busyLabel="Transferring…" />}
    >
      <Segmented
        label="Transfer to"
        value={to}
        onChange={setTo}
        options={[
          { key: "person", label: "Another person" },
          { key: "place", label: "A project or place" },
        ]}
      />
      {to === "person" ? (
        <Field id={`${uid}-to`} label="Who receives it">
          <SearchableSelect
            id={`${uid}-to`}
            value={toUserId}
            onChange={setToUserId}
            options={(staff ?? []).filter((s) => s.value !== asset.custodianId)}
            placeholder={staff === null ? "Loading staff…" : "Choose a member of staff"}
            searchPlaceholder="Search staff"
            noOptionsText={staff === null ? "Loading staff…" : "No staff found."}
            aria-invalid={errors.toUserId ? true : undefined}
          />
          <p className="mt-1.5 text-xs text-neutral-500">It stays with {asset.custodian ?? "its holder"} until the receiver signs.</p>
        </Field>
      ) : (
        <p className="text-sm text-neutral-600">A move with nobody new to sign for it, to a client site say, takes effect at once.</p>
      )}
      <FieldError message={errors.toUserId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-project`} label="Project" hint="Optional">
          <SearchableSelect
            id={`${uid}-project`}
            value={projectId}
            onChange={setProjectId}
            options={projects ?? []}
            clearable
            clearLabel="No project"
            placeholder={projects === null ? "Loading projects…" : "No project"}
            searchPlaceholder="Search projects"
          />
          <FieldError message={errors.projectId} />
        </Field>
        <Field id={`${uid}-loc`} label="Location" hint={to === "place" ? "Or a project" : "Optional"}>
          <input id={`${uid}-loc`} className={inputClass} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} placeholder="Client site, Kano" />
        </Field>
        <Field id={`${uid}-cond`} label="Condition">
          <SearchableSelect id={`${uid}-cond`} value={cond} onChange={(v) => setCond(v as AssetCondition)} options={conditionOptions} searchPlaceholder="Search conditions" />
        </Field>
        <Field id={`${uid}-acc`} label="Accessories" hint="Optional">
          <input id={`${uid}-acc`} className={inputClass} value={accessories} maxLength={255} onChange={(e) => setAccessories(e.target.value)} />
        </Field>
      </div>
      <Field id={`${uid}-note`} label="Note" hint="Optional">
        <textarea id={`${uid}-note`} rows={2} className={textareaClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

/** Take an asset back into store, with its condition checked. */
export function ReturnDialog({ asset, onDone, onClose }: { asset: AssetFull; onDone: (a: AssetFull) => void; onClose: () => void }) {
  const uid = useId();
  const [cond, setCond] = useState<AssetCondition>(asset.condition);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const { error, busy, run } = useAction(onDone);
  const cancelling = asset.status === "in_transit" && asset.pendingHandover;
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => assets.returnToStore(asset.id, { condition: cond, location: location.trim() || null, note: note.trim() || null }));
      }}
      titleId={`${uid}-title`}
      title="Return to store"
      subtitle={cancelling ? `The handover ${asset.pendingHandover?.handoverNo ?? ""} to ${asset.pendingHandover?.to ?? "the receiver"} is cancelled.` : asset.custodian ? `From ${asset.custodian}.` : undefined}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Return it to store" busyLabel="Returning…" />}
    >
      <Field id={`${uid}-cond`} label="Condition it came back in">
        <SearchableSelect id={`${uid}-cond`} value={cond} onChange={(v) => setCond(v as AssetCondition)} options={conditionOptions} searchPlaceholder="Search conditions" />
      </Field>
      <Field id={`${uid}-loc`} label="Where it is kept now" hint="Optional">
        <input id={`${uid}-loc`} className={inputClass} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} placeholder={asset.location ?? "Store room"} />
      </Field>
      <Field id={`${uid}-note`} label="Note" hint="Optional">
        <textarea id={`${uid}-note`} rows={2} className={textareaClass} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Scratched lid; charger missing" />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

const STATUS_COPY: Record<Exclude<StatusChange, "back">, { title: string; button: string; noteLabel: string; required: boolean; hint: string }> = {
  under_maintenance: {
    title: "Send for maintenance",
    button: "Send for maintenance",
    noteLabel: "What is wrong, and who is fixing it",
    required: false,
    hint: "It stays with its holder on the register. Mark it back in service when it returns.",
  },
  lost: {
    title: "Report it lost",
    button: "Report it lost",
    noteLabel: "Incident report",
    required: true,
    hint: "Say what happened, when, and who was told. Finance decides any write-off.",
  },
  stolen: {
    title: "Report it stolen",
    button: "Report it stolen",
    noteLabel: "Incident report",
    required: true,
    hint: "Say what happened, when, who was told, and the police report number if there is one.",
  },
};

/** Maintenance, loss or theft, with the incident in words. */
export function StatusDialog({ asset, status, onDone, onClose }: { asset: AssetFull; status: Exclude<StatusChange, "back">; onDone: (a: AssetFull) => void; onClose: () => void }) {
  const uid = useId();
  const copy = STATUS_COPY[status];
  const [note, setNote] = useState("");
  const { errors, error, busy, run, setErrors } = useAction(onDone);
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (copy.required && !note.trim()) {
          setErrors({ note: "Write the incident report: what happened, when, and who was told." });
          return;
        }
        void run(() => assets.setStatus(asset.id, status, note.trim() || null));
      }}
      titleId={`${uid}-title`}
      title={copy.title}
      subtitle={`${asset.tagNo ?? ""} ${asset.name}`.trim()}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={copy.button} danger={status !== "under_maintenance"} />}
    >
      <p className="text-sm text-neutral-600">{copy.hint}</p>
      <Field id={`${uid}-note`} label={copy.noteLabel} hint={copy.required ? "Required" : "Optional"}>
        <textarea
          id={`${uid}-note`}
          rows={4}
          className={textareaClass}
          value={note}
          maxLength={5000}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? `${uid}-note-err` : undefined}
        />
        <FieldError id={`${uid}-note-err`} message={errors.note} />
      </Field>
      {error && !errors.note && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
