"use client";

import { sanitizeHtml } from "@/lib/sanitize-html";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Link2,
  Eraser,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Lightweight, dependency-free rich-text editor (contentEditable).   */
/*  Outputs HTML; used to author article-type lectures.               */
/* ------------------------------------------------------------------ */

const TOOLS: { cmd: string; arg?: string; icon: LucideIcon; label: string }[] = [
  { cmd: "bold", icon: Bold, label: "Bold" },
  { cmd: "italic", icon: Italic, label: "Italic" },
  { cmd: "underline", icon: Underline, label: "Underline" },
  { cmd: "formatBlock", arg: "<h2>", icon: Heading2, label: "Heading" },
  { cmd: "insertUnorderedList", icon: List, label: "Bullet list" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write the lesson content…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(!stripHtml(value));

  // Seed the DOM from `value` only when it differs (avoids cursor jumps while typing).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) {
      /* Stored HTML is cleaned before it touches the DOM: an article saved by
         another account must not run script in this author's browser. */
      el.innerHTML = sanitizeHtml(value || "");
      setEmpty(!stripHtml(el.innerHTML));
    }
  }, [value]);

  function emit() {
    const html = ref.current?.innerHTML ?? "";
    setEmpty(!stripHtml(html));
    onChange(html);
  }

  function run(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  }

  function addLink() {
    const url = window.prompt("Link URL (https://…)");
    if (url) run("createLink", url);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-100">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-100 bg-neutral-50/60 px-1.5 py-1">
        {TOOLS.map((t) => (
          <ToolButton key={t.label} icon={t.icon} label={t.label} onClick={() => run(t.cmd, t.arg)} />
        ))}
        <ToolButton icon={Link2} label="Insert link" onClick={addLink} />
        <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
        <ToolButton icon={Eraser} label="Clear formatting" onClick={() => run("removeFormat")} />
      </div>

      {/* editor surface */}
      <div className="relative">
        {empty && (
          <span className="pointer-events-none absolute left-3.5 top-3 text-sm text-neutral-400">
            {placeholder}
          </span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Lesson content"
          onInput={emit}
          onBlur={emit}
          className="min-h-[150px] w-full px-3.5 py-2.5 text-sm leading-relaxed text-neutral-700 outline-none [&_a]:text-primary-600 [&_a]:underline [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-neutral-900 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Use onMouseDown to avoid stealing focus/selection from the editor.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none transition-colors hover:bg-white hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, "")
    .trim();
}
