"use client";

import { useId, useState } from "react";
import { Send, Wrench } from "lucide-react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { help, opsError, opsFieldErrors, type CatalogueField, type HelpCatalogue, type HelpItem, type TicketFull, type TicketPriority } from "@/lib/api/operations-desk-client";
import { CategoryIcon } from "@/suite/operations/components/desk/parts";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Ask the desk for one thing from the catalogue (or something not on it):
 * a title, what is needed, the item's own questions, and (for a fault)
 * where it is or which of my assets, so it can go straight to maintenance.
 */
export default function RaiseDialog({ item, catalogue, onClose, onDone }: { item: HelpItem | null; catalogue: HelpCatalogue; onClose: () => void; onDone: (t: TicketFull) => void }) {
  const uid = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [facilityId, setFacilityId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fault = item?.routesTo === "work_order";
  const where = fault || item?.category === "facilities";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Say briefly what you need.";
    for (const f of item?.fields ?? []) if (f.required && !(answers[f.key] ?? "").trim()) next[`answers.${f.key}`] = `${f.label} is needed.`;
    if (fault && !facilityId && !assetId) next.facilityId = "Say where it is, or which of your assets.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => v.trim() !== ""));
      onDone(
        await help.raise({
          catalogueId: item?.id ?? null,
          title: title.trim(),
          description: description.trim() || null,
          ...(Object.keys(clean).length ? { answers: clean } : {}),
          priority,
          facilityId: facilityId || null,
          assetId: assetId || null,
        }),
      );
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      size="lg"
      titleId={`${uid}-t`}
      title={item?.name ?? "Something else"}
      subtitle={item ? `${item.description ?? ""} Answered within ${item.slaHours} hours.`.trim() : "Tell the desk what you need and they will route it."}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-neutral-500">{fault ? "A fault goes straight to maintenance as a work order." : "You can follow it under My requests."}</span>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" icon={fault ? Wrench : Send} disabled={busy}>
              {busy ? "Sending…" : fault ? "Report the fault" : "Send the request"}
            </Button>
          </div>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      {item && (
        <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
          <CategoryIcon category={item.category} size={36} />
          <p className="text-sm text-neutral-700">{catalogue.categories[item.category] ?? item.category}</p>
        </div>
      )}
      <Field id={`${uid}-ti`} label="In a line">
        <input id={`${uid}-ti`} className={inputClass} value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} placeholder={fault ? "AC in the board room is not cooling" : "What do you need?"} aria-invalid={errors.title ? true : undefined} />
        <FieldError message={errors.title} />
      </Field>
      <Field id={`${uid}-de`} label="Details" hint="Optional">
        <RichTextEditor id={`${uid}-de`} value={description} onChange={setDescription} />
      </Field>

      {(item?.fields ?? []).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(item?.fields ?? []).map((f) => (
            <AnswerField key={f.key} id={`${uid}-a-${f.key}`} field={f} value={answers[f.key] ?? ""} error={errors[`answers.${f.key}`]} onChange={(v) => setAnswers((a) => ({ ...a, [f.key]: v }))} />
          ))}
        </div>
      )}

      {where && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-fa`} label="Where" hint={fault ? "Or choose an asset" : "Optional"}>
            <SearchableSelect
              id={`${uid}-fa`}
              value={facilityId}
              onChange={setFacilityId}
              options={catalogue.facilities.map((f) => ({ value: f.id, label: f.name }))}
              clearable
              placeholder="Choose the site"
              noOptionsText="No sites on record"
              aria-invalid={errors.facilityId ? true : undefined}
            />
            <FieldError message={errors.facilityId} />
          </Field>
          <Field id={`${uid}-as`} label="Which of my assets" hint="Optional">
            <SearchableSelect
              id={`${uid}-as`}
              value={assetId}
              onChange={setAssetId}
              options={catalogue.myAssets.map((a) => ({ value: a.id, label: a.name ?? a.tagNo ?? "Asset", hint: a.tagNo ?? undefined }))}
              clearable
              placeholder="None"
              noOptionsText="You hold no assets"
            />
          </Field>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">How urgent</p>
        <Segmented
          label="How urgent"
          value={priority}
          onChange={setPriority}
          options={[
            { key: "low", label: "Low" },
            { key: "normal", label: "Normal" },
            { key: "high", label: "High" },
            { key: "critical", label: "Critical" },
          ]}
        />
      </div>
    </DialogFrame>
  );
}

function AnswerField({ id, field: f, value, error, onChange }: { id: string; field: CatalogueField; value: string; error?: string; onChange: (v: string) => void }) {
  const hint = f.required ? "Required" : "Optional";
  return (
    <Field id={id} label={f.label} hint={hint} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
      {f.type === "textarea" ? (
        <textarea id={id} rows={3} className={textareaClass} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
      ) : f.type === "select" ? (
        <SearchableSelect id={id} value={value} onChange={onChange} options={(f.options ?? []).map((o) => ({ value: o, label: o }))} placeholder="Choose" clearable={!f.required} aria-invalid={error ? true : undefined} />
      ) : (
        <input id={id} type={f.type === "date" ? "date" : "text"} inputMode={f.type === "number" ? "decimal" : undefined} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
      )}
      <FieldError message={error} />
    </Field>
  );
}
