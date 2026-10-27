import { v2 as cloudinary } from "cloudinary";
import { getCredential } from "./credentials";
import { getFolderFromType, isDocFolder } from "./cloudinary-utils";

export * from "./cloudinary-utils";

async function configureCloudinary() {
  const cloudName = await getCredential("CLOUDINARY_CLOUD_NAME", "mock");
  const apiKey = await getCredential("CLOUDINARY_API_KEY", "mock");
  const apiSecret = await getCredential("CLOUDINARY_API_SECRET", "mock");

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

export interface CloudinaryUploadResponse {
  url: string;
  publicId: string;
}

// Check if Cloudinary is running in mock mode
export async function isCloudinaryMock(): Promise<boolean> {
  const cloudName = await getCredential("CLOUDINARY_CLOUD_NAME");
  const apiKey = await getCredential("CLOUDINARY_API_KEY");
  const apiSecret = await getCredential("CLOUDINARY_API_SECRET");
  
  return !cloudName || cloudName === "mock" || !apiKey || apiKey === "mock" || !apiSecret || apiSecret === "mock";
}

// Extends uploadImage signature to remain backward compatible, but returns JSON response.
export async function uploadImage(fileBase64: string, folderOrType: string = "products/images"): Promise<string> {
  const isMock = await isCloudinaryMock();
  const folder = getFolderFromType(folderOrType);
  const isDoc = isDocFolder(folder);
  
  // If already a JSON response from Cloudinary / previous upload
  if (fileBase64.startsWith("{\"url\":") || fileBase64.startsWith("{\"secure_url\":")) {
    return fileBase64;
  }

  // Extract mimetype and raw base64 data
  let mimeType = "";
  let base64Data = fileBase64;
  const isRemoteUrl = fileBase64.startsWith("http://") || fileBase64.startsWith("https://");

  if (fileBase64.startsWith("data:")) {
    const match = fileBase64.match(/^data:([^;]+);base64,/);
    if (match) {
      mimeType = match[1];
      base64Data = fileBase64.substring(match[0].length);
    }
  }

  // File size validation (Base64 character length is roughly 4/3 of actual size) - only for base64 data
  const approxSizeInBytes = (base64Data.length * 3) / 4;
  const sizeLimitMb = isDoc ? 10 : 5;
  const sizeLimitBytes = sizeLimitMb * 1024 * 1024;
  
  if (!isRemoteUrl && approxSizeInBytes > sizeLimitBytes) {
    throw new Error(`File size exceeds the limit of ${sizeLimitMb}MB`);
  }

  // Format validation
  if (mimeType) {
    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
    const allowedDocTypes = ["application/pdf", "image/jpeg", "image/png"];
    
    const allowedTypes = isDoc ? allowedDocTypes : allowedImageTypes;
    if (!allowedTypes.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed types: ${allowedTypes.join(", ")}`);
    }
  }

  if (isMock) {
    // Standard delay to simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    let mockUrl = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=60";
    if (isDoc) {
      mockUrl = "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=600&auto=format&fit=crop&q=60";
    }
    const mockPublicId = `mock_${folder.replace(/\//g, "_")}_${Math.random().toString(36).substring(2, 9)}`;
    
    return JSON.stringify({
      url: mockUrl,
      publicId: mockPublicId
    });
  }

  try {
    // Reconstruct valid data URI if missing prefix, unless it's a remote URL
    const isRemoteUrl = fileBase64.startsWith("http://") || fileBase64.startsWith("https://");
    const uploadInput = isRemoteUrl
      ? fileBase64
      : fileBase64.startsWith("data:") 
        ? fileBase64 
        : `data:${mimeType || (isDoc ? "application/pdf" : "image/jpeg")};base64,${fileBase64}`;

    await configureCloudinary();
    const uploadResponse = await cloudinary.uploader.upload(uploadInput, {
      folder: folder,
      resource_type: isDoc ? "auto" : "image",
    });

    console.log(`[Cloudinary] Upload successful. Public ID: ${uploadResponse.public_id}, URL: ${uploadResponse.secure_url}`);
    return JSON.stringify({
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id
    });
  } catch (error: any) {
    console.error("Cloudinary upload failed:", error.message || error);
    // Only fall back to mock if running in explicit mock mode without real credentials
    if (isMock) {
      let mockUrl = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=60";
      if (isDoc) {
        mockUrl = "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=600&auto=format&fit=crop&q=60";
      }
      return JSON.stringify({
        url: mockUrl,
        publicId: `mock_fallback_${Math.random().toString(36).substring(2, 9)}`
      });
    }
    // In real mode: throw real error so caller knows upload failed
    throw new Error(`Cloudinary storage upload error: ${error.message || "Upload failed"}`);
  }
}

// Delete helper to destroy files on Cloudinary
export async function deleteImage(publicId: string): Promise<boolean> {
  const isMock = await isCloudinaryMock();
  if (isMock || publicId.startsWith("mock_")) {
    return true;
  }
  try {
    await configureCloudinary();
    const response = await cloudinary.uploader.destroy(publicId);
    return response.result === "ok";
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return false;
  }
}
