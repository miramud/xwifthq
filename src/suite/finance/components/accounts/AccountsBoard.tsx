"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Cog,
  Download,
  FolderTree,
  Landmark,
  ListTree,
  Plus,
  TriangleAlert,
  UserRound,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { errorText, ledger, type Account, type AccountsPayload } from "@/lib/api/finance-ledger-client";
import { Button, Card, Chip, Empty, PageHeader, SearchField, Segmented, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo, mayUseFinance } from "@/suite/finance/lib/finance-access";
import { accounting } from "@/suite/finance/lib/format";
import { csvAmount, downloadCsv } from "../reports/shared";
import { AccountDialog } from "./AccountDialog";
import { TemplatePicker } from "./TemplatePicker";
import {
  CASH_FLOW,
  DIMENSION_LABEL,
  FAMILIES,
  balancesById,
  buildTree,
  familyOf,
  normalSigned,
  systemKeyLabel,
  typeLabel,
  type Family,
  type TreeNode,
} from "./meta";

/**
 * The chart of accounts as a tree, one section per statement family:
 * headings carry their children's balance, postable accounts show what they
 * demand of a journal line (project, cost centre…), what the software posts
 * to them, and their balance today.
 */

const DIM_ICON: Record<string, LucideIcon> = {
  project: FolderTree,
  "cost centre": Building2,
  counterparty: Users,
  person: UserRound,
};

type FamilyFilter = "all" | Family;

