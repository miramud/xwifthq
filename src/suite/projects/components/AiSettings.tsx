"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Coins,
  ExternalLink,
  Gauge,
  History,
  KeyRound,
  PieChart,
  PlugZap,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Donut, SegmentedGauge } from "@/components/workspace/charts";
import { hueFor, type Hue } from "@/components/workspace/modules";
import {
  ai as aiApi,
  ApiError,
  type AiProviderSettings,
  type AiUsageRow,
  type AiUsageSummary,
} from "@/lib/api/projects-client";
import { Notice, SectionHeading, Skeleton, hintCls, inputCls, labelCls } from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/** What the API sends back for a key nobody edited. */
const MASK = "••••••••";

const FEATURE_HUES: Hue[] = ["blue", "grape", "mint", "sun", "sky", "coral", "rose"];

/**
 * The institution's model providers, and what they have spent.
 *
 * **Their key, our software spending it.** Generation runs on the
 * institution's own provider account — there is no shared key and nothing is
 * billed to XwiftHQ. That is said on the screen rather than left implicit,
 * because it is the first question anybody asks when a product offers to run a
 * model for them.
 *
 * **The key is never shown, and never was.** Four characters come back, which
 * answers "is this the one I think it is" without being enough to use. The
 * field shows a mask when a key is set, and sending the mask back means "leave
 * it alone" — otherwise the first person to change a model would overwrite a
 * working key with eight bullet characters.
 *
 * **A key is not trusted until it has been used.** Verifying makes the
 * cheapest possible real call, because "wrong key", "wrong model" and "works"
 * are indistinguishable without one.
 */
