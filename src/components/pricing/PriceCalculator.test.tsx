import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceCalculator } from "./PriceCalculator";

/** "Price my company", checked against the strategy's worked examples. */
describe("price calculator", () => {
  const setEmployees = (n: number) =>
    fireEvent.change(screen.getByRole("spinbutton", { name: "Employees" }), { target: { value: String(n) } });

  it("prices a 220-staff polytechnic on the full suite", () => {
    render(<PriceCalculator />);
    setEmployees(220);

    expect(screen.getByText("₦18,810,000 a year")).toBeTruthy();
    expect(screen.getByText("₦35,000,000 once")).toBeTruthy();
    expect(screen.getByText("5 years: ₦63,000,000")).toBeTruthy();
    expect(screen.getByText(/Premium onboarding is ₦4,000,000/)).toBeTruthy();
  });

  it("prices an 18-person agency on three modules, with Quick Start onboarding", async () => {
    const user = userEvent.setup();
    render(<PriceCalculator />);
    setEmployees(18);
    await user.click(screen.getByRole("radio", { name: "3 modules" }));

    expect(screen.getByText("₦1,598,400 a year")).toBeTruthy();
    expect(screen.getByText(/Quick Start onboarding is ₦500,000/)).toBeTruthy();
  });

  it("says when owning overtakes renting", () => {
    render(<PriceCalculator />);
    setEmployees(50);
    expect(screen.getByText("about 3 years")).toBeTruthy();
  });

  it("bills below ten as ten, and quotes the largest companies", () => {
    render(<PriceCalculator />);
    setEmployees(6);
    expect(screen.getByText(/Billed as 10 employees/)).toBeTruthy();

    setEmployees(1500);
    expect(screen.getByText("Quoted")).toBeTruthy();
    expect(screen.getByText("Quoted, from ₦120,000,000")).toBeTruthy();
  });
});
