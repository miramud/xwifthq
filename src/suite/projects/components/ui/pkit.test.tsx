import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Drawer, Modal } from "./pkit";

/**
 * The backdrop closes a dialog only for a press that started on it. A list
 * portalled over the dialog (Log time › Against) overhangs it on a short
 * screen, and a pick or a scrollbar drag that ends over the backdrop must not
 * throw the form away.
 */

const OPTIONS = [
  { value: "", label: "The project (no ticket)" },
  ...Array.from({ length: 40 }, (_, i) => ({ value: `t-${i}`, label: `Ticket ${i}` })),
];

function backdropOf(dialog: HTMLElement): HTMLElement {
  return dialog.parentElement!.querySelector('button[aria-label="Close"]') as HTMLElement;
}

describe.each([
  ["Modal", Modal],
  ["Drawer", Drawer],
] as const)("the %s backdrop", (_name, Frame) => {
  function setup() {
    const onClose = vi.fn();
    const onChange = vi.fn();
    render(
      <Frame title="Log time" onClose={onClose}>
        <SearchableSelect aria-label="Against" value="" onChange={onChange} options={OPTIONS} />
      </Frame>,
    );
    return { onClose, onChange, backdrop: backdropOf(screen.getByRole("dialog")) };
  }

  it("keeps the dialog open when an option in a long list is picked with the mouse", async () => {
    const user = userEvent.setup();
    const { onClose, onChange } = setup();

    await user.click(screen.getByRole("combobox", { name: "Against" }));
    await user.click(screen.getByRole("option", { name: "Ticket 37" }));

    expect(onChange).toHaveBeenCalledWith("t-37");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("ignores a press that started in the list and was released over the backdrop", async () => {
    const user = userEvent.setup();
    const { onClose, backdrop } = setup();

    await user.click(screen.getByRole("combobox", { name: "Against" }));
    fireEvent.pointerDown(screen.getByRole("listbox"));
    fireEvent.click(backdrop, { detail: 1 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("still closes on a click that starts and ends on the backdrop", async () => {
    const user = userEvent.setup();
    const { onClose, backdrop } = setup();

    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
