/*
  CSV for any register: what is on screen, as a spreadsheet opens it.
  Money goes out as a plain decimal in major units (with a currency column
  beside it), dates as ISO, nothing formatted for reading.
*/

export type CsvCell = string | number | boolean | null | undefined;

const cell = (v: CsvCell) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** Minor units as a plain decimal for a spreadsheet: 123450 → "1234.50"; blank when unknown. */
export const csvAmount = (minor: number | null | undefined) =>
  minor === null || minor === undefined || Number.isNaN(minor) ? "" : (minor / 100).toFixed(2);

/** An ISO date (YYYY-MM-DD) from a date or timestamp string; blank when unknown. */
export const csvDate = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");

/** A filename with today's date: `vouchers` → `vouchers_2026-10-07.csv`. */
export const csvName = (base: string, ...parts: (string | null | undefined)[]) =>
  `${[base, ...parts.filter(Boolean)].join("_").replace(/[^\w.-]+/g, "-")}.csv`;

export function downloadCsv(filename: string, rows: CsvCell[][]) {
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
