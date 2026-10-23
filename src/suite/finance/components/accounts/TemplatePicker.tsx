"use client";

import { useState } from "react";
import { CheckCircle2, GraduationCap, Laptop, ListTree, Plus, type LucideIcon } from "lucide-react";
import { errorText, ledger, type CoaTemplate } from "@/lib/api/finance-ledger-client";
import { Button, Card, cx } from "@/components/workspace/kit";
import { ErrorNote, IconTile } from "@/suite/lms/components/ui/ws";

/** An empty chart: start from a ready-made one, or build it account by account. */

const ICONS: Record<string, LucideIcon> = { institution_v1: GraduationCap, rcs_v1: Laptop };

export function TemplatePicker({
  templates,
  canApply,
  onApplied,
  onBlank,
}: {
  templates: CoaTemplate[];
  canApply: boolean;
  onApplied: (created: number) => void;
  onBlank?: () => void;
}) {
  const [chosen, setChosen] = useState(templates[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await ledger.accounts.applyTemplate(chosen);
      onApplied(r.created);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <IconTile icon={ListTree} hue="blue" size={48} />
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">Start your chart of accounts</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Pick the chart closest to how your organisation works. Every account in it can be renamed, switched off or added to afterwards, and the accounts automatic postings need are already marked.
          </p>
        </div>
      </div>

      {error && <ErrorNote className="mt-5">{error}</ErrorNote>}

      <div role="radiogroup" aria-label="Chart templates" className="mt-6 grid gap-3 md:grid-cols-2">
        {templates.map((t) => {
          const on = t.key === chosen;
          const Icon = ICONS[t.key] ?? ListTree;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChosen(t.key)}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                on ? "border-primary-400 bg-primary-50/60 ring-1 ring-primary-300" : "border-neutral-200 hover:border-neutral-300",
              )}
            >
              <IconTile icon={Icon} hue={on ? "blue" : "slate"} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 text-[15px] font-semibold text-neutral-900">
                  {t.name}
                  {on && <CheckCircle2 size={18} className="shrink-0 text-primary-600" aria-hidden />}
                </span>
                <span className="mt-1 block text-sm text-neutral-600">{t.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {canApply ? (
          <Button variant="primary" onClick={apply} disabled={!chosen || busy}>
            {busy ? "Creating accounts…" : "Start from this chart"}
          </Button>
        ) : (
          <p className="text-sm text-neutral-500">Ask a financial controller to choose the chart.</p>
        )}
        {onBlank && (
          <Button icon={Plus} onClick={onBlank}>
            Add accounts one at a time
          </Button>
        )}
      </div>
    </Card>
  );
}
