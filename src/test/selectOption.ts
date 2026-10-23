import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/*
  Test helpers for SearchableSelect (components/workspace/SearchableSelect),
  the replacement for native <select> across the suite. Use these where a
  test used `user.selectOptions(select, "value")`:

      await chooseOption(user, "Department", "Finance");
      await chooseOption(user, screen.getByRole("combobox", { name: /status/i }), "Closed");
      await chooseOption(user, within(dialog).getByLabelText("Job title"), /add “staff accountant”/i, {
        search: "Staff accountant",
      });

  Options are chosen by their visible LABEL, not their value.
*/

type ComboTarget = HTMLElement | string | RegExp;

function resolve(target: ComboTarget): HTMLElement {
  if (typeof target === "string" || target instanceof RegExp) {
    return screen.getByRole("combobox", { name: target });
  }
  return target;
}

/** Opens the combobox (if closed) and returns its listbox. */
export async function openCombobox(user: UserEvent, target: ComboTarget): Promise<HTMLElement> {
  const combobox = resolve(target);
  if (combobox.getAttribute("aria-expanded") !== "true") await user.click(combobox);
  return waitFor(() => {
    const id = combobox.getAttribute("aria-controls");
    const listbox = id ? document.getElementById(id) : null;
    if (!listbox) throw new Error("The combobox's listbox didn't open.");
    return listbox;
  });
}

/**
 * Opens the combobox, searches, and clicks the option whose name (its label)
 * matches `option`.
 *
 * A string option is also typed into the search box first (so long lists
 * narrow to it); pass `search` to type something else — the text an "Add …"
 * option should create, say — or `search: false` to type nothing.
 */
export async function chooseOption(
  user: UserEvent,
  target: ComboTarget,
  option: string | RegExp,
  { search }: { search?: string | false } = {},
): Promise<void> {
  const listbox = await openCombobox(user, target);
  const text = search === undefined ? (typeof option === "string" ? option : "") : search || "";
  if (text !== "") {
    // paste, not type: a label may hold `{` or `[`, which `type` reads as keys.
    await user.paste(text);
  }
  const found = await within(listbox).findByRole("option", { name: option });
  await user.click(found);
}

/** The label a combobox currently shows (what a native select's selected option would read). */
export function comboboxLabel(target: ComboTarget): string {
  return (resolve(target).textContent ?? "").trim();
}

/** The value a combobox currently holds (its `data-value`). */
export function comboboxValue(target: ComboTarget): string {
  return resolve(target).getAttribute("data-value") ?? "";
}
