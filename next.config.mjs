/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export → deploys to classic Firebase Hosting (highclassshippinglogistics.web.app).
  // The whole app runs client-side on the Firebase Web SDK, so no server is needed.
  output: "export",
  images: {
    // Static export can't use the Next.js image optimizer.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  eslint: {
    // Lint runs in CI; don't block production builds on lint warnings.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
