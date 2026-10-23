"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FolderKanban, Plus, SlidersHorizontal, Tag, X } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { banking, errorText, type BankRule, type ProjectKeyword, type RulesBook } from "@/lib/api/finance-banking-client";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount } from "@/suite/finance/lib/format";
import { RULE_ACTIONS, categoryMeta, humanise } from "@/suite/finance/components/banking/labels";
import { lookupText, useLookup } from "@/suite/finance/components/banking/lookups";
import FeeBandsEditor from "./FeeBandsEditor";
import RuleDialog from "./RuleDialog";

/**
 * Statement rules: how a new statement line is classified before anybody
 * looks at it. Rules run in priority order and the first match wins; then
 * what people chose before ("remember this") fills the gaps, and project
 * keywords in the narration tag the project. The transfer-fee table splits
 * outward transfers into what was paid, the fee and the VAT.
 */

const DIRECTION: Record<string, string> = { DR: "Money out", CR: "Money in" };

export default function RulesBoard() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const accounts = useLookup("accounts");
  const [book, setBook] = useState<RulesBook | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<BankRule | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    banking.rules
      .book()
      .then((b) => {
        if (!alive) return;
        setBook(b);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(`Statement rules didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [reload]);

  const accountLabel = useMemo(() => new Map(accounts.options.map((o) => [o.value, o.label])), [accounts.options]);
  const rules = useMemo(() => [...(book?.rules ?? [])].sort((a, b) => a.priority - b.priority), [book]);
  const may = {
    create: mayDo(user, "bank_rules", "create"),
    update: mayDo(user, "bank_rules", "update"),
    remove: mayDo(user, "bank_rules", "delete"),
    addKeyword: mayDo(user, "bank_rules", "add_keyword"),
    removeKeyword: mayDo(user, "bank_rules", "remove_keyword"),
    fees: mayDo(user, "bank_rules", "update_fee_bands"),
  };

  const toggle = async (r: BankRule, active: boolean) => {
    setError(null);
    setBook((b) => (b ? { ...b, rules: b.rules.map((x) => (x.id === r.id ? { ...x, active } : x)) } : b));
    try {
      await banking.rules.update(r.id, { active });
    } catch (e) {
      setBook((b) => (b ? { ...b, rules: b.rules.map((x) => (x.id === r.id ? { ...x, active: !active } : x)) } : b));
      setError(`“${r.name}” wasn't ${active ? "switched on" : "switched off"}. ${errorText(e)}`);
    }
  };

  const sets = (r: BankRule) => {
    const parts: React.ReactNode[] = [];
    if (r.category) {
      const c = categoryMeta(r.category);
      parts.push(
        <Chip key="c" hue={c.hue} className="!px-2 !py-0.5 !text-[11px]">
          {c.label}
        </Chip>,
      );
    }
    const acct = r.accountId ? (accountLabel.get(r.accountId) ?? "An account") : r.systemKey ? humanise(r.systemKey) : null;
    if (acct) parts.push(<span key="a" className="text-xs text-neutral-700">{acct}</span>);
    return parts.length ? <span className="flex flex-wrap items-center gap-1.5">{parts}</span> : <span className="text-xs text-neutral-400">Nothing set</span>;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Banking"
        title="Statement rules"
        subtitle="How each new statement line is classified before anybody looks at it. Rules run top to bottom; the first that matches wins."
        actions={
          may.create ? (
            <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
              New rule
            </Button>
          ) : undefined
        }
      />

      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      {book === null && !loadError ? (
        <div aria-busy="true" className="space-y-5">
          <p className="sr-only">Loading statement rules…</p>
          <Skeleton className="h-[420px]" />
        </div>
      ) : book !== null ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <Panel title="Rules" subtitle={`${rules.length} ${rules.length === 1 ? "rule" : "rules"}, in the order they run`} icon={SlidersHorizontal} className="xl:col-span-2" bodyClassName="p-0">
            {rules.length === 0 ? (
              <Empty icon={SlidersHorizontal} title="No rules yet." hint="The starter rules are added with the first statement. Add your own for the payments you see every month." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <caption className="sr-only">Statement rules in priority order</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-xs text-neutral-500">
                      <th scope="col" className="px-5 py-3 font-semibold">#</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Rule</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Then</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Sets</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">Hits</th>
                      <th scope="col" className="px-5 py-3 font-semibold">On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rules.map((r) => (
                      <tr key={r.id} className={cx("align-top", !r.active && "bg-neutral-50/60")}>
                        <td className="px-5 py-3 text-xs font-semibold text-neutral-400 tabular-nums">{r.priority}</td>
                        <td className="max-w-[300px] px-3 py-3">
                          {may.update ? (
                            <button type="button" onClick={() => setEditing(r)} className={cx("cursor-pointer text-left font-semibold outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300", r.active ? "text-neutral-900" : "text-neutral-500")}>
                              {r.name}
                            </button>
                          ) : (
                            <span className="font-semibold text-neutral-900">{r.name}</span>
                          )}
                          <code className="mt-1 block break-all rounded-md bg-neutral-100/80 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700">{r.pattern}</code>
                          <span className="mt-1 block text-[11px] text-neutral-500">
                            {r.direction ? DIRECTION[r.direction] : "Money in or out"}
                            {r.amountMin != null && ` · from ${amount(r.amountMin)}`}
                            {r.amountMax != null && ` · up to ${amount(r.amountMax)}`}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-neutral-700">{RULE_ACTIONS[r.action]?.label ?? humanise(r.action)}</td>
                        <td className="px-3 py-3">{sets(r)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-neutral-700">{r.hits}</td>
                        <td className="px-5 py-3">
                          <Switch checked={r.active} onChange={(v) => void toggle(r, v)} label={`Use “${r.name}”`} disabled={!may.update} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="space-y-5">
            <Keywords
              keywords={book.keywords}
              canAdd={may.addKeyword}
              canRemove={may.removeKeyword}
              onAdded={(k) => setBook((b) => (b ? { ...b, keywords: [...b.keywords.filter((x) => x.keyword !== k.keyword), k].sort((x, y) => x.keyword.localeCompare(y.keyword)) } : b))}
              onRemove={async (k) => {
                const ok = await confirm({ title: `Remove the keyword “${k.keyword}”?`, body: "Lines already tagged keep their project. New lines with this word won't be tagged.", confirmLabel: "Remove keyword" });
                if (!ok) return;
                try {
                  await banking.rules.removeKeyword(k.id);
                  setBook((b) => (b ? { ...b, keywords: b.keywords.filter((x) => x.id !== k.id) } : b));
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            />
            <FeeBandsEditor bands={book.feeBands} editable={may.fees} onSaved={(feeBands) => setBook((b) => (b ? { ...b, feeBands } : b))} />
          </div>
        </div>
      ) : null}

      {editing !== null && (
        <RuleDialog
          rule={editing === "new" ? null : editing}
          nextPriority={(rules[rules.length - 1]?.priority ?? 90) + 10}
          canDelete={may.remove}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setBook((b) => (b ? { ...b, rules: b.rules.some((x) => x.id === saved.id) ? b.rules.map((x) => (x.id === saved.id ? saved : x)) : [...b.rules, saved] } : b));
          }}
          onDeleted={(id) => {
            setEditing(null);
            setBook((b) => (b ? { ...b, rules: b.rules.filter((x) => x.id !== id) } : b));
          }}
        />
      )}
    </div>
  );
}

function Keywords({
  keywords,
  canAdd,
  canRemove,
  onAdded,
  onRemove,
}: {
  keywords: ProjectKeyword[];
  canAdd: boolean;
  canRemove: boolean;
  onAdded: (k: ProjectKeyword) => void;
  onRemove: (k: ProjectKeyword) => void;
}) {
  const uid = useId();
  const projects = useLookup("projects");
  const [word, setWord] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const projectName = (id: string) => projects.options.find((o) => o.value === id)?.label;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (word.trim() === "" || projectId === "") {
      setError("Type a word and choose its project.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const k = await banking.rules.addKeyword(word.trim(), projectId);
      onAdded({ ...k, project: k.project ?? projectName(k.projectId) ?? null });
      setWord("");
      setProjectId("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Project keywords" subtitle="A word in the narration tags the line's project" icon={FolderKanban} hue="grape">
      {keywords.length === 0 ? (
        <p className="text-sm text-neutral-500">No keywords yet. Add a project&apos;s code or short name as it appears on payments, like “TETF-2026”.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {keywords.map((k) => (
            <li key={k.id} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1 pl-2.5 pr-1 text-xs">
              <Tag size={12} className="text-grape-600" aria-hidden />
              <span className="font-mono font-semibold text-neutral-900">{k.keyword}</span>
              <span className="text-neutral-500">→ {k.project ?? projectName(k.projectId) ?? "Project"}</span>
              {canRemove && (
                <button type="button" aria-label={`Remove keyword ${k.keyword}`} onClick={() => onRemove(k)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-neutral-400 outline-none hover:bg-neutral-100 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300">
                  <X size={13} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <form onSubmit={add} className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <label htmlFor={`${uid}-word`} className="mb-1 block text-xs font-semibold text-neutral-600">
                Word
              </label>
              <input id={`${uid}-word`} value={word} onChange={(e) => setWord(e.target.value)} maxLength={48} className={cx(inputClass, "font-mono uppercase")} />
            </div>
            <div>
              <label htmlFor={`${uid}-project`} className="mb-1 block text-xs font-semibold text-neutral-600">
                Project
              </label>
              <SearchableSelect id={`${uid}-project`} value={projectId} onChange={setProjectId} options={projects.options} placeholder="Choose a project" noOptionsText={lookupText(projects, "projects")} />
            </div>
          </div>
          <FieldError message={error ?? undefined} />
          <Button type="submit" size="sm" icon={Plus} disabled={busy}>
            {busy ? "Adding…" : "Add keyword"}
          </Button>
        </form>
      )}
    </Panel>
  );
}
