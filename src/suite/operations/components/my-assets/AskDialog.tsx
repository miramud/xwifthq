"use client";

import { useId, useState } from "react";
import { Button } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { todayYmd } from "@/components/workspace/Calendar";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { myAssets, opsError, opsFieldErrors, type AssetCategory, type AssetRequest, type MyAsset, type MyRequestKind } from "@/lib/api/operations-assets-client";
import { usePickerOptions } from "@/suite/operations/components/assets/parts";

/** What each kind of request is called on this form: what the person wants, not the desk's word for it. */
export const ASK_KINDS: { key: MyRequestKind; label: string; hint: string }[] = [
  { key: "replacement", label: "Report a fault and get a replacement", hint: "Something you hold is broken or not working properly." },
  { key: "allocation", label: "Ask for something new", hint: "Equipment you need for your work." },
  { key: "return", label: "Give something back", hint: "You no longer need it; Operations takes it back into store." },
  { key: "transfer", label: "Pass something to somebody else", hint: "To a colleague, a project or another place." },
  { key: "take_out", label: "Take something off-site for a while", hint: "You get a gate pass, and bring it back by a date." },
];

/** "Report a problem / ask for something": every kind of request staff raise about equipment, sent for approval. */
export default function AskDialog({
  held,
  categories,
  initialKind = "replacement",
  initialAssetId = "",
  onDone,
  onClose,
}: {
  held: MyAsset[];
  categories: AssetCategory[];
  initialKind?: MyRequestKind;
  initialAssetId?: string;
  onDone: (r: AssetRequest) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const { staff, projects } = usePickerOptions();
  const [kind, setKind] = useState<MyRequestKind>(held.length === 0 ? "allocation" : initialKind);
  const [assetId, setAssetId] = useState(initialAssetId);
  const [categoryId, setCategoryId] = useState("");
  const [reason, setReason] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [returnBy, setReturnBy] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsAsset = kind !== "allocation";
  const today = todayYmd();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (needsAsset && !assetId) local.assetId = "Choose which of your assets.";
    if (kind === "allocation" && !categoryId) local.categoryId = "Say what kind of asset you need.";
    if (kind === "replacement" && !reason.trim()) local.reason = "Say what is wrong with it.";
    if (kind === "take_out" && !returnBy) local.returnBy = "Say when it comes back.";
    if (kind === "take_out" && returnBy && returnBy < today) local.returnBy = "The return date cannot be in the past.";
    if (kind === "transfer" && !toUserId && !projectId && !toLocation.trim()) local.toUserId = "Say who, which project or where it is going.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      onDone(
        await myAssets.request({
          kind,
          assetId: needsAsset ? assetId : null,
          categoryId: kind === "allocation" ? categoryId : null,
          reason: reason.trim() || null,
          neededBy: kind === "allocation" || kind === "replacement" ? neededBy || null : null,
          returnBy: kind === "take_out" ? returnBy : null,
          toUserId: kind === "transfer" ? toUserId || null : null,
          projectId: kind === "transfer" || kind === "allocation" ? projectId || null : null,
          toLocation: kind === "transfer" || kind === "take_out" ? toLocation.trim() || null : null,
        }),
      );
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  const assetOptions = held.map((a) => ({ value: a.id, label: `${a.tagNo ?? "Untagged"} · ${a.name}`, hint: a.category ?? undefined }));
  const chosenKind = ASK_KINDS.find((k) => k.key === kind);

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-title`}
      title="Report a problem or ask for something"
      subtitle="It goes to your head of unit for approval, then to Operations."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Sending…" : "Send the request"}
          </Button>
        </div>
      }
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">What do you need?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ASK_KINDS.map((k) => {
            const disabled = k.key !== "allocation" && held.length === 0;
            return (
              <label
                key={k.key}
                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${kind === k.key ? "border-primary-400 bg-primary-50/60 ring-2 ring-primary-200" : "border-neutral-200 hover:border-neutral-300"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name={`${uid}-kind`}
                  className="mt-1 h-4 w-4 accent-primary-600"
                  checked={kind === k.key}
                  disabled={disabled}
                  onChange={() => {
                    setKind(k.key);
                    setErrors({});
                  }}
                />
                <span>
                  <span className="block text-sm font-semibold text-neutral-900">{k.label}</span>
                  <span className="block text-xs text-neutral-500">{k.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        {held.length === 0 && <p className="mt-2 text-xs text-neutral-500">You hold no assets, so you can only ask for something new.</p>}
      </fieldset>

      {needsAsset ? (
        <Field id={`${uid}-asset`} label="Which asset">
          <SearchableSelect
            id={`${uid}-asset`}
            value={assetId}
            onChange={setAssetId}
            options={assetOptions}
            placeholder="Choose one of your assets"
            searchPlaceholder="Search by tag or name"
            noOptionsText="You hold no assets."
            aria-invalid={errors.assetId ? true : undefined}
          />
          <FieldError message={errors.assetId} />
        </Field>
      ) : (
        <Field id={`${uid}-cat`} label="What kind of asset">
          <SearchableSelect
            id={`${uid}-cat`}
            value={categoryId}
            onChange={setCategoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Choose a category"
            searchPlaceholder="Search categories"
            noOptionsText="No categories yet. Ask Operations."
            aria-invalid={errors.categoryId ? true : undefined}
          />
          <FieldError message={errors.categoryId} />
        </Field>
      )}

      {kind === "transfer" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-to`} label="To somebody" hint="Or a project or place">
            <SearchableSelect
              id={`${uid}-to`}
              value={toUserId}
              onChange={setToUserId}
              options={staff ?? []}
              clearable
              clearLabel="Nobody"
              placeholder={staff === null ? "Loading staff…" : "Choose a colleague"}
              searchPlaceholder="Search staff"
              aria-invalid={errors.toUserId ? true : undefined}
            />
            <FieldError message={errors.toUserId} />
          </Field>
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
          </Field>
        </div>
      )}
      {(kind === "transfer" || kind === "take_out") && (
        <Field id={`${uid}-loc`} label={kind === "take_out" ? "Where you are taking it" : "To a place"} hint="Optional">
          <input id={`${uid}-loc`} className={inputClass} value={toLocation} maxLength={255} onChange={(e) => setToLocation(e.target.value)} placeholder="Client site, Kano" />
        </Field>
      )}
      {kind === "take_out" && (
        <Field id={`${uid}-back`} label="Bringing it back by">
          <input id={`${uid}-back`} type="date" className={`${inputClass} sm:w-56`} value={returnBy} min={today} onChange={(e) => setReturnBy(e.target.value)} aria-invalid={errors.returnBy ? true : undefined} />
          <FieldError message={errors.returnBy} />
        </Field>
      )}
      {(kind === "allocation" || kind === "replacement") && (
        <Field id={`${uid}-need`} label="Needed by" hint="Optional">
          <input id={`${uid}-need`} type="date" className={`${inputClass} sm:w-56`} value={neededBy} min={today} onChange={(e) => setNeededBy(e.target.value)} />
        </Field>
      )}
      <Field id={`${uid}-reason`} label={kind === "replacement" ? "What is wrong with it" : "Why"} hint={kind === "replacement" ? "Required" : "Optional"}>
        <textarea
          id={`${uid}-reason`}
          rows={3}
          className={textareaClass}
          value={reason}
          maxLength={5000}
          onChange={(e) => setReason(e.target.value)}
          placeholder={kind === "replacement" ? "The screen flickers and goes black after a few minutes." : chosenKind?.hint}
          aria-invalid={errors.reason ? true : undefined}
        />
        <FieldError message={errors.reason} />
      </Field>
      {error && !["assetId", "categoryId", "reason", "returnBy", "toUserId"].some((k) => errors[k]) && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
