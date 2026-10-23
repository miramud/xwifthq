import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

/*
  A confirmation asked without a ConfirmProvider mounts its own dialog on
  document.body, outside the tree Testing Library cleans up. A test that opens
  one and never answers it would otherwise leave it, and its buttons, in the
  next test's page.
*/
afterEach(() => {
  document.querySelectorAll("[data-confirm-host]").forEach((node) => node.remove());
});

/*
  The rich-text editor (ProseMirror) needs layout that jsdom does not have, so
  screen tests get a textarea with the same contract: the same id (so its
  <label htmlFor> names it), the same value in, HTML-or-plain text out.
  `RichTextEditor.test.tsx` tests the real editor, with the polyfills below.
*/
vi.mock("@/components/workspace/RichTextEditor", async () => {
  const React = await import("react");

  return {
    RichTextEditor: (props: {
      id?: string;
      value: string;
      onChange: (html: string) => void;
      label?: string;
      placeholder?: string;
      invalid?: boolean;
      describedBy?: string;
      disabled?: boolean;
    }) =>
      React.createElement("textarea", {
        id: props.id,
        value: props.value,
        "aria-label": props.label,
        placeholder: props.placeholder,
        "aria-invalid": props.invalid || undefined,
        "aria-describedby": props.describedBy,
        disabled: props.disabled,
        onChange: (e: { target: { value: string } }) => props.onChange(e.target.value),
      }),
  };
});

/* What ProseMirror asks the layout engine for; jsdom has no layout. */
if (typeof Range !== "undefined") {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
  Range.prototype.getClientRects ??= () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => rect as DOMRect;
  Element.prototype.getClientRects ??= () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  document.elementFromPoint ??= () => null;
}
