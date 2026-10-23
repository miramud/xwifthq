"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, X } from "lucide-react";

interface VideoPreviewModalProps {
  gradient: string;
  courseTitle: string;
}

export default function VideoPreviewModal({
  gradient,
  courseTitle,
}: VideoPreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, close]);

  return (
    <>
      {/* Preview Banner / Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className={`relative w-full aspect-video rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center cursor-pointer group overflow-hidden`}
        aria-label={`Preview ${courseTitle}`}
      >
        {/* Subtle overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300" />

        {/* Play button */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="h-20 w-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300">
            <Play
              size={36}
              className="text-neutral-800 ml-1.5"
              fill="currentColor"
            />
          </div>
          <span className="text-sm font-medium text-white/90 bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-sm">
            Preview this course
          </span>
        </div>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-4 bg-black/80 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`${courseTitle} preview`}
        >
          <div
            className="relative my-auto w-full max-w-3xl bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close preview"
            >
              <X size={18} className="text-white" />
            </button>

            {/* Placeholder video area */}
            <div
              className={`aspect-video bg-gradient-to-br ${gradient} flex items-center justify-center`}
            >
              <div className="text-center">
                <div className="h-20 w-20 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-4">
                  <Play
                    size={36}
                    className="text-white ml-1.5"
                    fill="currentColor"
                  />
                </div>
                <p className="text-white/80 text-sm font-medium">
                  No preview video for this course
                </p>
                <p className="text-white/50 text-xs mt-1">
                  {courseTitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
