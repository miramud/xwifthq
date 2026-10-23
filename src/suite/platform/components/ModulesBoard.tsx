"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Blocks, Building2, Lock, PackageX, Users } from "lucide-react";
import { Card, Chip, Empty, PageHeader, StatGrid, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { StatCard, Switch } from "@/suite/lms/components/ui/ws";
import { ApiError, platformModules, type PlatformModule } from "@/lib/api/platform-client";
import { useAuth } from "@/lib/auth-store";
import { canPlatform, PERM } from "@/suite/platform/access";
import { Bullet, LoadError, moduleHue, Notice, PageSkeleton } from "./ui";

/**
 * Every module the platform ships, and the platform-wide switch for each.
 *
 * The switch is the widest lever in the console: turning a module off takes
 * it away from every organisation at once, whatever they have licensed. So
 * both directions ask, and the question says how many organisations and
 * people it touches. Core is the chassis and cannot be switched off.
 * Reassigning a module to *one* organisation is on that organisation's page.
 */
export default function ModulesBoard() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [modules, setModules] = useState<PlatformModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ key: string; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canManage = canPlatform(user, PERM.modulesManage);

  const load = useCallback(() => {
    setError(null);
    platformModules
      .list()
      .then(setModules)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "The modules didn't load."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const list = modules ?? [];
    return {
      enabled: list.filter((m) => m.enabled).length,
      total: list.length,
      maxOrgs: Math.max(1, ...list.map((m) => m.organisations)),
      activeUsers: list.reduce((n, m) => n + m.activeUsers30d, 0),
    };
  }, [modules]);

  async function toggle(m: PlatformModule, enabled: boolean) {
    const ok = await confirm(
      enabled
        ? {
            title: `Switch ${m.label} on across the platform?`,
            body: "Organisations that license it can use it again straight away.",
            confirmLabel: `Switch ${m.label} on`,
            tone: "primary",
          }
        : {
            title: `Switch ${m.label} off for everyone?`,
            body: `${m.organisations.toLocaleString("en-NG")} ${m.organisations === 1 ? "organisation loses" : "organisations lose"} access, and ${m.activeUsers30d.toLocaleString("en-NG")} people who used it this month can't open it. Their records are kept and come back when you switch it on.`,
            confirmLabel: `Switch ${m.label} off`,
          },
    );
    if (!ok) return;

    setBusy(m.key);
    setRowError(null);
    try {
      const updated = await platformModules.setEnabled(m.key, enabled);
      setModules((prev) => (prev ?? []).map((x) => (x.key === m.key ? { ...x, ...updated } : x)));
      setNotice(`${m.label} is ${enabled ? "on" : "off"} across the platform.`);
    } catch (e) {
      setRowError({ key: m.key, message: e instanceof ApiError ? e.message : "That didn't change." });
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <PageHeader
      eyebrow="Platform"
      title="Modules"
      subtitle="What the platform offers, who uses it, and the platform-wide switch for each."
    />
  );

  if (error) {
    return (
      <div>
        {header}
        <LoadError message={error} onRetry={load} />
      </div>
    );
  }

  if (!modules) {
    return (
      <div>
        {header}
        <PageSkeleton stats={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}

      <StatGrid cols={3}>
        <StatCard featured featuredHue="grape" icon={Blocks} label="Modules on" value={totals.enabled} unit={`of ${totals.total}`} />
        <StatCard icon={Building2} hue="sun" label="Most adopted" value={[...modules].sort((a, b) => b.organisations - a.organisations)[0]?.label ?? "-"} />
        <StatCard icon={Users} hue="sky" label="Active users" value={totals.activeUsers.toLocaleString("en-NG")} hint="Across all modules, 30 days" />
      </StatGrid>

      {modules.length === 0 ? (
        <Card>
          <Empty icon={PackageX} title="No modules reported" hint="The API lists every module it ships. If this stays empty, check the deployment's module configuration." />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {modules.map((m) => {
            const hue = moduleHue(m.key);
            const core = m.key === "core";
            return (
              <li key={m.key}>
                <Card className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", HUE[hue].tile)} aria-hidden>
                      <Blocks size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[15px] font-semibold text-neutral-900">{m.label}</h2>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {core ? (
                          <Chip hue="slate" icon={Lock}>Always on</Chip>
                        ) : (
                          <Chip hue={m.enabled ? "mint" : "slate"} dot>
                            {m.enabled ? "On" : "Off"}
                          </Chip>
                        )}
                        {!m.deployed && <Chip hue="sun">Not deployed</Chip>}
                        {m.sellable ? <Chip hue="blue">Sold per organisation</Chip> : <Chip hue="slate">Included</Chip>}
                      </p>
                    </div>
                    {!core && (
                      <Switch
                        checked={m.enabled}
                        disabled={!canManage || !m.deployed || busy === m.key}
                        onChange={(v) => toggle(m, v)}
                        label={`${m.label} on across the platform`}
                      />
                    )}
                  </div>

                  <Bullet
                    label="Organisations using it"
                    value={m.organisations}
                    max={totals.maxOrgs}
                    hue={hue}
                  />

                  <dl className="grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-3 text-sm">
                    <div>
                      <dt className="text-xs text-neutral-500">Active users, 30 days</dt>
                      <dd className="font-semibold tabular-nums text-neutral-900">{m.activeUsers30d.toLocaleString("en-NG")}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Features</dt>
                      <dd className="font-semibold tabular-nums text-neutral-900">{m.features}</dd>
                    </div>
                  </dl>

                  {!m.deployed && !core && (
                    <p className="text-xs text-neutral-500">
                      Not deployed on this server, so it can&apos;t be switched on here.
                    </p>
                  )}
                  {rowError?.key === m.key && (
                    <p role="alert" className="text-sm text-error-700">
                      {rowError.message}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
