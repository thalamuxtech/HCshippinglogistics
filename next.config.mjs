/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
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
