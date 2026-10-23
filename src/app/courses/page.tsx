import type { Metadata } from "next";
import CourseCatalogView from "./CourseCatalogView";
import { getCourses } from "@/lib/api/public";

/* ------------------------------------------------------------------ */
/*  SEO Metadata                                                       */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Courses: browse every course",
  description:
    "Browse every course on XwiftHQ, from web development and cybersecurity to data science, cloud, design and mobile. Learn from expert instructors at your own pace and earn a certificate when you finish.",
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
    title: "Browse every course | XwiftHQ",
    description:
      "Find the right course for you or your team. Expert-led training in web development, cybersecurity, data science and more.",
    url: "https://xwifthq.example.com/courses",
  },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function CoursesPage() {
  const courses = await getCourses();
  return <CourseCatalogView courses={courses} />;
}
