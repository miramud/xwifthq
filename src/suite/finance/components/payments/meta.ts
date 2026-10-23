import { CalendarCheck2, CheckCircle2, FileDown, PenLine, XCircle, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { ScheduleStatus } from "@/lib/api/finance-payments-client";

export const SCHEDULE_STATUS: Record<ScheduleStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  draft: { label: "Awaiting approval", hue: "grape", icon: PenLine },
  approved: { label: "Approved, file not downloaded", hue: "blue", icon: CalendarCheck2 },
  downloaded: { label: "Bank file downloaded", hue: "sky", icon: FileDown },
  completed: { label: "Completed", hue: "mint", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", hue: "slate", icon: XCircle },
};

/** SHA-256 of a text, as lowercase hex - the hash the API keeps of the bank file. Null where the browser can't. */
export async function sha256Hex(text: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** Hand a text to the browser as a file download. */
export function saveText(text: string, filename: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** `PS/2026/10/0001` → `PS-2026-10-0001.csv`, the name the API gives it. */
export const bankFileName = (reference: string) => `${reference.replace(/\//g, "-")}.csv`;

/** A long hash broken into groups of eight, so a person can compare it by eye. */
export const groupHash = (h: string) => h.match(/.{1,8}/g)?.join(" ") ?? h;
