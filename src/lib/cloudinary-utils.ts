// Pure utility functions for Cloudinary URLs, document previews, and folder resolution
// Safe for both client-side and server-side components (no Node.js dependencies like 'fs')

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

export function isDocFolder(folder: string): boolean {
  return folder === "documents/verification";
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

// Helper to detect if a stored URL is a legacy mock/fallback Unsplash image
export function isLegacyMockUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("1606857521015-7f9fcf423740") ||
    url.includes("1542601906990-b4d3fb778b09") ||
    url.includes("example.com") ||
    url.includes("mock_fallback")
  );
}

// Comprehensive preview helper for Admin and Seller portals
export function getDocumentPreviewInfo(
  urlOrDbValue: string | null | undefined,
  fileName?: string,
  storedFormat?: string
): {
  cleanUrl: string;
  previewUrl: string;
  isPdf: boolean;
  isImage: boolean;
  isLegacyMock: boolean;
  isAvailable: boolean;
  fileExtension: string;
} {
  const cleanUrl = getUrlFromDb(urlOrDbValue);
  if (!cleanUrl) {
    return {
      cleanUrl: "",
      previewUrl: "",
      isPdf: false,
      isImage: false,
      isLegacyMock: false,
      isAvailable: false,
      fileExtension: "",
    };
  }

  const isLegacyMock = isLegacyMockUrl(cleanUrl);
  const extFromName = fileName?.split(".").pop()?.toLowerCase() || "";
  const extFromUrl = cleanUrl.split("?")[0].split(".").pop()?.toLowerCase() || "";
  const fileExtension = storedFormat?.toLowerCase() || extFromName || extFromUrl;

  const isPdf = fileExtension === "pdf" || cleanUrl.toLowerCase().includes(".pdf");
  const isImage = !isPdf && ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"].includes(fileExtension);

  let previewUrl = cleanUrl;
  // For Cloudinary PDFs, page 1 JPG rasterization preview
  if (isPdf && cleanUrl.includes("res.cloudinary.com")) {
    if (cleanUrl.toLowerCase().endsWith(".pdf")) {
      previewUrl = cleanUrl.replace(/\.pdf$/i, ".jpg");
    } else if (cleanUrl.includes("/image/upload/")) {
      previewUrl = `${cleanUrl}.jpg`;
    }
  }

  return {
    cleanUrl,
    previewUrl,
    isPdf,
    isImage: isImage || (!isPdf && !isLegacyMock),
    isLegacyMock,
    isAvailable: !isLegacyMock && cleanUrl.length > 0,
    fileExtension,
  };
}
