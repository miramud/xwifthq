"use client";

import { useState } from "react";
import { Plus, Receipt, Save, Trash2 } from "lucide-react";
import { Button, Panel, cx } from "@/components/workspace/kit";
import { ErrorNote } from "@/suite/lms/components/ui/ws";
import { banking, errorText, type FeeBand } from "@/lib/api/finance-banking-client";
import { amount, amountInput, parseAmount } from "@/suite/finance/lib/format";

/**
 * The transfer-fee table: for a transfer of up to so much, the bank charges
 * this fee plus this VAT. The classifier uses it to split an outward transfer
 * into what was paid, the fee and the VAT. Naira on screen; kobo on the wire.
 */

interface Row {
  upTo: string;
  fee: string;
  vat: string;
}

const toRows = (bands: FeeBand[] | null): Row[] => (bands ?? []).map((b) => ({ upTo: b.upTo === null ? "" : amountInput(b.upTo), fee: amountInput(b.fee) || "0.00", vat: amountInput(b.vat) || "0.00" }));

/** Rows → bands, or the first problem in words. The last band may be open-ended; no other may. */
export function parseBands(rows: Row[]): { bands: FeeBand[] } | { error: string } {
  if (rows.length === 0) return { error: "Add at least one band." };
  const bands: FeeBand[] = [];
  let last = 0;
  for (const [i, r] of rows.entries()) {
    const open = r.upTo.trim() === "";
    if (open && i !== rows.length - 1) return { error: `Band ${i + 1}: only the last band can have no upper limit.` };
    const upTo = open ? null : parseAmount(r.upTo);
    const fee = parseAmount(r.fee || "0");
    const vat = parseAmount(r.vat || "0");
    if (!open && (upTo === null || upTo <= 0)) return { error: `Band ${i + 1}: type the upper limit as an amount, like 5,000.00.` };
    if (upTo !== null && upTo <= last) return { error: `Band ${i + 1}: each limit has to be higher than the one before.` };
    if (fee === null || vat === null) return { error: `Band ${i + 1}: type the fee and VAT as amounts, like 26.88.` };
    bands.push({ upTo, fee, vat });
    if (upTo !== null) last = upTo;
  }
  return { bands };
}

export default function FeeBandsEditor({ bands, editable, onSaved }: { bands: FeeBand[] | null; editable: boolean; onSaved: (bands: FeeBand[]) => void }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(bands));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cell = "h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-right text-sm tabular-nums outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-neutral-50";

  const set = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = async () => {
    setNotice(null);
    const parsed = parseBands(rows);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const saved = await banking.rules.saveFeeBands(parsed.bands);
      setRows(toRows(saved));
      onSaved(saved);
      setNotice("Fee table saved. New statements are split with it.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // A worked example from the first band: what a transfer would be read as.
  const first = parseBands(rows);
  const example = "bands" in first && first.bands[0] ? first.bands[0] : null;
  const exPrincipal = example ? Math.min(example.upTo ?? 23_200_000, 23_200_000) : 0;

  return (
    <Panel
      title="Transfer fees"
      subtitle="What the bank charges per outward transfer, by size"
      icon={Receipt}
      hue="sun"
      actions={
        editable ? (
          <Button size="sm" variant="primary" icon={Save} disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save fee table"}
          </Button>
        ) : undefined
      }
    >
      {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
      {notice && (
        <p role="status" className="mb-3 rounded-xl bg-mint-50 px-4 py-2.5 text-sm text-mint-700">
          {notice}
        </p>
      )}
      <table className="w-full text-sm">
        <caption className="sr-only">Transfer fee bands, in naira</caption>
        <thead>
          <tr className="text-left text-xs text-neutral-500">
            <th scope="col" className="pb-2 font-semibold">Transfer up to (₦)</th>
            <th scope="col" className="pb-2 pl-2 font-semibold">Fee (₦)</th>
            <th scope="col" className="pb-2 pl-2 font-semibold">VAT (₦)</th>
            {editable && <th scope="col" className="sr-only">Remove</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-1">
                <input aria-label={`Band ${i + 1}: transfer up to`} value={r.upTo} onChange={(e) => set(i, "upTo", e.target.value)} disabled={!editable} placeholder={i === rows.length - 1 ? "No limit" : ""} inputMode="decimal" className={cell} />
              </td>
              <td className="py-1 pl-2">
                <input aria-label={`Band ${i + 1}: fee`} value={r.fee} onChange={(e) => set(i, "fee", e.target.value)} disabled={!editable} inputMode="decimal" className={cell} />
              </td>
              <td className="py-1 pl-2">
                <input aria-label={`Band ${i + 1}: VAT`} value={r.vat} onChange={(e) => set(i, "vat", e.target.value)} disabled={!editable} inputMode="decimal" className={cell} />
              </td>
              {editable && (
                <td className="py-1 pl-1">
                  <button
                    type="button"
                    aria-label={`Remove band ${i + 1}`}
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-neutral-400 outline-none hover:bg-neutral-100 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={() => setRows((rs) => [...rs, { upTo: "", fee: "0.00", vat: "0.00" }])}>
          Add band
        </Button>
      )}
      {example && (
        <p className={cx("mt-3 rounded-xl bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600")}>
          For example, a transfer of {amount(exPrincipal + example.fee + example.vat)} reads as {amount(exPrincipal)} paid + {amount(example.fee)} fee + {amount(example.vat)} VAT.
        </p>
      )}
    </Panel>
  );
}
