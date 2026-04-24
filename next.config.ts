/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  allowedDevOrigins: [
    "192.168.68.100",   // your phone / other PC
    "localhost",
    "0.0.0.0"
  ],
};

module.exports = nextConfig;