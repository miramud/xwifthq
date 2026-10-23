import type { Metadata } from "next";
import AiSettings from "@/suite/projects/components/AiSettings";

export const metadata: Metadata = {
  title: "AI",
  robots: { index: false, follow: false },
};

/**
 * Which model provider this institution uses, and what it has spent.
 *
 * An institution-level screen because the key is an institution-level thing:
 * it is theirs, it is billed to their account, and there is no shared key
 * anywhere in this product for somebody to fall back onto by accident.
 *
 * Reachable by whoever may start a project — the same rule as adding a client
 * and setting the rate card. The API refuses anybody else, and a rate card and
 * an API key are both things not to leave open on a shared screen.
 */
export default function AiPage() {
  return <AiSettings />;
}
