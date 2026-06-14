/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@renting/shared"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
