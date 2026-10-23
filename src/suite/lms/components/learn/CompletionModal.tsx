"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, ArrowRight, Download, Star } from "lucide-react";

interface CompletionModalProps {
  courseTitle: string;
  courseSlug: string;
  /** The learner's own name, for the certificate preview. */
  recipientName?: string | null;
  /**
   * Serial of the certificate the API issued on completion. Absent when the
   * course does not offer one, or when issuing has not landed yet.
   */
  certificateSerial?: string | null;
  onClose: () => void;
}

function ConfettiDot({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full opacity-0"
      style={{
        left: `${x}%`,
        top: "-4px",
        backgroundColor: color,
        animation: `confetti-fall 2.5s ease-in ${delay}s infinite`,
      }}
    />
  );
}

const confettiColors = [
  "#0c4f54", "#8e75bc", "#e6a532", "#22c55e", "#facc15",
  "#ec4899", "#06b6d4", "#f43f5e", "#8b5cf6", "#10b981",
];

const CONFETTI_COUNT = 30;

/**
 * Fixed scatter, computed once at module load rather than during render.
 *
 * `Math.random()` in the render body is impure: React may re-render this modal
 * for any reason, and every dot would then jump to a new column and restart its
 * fall. Precomputing keeps the animation stable across re-renders — and the
 * pattern only has to look unplanned, not be freshly random each time.
 */
const CONFETTI = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  // Golden-ratio spacing spreads the dots across the width without clumping,
  // which random placement does not reliably do at this count.
  x: ((i * 61.803) % 100),
  delay: ((i * 37) % 20) / 10,
  color: confettiColors[i % confettiColors.length],
}));

export default function CompletionModal({
  courseTitle,
  courseSlug,
  recipientName,
  certificateSerial,
  onClose,
}: CompletionModalProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          show ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Confetti — hidden outright for anyone who has asked for less motion. */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none motion-reduce:hidden"
        aria-hidden="true"
      >
        {CONFETTI.map((dot, i) => (
          <ConfettiDot key={i} delay={dot.delay} x={dot.x} color={dot.color} />
        ))}
      </div>

      {/* Modal */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transition-all duration-500 ${
          show ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-8"
        }`}
      >
        {/* Top gradient bar */}
        <div className="h-2 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-600 rounded-t-2xl" />

        <div className="p-6 sm:p-8 text-center">
          {/* Trophy / celebration */}
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-accent-400 to-accent-600 rounded-full flex items-center justify-center shadow-lg shadow-accent-500/30 animate-bounce-gentle">
            <Award className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-neutral-900 mb-2">
            Congratulations!
          </h2>
          <p className="text-neutral-600 mb-6">
            You&apos;ve completed <span className="font-semibold text-neutral-800">{courseTitle}</span>!
          </p>

          {/* Certificate preview */}
          <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 rounded-xl p-6 text-white mb-6 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <p className="text-xs uppercase tracking-[0.2em] text-primary-200 mb-1">
                Certificate of Completion
              </p>
              <div className="w-8 h-0.5 bg-accent-500 mx-auto mb-3" />
              <p className="text-lg font-heading font-semibold leading-snug mb-3">
                {courseTitle}
              </p>
              <p className="text-sm text-primary-200 mb-1">Awarded to</p>
              {/* The learner's real name — this used to read "Student Name". */}
              <p className="text-base font-medium mb-3">{recipientName ?? "You"}</p>
              <div className="flex items-center justify-between text-xs text-primary-300">
                <span>{certificateSerial ?? today}</span>
                <span className="font-heading font-semibold text-primary-200">
                  Elevate
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {/*
              The real certificate, not a simulated download. When the API has
              issued one, this opens its verification page — a shareable public
              URL anyone can check. When the course offers no certificate (or
              issuing has not landed yet) the button is simply not shown, rather
              than pretending to produce a file.
            */}
            {certificateSerial && (
              <Link
                href={`/verify/${certificateSerial}`}
                className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-primary-700 transition-colors active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                View your certificate
              </Link>
            )}

            <Link
              href={`/courses/${courseSlug}#reviews`}
              className="w-full flex items-center justify-center gap-2 border-2 border-primary-200 text-primary-700 px-6 py-3 rounded-lg font-semibold text-sm hover:bg-primary-50 transition-colors"
            >
              <Star className="w-4 h-4" />
              Leave a review
            </Link>

            <Link
              href="/courses"
              className="w-full flex items-center justify-center gap-2 text-neutral-600 px-6 py-3 rounded-lg text-sm hover:bg-neutral-100 transition-colors"
            >
              Back to Courses
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(0) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translateY(100vh) rotate(720deg);
          }
        }
        @keyframes bounce-gentle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
