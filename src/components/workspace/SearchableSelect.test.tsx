import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchableSelect, type SelectOption, type SearchableSelectProps } from "./SearchableSelect";
import { chooseOption, comboboxLabel, comboboxValue, openCombobox } from "@/test/selectOption";

const FRUIT: SelectOption[] = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana", hint: "Yellow" },
  { value: "cherry", label: "Cherry", disabled: true },
  { value: "creme", label: "Crème brûlée" },
];

function Harness({
  initial = "",
  onChange,
  ...props
}: Partial<SearchableSelectProps> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <label htmlFor="fruit">Fruit</label>
      <SearchableSelect
        id="fruit"
        options={FRUIT}
        {...props}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
      <button type="button">After</button>
    </div>
  );
}

describe("SearchableSelect", () => {
  it("is a combobox named by its label, showing the chosen option", () => {
    render(<Harness initial="banana" />);
    const box = screen.getByRole("combobox", { name: "Fruit" });
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(comboboxLabel(box)).toBe("Banana");
    expect(comboboxValue(box)).toBe("banana");
  });

  it("shows the placeholder when nothing is chosen", () => {
    render(<Harness placeholder="Pick a fruit" />);
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveTextContent("Pick a fruit");
  });

  it("chooses an option with the mouse and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await chooseOption(user, "Fruit", "Banana");

    expect(onChange).toHaveBeenCalledWith("banana");
    const box = screen.getByRole("combobox", { name: "Fruit" });
    expect(box).toHaveTextContent("Banana");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("names options by their label alone, with the hint as a description", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const listbox = await openCombobox(user, "Fruit");
    const banana = within(listbox).getByRole("option", { name: "Banana" });
    expect(banana).toHaveAccessibleDescription("Yellow");
  });

  it("filters by label and hint, ignoring case and accents", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const listbox = await openCombobox(user, "Fruit");
    const search = screen.getByRole("textbox", { name: "Search Fruit" });
    expect(search).toHaveFocus();

    await user.type(search, "CREME");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual(["Crème brûlée"]);

    await user.clear(search);
    await user.type(search, "yellow");
    expect(within(listbox).getByRole("option", { name: "Banana" })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "zzz");
    expect(within(listbox).queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Nothing matches that.")).toBeInTheDocument();
  });

  it("works from the keyboard: arrows skip disabled options, Enter chooses", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    screen.getByRole("combobox", { name: "Fruit" }).focus();
    await user.keyboard("{ArrowDown}");
    const search = screen.getByRole("textbox", { name: "Search Fruit" });
    expect(search).toHaveFocus();

    const active = () => document.getElementById(search.getAttribute("aria-activedescendant") ?? "")?.textContent;
    expect(active()).toBe("Apple");
    await user.keyboard("{ArrowDown}");
    expect(active()).toMatch(/^Banana/);
    await user.keyboard("{ArrowDown}"); // Cherry is disabled
    expect(active()).toBe("Crème brûlée");
    await user.keyboard("{Home}");
    expect(active()).toBe("Apple");
    await user.keyboard("{End}{Enter}");

    expect(onChange).toHaveBeenCalledWith("creme");
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveFocus();
  });

  it("opens by typing, with the letter as the search", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("combobox", { name: "Fruit" }).focus();
    await user.keyboard("b");
    expect(screen.getByRole("textbox", { name: "Search Fruit" })).toHaveValue("b");
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).queryByRole("option", { name: "Apple" })).not.toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: "Banana" })).toBeInTheDocument();
  });

  it("Escape closes without choosing and doesn't reach a surrounding dialog", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onWindowEscape = vi.fn();
    const listener = (e: KeyboardEvent) => e.key === "Escape" && onWindowEscape();
    window.addEventListener("keydown", listener);
    render(<Harness onChange={onChange} />);

    await openCombobox(user, "Fruit");
    await user.keyboard("{Escape}");

    window.removeEventListener("keydown", listener);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(onWindowEscape).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveFocus();
  });

  it("Tab closes the list and moves on", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCombobox(user, "Fruit");
    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("closes on a click outside", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCombobox(user, "Fruit");
    await user.click(screen.getByRole("button", { name: "After" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clears to empty with the clear option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="apple" clearable clearLabel="No fruit" onChange={onChange} />);
    await chooseOption(user, "Fruit", "No fruit", { search: false });
    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveTextContent("Select…");
  });

  it("does not choose a disabled option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const listbox = await openCombobox(user, "Fruit");
    await user.click(within(listbox).getByRole("option", { name: "Cherry" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lists grouped options under their group", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        options={[
          { value: "a", label: "Alpha", group: "Greek" },
          { value: "x", label: "Loose" },
          { value: "b", label: "Beta", group: "Greek" },
          { value: "one", label: "One", group: "Numbers" },
        ]}
      />,
    );
    const listbox = await openCombobox(user, "Fruit");
    expect(listbox.textContent).toBe("LooseGreekAlphaBetaNumbersOne");
  });

  it("posts its value with the form, and enforces required", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      return new FormData(e.currentTarget).get("fruit");
    });
    render(
      <form onSubmit={onSubmit}>
        <label htmlFor="f">Fruit</label>
        <Controlled id="f" name="fruit" required />
        <button type="submit">Save</button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();

    await chooseOption(user, "Fruit", "Apple");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveReturnedWith("apple");
  });

  it("is named by a wrapping label too", () => {
    render(
      <label>
        <span>Fruit</span>
        <Controlled />
      </label>,
    );
    expect(screen.getByRole("combobox", { name: /^Fruit/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Fruit/)).toHaveAttribute("role", "combobox");
  });

  it("stays quick with a thousand options", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 1000 }, (_, i) => ({ value: String(i), label: `Option ${i}` }));
    const onChange = vi.fn();
    render(<Harness options={many} onChange={onChange} />);
    await chooseOption(user, "Fruit", "Option 999");
    expect(onChange).toHaveBeenCalledWith("999");
  });

  describe("adding an option", () => {
    it("offers to add unmatched text and selects what was added", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onCreate = vi.fn(async (text: string) => ({ value: "new-1", label: text }));
      render(<Harness onChange={onChange} onCreate={onCreate} createLabel={(t) => `Add “${t}” as a fruit`} />);

      await chooseOption(user, "Fruit", "Add “Durian” as a fruit", { search: "Durian" });

      expect(onCreate).toHaveBeenCalledWith("Durian");
      expect(onChange).toHaveBeenCalledWith("new-1");
      expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveTextContent("Durian");
    });

    it("doesn't offer to add what already exists", async () => {
      const user = userEvent.setup();
      render(<Harness onCreate={vi.fn()} />);
      const listbox = await openCombobox(user, "Fruit");
      await user.paste("apple");
      expect(within(listbox).queryByRole("option", { name: /add/i })).not.toBeInTheDocument();
    });

    it("shows why adding failed and keeps the list open", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onCreate = vi.fn(async () => {
        throw new Error("Ask an admin to add this.");
      });
      render(<Harness onChange={onChange} onCreate={onCreate} />);

      await chooseOption(user, "Fruit", "Add “Durian”", { search: "Durian" });

      expect(await screen.findByRole("alert")).toHaveTextContent("Ask an admin to add this.");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("shows that it's busy while adding", async () => {
      const user = userEvent.setup();
      let finish: (v: { value: string; label: string }) => void = () => {};
      const onCreate = vi.fn(() => new Promise<{ value: string; label: string }>((r) => (finish = r)));
      render(<Harness onCreate={onCreate} />);

      await chooseOption(user, "Fruit", "Add “Durian”", { search: "Durian" });
      expect(screen.getByRole("option", { name: "Adding “Durian”…" })).toHaveAttribute("aria-disabled", "true");

      finish({ value: "d", label: "Durian" });
      await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    });
  });
});

function Controlled(props: Partial<SearchableSelectProps>) {
  const [value, setValue] = useState("");
  return <SearchableSelect options={FRUIT} {...props} value={value} onChange={setValue} />;
}
