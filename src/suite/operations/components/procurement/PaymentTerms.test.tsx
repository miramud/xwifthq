import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentTermsEditor, termInputs, termRows, type TermRow } from "./PaymentTerms";
import { TRIGGERS, poFull } from "./fixtures";

/** Payment terms: the live check that they add up to the order, and the rows as the API takes them. */

function Harness({ initial, total }: { initial: TermRow[]; total: number }) {
  const [rows, setRows] = useState(initial);
  return <PaymentTermsEditor rows={rows} onChange={setRows} total={total} triggers={TRIGGERS} />;
}

describe("PaymentTermsEditor", () => {
  it("checks the terms against the order total as they are typed", async () => {
    const user = userEvent.setup();
    render(<Harness initial={termRows(poFull().paymentTerms)} total={3_934_500_00} />);
    expect(screen.getByText("The terms add up to the order.")).toBeInTheDocument();
    expect(screen.getByText("₦1,180,350.00")).toBeInTheDocument();

    const balance = screen.getByLabelText("Share (%), term 2");
    await user.clear(balance);
    await user.type(balance, "60");
    expect(screen.getByText("₦393,450.00 short of the order total.")).toBeInTheDocument();

    await user.clear(balance);
    await user.type(balance, "80");
    expect(screen.getByText("₦393,450.00 more than the order total.")).toBeInTheDocument();
  }, 15_000);

  it("adds a fixed-amount term and counts it", async () => {
    const user = userEvent.setup();
    render(<Harness initial={termRows([{ ...poFull().paymentTerms[0], pctBp: 5000, amount: 50_00 }])} total={100_00} />);
    expect(screen.getByText("₦50.00 short of the order total.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a term" }));
    await user.click(screen.getAllByRole("radio", { name: "Amount ₦" })[1]);
    await user.type(screen.getByLabelText("Amount (₦), term 2"), "50");
    expect(screen.getByText("The terms add up to the order.")).toBeInTheDocument();
  }, 15_000);
});

describe("termInputs", () => {
  it("sends shares as basis points and amounts in kobo, and says what is missing", () => {
    const rows: TermRow[] = [
      { key: "a", label: "Advance", trigger: "on_po", mode: "pct", value: "30", days: "" },
      { key: "b", label: "Balance", trigger: "net_days", mode: "amount", value: "700.00", days: "30" },
      { key: "c", label: "", trigger: "on_delivery", mode: "pct", value: "10", days: "" },
      { key: "d", label: "Retention", trigger: "", mode: "pct", value: "5", days: "" },
    ];
    const { terms, problems } = termInputs(rows);
    expect(terms[0]).toEqual({ label: "Advance", trigger: "on_po", pctBp: 3000, amount: null, days: null });
    expect(terms[1]).toEqual({ label: "Balance", trigger: "net_days", pctBp: null, amount: 700_00, days: 30 });
    expect(problems).toEqual({ 2: "Give the term a label, like “Advance (30%)”.", 3: "Choose what makes this payment due." });
  });
});
