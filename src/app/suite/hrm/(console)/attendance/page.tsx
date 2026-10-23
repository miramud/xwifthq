import type { Metadata } from "next";
import AttendanceBoard from "@/suite/hrm/components/console/AttendanceBoard";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";

export const metadata: Metadata = {
  title: "Attendance",
  robots: { index: false, follow: false },
};

export default function HrmAttendancePage() {
  return (
    <ManagerOnly>
      <AttendanceBoard />
    </ManagerOnly>
  );
}
