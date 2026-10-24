"use client";

import { useEffect, useState } from "react";

/**
 * A one-shot celebration burst for the "hooray, it's verified" moment.
 * Deterministic (no Math.random during render, keeps the React Compiler happy
 * and SSR stable) and fully disabled under prefers-reduced-motion.
 */

const COLORS = [
  "#9638cd",
  "#bc7ee6",
  "#e6a532",
  "#22c55e",
  "#facc15",
  "#ec4899",
  "#06b6d4",
];

const COUNT = 70;

// Cheap deterministic pseudo-random in [0,1) from an integer seed.
function rand(seed: number): number {
  const x = Math.sin(seed * 99.13) * 43758.5453;
  return x - Math.floor(x);
}

interface Piece {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
  color: string;
  size: number;
  round: boolean;
}

const PIECES: Piece[] = Array.from({ length: COUNT }, (_, i) => ({
  left: rand(i + 1) * 100,
  delay: rand(i + 2) * 0.6,
  duration: 2.4 + rand(i + 3) * 1.6,
  drift: (rand(i + 4) - 0.5) * 220,
  rotate: rand(i + 5) * 720 - 360,
  color: COLORS[i % COLORS.length],
  size: 6 + Math.round(rand(i + 6) * 6),
  round: rand(i + 7) > 0.5,
}));

export default function Confetti({ fire = true }: { fire?: boolean }) {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    // Sync the initial value off the effect body (not a synchronous setState).
    const raf = requestAnimationFrame(onChange);
    mq.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  if (!fire || reduced) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes cert-confetti {
          0%   { transform: translate3d(0, -10%, 0) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translate3d(var(--drift), 115vh, 0) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
      {PIECES.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "-16px",
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            opacity: 0,
            ["--drift" as string]: `${p.drift}px`,
            ["--rot" as string]: `${p.rotate}deg`,
            animation: `cert-confetti ${p.duration}s cubic-bezier(0.2, 0.6, 0.4, 1) ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
