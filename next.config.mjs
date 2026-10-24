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
    // Default 1MB terlalu kecil untuk upload logo yayasan (maks 3MB + field form)
    serverActions: {
      bodySizeLimit: "4mb",
    },
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
