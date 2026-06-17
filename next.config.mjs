/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  },
  serverExternalPackages: ["better-sqlite3", "@xenova/transformers"]
};

export default nextConfig;
