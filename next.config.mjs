/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Video thumbnail domains added here when vendor is confirmed (OQ-video)
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@workos-inc/node"],
  },
};

export default nextConfig;
