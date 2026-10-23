"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Check,
  ChevronDown,
  Columns3,
  Eraser,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cx } from "./kit";
import { useDismiss } from "./useDismiss";
import { toEditorHtml } from "@/lib/richText";

/*
  The suite's text editor: a Word-style ribbon over the text, and the text
  kept the way it was written — headings, lists, bold, tables, links — for
  `RichTextView` to show back.

  Two sizes:
  - `full` for documents (memos, descriptions, PRDs): undo, paragraph styles,
    character formatting, text colour and highlight, lists and indents,
    alignment, links, quotes, rules, tables, clear formatting, and a status bar
    with the word count. The text sits on a page, as in Word.
  - `compact` for comments, notes and questions: bold, italic, underline,
    lists and links. The same shortcuts work in both (Ctrl+B, Ctrl+I, …).

  The value is HTML, or "" when there are no words, so `required` checks and
  "is anything written?" keep working. Plain text from before the editor opens
  as paragraphs. The API cleans what it stores; the editor only produces what
  that allowlist keeps.
*/

export type RichTextVariant = "full" | "compact";

/** Text colours offered in the ribbon. Content colours, stored in the text, so they are values rather than tokens. */
const COLOURS: { name: string; value: string }[] = [
  { name: "Dark grey", value: "#334155" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Amber", value: "#b45309" },
  { name: "Green", value: "#15803d" },
  { name: "Teal", value: "#0f766e" },
  { name: "Blue", value: "#1d4ed8" },
  { name: "Purple", value: "#7e22ce" },
  { name: "Pink", value: "#be185d" },
];

const STYLES = [
  { value: "p", label: "Normal text" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
] as const;

type StyleValue = (typeof STYLES)[number]["value"];

export function RichTextEditor({
  id,
  value,
  onChange,
  variant = "compact",
  label,
  placeholder,
  minHeight,
  invalid,
  describedBy,
  disabled,
  autoFocus,
  className,
}: {
  /** Put on the editable area; a `<label htmlFor={id}>` names it and focuses it. */
  id?: string;
  value: string;
  onChange: (html: string) => void;
  variant?: RichTextVariant;
  /** Accessible name when there is no `<label htmlFor>`. */
  label?: string;
  placeholder?: string;
  /** Height of the writing area before it grows, in px. */
  minHeight?: number;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const full = variant === "full";

  /* The last HTML this editor reported, so a parent echoing it back is not a reset. */
  const emitted = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    autofocus: autoFocus ? "end" : false,
    content: toEditorHtml(value),
    extensions: [
      StarterKit.configure({
        heading: { levels: full ? [1, 2, 3] : [3] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["mailto"],
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      ...(full
        ? [
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            TextStyle,
            Color,
            Highlight,
            TableKit.configure({ table: { resizable: false } }),
          ]
        : []),
    ],
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: "textbox",
        "aria-multiline": "true",
        ...(label ? { "aria-label": label } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        class: cx("rich-text rt-editable", full ? "rt-page" : "rt-compact"),
        style: `min-height: ${minHeight ?? (full ? 320 : 96)}px`,
      },
    },
    onUpdate: ({ editor: e }) => {
      /* The empty paragraph kept after a list or table, for the cursor, is not part of the text. */
      /*
        No words (and no table or rule) is "", so every `value.trim() === ""`
        check written for a textarea still means "nothing written".
      */
      const raw = e.getHTML().replace(/(<p><\/p>)+$/, "");
      const html = e.getText().trim() === "" && !/<(table|hr)\b/.test(raw) ? "" : raw;
      emitted.current = html;
      onChangeRef.current(html);
    },
  });

  /* A parent that resets the value (after sending, after loading a record) wins. */
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(toEditorHtml(value), { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [disabled, editor]);

  /* Keep aria-invalid / aria-describedby current; editorProps are read once. */
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    if (invalid) dom.setAttribute("aria-invalid", "true");
    else dom.removeAttribute("aria-invalid");
    if (describedBy) dom.setAttribute("aria-describedby", describedBy);
    else dom.removeAttribute("aria-describedby");
  }, [editor, invalid, describedBy]);

  /*
    A <label htmlFor> cannot name a contenteditable, so name it through
    aria-labelledby, and make a click on the label put the cursor in the text
    as it would for a textarea.
  */
  useEffect(() => {
    if (!editor || !id) return;
    const labelEl = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
    if (!labelEl) return;
    if (!labelEl.id) labelEl.id = `${id}-label`;
    editor.view.dom.setAttribute("aria-labelledby", labelEl.id);
    const focus = (e: MouseEvent) => {
      e.preventDefault();
      editor.commands.focus("end");
    };
    labelEl.addEventListener("click", focus);
    return () => labelEl.removeEventListener("click", focus);
  }, [editor, id]);

  /*
    Written inside a <label>, as many forms do with a textarea: the label's
    own words name the editor, and a click on them puts the cursor in the
    text instead of pressing the first toolbar button (a <label> activates
    the first control inside it).
  */
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = shell.current;
    const wrap = root?.closest("label");
    if (!editor || !root || !wrap) return;
    if (!label && !editor.view.dom.hasAttribute("aria-labelledby")) {
      const name = Array.from(wrap.childNodes)
        .filter((n) => !n.contains(root))
        .map((n) => n.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (name) editor.view.dom.setAttribute("aria-label", name);
    }
    const onClick = (e: MouseEvent) => {
      if (root.contains(e.target as Node)) return;
      e.preventDefault();
      editor.commands.focus("end");
    };
    wrap.addEventListener("click", onClick);
    return () => wrap.removeEventListener("click", onClick);
  }, [editor, label]);

  return (
    <div
      ref={shell}
      className={cx(
        "rt-shell overflow-hidden rounded-xl border bg-white transition focus-within:ring-4",
        invalid
          ? "border-error-400 focus-within:border-error-500 focus-within:ring-error-500/15"
          : "border-neutral-200 focus-within:border-primary-400 focus-within:ring-primary-100",
        disabled && "opacity-70",
        className,
      )}
    >
      {editor ? (
        <Ribbon editor={editor} full={full} disabled={Boolean(disabled)} />
      ) : (
        <div className={cx("border-b border-neutral-200 bg-neutral-50", full ? "h-[49px]" : "h-[45px]")} aria-hidden />
      )}

      <div className={cx(full && "rt-desk bg-neutral-100/70 px-2 py-3 sm:px-5 sm:py-4")}>
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          /* Before the editor mounts (and on the server): the same box, so nothing jumps. */
          <div className={cx("rich-text rt-editable", full ? "rt-page" : "rt-compact")} style={{ minHeight: minHeight ?? (full ? 320 : 96) }} aria-hidden />
        )}
      </div>

      {full && editor && <StatusBar editor={editor} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ribbon                                                             */
/* ------------------------------------------------------------------ */

function Ribbon({ editor, full, disabled }: { editor: Editor; full: boolean; disabled: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      highlight: e.isActive("highlight"),
      table: e.isActive("table"),
      inList: e.isActive("listItem"),
      style: (e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "p") as StyleValue,
      align: (["center", "right", "justify"].find((a) => e.isActive({ textAlign: a })) ?? "left") as string,
      colour: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      canSink: e.can().sinkListItem("listItem"),
      canLift: e.can().liftListItem("listItem"),
    }),
  });

  const [linking, setLinking] = useState(false);
  const run = () => editor.chain().focus();
  const off = disabled;

  return (
    <div className="border-b border-neutral-200 bg-neutral-50">
      <div role="toolbar" aria-label="Formatting" aria-orientation="horizontal" className="flex flex-wrap items-center gap-0.5 px-1.5 py-1.5">
        {full && (
          <Group>
            <Tool icon={Undo2} label="Undo" keys="Ctrl+Z" disabled={off || !s.canUndo} onClick={() => run().undo().run()} />
            <Tool icon={Redo2} label="Redo" keys="Ctrl+Y" disabled={off || !s.canRedo} onClick={() => run().redo().run()} />
          </Group>
        )}

        {full && (
          <Group>
            <label className="sr-only" htmlFor={`${editor.instanceId}-style`}>
              Paragraph style
            </label>
            <div className="relative">
              <select
                id={`${editor.instanceId}-style`}
                value={s.style}
                disabled={off}
                onChange={(e) => {
                  const v = e.target.value as StyleValue;
                  if (v === "p") run().setParagraph().run();
                  else run().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
                }}
                className="h-9 w-[8.5rem] cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent pl-2.5 pr-7 text-sm font-medium text-neutral-700 transition hover:border-neutral-200 hover:bg-white focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed"
              >
                {STYLES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
            </div>
          </Group>
        )}

        <Group>
          <Tool icon={Bold} label="Bold" keys="Ctrl+B" active={s.bold} disabled={off} onClick={() => run().toggleBold().run()} />
          <Tool icon={Italic} label="Italic" keys="Ctrl+I" active={s.italic} disabled={off} onClick={() => run().toggleItalic().run()} />
          <Tool icon={Underline} label="Underline" keys="Ctrl+U" active={s.underline} disabled={off} onClick={() => run().toggleUnderline().run()} />
          {full && <Tool icon={Strikethrough} label="Strikethrough" keys="Ctrl+Shift+S" active={s.strike} disabled={off} onClick={() => run().toggleStrike().run()} />}
        </Group>

        {full && (
          <Group>
            <ColourPicker editor={editor} current={s.colour} disabled={off} />
            <Tool icon={Highlighter} label="Highlight" keys="Ctrl+Shift+H" active={s.highlight} disabled={off} onClick={() => run().toggleHighlight().run()} />
          </Group>
        )}

        <Group>
          <Tool icon={List} label="Bulleted list" keys="Ctrl+Shift+8" active={s.bullet} disabled={off} onClick={() => run().toggleBulletList().run()} />
          <Tool icon={ListOrdered} label="Numbered list" keys="Ctrl+Shift+7" active={s.ordered} disabled={off} onClick={() => run().toggleOrderedList().run()} />
          {full && (
            <>
              <Tool icon={IndentDecrease} label="Decrease indent" keys="Shift+Tab" disabled={off || !s.canLift} onClick={() => run().liftListItem("listItem").run()} />
              <Tool icon={IndentIncrease} label="Increase indent" keys="Tab" disabled={off || !s.canSink} onClick={() => run().sinkListItem("listItem").run()} />
            </>
          )}
        </Group>

        {full && (
          <Group>
            <Tool icon={AlignLeft} label="Align left" keys="Ctrl+Shift+L" active={s.align === "left"} disabled={off} onClick={() => run().setTextAlign("left").run()} />
            <Tool icon={AlignCenter} label="Centre" keys="Ctrl+Shift+E" active={s.align === "center"} disabled={off} onClick={() => run().setTextAlign("center").run()} />
            <Tool icon={AlignRight} label="Align right" keys="Ctrl+Shift+R" active={s.align === "right"} disabled={off} onClick={() => run().setTextAlign("right").run()} />
            <Tool icon={AlignJustify} label="Justify" keys="Ctrl+Shift+J" active={s.align === "justify"} disabled={off} onClick={() => run().setTextAlign("justify").run()} />
          </Group>
        )}

        <Group last={!full}>
          <Tool icon={Link2} label={s.link ? "Edit link" : "Link"} keys="Ctrl+K" active={s.link || linking} disabled={off} onClick={() => setLinking((v) => !v)} />
          {full && (
            <>
              <Tool icon={Quote} label="Quote" active={s.quote} disabled={off} onClick={() => run().toggleBlockquote().run()} />
              <Tool icon={Minus} label="Horizontal line" disabled={off} onClick={() => run().setHorizontalRule().run()} />
              <Tool
                icon={Table2}
                label="Insert table"
                disabled={off || s.table}
                onClick={() => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              />
            </>
          )}
        </Group>

        {full && (
          <Group last>
            <Tool icon={Eraser} label="Clear formatting" disabled={off} onClick={() => run().unsetAllMarks().clearNodes().run()} />
          </Group>
        )}
      </div>

      {full && s.table && !off && <TableTools editor={editor} />}

      {linking && <LinkBar editor={editor} hasLink={s.link} onClose={() => setLinking(false)} />}

      <LinkShortcut editor={editor} onOpen={() => setLinking(true)} />
    </div>
  );
}

function Group({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div role="group" className={cx("flex items-center gap-0.5", !last && "mr-1 border-r border-neutral-200 pr-1")}>
      {children}
    </div>
  );
}

function Tool({
  icon: Icon,
  label,
  keys,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  keys?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={keys ? `${label} (${keys})` : label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      /* Keep the selection in the text while the button is pressed. */
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-primary-100 text-primary-700" : "text-neutral-600 hover:bg-white hover:text-neutral-900",
      )}
    >
      <Icon size={17} strokeWidth={2} aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Colour, links, tables                                              */
/* ------------------------------------------------------------------ */

function ColourPicker({ editor, current, disabled }: { editor: Editor; current: string | null; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useDismiss(open, (focus) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  }, [trigger, panel]);

  const pick = (value: string | null) => {
    const chain = editor.chain().focus();
    (value === null ? chain.unsetColor() : chain.setColor(value)).run();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label="Text colour"
        title="Text colour"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 cursor-pointer flex-col items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Baseline size={16} aria-hidden />
        <span className="mt-0.5 h-1 w-4 rounded-full" style={{ background: current ?? "currentColor" }} aria-hidden />
      </button>

      {open && (
        <div ref={panel} role="dialog" aria-label="Text colour" className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(null)}
            className="mb-2 flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <span className="h-4 w-4 rounded border border-neutral-300 bg-neutral-900" aria-hidden />
            Automatic
            {current === null && <Check size={14} className="ml-auto text-primary-600" aria-hidden />}
          </button>
          <div className="grid grid-cols-5 gap-1.5">
            {COLOURS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={c.name}
                title={c.name}
                aria-pressed={current?.toLowerCase() === c.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c.value)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                style={{ background: c.value }}
              >
                {current?.toLowerCase() === c.value && <Check size={14} className="text-white" aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkBar({ editor, hasLink, onClose }: { editor: Editor; hasLink: boolean; onClose: () => void }) {
  const [href, setHref] = useState<string>(() => (editor.getAttributes("link").href as string | undefined) ?? "");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const apply = () => {
    const raw = href.trim();
    if (raw === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }

    const url = /^(https?:\/\/|mailto:)/i.test(raw) ? raw : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? `mailto:${raw}` : `https://${raw}`;

    if (!/^(https?:\/\/[^\s]+\.[^\s]+|mailto:[^\s@]+@[^\s@]+)/i.test(url)) {
      setError("Enter a web address (example.com) or an email address.");
      return;
    }

    const { empty } = editor.state.selection;
    const chain = editor.chain().focus().extendMarkRange("link");

    if (empty && !hasLink) {
      /* Nothing selected: the address becomes the link text. */
      chain.insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href: url } }] }).run();
    } else {
      chain.setLink({ href: url }).run();
    }

    onClose();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 bg-white px-2.5 py-2">
      <label htmlFor={`${editor.instanceId}-link`} className="text-xs font-medium text-neutral-600">
        Link to
      </label>
      <input
        ref={input}
        id={`${editor.instanceId}-link`}
        type="url"
        inputMode="url"
        value={href}
        placeholder="example.com or name@example.com"
        onChange={(e) => {
          setHref(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
            editor.commands.focus();
          }
        }}
        aria-invalid={error !== null}
        aria-describedby={error ? `${editor.instanceId}-link-error` : undefined}
        className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-200 px-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      />
      <button type="button" onClick={apply} className="h-9 cursor-pointer rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
        Apply
      </button>
      {hasLink && (
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            onClose();
          }}
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <Link2Off size={15} aria-hidden /> Remove link
        </button>
      )}
      <button type="button" aria-label="Close link" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
        <X size={16} aria-hidden />
      </button>
      {error && (
        <p id={`${editor.instanceId}-link-error`} role="alert" className="basis-full text-xs text-error-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Ctrl+K opens the link bar, as in Word. */
function LinkShortcut({ editor, onOpen }: { editor: Editor; onOpen: () => void }) {
  useEffect(() => {
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    dom.addEventListener("keydown", onKey);
    return () => dom.removeEventListener("keydown", onKey);
  }, [editor, onOpen]);

  return null;
}

function TableTools({ editor }: { editor: Editor }) {
  const run = () => editor.chain().focus();
  const item = "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-neutral-700 transition hover:bg-white hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300";

  return (
    <div role="toolbar" aria-label="Table" className="flex flex-wrap items-center gap-0.5 border-t border-neutral-200 bg-primary-50/50 px-2 py-1">
      <span className="mr-1 text-xs font-semibold text-primary-700">Table</span>
      <button type="button" className={item} onMouseDown={(e) => e.preventDefault()} onClick={() => run().addRowBefore().run()}>
        <Rows3 size={14} aria-hidden /> Row above
      </button>
      <button type="button" className={item} onMouseDown={(e) => e.preventDefault()} onClick={() => run().addRowAfter().run()}>
        <Rows3 size={14} aria-hidden /> Row below
      </button>
      <button type="button" className={item} onMouseDown={(e) => e.preventDefault()} onClick={() => run().addColumnBefore().run()}>
        <Columns3 size={14} aria-hidden /> Column left
      </button>
      <button type="button" className={item} onMouseDown={(e) => e.preventDefault()} onClick={() => run().addColumnAfter().run()}>
        <Columns3 size={14} aria-hidden /> Column right
      </button>
      <button type="button" className={item} onMouseDown={(e) => e.preventDefault()} onClick={() => run().toggleHeaderRow().run()}>
        Header row
      </button>
      <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
      <button type="button" className={item} onMouseDown={(e) => e.preventDefault()} onClick={() => run().deleteRow().run()}>
        Delete row
      </button>
      <button type="button" className={item} onMouseDown={(e) => e.preventDefault()} onClick={() => run().deleteColumn().run()}>
        Delete column
      </button>
      <button type="button" className={cx(item, "text-error-700 hover:bg-error-500/10 hover:text-error-700")} onMouseDown={(e) => e.preventDefault()} onClick={() => run().deleteTable().run()}>
        <Trash2 size={14} aria-hidden /> Delete table
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatusBar({ editor }: { editor: Editor }) {
  const words = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const text = e.getText({ blockSeparator: " " }).trim();
      return text === "" ? 0 : text.split(/\s+/).length;
    },
  });

  return (
    <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-500">
      <span aria-live="polite">
        {words.toLocaleString()} {words === 1 ? "word" : "words"}
      </span>
      <span className="hidden sm:inline">Ctrl+B bold · Ctrl+I italic · Ctrl+K link</span>
    </div>
  );
}