export default function AiSettings() {
  const confirm = useConfirm();
  const [providers, setProviders] = useState<AiProviderSettings[] | null>(null);
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<AiUsageRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([aiApi.providers(), aiApi.usage()])
      .then(([settings, spend]) => {
        if (cancelled) return;

        setProviders(settings.data);
        setUsage(settings.meta.usage);
        setNote(settings.meta.note);
        setRows(spend.data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setProviders([]);
      });

    return () => {
      cancelled = true;
    };
  }, [reloads]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);

    try {
      await action();
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <PageHeader
      eyebrow="Projects · Settings"
      title="AI"
      subtitle="Which model provider drafts stories and tasks for your projects, and what it has spent."
    />
  );

  if (providers === null) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {header}
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[124px]" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const configured = providers.filter((p) => p.hasKey);
  const inUse = providers.find((p) => p.isDefault && p.hasKey) ?? null;
  const features = Object.entries(usage?.byFeature ?? {}).map(([name, v], i) => ({
    label: name.charAt(0).toUpperCase() + name.slice(1),
    value: v.tokens,
    hue: FEATURE_HUES[i % FEATURE_HUES.length],
  }));

  const columns: Column<AiUsageRow>[] = [
    {
      key: "at",
      header: "When",
      sortable: true,
      value: (row) => row.at ?? "",
      render: (row) => (
        <span className="whitespace-nowrap text-neutral-500">{row.at?.slice(0, 16).replace("T", " ") ?? "-"}</span>
      ),
    },
    {
      key: "feature",
      header: "What",
      primary: true,
      sortable: true,
      value: (row) => row.feature,
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          {row.succeeded ? (
            <CheckCircle2 size={15} className="shrink-0 text-mint-600" aria-hidden />
          ) : (
            <XCircle size={15} className="shrink-0 text-error-600" aria-hidden />
          )}
          <span className="font-medium text-neutral-900">{row.feature}</span>
          {!row.succeeded && (
            <span
              className="rounded-full bg-error-500/10 px-2 py-0.5 text-[11px] font-semibold text-error-700"
              title={row.error ?? ""}
            >
              failed
            </span>
          )}
        </span>
      ),
    },
    {
      key: "project",
      header: "Project",
      sortable: true,
      value: (row) => row.project ?? "",
      render: (row) =>
        row.project ? (
          <span className="block max-w-[12rem] truncate text-neutral-700">{row.project}</span>
        ) : (
          <span className="text-neutral-400">-</span>
        ),
    },
    {
      key: "user",
      header: "By",
      sortable: true,
      hideOnMobile: true,
      value: (row) => row.user ?? "",
    },
    {
      key: "model",
      header: "Model",
      sortable: true,
      hideOnMobile: true,
      value: (row) => row.model,
      render: (row) => <span className="font-mono text-xs text-neutral-600">{row.model}</span>,
    },
    {
      key: "tokens",
      header: "Tokens",
      sortable: true,
      align: "right",
      value: (row) => row.totalTokens,
      render: (row) => row.totalTokens.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      {error !== null && <Notice>{error}</Notice>}

      {/*
        Said once, plainly. It is the first question anybody asks when a
        product offers to run a model on their behalf.
      */}
      <Notice tone="info">{note}</Notice>

      {usage !== null && (
        <StatGrid>
          <StatCard
            featured
            label="Tokens this month"
            value={usage.tokensThisMonth.toLocaleString()}
            icon={Coins}
            hint={`Since ${usage.monthStartedOn}`}
          />
          <StatCard label="Generations" value={usage.callsThisMonth.toLocaleString()} icon={Activity} hue="sky" />
          <StatCard
            label="Failed calls"
            value={usage.failuresThisMonth.toLocaleString()}
            icon={AlertTriangle}
            hue={usage.failuresThisMonth > 0 ? "rose" : "slate"}
            /* A run of these is a rotated key, not a quiet token total. */
            hint={usage.failuresThisMonth > 0 ? "Check the key is still valid" : undefined}
          />
          <StatCard
            label="Providers ready"
            value={configured.length}
            unit={`of ${providers.length}`}
            icon={PlugZap}
            hue={configured.length > 0 ? "mint" : "sun"}
            hint={inUse ? `Using ${inUse.label}` : undefined}
          />
        </StatGrid>
      )}

      {configured.length === 0 && (
        <Notice tone="warn">
          No provider is set up yet, so nothing can be generated. Add a key
          below. It stays encrypted and is never shown again.
        </Notice>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <section aria-labelledby="ai-providers-heading" className="space-y-4 xl:col-span-2">
          <SectionHeading
            title={<span id="ai-providers-heading">Providers</span>}
            hint="Your own account with each. The one marked as in use drafts everything."
          />
          {providers.map((provider) => (
            <ProviderCard
              key={provider.provider}
              provider={provider}
              busy={busy}
              onSave={(input) => run(`save-${provider.provider}`, () => aiApi.saveProvider(input))}
              onVerify={() => run(`verify-${provider.provider}`, () => aiApi.verify(provider.id ?? ""))}
              onRemove={async () => {
                const ok = await confirm({
                  title: `Remove the ${provider.label} key?`,
                  body: `The key is erased for good, not kept in the recycle bin. If ${provider.label} is the provider in use, drafting stops until you save a key again.`,
                  confirmLabel: "Remove key",
                });
                if (ok) await run(`remove-${provider.provider}`, () => aiApi.removeProvider(provider.id ?? ""));
              }}
            />
          ))}
        </section>

        <div className="space-y-5">
          <Panel title="Budget" subtitle="The provider in use, this month" icon={Gauge} hue="grape">
            {inUse === null ? (
              <Empty icon={CircleDashed} hue="grape" title="No provider in use" hint="Save a key and choose it to see its spend here." />
            ) : inUse.monthlyTokenBudget === null ? (
              <Empty
                icon={Gauge}
                hue="grape"
                title="No ceiling set"
                hint={`${inUse.label} has no monthly token budget. That is a decision, not a gap. Set one below if you want calls refused past it.`}
              />
            ) : (
              <SegmentedGauge
                value={inUse.tokensThisMonth}
                max={inUse.monthlyTokenBudget}
                hue={inUse.tokensThisMonth > inUse.monthlyTokenBudget * 0.9 ? "rose" : "grape"}
                label={`of ${inUse.label}'s monthly budget`}
                caption={`${inUse.tokensThisMonth.toLocaleString()} of ${inUse.monthlyTokenBudget.toLocaleString()} tokens`}
              />
            )}
          </Panel>

          <Panel title="Where it went" subtitle="Tokens by feature this month" icon={PieChart} hue="sky">
            {features.length === 0 || features.every((f) => f.value === 0) ? (
              <Empty icon={PieChart} hue="sky" title="Nothing spent yet" hint="Drafting stories or tasks on a project uses tokens." />
            ) : (
              <Donut
                data={features}
                centerLabel="tokens"
                total={features.reduce((s, f) => s + f.value, 0).toLocaleString()}
                caption="Tokens spent by feature this month"
                legend="below"
                size={160}
              />
            )}
          </Panel>
        </div>
      </div>

      {/* --------------------------- the spend -------------------------- */}

      <section aria-labelledby="ai-spend-heading">
        <SectionHeading
          title={<span id="ai-spend-heading">Recent generations</span>}
          hint="What was spent, on what, and by whom. Failures included."
        />
        {rows.length === 0 ? (
          <Panel>
            <Empty
              icon={History}
              title="Nothing generated yet"
              hint="Every call made on your account appears here, whether it worked or not."
            />
          </Panel>
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(row) => row.id}
            storageKey="projects.ai.usage"
            searchPlaceholder="Search by feature, project or person"
            caption="Recent generations"
            renderCard={(row) => (
              <div className={cx("flex h-full flex-col gap-3 p-5", !row.succeeded && "rounded-[1.125rem] bg-error-500/5")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-neutral-900">{row.feature}</span>
                  {row.succeeded ? (
                    <Chip hue="mint" icon={CheckCircle2}>
                      Worked
                    </Chip>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-error-500/10 px-2.5 py-1 text-xs font-semibold text-error-700"
                      title={row.error ?? ""}
                    >
                      <XCircle size={12} aria-hidden />
                      failed
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-neutral-600">{row.project ?? "No project"}</p>
                {!row.succeeded && row.error && <p className="text-xs text-error-700">{row.error}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  <span className="truncate">
                    {row.user ?? "-"} · <span className="font-mono">{row.model}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-neutral-900">{row.totalTokens.toLocaleString()}</span>
                </div>
              </div>
            )}
          />
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProviderCard({
  provider,
  busy,
  onSave,
  onVerify,
  onRemove,
}: {
  provider: AiProviderSettings;
  busy: string | null;
  onSave: (input: {
    provider: AiProviderSettings["provider"];
    apiKey?: string;
    model?: string;
    isDefault?: boolean;
    monthlyTokenBudget?: number | null;
  }) => Promise<void>;
  onVerify: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  /* The mask stands in for a saved key; sending it back means "leave it". */
  const [apiKey, setApiKey] = useState(provider.hasKey ? MASK : "");
  const [model, setModel] = useState(provider.model);
  const [budget, setBudget] = useState(
    provider.monthlyTokenBudget === null ? "" : String(provider.monthlyTokenBudget),
  );

  const working = busy !== null;

  return (
    <Panel
      title={provider.label}
      subtitle={
        provider.hasKey
          ? `Key ending ${provider.keyHint} · ${provider.tokensThisMonth.toLocaleString()} tokens this month`
          : "No key saved."
      }
      icon={KeyRound}
      hue={provider.hasKey ? hueFor(provider.label) : "slate"}
      className={cx(provider.isDefault && provider.hasKey && "ring-2 ring-primary-200")}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {provider.isDefault && (
            <Chip hue="blue" icon={Star}>
              Default
            </Chip>
          )}

          {provider.hasKey && provider.verifiedAt !== null && (
            <Chip hue="mint" dot>
              Working
            </Chip>
          )}

          {provider.hasKey && provider.verifiedAt === null && (
            /* Unproven, not broken — a new key has simply not been used yet. */
            <Chip hue="slate" icon={CircleDashed}>
              Not tested
            </Chip>
          )}
        </div>
      }
    >
      {provider.lastError !== null && provider.lastError !== "" && (
        <Notice className="mb-4">
          {/* The provider's own words: "model not found" is fixable here. */}
          {provider.lastError}
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`key-${provider.provider}`} className={labelCls}>
            API key
          </label>
          <input
            id={`key-${provider.provider}`}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider.hasKey ? MASK : "Paste it here"}
            autoComplete="off"
            className={inputCls}
          />
          <p className={hintCls}>Encrypted, and never shown again.</p>
        </div>

        <div>
          <label htmlFor={`model-${provider.provider}`} className={labelCls}>
            Model
          </label>
          <input
            id={`model-${provider.provider}`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            list={`models-${provider.provider}`}
            className={inputCls}
          />
          {/*
            A datalist rather than a select: model names change faster than any
            release cycle, and a dropdown that refuses one released last week
            is a support ticket that takes a deploy to close.
          */}
          <datalist id={`models-${provider.provider}`}>
            {provider.models.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <p className={hintCls}>Any model this provider accepts.</p>
        </div>

        <div>
          <label htmlFor={`budget-${provider.provider}`} className={labelCls}>
            Monthly token budget
          </label>
          <input
            id={`budget-${provider.provider}`}
            type="number"
            min="1000"
            step="1000"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="No limit"
            className={inputCls}
          />
          <p className={hintCls}>
            {/* Empty means no ceiling, which is a decision rather than a gap. */}
            Leave empty for no ceiling. Checked before each call.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            void onSave({
              provider: provider.provider,
              apiKey: apiKey === "" ? undefined : apiKey,
              model,
              monthlyTokenBudget: budget.trim() === "" ? null : Number.parseInt(budget, 10),
            })
          }
          disabled={working}
        >
          {busy === `save-${provider.provider}` ? "Saving…" : "Save"}
        </Button>

        {provider.hasKey && (
          <Button size="sm" icon={CheckCircle2} onClick={() => void onVerify()} disabled={working}>
            {busy === `verify-${provider.provider}` ? "Testing…" : "Test it"}
          </Button>
        )}

        {provider.hasKey && !provider.isDefault && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void onSave({ provider: provider.provider, isDefault: true })}
            disabled={working}
          >
            Use this one
          </Button>
        )}

        <a
          href={provider.keysUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-primary-700 transition-colors hover:bg-primary-50"
        >
          <ExternalLink size={13} aria-hidden />
          Get a key
        </a>

        {provider.id !== null && (
          <button
            type="button"
            onClick={() => void onRemove()}
            disabled={working}
            aria-label={`Remove the ${provider.label} key`}
            title="Remove the key"
            className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-error-500/10 hover:text-error-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        )}
      </div>
    </Panel>
  );
}
