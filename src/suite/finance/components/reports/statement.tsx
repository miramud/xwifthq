"use client";

import { Fragment } from "react";
import type { StatementSection } from "@/lib/api/finance-ledger-client";
import { FigureRow } from "./shared";

/*
  A statement section the way it is printed: rows under their heading
  (the parent account), then the section's total over a rule. A heading
  with a single account in it is not repeated above that account.
*/

export function SectionBlock({
  title,
  section,
  totalLabel,
  ledgerHref,
  sign = 1,
}: {
  title: string;
  section: StatementSection;
  totalLabel: string;
  ledgerHref?: (accountId: string) => string;
  /** −1 shows the section negated (an expense under "less"). */
  sign?: 1 | -1;
}) {
  const groups = new Map<string, StatementSection["rows"]>();
  for (const r of section.rows) {
    const g = r.group ?? "";
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  return (
    <>
      <tr>
        <th colSpan={2} scope="colgroup" className="pb-1 pt-5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </th>
      </tr>
      {section.rows.length === 0 && <FigureRow label="Nothing posted" value={null} indent={1} muted />}
      {[...groups.entries()].map(([g, rows]) => (
        <Fragment key={g || "_"}>
          {g && rows.length > 1 && <FigureRow label={g} value={null} indent={1} muted />}
          {rows.map((r) => (
            <FigureRow
              key={r.accountId}
              label={
                <>
                  <span className="mr-2 font-mono text-[12px] text-neutral-500">{r.code}</span>
                  {r.name}
                </>
              }
              value={sign * r.amount}
              indent={g && rows.length > 1 ? 2 : 1}
              href={ledgerHref?.(r.accountId)}
            />
          ))}
        </Fragment>
      ))}
      <FigureRow label={totalLabel} value={sign * section.total} strong border="top" />
    </>
  );
}