export default function AccountsBoard() {
  const { user } = useAuth();
  const [payload, setPayload] = useState<AccountsPayload | null>(null);
  const [balances, setBalances] = useState<Map<string, number> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<FamilyFilter>("all");
  const [showOff, setShowOff] = useState(false);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canReports = mayUseFinance(user, "reports");
  useEffect(() => {
    let alive = true;
    ledger.accounts
      .list()
      .then((p) => {
        if (!alive) return;
        setPayload(p);
        setLoadError(null);
        if (canReports && p.accounts.length)
          ledger.reports
            .trialBalance()
            .then((tb) => alive && setBalances(balancesById(p.accounts, tb.rows)))
            .catch(() => undefined);
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e) || "The chart of accounts didn't load."));
    return () => {
      alive = false;
    };
  }, [reload, canReports]);

  const accounts = useMemo(() => payload?.accounts ?? [], [payload]);
  const missingKeys = useMemo(() => {
    const held = new Set(accounts.map((a) => a.systemKey).filter(Boolean));
    return (payload?.systemKeys ?? []).filter((k) => !held.has(k));
  }, [accounts, payload]);

  /* Search keeps an account's headings, so a match is never shown out of its place. */
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const keep = new Set<string>();
    for (const a of accounts) {
      if (!showOff && !a.active) continue;
      if (family !== "all" && familyOf(a.type) !== family) continue;
      const hay = `${a.code} ${a.name} ${a.aliases.map((x) => x.alias).join(" ")} ${a.systemKey ? systemKeyLabel(a.systemKey) : ""}`.toLowerCase();
      if (needle && !hay.includes(needle)) continue;
      let cur: Account | undefined = a;
      while (cur && !keep.has(cur.id)) {
        keep.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
    }
    return accounts.filter((a) => keep.has(a.id));
  }, [accounts, q, family, showOff]);

  const tree = useMemo(() => buildTree(visible), [visible]);
  const searching = q.trim().length > 0;
  const canCreate = mayDo(user, "accounts", "create");
  const canEdit = mayDo(user, "accounts", "update");

  const toggle = (id: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (loadError) return <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />;
  if (!payload) return <Skeleton className="h-[32rem]" />;

  if (accounts.length === 0)
    return (
      <div>
        <PageHeader title="Chart of accounts" subtitle="The accounts every journal posts to." />
        <TemplatePicker
          templates={payload.templates}
          canApply={mayDo(user, "accounts", "apply_template")}
          onApplied={(n) => {
            setNotice(`${n} accounts created. Adjust any of them below.`);
            setReload((x) => x + 1);
          }}
          onBlank={canCreate ? () => setEditing("new") : undefined}
        />
        {editing && (
          <AccountDialog
            account={editing === "new" ? null : editing}
            accounts={accounts}
            systemKeys={payload.systemKeys}
            onClose={() => setEditing(null)}
            onSaved={(msg) => {
              setEditing(null);
              setNotice(msg);
              setReload((x) => x + 1);
            }}
          />
        )}
      </div>
    );

  const postable = accounts.filter((a) => a.isPostable && a.active).length;

  /* What is listed, in chart order, with the filters applied. */
  const exportCsv = () => {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    downloadCsv("chart-of-accounts.csv", [
      ["Code", "Name", "Type", "Parent", "Posting", "Normal balance", "Currency", "Used for", "Status", "Balance"],
      ...visible.map((a) => {
        const bal = balances?.get(a.id);
        return [
          a.code,
          a.name,
          typeLabel(a.type),
          a.parentId ? (byId.get(a.parentId)?.code ?? "") : "",
          a.isPostable ? "Posting" : "Heading",
          a.normalBalance === "credit" ? "Credit" : "Debit",
          a.currency ?? "",
          a.systemKey ? systemKeyLabel(a.systemKey) : "",
          a.active ? "Open" : "Switched off",
          bal === undefined ? "" : csvAmount(normalSigned(a, bal)),
        ];
      }),
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Chart of accounts"
        subtitle={`${accounts.length} accounts, ${postable} open for posting. Balances are as at today.`}
        actions={
          <>
            <Button icon={Download} onClick={exportCsv} disabled={visible.length === 0}>
              Download CSV
            </Button>
            {canCreate && (
              <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
                New account
              </Button>
            )}
          </>
        }
      />
      <Notice text={notice} />

      {missingKeys.length > 0 && (
        <div className="mb-5 rounded-xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm text-sun-700">
          <span className="flex items-start gap-2">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Automatic postings need an account for {missingKeys.length === 1 ? "one purpose" : `${missingKeys.length} purposes`} that has none:{" "}
              <strong>{missingKeys.map(systemKeyLabel).join(", ")}</strong>. Open the right account and set what it is used for.
            </span>
          </span>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchField value={q} onChange={setQ} placeholder="Search code, name or another name" label="Search accounts" className="w-full lg:max-w-sm" />
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<FamilyFilter>
            label="Show"
            value={family}
            onChange={setFamily}
            options={[{ key: "all", label: "All" }, ...FAMILIES.map((f) => ({ key: f.key as FamilyFilter, label: f.key === "equity" ? "Reserves" : f.label }))]}
          />
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} className="h-4 w-4 accent-primary-600" />
            Show switched-off accounts
          </label>
        </div>
      </div>

      {tree.length === 0 ? (
        <Card>
          <Empty icon={ListTree} title="No accounts match" hint="Try another word, or show every family." />
        </Card>
      ) : (
        <div className="space-y-5">
          {FAMILIES.map((f) => {
            const roots = tree.filter((n) => familyOf(n.account.type) === f.key);
            if (!roots.length) return null;
            const total = roots.reduce((s, n) => s + (balances?.get(n.account.id) ?? 0), 0);
            return (
              <Card key={f.key} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
                  <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-neutral-900">
                    <span className={cx("h-2.5 w-2.5 rounded-full", HUE[f.hue].dot)} aria-hidden />
                    {f.label}
                  </h2>
                  {balances && (
                    <span className="text-sm font-semibold tabular-nums text-neutral-700">
                      {accounting(f.key === "assets" || f.key === "costs" ? total : -total, true)}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <caption className="sr-only">{f.label} accounts</caption>
                    <thead>
                      <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        <th scope="col" className="w-28 py-2.5 pl-5 pr-2">
                          Code
                        </th>
                        <th scope="col" className="px-2 py-2.5">
                          Account
                        </th>
                        <th scope="col" className="px-2 py-2.5">
                          Posting rules
                        </th>
                        <th scope="col" className="w-40 py-2.5 pl-2 pr-5 text-right">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roots.map((n) => (
                        <TreeRows
                          key={n.account.id}
                          node={n}
                          depth={0}
                          closed={searching ? new Set() : closed}
                          onToggle={toggle}
                          balances={balances}
                          onOpen={canEdit ? (a) => setEditing(a) : undefined}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <AccountDialog
          account={editing === "new" ? null : editing}
          accounts={accounts}
          systemKeys={payload.systemKeys}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setNotice(msg);
            setReload((x) => x + 1);
          }}
        />
      )}
    </div>
  );
}

function TreeRows({
  node,
  depth,
  closed,
  onToggle,
  balances,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  closed: Set<string>;
  onToggle: (id: string) => void;
  balances: Map<string, number> | null;
  onOpen?: (a: Account) => void;
}) {
  const a = node.account;
  const heading = !a.isPostable;
  const open = !closed.has(a.id);
  const bal = balances?.get(a.id);
  return (
    <Fragment>
      <tr className={cx("border-b border-neutral-100 last:border-0", heading ? "bg-neutral-50/40" : "hover:bg-neutral-50/60", !a.active && "opacity-60")}>
        <td className="py-2.5 pl-5 pr-2 font-mono text-[13px] tabular-nums text-neutral-600">{a.code}</td>
        <td className="px-2 py-2">
          <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: depth * 20 }}>
            {node.children.length > 0 ? (
              <button
                type="button"
                onClick={() => onToggle(a.id)}
                aria-expanded={open}
                aria-label={`${open ? "Collapse" : "Expand"} ${a.name}`}
                className="-ml-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                {open ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
              </button>
            ) : (
              <span className="w-7 shrink-0" aria-hidden />
            )}
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(a)}
                className={cx(
                  "min-h-9 cursor-pointer truncate rounded-lg px-1 text-left outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300",
                  heading ? "font-semibold text-neutral-900" : "font-medium text-neutral-800",
                )}
              >
                {a.name}
              </button>
            ) : (
              <span className={cx("truncate px-1", heading ? "font-semibold text-neutral-900" : "font-medium text-neutral-800")}>{a.name}</span>
            )}
            {heading && <span className="ml-1 shrink-0 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Heading</span>}
          </div>
        </td>
        <td className="px-2 py-2">
          <span className="flex flex-wrap items-center gap-1">
            {!heading && a.type !== "asset" && a.type !== "liability" && a.type !== "equity" && a.type !== "revenue" && a.type !== "expense" && (
              <Chip hue="slate" className="!px-2 !py-0.5 !text-[11px]">
                {typeLabel(a.type)}
              </Chip>
            )}
            {a.systemKey && (
              <Chip hue="blue" icon={Cog} className="!px-2 !py-0.5 !text-[11px]">
                {systemKeyLabel(a.systemKey)}
              </Chip>
            )}
            {a.isBank && (
              <Chip hue="sky" icon={Landmark} className="!px-2 !py-0.5 !text-[11px]">
                Bank
              </Chip>
            )}
            {a.currency && (
              <Chip hue="grape" className="!px-2 !py-0.5 !text-[11px]">
                {a.currency} only
              </Chip>
            )}
            {a.requires.map((d) => {
              const Icon = DIM_ICON[d] ?? Workflow;
              return (
                <Chip key={d} hue="sun" icon={Icon} className="!px-2 !py-0.5 !text-[11px]">
                  Needs {DIMENSION_LABEL[d]?.toLowerCase() ?? d}
                </Chip>
              );
            })}
            {a.cashFlow && a.cashFlow !== "operating" && (
              <Chip hue="mint" className="!px-2 !py-0.5 !text-[11px]">
                {CASH_FLOW.find((c) => c.key === a.cashFlow)?.label} cash flow
              </Chip>
            )}
            {!a.active && (
              <Chip hue="slate" className="!px-2 !py-0.5 !text-[11px]">
                Switched off
              </Chip>
            )}
          </span>
        </td>
        <td className={cx("py-2.5 pl-2 pr-5 text-right tabular-nums", heading ? "font-semibold text-neutral-900" : "text-neutral-800")}>
          {bal === undefined ? (
            <span className="text-neutral-400">—</span>
          ) : heading ? (
            accounting(normalSigned(a, bal), true)
          ) : (
            <Link
              href={`/suite/finance/reports/ledger/${a.id}`}
              className="rounded outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
              aria-label={`${a.name} ledger, balance ${accounting(normalSigned(a, bal), true)}`}
            >
              {accounting(normalSigned(a, bal), true)}
            </Link>
          )}
        </td>
      </tr>
      {open && node.children.map((c) => <TreeRows key={c.account.id} node={c} depth={depth + 1} closed={closed} onToggle={onToggle} balances={balances} onOpen={onOpen} />)}
    </Fragment>
  );
}
