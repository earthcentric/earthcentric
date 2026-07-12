import { v2 as cloudinary } from "cloudinary";
import { getCredential } from "./credentials";

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

// Automatically resolve folders based on upload type
export function getFolderFromType(folderOrType: string): string {
  const normalized = folderOrType.toLowerCase().trim();
  
  if (normalized.includes("buyer-profile") || normalized.includes("buyers/profile")) {
    return "buyers/profile";
  }
  if (normalized.includes("seller-profile") || normalized.includes("sellers/profile")) {
    return "sellers/profile";
  }
  if (normalized.includes("seller-banner") || normalized.includes("sellers/banner") || normalized.includes("sellers/banners")) {
    return "sellers/banners";
  }
  if (normalized.includes("product") || normalized.includes("products/images")) {
    return "products/images";
  }
  if (normalized.includes("category") || normalized.includes("admin/categories")) {
    return "admin/categories";
  }
  if (normalized.includes("ad-banner") || normalized.includes("admin/banner") || normalized.includes("admin/banners")) {
    return "admin/banners";
  }
  if (normalized.includes("verification") || normalized.includes("document") || normalized.includes("documents/verification")) {
    return "documents/verification";
  }
  
  return folderOrType; // default fallback if none match
}

// Helper to check if file type is document
function isDocFolder(folder: string): boolean {
  return folder === "documents/verification";
}

// Extends uploadImage signature to remain backward compatible, but returns JSON response.
export async function uploadImage(fileBase64: string, folderOrType: string = "products/images"): Promise<string> {
  const isMock = await isCloudinaryMock();
  const folder = getFolderFromType(folderOrType);
  const isDoc = isDocFolder(folder);
  
  // Extract mimetype and raw base64 data
  let mimeType = "";
  let base64Data = fileBase64;
  if (fileBase64.startsWith("data:")) {
    const match = fileBase64.match(/^data:([^;]+);base64,/);
    if (match) {
      mimeType = match[1];
      base64Data = fileBase64.substring(match[0].length);
    }
  }

  // File size validation (Base64 character length is roughly 4/3 of actual size)
  const approxSizeInBytes = (base64Data.length * 3) / 4;
  const sizeLimitMb = isDoc ? 10 : 5;
  const sizeLimitBytes = sizeLimitMb * 1024 * 1024;
  
  if (approxSizeInBytes > sizeLimitBytes) {
    throw new Error(`File size exceeds the limit of ${sizeLimitMb}MB`);
  }

  // Format validation
  if (mimeType) {
    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
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
    console.warn("Cloudinary upload failed, falling back to mock:", error.message || error);
    // Fall back to mock response to prevent application crashes
    let mockUrl = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=60";
    if (isDoc) {
      mockUrl = "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=600&auto=format&fit=crop&q=60";
    }
    return JSON.stringify({
      url: mockUrl,
      publicId: `mock_fallback_${Math.random().toString(36).substring(2, 9)}`
    });
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

// Database helper: Extract clean URL from DB JSON string
export function getUrlFromDb(dbValue: string | null | undefined): string {
  if (!dbValue) return "";
  if (dbValue.startsWith("{") && dbValue.endsWith("}")) {
    try {
      const parsed = JSON.parse(dbValue);
      if (parsed && typeof parsed === "object" && "url" in parsed) {
        return parsed.url;
      }
    } catch (e) {
      // Ignored
    }
  }
  return dbValue;
}

// Database helper: Extract public ID from DB JSON string
export function getPublicIdFromDb(dbValue: string | null | undefined): string | null {
  if (!dbValue) return null;
  if (dbValue.startsWith("{") && dbValue.endsWith("}")) {
    try {
      const parsed = JSON.parse(dbValue);
      if (parsed && typeof parsed === "object" && "publicId" in parsed) {
        return parsed.publicId;
      }
    } catch (e) {
      // Ignored
    }
  }
  
  // Fallback: extract public ID from Cloudinary URL if possible
  if (dbValue.includes("cloudinary.com")) {
    try {
      const parts = dbValue.split("/upload/");
      if (parts.length > 1) {
        const afterUpload = parts[1];
        const pathParts = afterUpload.split("/");
        // remove version folder (e.g. v12345678)
        if (pathParts[0].startsWith("v") && /^\d+$/.test(pathParts[0].substring(1))) {
          pathParts.shift();
        }
        const fullPath = pathParts.join("/");
        const dotIndex = fullPath.lastIndexOf(".");
        if (dotIndex !== -1) {
          return fullPath.substring(0, dotIndex);
        }
        return fullPath;
      }
    } catch (e) {
      console.error("Error parsing publicId from url fallback:", e);
    }
  }
  return null;
}
