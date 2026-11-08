/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["images.unsplash.com"],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "https://mezflow.vercel.app/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
