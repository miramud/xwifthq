import type { Metadata } from "next";
import CourseCatalog from "@/suite/lms/components/courses/CourseCatalog";
import { getCourses } from "@/lib/api/public";

/* ------------------------------------------------------------------ */
/*  SEO Metadata                                                       */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Courses - Browse All Tech Courses",
  description:
    "Explore our catalog of industry-ready tech courses in web development, cybersecurity, data science, cloud computing, UI/UX design, mobile development, and more. Learn from expert instructors and build your tech career with Elevate.",
  keywords: [
    "tech courses",
    "online courses Nigeria",
    "web development course",
    "cybersecurity training",
    "data science course",
    "cloud computing certification",
    "UI/UX design course",
    "mobile development",
    "coding bootcamp Nigeria",
    "IT training Abuja",
  ],
  openGraph: {
    title: "Browse All Tech Courses | Elevate",
    description:
      "Find the perfect tech course to advance your career. Expert-led training in web development, cybersecurity, data science, and more.",
    url: "https://elevate.example.com/courses",
  },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function CoursesPage() {
  const courses = await getCourses();
  return <CourseCatalog courses={courses} />;
}
