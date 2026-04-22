// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    // Ubah file menjadi buffer agar bisa dibaca Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Proses upload menggunakan Promise
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "mtm_app_uploads" }, // Nama folder di Cloudinary Anda
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      // Akhiri stream dengan buffer gambar
      uploadStream.end(buffer);
    });

    return NextResponse.json({ 
      success: true, 
      url: (uploadResult as any).secure_url // Ini URL gambar yang akan kita simpan di Firebase
    });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}