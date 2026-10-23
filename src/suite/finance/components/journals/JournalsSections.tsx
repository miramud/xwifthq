import Link from "next/link";
import { NotebookPen, Repeat } from "lucide-react";
import { cx } from "@/components/workspace/kit";

/**
 * The journals screen's two sections - every journal, and the recurring
 * templates that make some of them - as a segmented switch of links, so
 * each has its own address.
 */
export function JournalsSections({ current, showRecurring = true }: { current: "journals" | "recurring"; showRecurring?: boolean }) {
  if (!showRecurring) return null;
  const items = [
    { key: "journals", label: "All journals", href: "/suite/finance/journals", icon: NotebookPen },
    { key: "recurring", label: "Recurring", href: "/suite/finance/journals/recurring", icon: Repeat },
  ] as const;
  return (
    <nav aria-label="Journals sections" className="mb-4 inline-flex rounded-xl bg-neutral-100 p-1">
      {items.map((i) => {
        const on = i.key === current;
        const Icon = i.icon;
        return (
          <Link
            key={i.key}
            href={i.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
              on ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            <Icon size={15} aria-hidden />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
