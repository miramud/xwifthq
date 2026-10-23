import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import ReviewsBoard from "@/suite/hrm/components/console/ReviewsBoard";

export const metadata: Metadata = {
  title: "Reviews",
  robots: { index: false, follow: false },
};

export default function HrmReviewsPage() {
  return (
    <ManagerOnly>
      <ReviewsBoard />
    </ManagerOnly>
  );
}
