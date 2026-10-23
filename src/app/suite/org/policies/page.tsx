"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { AlertCircle, Building2, Check, Gavel, Globe, Info, Loader2, Save, ShieldCheck, ShieldOff } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { ErrorNote, IconTile } from "@/suite/lms/components/ui/ws";
import { useAuth } from "@/lib/auth-store";
import {
  organisationPolicies as policiesApi,
  ApiError,
  type OrganisationPolicy,
  type PolicyChanges,
  type PolicyKey,
} from "@/lib/api/saas-client";

/**
 * The governance an institution answers for itself.
 *
 * The whole screen turns on one idea a plain switch cannot express: a policy
 * has three states, not two. "Required", "Not required", and "whatever the
 * platform says" are different answers, and the third one keeps moving as the
 * platform changes its mind. A switch left off would look identical to a switch
 * nobody ever touched, so the control here is a three-way choice and every row
 * says out loud which answer is in force and where it came from.
 */

/* ------------------------------------------------------------------ */
/*  Tri-state choice                                                   */
/* ------------------------------------------------------------------ */

/** `null` is the inherited state, so it needs a name the radio group can carry. */
type Choice = "platform" | "on" | "off";

const CHOICES: { value: Choice; label: string }[] = [
  { value: "platform", label: "Follow platform" },
  { value: "on", label: "Required" },
  { value: "off", label: "Not required" },
];

function choiceOf(policy: OrganisationPolicy): Choice {
  if (policy.source === "platform") return "platform";
  return policy.value ? "on" : "off";
}

function valueOf(choice: Choice): boolean | null {
  if (choice === "platform") return null;
  return choice === "on";
}

