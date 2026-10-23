/* ------------------------------------------------------------------ */
/*  Course types + pure formatting helpers.                            */
/*                                                                      */
/*  This file used to also export a hand-written `COURSES` array that   */
/*  the catalog, cart and dashboards read from. Every course now comes  */
/*  from the database via `src/lib/api/public.ts` (public pages) or the  */
/*  admin/instructor clients, so only the shape and the formatters       */
/*  survive here.                                                        */
/* ------------------------------------------------------------------ */

/** The three levels the backend's CourseLevel enum accepts. */
export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

export type CourseLevel = (typeof LEVELS)[number];

/** Mirrors Laravel's `CourseResource`. The list endpoint omits the heavy keys. */
export interface Course {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  categorySlug: string;
  level: CourseLevel;
  rating: number;
  reviewCount: number;
  studentsEnrolled: number;
  duration: string;
  durationMonths: number;
  instructor: {
    name: string;
    title: string;
    avatar: string;
    bio: string;
    courseCount: number;
    studentCount: number;
    rating: number;
  };
  language: string;
  lastUpdated: string;
  totalLectures: number;
  totalHours: number;
  articles: number;
  downloadableResources: number;
  hasCertificate: boolean;
  /** Fallback tile styling, used whenever `thumbnailUrl` is null. */
  gradient: string;
  /** Uploaded cover image (Cloudinary), or null when the author never set one. */
  thumbnailUrl?: string | null;
  learningOutcomes: string[];
  requirements: string[];
  sections: {
    title: string;
    lectures: {
      id?: string;
      title: string;
      /** "M:SS"/"H:MM:SS", or null when the author never set a runtime. */
      duration: string | null;
      type: "video" | "article" | "document" | "quiz";
    }[];
  }[];
  reviews: {
    name: string;
    rating: number;
    date: string;
    comment: string;
    avatar: string;
  }[];
}

