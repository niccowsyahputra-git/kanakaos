/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Hanya izinkan foto dari Cloudinary (pengganti images.domains yang deprecated)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [
      "@libsql/client",
      "@prisma/adapter-libsql",
      "bcryptjs",
      "@react-pdf/renderer",
      "cloudinary",
    ],
  },
};

export default nextConfig;
