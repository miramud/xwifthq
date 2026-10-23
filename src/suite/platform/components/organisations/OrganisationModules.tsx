"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Blocks, FlaskConical, Hourglass, Info, Lock, Receipt, Save, Undo2 } from "lucide-react";
import { Button, Card, Chip, Panel, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { Skeleton, Switch } from "@/suite/lms/components/ui/ws";
import {
  ApiError,
  platformOrganisations,
  type LicenceRow,
  type ModuleChange,
  type OrganisationModule,
} from "@/lib/api/platform-client";
import { formatMoney } from "@/lib/money";
import { formatDate, LoadError, ModuleChip, moduleHue, Notice } from "../ui";
import { LicenceHistory, licensedModules, licenceModuleName, RecordLicenceDialog } from "./OrganisationLicences";

interface Draft {
  enabled: boolean;
  /** `yyyy-mm-dd` or "" for no end date. */
  until: string;
  /** Opened ahead of release. Kept while the module is switched off so switching it back on restores it. */
  earlyAccess: boolean;
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** Unreleased deployment-wide: a preview for everyone unless opened early. */
const unreleased = (m: OrganisationModule) => m.released === false;

/** Early access only counts while the module is on — switching it off clears it. */
const earlyOn = (d: Draft) => d.enabled && d.earlyAccess;

/**
 * Which modules one organisation may use — the platform owner's lever for
 * selling, lending or withdrawing a product.
 *
 * Changes are drafted and saved together, because reassigning a licence is
 * usually several switches at once (swap HRM for Projects, end a trial on a
 * date). Taking a module away asks first: its people lose it on save. Their
 * records in it are kept, so switching it back on restores their work.
 *
 * Selling a module is a licence (27 Sep 2026): online payment is off, so the
 * owner records what the organisation paid and the modules switch on for
 * good. The switches below stay for trials and for taking a module away.
 * `openLicence` opens the licence dialog on arrival — the step after creating
 * an organisation.
 */
export default function OrganisationModules({
  slug,
  canManage,
  organisationName = "This organisation",
  openLicence = false,
}: {
  slug: string;
  canManage: boolean;
  organisationName?: string;
  openLicence?: boolean;
}) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<OrganisationModule[] | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<LicenceRow[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [recording, setRecording] = useState(openLicence && canManage);

  const seed = useCallback((list: OrganisationModule[]) => {
    setRows(list);
    setDraft(
      Object.fromEntries(list.map((m) => [m.key, { enabled: m.entitled, until: toDateInput(m.until), earlyAccess: m.earlyAccess === true }])),
    );
  }, []);

  const load = useCallback(() => {
    setError(null);
    platformOrganisations
      .modules(slug)
      .then(seed)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "The modules didn't load."));
  }, [slug, seed]);

  const loadHistory = useCallback(() => {
    setHistoryError(null);
    platformOrganisations
      .licences(slug)
      .then(setHistory)
      .catch((e: unknown) => setHistoryError(e instanceof ApiError ? e.message : "The licence history didn't load."));
  }, [slug]);

  useEffect(() => {
    load();
    loadHistory();
  }, [load, loadHistory]);

  const owned = useMemo(() => licensedModules(history ?? []), [history]);
  const labels = useMemo(() => Object.fromEntries((rows ?? []).map((m) => [m.key, m.label])), [rows]);
  const heldAfter = history?.find((l) => l.status === "paid")?.modulesAfter ?? owned.size;

  function recorded(licence: LicenceRow) {
    setRecording(false);
    // Licensing switched modules on: both the states and the history move.
    load();
    loadHistory();
    setNotice(
      `${licence.reference} recorded: ${licence.modules.map((k) => licenceModuleName(k, labels)).join(", ")} ${licence.modules.length === 1 ? "is" : "are"} on for good, for ${formatMoney(licence.amountMinor, licence.currency)}. ${organisationName}'s admins have been emailed.`,
    );
  }

  const changed = useMemo(
    () =>
      (rows ?? []).filter((m) => {
        const d = draft[m.key];
        return (
          d &&
          (d.enabled !== m.entitled ||
            d.until !== toDateInput(m.until) ||
            (unreleased(m) && earlyOn(d) !== (m.earlyAccess === true)))
        );
      }),
    [rows, draft],
  );

  const set = (key: string, patch: Partial<Draft>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  async function save() {
    if (!rows) return;
    const removing = changed.filter((m) => m.entitled && !draft[m.key].enabled);
    if (
      removing.length > 0 &&
      !(await confirm({
        title: `Remove ${removing.map((m) => m.label).join(" and ")}?`,
        body: "Everyone in this organisation loses access to it when you save. Their records in it are kept, and come back if you switch it on again.",
        confirmLabel: removing.length === 1 ? "Remove module" : "Remove modules",
      }))
    )
      return;

    setSaving(true);
    setSaveError(null);
    const modules: ModuleChange[] = rows
      .filter((m) => m.key !== "core")
      .map((m) => ({
        key: m.key,
        enabled: draft[m.key]?.enabled ?? m.entitled,
        until: draft[m.key]?.enabled && draft[m.key]?.until ? draft[m.key].until : null,
        ...(unreleased(m) ? { earlyAccess: draft[m.key] ? earlyOn(draft[m.key]) : m.earlyAccess === true } : {}),
      }));
    try {
      seed(await platformOrganisations.saveModules(slug, modules));
      setNotice(`Modules saved. ${changed.length} ${changed.length === 1 ? "change" : "changes"} applied.`);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "The modules weren't saved.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <LoadError message={error} onRetry={load} />;

  if (rows === null) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading modules">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}

      <Panel
        title="Licences"
        subtitle="Modules this organisation has paid for, recorded by hand or bought online. Licensed modules stay on for good."
        icon={Receipt}
        hue="grape"
        actions={
          canManage ? (
            <Button variant="primary" icon={BadgeCheck} onClick={() => setRecording(true)}>
              Record a licence
            </Button>
          ) : undefined
        }
      >
        {historyError ? (
          <LoadError message={historyError} onRetry={loadHistory} />
        ) : history === null ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="space-y-4">
            {owned.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                <span>
                  Holds <span className="font-semibold tabular-nums text-neutral-900">{heldAfter}</span>{" "}
                  licensed module{heldAfter === 1 ? "" : "s"}:
                </span>
                {[...owned].map((k) => (
                  <ModuleChip key={k} moduleKey={k} label={licenceModuleName(k, labels)} />
                ))}
              </div>
            )}
            <LicenceHistory rows={history} labels={labels} />
          </div>
        )}
      </Panel>

      <Card>
        <div className="flex flex-col gap-1 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-neutral-900">Activated modules</h2>
            <p className="text-xs text-neutral-500">
              Switch a module on without payment (for a trial or a fixed term, with an end date), or take one away.
              Anything left off is a preview for them: they can see what it does but can&apos;t open it.
            </p>
          </div>
          {!canManage && <Chip hue="slate" icon={Lock}>Read only</Chip>}
        </div>

        <ul className="divide-y divide-neutral-100">
          {rows.map((m) => {
            const d = draft[m.key] ?? { enabled: m.entitled, until: "", earlyAccess: m.earlyAccess === true };
            const core = m.key === "core";
            const preview = !core && unreleased(m);
            const early = earlyOn(d);
            const dirty = changed.some((c) => c.key === m.key);
            const hue = moduleHue(m.key);
            return (
              <li
                key={m.key}
                className={cx(
                  "flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center",
                  dirty && "bg-primary-50/40",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)} aria-hidden>
                    <Blocks size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
                      {m.label}
                      {core ? (
                        <Chip hue="slate" icon={Lock}>Always on</Chip>
                      ) : d.enabled ? (
                        <Chip hue="mint" dot>{dirty && !m.entitled ? "Will be added" : "Licensed"}</Chip>
                      ) : (
                        <Chip hue={dirty ? "rose" : "slate"} dot>{dirty ? "Will be removed" : "Not licensed"}</Chip>
                      )}
                      {preview &&
                        (early ? (
                          <Chip hue="sky" icon={FlaskConical}>{m.earlyAccess ? "Early access" : "Will open early"}</Chip>
                        ) : (
                          <Chip hue="sun" icon={Hourglass}>Preview until released</Chip>
                        ))}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {core
                        ? "The console every organisation needs to run itself."
                        : owned.has(m.key) && m.entitled
                          ? `Paid licence${m.since ? ` since ${formatDate(m.since)}` : ""}`
                          : m.entitled
                          ? `${m.source === "licence" ? "Activated" : "Included by default"}${m.since ? ` since ${formatDate(m.since)}` : ""}${m.until ? ` · ends ${formatDate(m.until)}` : ""}`
                          : "Not activated. Shown to this organisation as a preview."}
                    </p>
                    {preview && (
                      <div className="mt-3 flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 px-3 py-2.5">
                        <Switch
                          checked={early}
                          disabled={!canManage || !d.enabled}
                          onChange={(v) => set(m.key, { earlyAccess: v })}
                          label={`${m.label} early access`}
                        />
                        <div className="min-w-0 text-xs">
                          <p className="font-semibold text-neutral-800">Early access</p>
                          <p className="mt-0.5 text-neutral-500">
                            Open this module for this organisation before it is released to everyone. Everyone else keeps
                            seeing a preview.
                            {!d.enabled && " Switch the module on first."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {!core && (
                  <div className="flex items-center gap-4 sm:justify-end">
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <span>Ends</span>
                      <input
                        type="date"
                        value={d.until}
                        disabled={!canManage || !d.enabled}
                        onChange={(e) => set(m.key, { until: e.target.value })}
                        aria-label={`${m.label} end date`}
                        className="h-9 rounded-xl border border-neutral-200 bg-white px-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
                      />
                    </label>
                    <Switch
                      checked={d.enabled}
                      disabled={!canManage}
                      onChange={(v) => set(m.key, { enabled: v })}
                      label={`${m.label} licensed`}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="flex items-start gap-2 border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
          <Info size={14} className="mt-px shrink-0 text-info-600" aria-hidden />
          Online payment for modules is switched off. When an organisation pays, record a licence above: it switches
          the modules on for good and shows in Payments and Sales. These switches are for trials and removals.
        </p>

        {canManage && (
          <div className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-500" aria-live="polite">
              {changed.length === 0 ? "No unsaved changes." : `${changed.length} unsaved ${changed.length === 1 ? "change" : "changes"}.`}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {saveError && <span role="alert" className="self-center text-sm text-error-700">{saveError}</span>}
              <Button icon={Undo2} disabled={changed.length === 0 || saving} onClick={() => seed(rows)}>
                Discard
              </Button>
              {/* Primary only while there is something to save: at rest, "Record a licence" is this tab's one primary. */}
              <Button
                variant={changed.length > 0 ? "primary" : "secondary"}
                icon={Save}
                disabled={changed.length === 0 || saving}
                onClick={save}
              >
                {saving ? "Saving…" : "Save modules"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {recording && canManage && (
        <RecordLicenceDialog
          slug={slug}
          organisationName={organisationName}
          modules={rows.filter((m) => m.key !== "core").map((m) => ({ key: m.key, label: m.label }))}
          owned={owned}
          onClose={() => setRecording(false)}
          onRecorded={recorded}
        />
      )}
    </div>
  );
}
