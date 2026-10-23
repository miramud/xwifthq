import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray lockfile in a parent
  // directory was causing Next to infer the wrong root.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Next buffers every incoming request body to a clonable stream (so proxy
    // and the route handler can both read it) and caps it at 10 MB BY DEFAULT.
    // Past the cap it silently truncates the body and only logs a warning to
    // the SERVER terminal — no client error. That corrupted every lecture-video
    // upload over 10 MB posted to /api/uploads (videos are capped at 500 MB).
    // Keep this at/above the media video cap (MEDIA_MAX_VIDEO_KB, 500 MB).
    proxyClientMaxBodySize: "520mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
