import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Cek apakah kredensial Cloudinary sudah diisi di environment */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export type CloudinaryResourceType = "image" | "raw" | "auto";

/**
 * Upload buffer file ke Cloudinary via upload_stream.
 *
 * @param fileBuffer  Isi file (Buffer)
 * @param folder      Folder tujuan, contoh: "yayasan/children"
 * @param publicId    Nama file di Cloudinary (opsional, tanpa ekstensi utk image)
 * @param resourceType "image" utk foto, "raw" utk PDF/dokumen
 * @returns secure_url file yang ter-upload
 */
export function uploadFileToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  publicId?: string,
  resourceType: CloudinaryResourceType = "image"
): Promise<string> {
  if (!isCloudinaryConfigured()) {
    return Promise.reject(
      new Error(
        "Cloudinary belum dikonfigurasi. Isi CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET di environment."
      )
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
        // Kompresi otomatis utk foto agar hemat bandwidth free tier
        ...(resourceType === "image" && {
          transformation: [{ quality: "auto:good", fetch_format: "auto" }],
        }),
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url) {
          reject(new Error("Cloudinary tidak mengembalikan secure_url"));
          return;
        }
        resolve(result.secure_url);
      }
    );

    uploadStream.end(fileBuffer);
  });
}
