/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@renting/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
