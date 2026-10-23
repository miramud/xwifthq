import type { Metadata } from "next";
import RateCard from "@/suite/projects/components/RateCard";

export const metadata: Metadata = {
  title: "Rates",
  robots: { index: false, follow: false },
};

/**
 * What an hour costs, and what a naira is worth.
 *
 * An institution-level screen rather than a per-project one, because both
 * answers are the institution's: a rate card is a commercial position and an
 * exchange rate is a fact about the bank. A project overrides the card from its
 * own Cost tab, which is where somebody is when they need to.
 *
 * Reachable by whoever may start a project — the same rule as adding a client.
 * The API refuses anybody else, and a rate card says what each colleague is
 * charged out at, so it is not a screen to leave lying open.
 */
export default function RatesPage() {
  return <RateCard />;
}
