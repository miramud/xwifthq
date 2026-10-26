"use client";

import { useCallback, useId, useState } from "react";
import { Info, Percent, Save } from "lucide-react";
import { Button, CalloutStrip, Card, Empty, PageHeader, Panel } from "@/components/workspace/kit";
import { useAuth } from "@/lib/auth-store";
import { ErrorNote, hintClass, inputClass, labelClass, SettingRow, Switch } from "@/suite/lms/components/ui/ws";
import { ApiError, platformAffiliates, type ProgrammeTerms as Terms } from "@/lib/api/affiliate-client";
import { canPlatform, PERM } from "@/suite/platform/access";
import { LoadError, Notice, PageSkeleton, useLoad } from "../ui";
import { fieldErrors } from "./shared";

type NumberKey = Exclude<keyof Terms, "open">;

// The limits the API enforces (PlatformAffiliateController::updateSettings).
const FIELDS: { key: NumberKey; label: string; unit: string; hint: string; min: number; max: number }[] = [
  {
    key: "commissionPercent",
    label: "Commission",
    unit: "%",
    min: 0,
    max: 90,
    hint: "The affiliate's share of a referred organisation's first payment, worked out on the price before the referral discount.",
  },
  {
    key: "discountPercent",
    label: "Referral discount",
    unit: "%",
    min: 0,
    max: 90,
    hint: "Taken off the first payment of an organisation that came through an affiliate's link.",
  },
  {
    key: "cookieDays",
    label: "Cookie window",
    unit: "days",
    min: 1,
    max: 365,
    hint: "How long after someone opens a link a sign-up still counts as that affiliate's referral.",
  },
  {
    key: "holdDays",
    label: "Hold period",
    unit: "days",
    min: 0,
    max: 180,
    hint: "How long a commission stays on hold before it's ready to pay, so a refund or a dispute can surface first.",
  },
];

type Draft = { open: boolean } & Record<NumberKey, string>;

function draftOf(t: Terms): Draft {
  return {
    open: t.open,
    commissionPercent: String(t.commissionPercent),
    discountPercent: String(t.discountPercent),
    cookieDays: String(t.cookieDays),
    holdDays: String(t.holdDays),
  };
}

/**
 * The programme's terms: whether it takes applications, the commission and
 * discount rates, the cookie window and the hold period. A change applies
 * from now on; commissions already earned and payments already started keep
 * the terms they began under.
 */
export default function ProgrammeTerms() {
  const { user } = useAuth();
  const allowed = canPlatform(user, PERM.affiliatesView);
  const canManage = canPlatform(user, PERM.affiliatesManage);

  const fetchTerms = useCallback(() => platformAffiliates.settings(), []);
  const { data, error, reload, setData } = useLoad(fetchTerms, "Programme terms didn't load.");

  const header = (
    <PageHeader
      eyebrow="Affiliates"
      title="Programme terms"
      subtitle="What affiliates earn, what referred organisations save, and how long each step takes."
    />
  );

  if (user && !allowed) {
    return (
      <div>
        {header}
        <Card>
          <Empty icon={Percent} title="You can't see the affiliate programme" hint="Ask a platform owner for access to affiliates." />
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        {header}
        <LoadError message={error} onRetry={reload} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {header}
        <PageSkeleton stats={0} rows={1} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <TermsForm terms={data} canManage={canManage} onSaved={(t) => setData(() => t)} />
    </div>
  );
}

function TermsForm({ terms, canManage, onSaved }: { terms: Terms; canManage: boolean; onSaved: (t: Terms) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(terms));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const original = draftOf(terms);
  const dirty = (Object.keys(original) as (keyof Draft)[]).some((k) => String(draft[k]).trim() !== String(original[k]));

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setSaved(false);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !dirty) return;

    const missing: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = draft[f.key].trim();
      if (v === "" || Number.isNaN(Number(v))) missing[f.key] = `Enter a number for ${f.label.toLowerCase()}.`;
    }
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }

    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const next = await platformAffiliates.updateSettings({
        open: draft.open,
        commissionPercent: Number(draft.commissionPercent),
        discountPercent: Number(draft.discountPercent),
        cookieDays: Number(draft.cookieDays),
        holdDays: Number(draft.holdDays),
      });
      // The form carries on from what the API kept, which may be tidier than what was typed.
      setDraft(draftOf(next));
      onSaved(next);
      setSaved(true);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      setError(Object.keys(fields).length ? null : err instanceof ApiError ? err.message : "The terms weren't saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6" aria-labelledby={`${id}-title`}>
      {saved && !dirty && <Notice>Saved. The new terms apply from now on.</Notice>}

      <CalloutStrip icon={Info} hue="sky" title="Changes apply from now on">
        They never rewrite commissions already earned or payments already started. Those keep the terms they began under.
      </CalloutStrip>

      {!canManage && (
        <p className="text-sm text-neutral-600">You can read these terms. Changing them needs permission to manage affiliates.</p>
      )}

      <Panel title={<span id={`${id}-title`}>Terms</span>} icon={Percent} hue="grape">
        <div className="space-y-5">
          <SettingRow
            title="Open for applications"
            hint="When it's off, the affiliate page stops taking new applications."
          >
            <Switch checked={draft.open} onChange={(v) => set("open", v)} label="Open for applications" disabled={!canManage} />
          </SettingRow>

          <div className="grid gap-5 sm:grid-cols-2">
            {FIELDS.map((f) => {
              const err = errors[f.key];
              return (
                <div key={f.key}>
                  <label htmlFor={`${id}-${f.key}`} className={labelClass}>
                    {f.label} ({f.unit})
                  </label>
                  <input
                    id={`${id}-${f.key}`}
                    type="number"
                    inputMode="decimal"
                    min={f.min}
                    max={f.max}
                    step={f.unit === "%" ? "any" : 1}
                    value={draft[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    disabled={!canManage}
                    aria-invalid={Boolean(err)}
                    aria-describedby={`${id}-${f.key}-help${err ? ` ${id}-${f.key}-error` : ""}`}
                    className={inputClass}
                  />
                  <p id={`${id}-${f.key}-help`} className={hintClass}>
                    {f.hint}
                  </p>
                  {err && (
                    <p id={`${id}-${f.key}-error`} className="mt-1.5 text-xs font-medium text-error-700">
                      {err}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {errors.open && <ErrorNote>{errors.open}</ErrorNote>}
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        {canManage && (
          <div className="mt-5 flex justify-end border-t border-neutral-100 pt-4">
            <Button type="submit" variant="primary" icon={Save} disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save terms"}
            </Button>
          </div>
        )}
      </Panel>
    </form>
  );
}
