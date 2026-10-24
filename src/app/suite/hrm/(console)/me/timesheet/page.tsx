import type { Metadata } from "next";
import TimeClock from "@/suite/hrm/components/console/TimeClock";

export const metadata: Metadata = {
  title: "My timesheet",
  robots: { index: false, follow: false },
};

/**
 * Not behind the manager gate. Signing in and out is the employee's own
 * action, and the API resolves the record from the token rather than from an
 * id, so there is nothing here to tamper with.
 */
export default function MyTimesheetPage() {
  return <TimeClock />;
}
