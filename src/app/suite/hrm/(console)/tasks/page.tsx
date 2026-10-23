import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import TasksBoard from "@/suite/hrm/components/console/TasksBoard";

export const metadata: Metadata = {
  title: "Tasks",
  robots: { index: false, follow: false },
};

export default function HrmTasksPage() {
  return (
    <ManagerOnly>
      <TasksBoard />
    </ManagerOnly>
  );
}