function ChoiceGroup({
  name,
  legend,
  value,
  onChange,
  disabled,
}: {
  name: string;
  legend: string;
  value: Choice;
  onChange: (next: Choice) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="shrink-0" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex rounded-xl bg-neutral-100 p-1">
        {CHOICES.map((choice) => {
          const selected = choice.value === value;

          return (
            <label
              key={choice.value}
              className={cx(
                "flex h-9 cursor-pointer items-center rounded-lg px-3 text-[13px] font-semibold transition-colors focus-within:ring-2 focus-within:ring-primary-300",
                selected
                  ? choice.value === "on"
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={selected}
                onChange={() => onChange(choice.value)}
              />
              {choice.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/*  One policy                                                         */
/* ------------------------------------------------------------------ */

/**
 * The sentence under each control. It exists because "Follow platform" alone
 * does not tell an admin what is actually happening to their instructors today.
 */
function resolutionLine(policy: OrganisationPolicy, choice: Choice): string {
  const platformWord = policy.platformDefault ? "required" : "not required";

  if (choice === "platform") {
    return `Following the platform, which currently has this ${platformWord}.`;
  }

  const chosenWord = choice === "on" ? "required" : "not required";

  return policy.platformDefault === (choice === "on")
    ? `Set here as ${chosenWord}, and it stays that way if the platform changes.`
    : `Set here as ${chosenWord}, overriding the platform default of ${platformWord}.`;
}

function PolicyRow({
  policy,
  choice,
  onChange,
  disabled,
}: {
  policy: OrganisationPolicy;
  choice: Choice;
  onChange: (next: Choice) => void;
  disabled: boolean;
}) {
  const name = useId();

  const inForce = choice === "platform" ? policy.platformDefault : choice === "on";

  return (
    <div className="py-5 first:pt-1 last:pb-1">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="flex min-w-0 gap-3">
          <IconTile icon={inForce ? ShieldCheck : ShieldOff} hue={inForce ? "mint" : "slate"} size={40} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
              {policy.label}
              <Chip hue={choice === "platform" ? "sky" : "grape"}>
                {choice === "platform" ? "Platform default" : "Set here"}
              </Chip>
            </p>
            <p className="mt-0.5 text-sm text-neutral-500">{policy.effect}</p>
          </div>
        </div>

        <ChoiceGroup
          name={name}
          legend={policy.label}
          value={choice}
          onChange={onChange}
          disabled={disabled}
        />
      </div>

      <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600 lg:ml-[52px]">
        <Info size={13} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
        {resolutionLine(policy, choice)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminPoliciesPage() {
  const { user } = useAuth();

  const [policies, setPolicies] = useState<OrganisationPolicy[] | null>(null);
  const [draft, setDraft] = useState<Record<string, Choice>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const belongsToOrganisation = Boolean(user?.organisationId);

  const settle = useCallback((rows: OrganisationPolicy[]) => {
    setPolicies(rows);
    setDraft(Object.fromEntries(rows.map((p) => [p.key, choiceOf(p)])));
  }, []);

  useEffect(() => {
    if (!belongsToOrganisation) {
      setLoading(false);
      return;
    }

    let alive = true;

    policiesApi
      .list()
      .then((rows) => {
        if (alive) settle(rows);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Could not load your policies.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [belongsToOrganisation, settle]);

  /** Only the policies actually moved are sent. */
  const changes = useMemo<PolicyChanges>(() => {
    if (!policies) return {};

    const diff: PolicyChanges = {};
    for (const policy of policies) {
      const next = draft[policy.key];
      if (next !== undefined && next !== choiceOf(policy)) {
        diff[policy.key] = valueOf(next);
      }
    }
    return diff;
  }, [policies, draft]);

  const dirty = Object.keys(changes).length > 0;

  const choose = useCallback((key: PolicyKey, next: Choice) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: next }));
  }, []);

  const save = useCallback(async () => {
    if (!dirty || saving) return;

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      settle(await policiesApi.update(changes));
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your policies.");
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, changes, settle]);

  const discard = useCallback(() => {
    if (policies) settle(policies);
    setSaved(false);
    setError(null);
  }, [policies, settle]);

  const heading = (
    <PageHeader
      eyebrow="Institution"
      title="Institution Policies"
      subtitle="How your institution governs its own catalog. Anything you leave on the platform default follows XwiftHQ."
    />
  );

  if (user && !belongsToOrganisation) {
    return (
      <div>
        {heading}
        <Card>
          <Empty
            icon={Building2}
            title="Policies belong to an institution"
            hint="Your account administers the platform rather than a single institution. Set the platform defaults from Settings. Every institution that has not answered for itself follows them."
          />
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        {heading}
        <div className="flex items-center gap-2 py-20 text-sm text-neutral-500">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading policies…
        </div>
      </div>
    );
  }

  if (!policies) {
    return (
      <div>
        {heading}
        <ErrorNote className="flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" aria-hidden />
          {error ?? "Policies are unavailable."}
        </ErrorNote>
      </div>
    );
  }

  const overridden = policies.filter((p) => (draft[p.key] ?? choiceOf(p)) !== "platform").length;

  return (
    <div className="space-y-6">
      {heading}

      {error && (
        <ErrorNote className="flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" aria-hidden />
          {error}
        </ErrorNote>
      )}

      {saved && !dirty && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-mint-100 bg-mint-50 px-4 py-3 text-sm text-mint-700"
        >
          <Check size={15} className="shrink-0" aria-hidden />
          Policies saved.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          title="Approvals"
          subtitle="Who signs off before something becomes visible"
          icon={Gavel}
          hue="sun"
          className="xl:col-span-2"
          bodyClassName="px-5 pb-5 pt-2"
        >
          <div className="divide-y divide-neutral-100">
            {policies.map((policy) => (
              <PolicyRow
                key={policy.key}
                policy={policy}
                choice={draft[policy.key] ?? choiceOf(policy)}
                onChange={(next) => choose(policy.key, next)}
                disabled={saving}
              />
            ))}
          </div>

          <div className="mt-2 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-500">
              {dirty
                ? `${Object.keys(changes).length} unsaved ${Object.keys(changes).length === 1 ? "change" : "changes"}`
                : "No unsaved changes"}
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={discard} disabled={!dirty || saving}>
                Discard
              </Button>
              <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving}>
                {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="How a policy is decided" icon={Globe} hue="sky">
          <p className="text-sm text-neutral-600">
            Each policy has three answers, not two. You are answering{" "}
            <span className="font-semibold text-neutral-900">{overridden}</span> of {policies.length} yourself.
          </p>
          <ul className="mt-4 space-y-3">
            {[
              { hue: "sky" as const, title: "Follow platform", text: "Whatever XwiftHQ decides, now and later." },
              { hue: "mint" as const, title: "Required", text: "Always on here, whatever the platform does." },
              { hue: "slate" as const, title: "Not required", text: "Always off here, whatever the platform does." },
            ].map((row) => (
              <li key={row.title} className="flex items-start gap-3 rounded-xl bg-neutral-50 p-3">
                <Chip hue={row.hue} dot>
                  {row.title}
                </Chip>
                <span className="text-xs text-neutral-600">{row.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-neutral-500">
            These apply to courses and reviews your institution owns. Courses your instructors publish to
            the public marketplace follow the platform&rsquo;s own rules.
          </p>
        </Panel>
      </div>
    </div>
  );
}
