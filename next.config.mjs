/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  },
  serverExternalPackages: ["@xenova/transformers", "@libsql/client"]
};

export default nextConfig;
