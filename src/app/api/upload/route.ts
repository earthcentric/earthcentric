import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getCredential } from "@/lib/credentials";

// Configure Cloudinary helper
async function configureCloudinary() {
  const cloudName = await getCredential("CLOUDINARY_CLOUD_NAME", "");
  const apiKey = await getCredential("CLOUDINARY_API_KEY", "");
  const apiSecret = await getCredential("CLOUDINARY_API_SECRET", "");

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials are not configured.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folderType = (formData.get("folder") as string) || "documents/verification";
    const docType = (formData.get("docType") as string) || "DOCUMENT";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file was provided." }, { status: 400 });
    }

    const isDoc = folderType.includes("documents") || folderType.includes("verification");
    const mimeType = file.type || "";
    const fileName = file.name || "uploaded_file";

    // Validate size (15MB for docs, 10MB for images)
    const maxBytes = isDoc ? 15 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      const limitMb = isDoc ? 15 : 10;
      return NextResponse.json(
        { success: false, error: `File size exceeds the limit of ${limitMb}MB.` },
        { status: 400 }
      );
    }

    // Validate MIME types
    const allowedDocTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/avif"];
    const allowed = isDoc ? allowedDocTypes : allowedImageTypes;

    // Check by mimeType or file extension
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const isAllowedExt = isDoc
      ? ["pdf", "jpg", "jpeg", "png", "webp"].includes(ext)
      : ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext);

    if (mimeType && !allowed.includes(mimeType) && !isAllowedExt) {
      return NextResponse.json(
        { success: false, error: `Invalid file format (${mimeType || ext}). Supported formats: ${allowed.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if Cloudinary credentials are set
    const cloudName = await getCredential("CLOUDINARY_CLOUD_NAME", "");
    const apiKey = await getCredential("CLOUDINARY_API_KEY", "");
    const apiSecret = await getCredential("CLOUDINARY_API_SECRET", "");
    const isMock = !cloudName || cloudName === "mock" || !apiKey || apiKey === "mock" || !apiSecret || apiSecret === "mock";

    if (isMock) {
      return NextResponse.json({
        success: false,
        error: "Cloudinary credentials are not configured in environment.",
      }, { status: 500 });
    }

    await configureCloudinary();

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine resource type:
    // For PDFs: using "image" with format "pdf" allows Cloudinary to generate page 1 JPG thumbnails!
    const isPdf = mimeType === "application/pdf" || ext === "pdf";
    const resourceType = isPdf ? "image" : (isDoc ? "auto" : "image");

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderType,
          resource_type: resourceType as any,
          format: isPdf ? "pdf" : undefined,
          // Preserve sanitised original filename as part of public_id for clarity
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    console.log(`[Cloudinary Upload] Success for ${fileName} (${docType}): ${uploadResult.secure_url}`);

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      format: uploadResult.format || ext,
      resourceType: uploadResult.resource_type,
      fileName: fileName,
      fileSize: file.size,
    });
  } catch (error: any) {
    console.error("[Upload API Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload file to storage." },
      { status: 500 }
    );
  }
}
