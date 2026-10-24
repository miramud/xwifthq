"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, FolderTree, Network, Plus, Users } from "lucide-react";
import { orgFoundations, type CostCentre, type OrgUnit } from "@/lib/api/org-foundations-client";
import { Button, Card, Empty, PageHeader, Segmented, StatGrid } from "@/components/workspace/kit";
import { ErrorNote, Skeleton, StatCard, Switch } from "@/suite/lms/components/ui/ws";
import { buildTree } from "./logic";
import { LoadError, Notice, errorText } from "./shared";
import { OrgChart, UnitTreeList } from "./UnitTree";
import UnitPanel, { UnitFormDialog } from "./UnitPanel";
import CostCentres, { CostCentreDialog } from "./CostCentres";

/**
 * Structure: the organisation's units (divisions, departments, units, teams)
 * as a tree, who heads each, and the cost centres spending is charged to.
 * Approvals route up this tree, so a head here is who "the head of the
 * requester's unit" means.
 */

type Tab = "units" | "cost-centres";

export default function StructureBoard() {
  const [tab, setTab] = useState<Tab>("units");
  const [units, setUnits] = useState<OrgUnit[] | null>(null);
  const [centres, setCentres] = useState<CostCentre[] | null>(null);
  const [includeRetired, setIncludeRetired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<"tree" | "chart">("tree");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState(false);
  const [editingCentre, setEditingCentre] = useState<CostCentre | "new" | null>(null);

  const loadUnits = useCallback(
    () =>
      orgFoundations.units
        .tree(includeRetired)
        .then((u) => {
          setUnits(u);
          setLoadError(null);
        })
        .catch((e: unknown) => setLoadError(errorText(e, "The unit tree didn't load."))),
    [includeRetired],
  );

  useEffect(() => {
    void loadUnits();
  }, [loadUnits, reload]);

  useEffect(() => {
    let alive = true;
    orgFoundations.costCentres
      .list()
      .then((c) => alive && setCentres(c))
      .catch((e: unknown) => alive && setLoadError(errorText(e, "Cost centres didn't load.")));
    return () => {
      alive = false;
    };
  }, [reload]);

  const tree = useMemo(() => buildTree(units ?? []), [units]);
  const selected = units?.find((u) => u.id === selectedId) ?? null;

  const putUnit = (u: OrgUnit) => setUnits((list) => (list ? (list.some((x) => x.id === u.id) ? list.map((x) => (x.id === u.id ? u : x)) : [...list, u]) : [u]));
  const putCentre = (c: CostCentre) => setCentres((list) => (list ? (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]) : [c]));

  const say = (text: string) => {
    setError(null);
    setNotice(text);
  };

  const stats = useMemo(() => {
    const list = units ?? [];
    return {
      units: list.filter((u) => u.status === "active").length,
      headless: list.filter((u) => u.status === "active" && !u.head).length,
      people: list.reduce((n, u) => n + (u.memberCount ?? 0), 0),
      open: (centres ?? []).filter((c) => c.isOpen).length,
    };
  }, [units, centres]);

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <PageHeader
        eyebrow="Organisation"
        title="Structure"
        subtitle="Your units, who heads each one, and the cost centres your spending is charged to. Approvals route up this tree."
        actions={
          tab === "units" ? (
            <Button variant="primary" icon={Plus} onClick={() => setNewUnit(true)} disabled={units === null}>
              New unit
            </Button>
          ) : (
            <Button variant="primary" icon={Plus} onClick={() => setEditingCentre("new")} disabled={centres === null}>
              New cost centre
            </Button>
          )
        }
        tabs={[
          { key: "units", label: "Units", count: units ? stats.units : undefined },
          { key: "cost-centres", label: "Cost centres", count: centres?.length },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <Notice text={notice} />
      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      {tab === "units" ? (
        <>
          <div className="mb-6">
            <StatGrid cols={4}>
              <StatCard featured label="Active units" value={units ? stats.units : "-"} icon={FolderTree} />
              <StatCard label="Without a head" value={units ? stats.headless : "-"} icon={Network} hue="sun" hint={stats.headless > 0 ? "Their approvals go up a level" : "Every unit is headed"} />
              <StatCard label="People placed" value={units ? stats.people : "-"} icon={Users} hue="sky" />
              <StatCard label="Open cost centres" value={centres ? stats.open : "-"} icon={Coins} hue="mint" />
            </StatGrid>
          </div>

          {units === null && !loadError ? (
            <div aria-busy="true" className="grid gap-6 lg:grid-cols-3">
              <p className="sr-only">Loading the unit tree…</p>
              <Skeleton className="h-[420px] lg:col-span-2" />
              <Skeleton className="h-[420px]" />
            </div>
          ) : units !== null ? (
            <div className="grid items-start gap-6 lg:grid-cols-3">
              <Card className="min-w-0 overflow-hidden lg:col-span-2">
                <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <Segmented
                    label="Show as"
                    value={view}
                    onChange={setView}
                    options={[
                      { key: "tree", label: "Tree" },
                      { key: "chart", label: "Chart" },
                    ]}
                  />
                  <div className="flex items-center gap-4">
                    {view === "tree" && tree.length > 0 && (
                      <span className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setCollapsed(new Set())}>
                          Expand all
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setCollapsed(new Set((units ?? []).map((u) => u.id)))}>
                          Collapse all
                        </Button>
                      </span>
                    )}
                    <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700">
                      <Switch checked={includeRetired} onChange={setIncludeRetired} label="Show retired units" />
                      <span aria-hidden>Retired</span>
                    </label>
                  </div>
                </div>
                {tree.length === 0 ? (
                  <Empty
                    icon={FolderTree}
                    title="No units yet."
                    hint="Add your top-level divisions or departments first, then the units and teams beneath them."
                    action={
                      <Button icon={Plus} onClick={() => setNewUnit(true)}>
                        Add the first unit
                      </Button>
                    }
                  />
                ) : view === "tree" ? (
                  <UnitTreeList tree={tree} collapsed={collapsed} onToggle={toggle} selectedId={selectedId} onSelect={setSelectedId} />
                ) : (
                  <div className="p-5">
                    <OrgChart tree={tree} selectedId={selectedId} onSelect={setSelectedId} />
                  </div>
                )}
              </Card>

              <div className="min-w-0 lg:sticky lg:top-20">
                {selected ? (
                  <UnitPanel
                    key={selected.id}
                    unit={selected}
                    units={units}
                    costCentres={centres ?? []}
                    onChanged={(u, text) => {
                      putUnit(u);
                      say(text);
                    }}
                    onMoved={(text) => {
                      say(text);
                      void loadUnits();
                    }}
                    onDeleted={(u) => {
                      setUnits((list) => list?.filter((x) => x.id !== u.id) ?? list);
                      setSelectedId(null);
                      say(`${u.name} deleted.`);
                    }}
                  />
                ) : (
                  <Card className="p-2">
                    <Empty icon={FolderTree} hue="slate" title="Choose a unit." hint="Its head, members and cost centre show here, with ways to edit, move or delete it." />
                  </Card>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : centres === null && !loadError ? (
        <Skeleton className="h-[360px]" />
      ) : centres !== null ? (
        <CostCentres
          rows={centres}
          units={units ?? []}
          onEdit={(c) => setEditingCentre(c)}
          onSaved={(c, text) => {
            putCentre(c);
            say(text);
          }}
          onDeleted={(c) => {
            setCentres((list) => list?.filter((x) => x.id !== c.id) ?? list);
            say(`${c.code} deleted.`);
          }}
          onError={(m) => {
            setNotice(null);
            setError(m);
          }}
        />
      ) : null}

      {newUnit && units && (
        <UnitFormDialog
          unit={null}
          units={units}
          costCentres={centres ?? []}
          parentId={selected?.status === "active" ? selected.id : null}
          onClose={() => setNewUnit(false)}
          onSaved={(u) => {
            setNewUnit(false);
            putUnit(u);
            setSelectedId(u.id);
            say(`${u.name} added.`);
          }}
        />
      )}
      {editingCentre && (
        <CostCentreDialog
          centre={editingCentre === "new" ? null : editingCentre}
          units={units ?? []}
          onClose={() => setEditingCentre(null)}
          onSaved={(c) => {
            const wasNew = editingCentre === "new";
            setEditingCentre(null);
            putCentre(c);
            say(wasNew ? `${c.code} added.` : `${c.code} saved.`);
          }}
        />
      )}
    </div>
  );
}
