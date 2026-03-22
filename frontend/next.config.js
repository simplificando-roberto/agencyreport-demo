/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.API_URL || "http://localhost:8000"}/api/:path*` },
    ];
  },
};
