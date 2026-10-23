"use client";

import type { LucideIcon } from "lucide-react";
import { PenLine } from "lucide-react";
import { Button, cx } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import { Drawer } from "@/suite/projects/components/ui/pkit";

/**
 * A record read beside its list: every fact the list already carries, then
 * whatever related rows came with it (payments, confirmations, history). It
 * reads only; "Edit" hands over to the record's existing dialog.
 */

export interface DetailFact {
  label: string;
  value: React.ReactNode;
  /** Spread across both columns (notes, addresses). */
  wide?: boolean;
}

export interface DetailSection {
  title: string;
  /** Shown when the section has nothing in it. */
  empty?: string;
  children?: React.ReactNode;
}

const blank = (v: React.ReactNode) => v === null || v === undefined || v === "" || v === false;

export function DetailDrawer({
  title,
  subtitle,
  icon,
  hue = "blue",
  status,
  facts,
  sections = [],
  onClose,
  onEdit,
  editLabel = "Edit",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  hue?: Hue;
  /** A chip or two beside the facts (status, days left). */
  status?: React.ReactNode;
  facts: DetailFact[];
  sections?: DetailSection[];
  onClose: () => void;
  /** Closes the drawer and opens the record's edit dialog. Leave out when the person may not edit. */
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <Drawer
      title={title}
      subtitle={subtitle}
      icon={icon}
      hue={hue}
      onClose={onClose}
      width="lg"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {onEdit && (
            <Button
              variant="primary"
              icon={PenLine}
              className="ml-auto"
              onClick={() => {
                onClose();
                onEdit();
              }}
            >
              {editLabel}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {status && <div className="flex flex-wrap gap-2">{status}</div>}
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className={cx("rounded-xl bg-neutral-50 px-3 py-2.5", f.wide && "sm:col-span-2")}>
              <dt className="text-xs font-medium text-neutral-500">{f.label}</dt>
              <dd className="mt-0.5 break-words text-sm font-semibold text-neutral-900">{blank(f.value) ? <span className="font-normal text-neutral-500">Not recorded</span> : f.value}</dd>
            </div>
          ))}
        </dl>
        {sections.map((s) => (
          <section key={s.title} aria-label={s.title}>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">{s.title}</h3>
            {blank(s.children) ? <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">{s.empty ?? "Nothing yet."}</p> : s.children}
          </section>
        ))}
      </div>
    </Drawer>
  );
}

/** A plain list of related rows for a drawer section: a main line, a quiet line, and something on the right. */
export function DetailList({ rows }: { rows: { key: string; main: React.ReactNode; sub?: React.ReactNode; aside?: React.ReactNode }[] }) {
  return (
    <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
      {rows.map((r) => (
        <li key={r.key} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900">{r.main}</p>
            {r.sub && <p className="mt-0.5 text-xs text-neutral-500">{r.sub}</p>}
          </div>
          {r.aside && <div className="shrink-0 text-right text-sm tabular-nums">{r.aside}</div>}
        </li>
      ))}
    </ul>
  );
}
