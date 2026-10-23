import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OneTimeSalesBody } from "./OneTimeSalesView";

/**
 * One-time sales: currencies are totalled separately, the ladder shows how far
 * up buyers go, and the onboarding funnel reports honestly when nothing started.
 */
describe("OneTimeSalesBody", () => {
  it("keeps naira and dollars apart and reads the funnel", () => {
    render(
      <OneTimeSalesBody
        data={{
          byTier: [
            { modules: 1, currency: "NGN", orders: 2, grossMinor: 500_000_000 },
            { modules: 3, currency: "USD", orders: 1, grossMinor: 800_000 },
          ],
          byCurrency: [
            { currency: "NGN", orders: 2, grossMinor: 500_000_000 },
            { currency: "USD", orders: 1, grossMinor: 800_000 },
          ],
          onboarding: { started: 4, paid: 3, abandoned: 1, pending: 0 },
          salesRequests: { byStatus: { new: 2, won: 1 }, byType: { source_code: 2, dedicated_hosting: 1 } },
        }}
      />,
    );

    expect(screen.getByText("Sales in NGN")).toBeInTheDocument();
    expect(screen.getAllByText("₦5M").length).toBeGreaterThan(0);
    expect(screen.getByText("Sales in USD")).toBeInTheDocument();
    expect(screen.getByText("75% of 4 started")).toBeInTheDocument();
    expect(screen.getAllByText("3 modules").length).toBeGreaterThan(0);
    expect(screen.getByText("New · 2")).toBeInTheDocument();
  });

  it("says so when no sign-ups started", () => {
    render(
      <OneTimeSalesBody
        data={{
          byTier: [],
          byCurrency: [],
          onboarding: { started: 0, paid: 0, abandoned: 0, pending: 0 },
          salesRequests: { byStatus: {}, byType: {} },
        }}
      />,
    );
    expect(screen.getByText("No sign-ups started in this period.")).toBeInTheDocument();
    expect(screen.getByText("No one-time sales in this period.")).toBeInTheDocument();
  });

  it("splits module sales by channel and by new or upgrade, per currency", () => {
    render(
      <OneTimeSalesBody
        data={{
          byTier: [],
          byCurrency: [],
          byChannel: [
            { channel: "online", orders: 2, byCurrency: { NGN: 500_000_000 } },
            { channel: "offline", orders: 3, byCurrency: { NGN: 250_000_000, USD: 800_000 } },
          ],
          byKind: [{ kind: "upgrade", orders: 1, byCurrency: { USD: 800_000 } }],
          onboarding: { started: 0, paid: 0, abandoned: 0, pending: 0 },
          salesRequests: { byStatus: {}, byType: {} },
        }}
      />,
    );
    expect(screen.getAllByText("Licensed by hand").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₦2.5M · $8K").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Upgrade").length).toBeGreaterThan(0);
  });
});
