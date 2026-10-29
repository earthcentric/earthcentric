"use server";

import db from "@/lib/db";
import { uploadImage, deleteImage, getUrlFromDb, getPublicIdFromDb } from "@/lib/cloudinary";
import { createAdminNotification } from "@/actions/notifications";
import { createProduct } from "./products";
import { getOrdersBySeller } from "./orders";
import { encrypt, decrypt } from "@/lib/encryption";
import { setEarthcentricSessionCookie } from "@/lib/session";
import { validateFullApplication } from "@/lib/seller-validation";

export interface SellerRemovalRecord {
  sellerId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  companyName: string;
  businessType: string;
  description?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  declaredRevenue?: string;
  trustScore?: number;
  badges?: string[];
  phone?: string;
  ownerName?: string;
  founderName?: string;
  aadharNumber?: string;
  factoryAddress?: string;
  pickupAddress?: string;
  companyAddress?: string;
  bankAccountNo?: string;
  bankName?: string;
  bankIfsc?: string;
  bankProofUrl?: string;
  verifiedAt?: Date | string;
  previousStatus: string;
  removedAt: string;
  removalReason: string;
  removedBy: string;
  documents?: {
    type: string;
    fileName: string;
    fileUrl: string;
    uploadedAt?: Date | string;
  }[];
  productsCount?: number;
}

export interface SellerProfile {
  id: string;
  userId: string;
  userName?: string;
  user?: { name: string | null; email: string };
  companyName: string;
  businessType: string;
  description?: string;
  logoUrl?: string;
  companyLogo?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  verificationStatus: "PENDING" | "UNDER_REVIEW" | "NEED_MORE_DOCS" | "APPROVED" | "REJECTED" | "SUSPENDED";
  declaredRevenue?: string;
  rejectionReason?: string;
  trustScore?: number;
  badges?: string[];
  phone?: string;
  ownerName?: string;
  founderName?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  verifiedAt?: Date | string;
  appliedAt?: Date | string;
  appliedOn?: string;
  aadharNumber?: string;
  factoryAddress?: string;
  pickupAddress?: string;
  companyAddress?: string;
  bankAccountNo?: string;
  bankName?: string;
  bankIfsc?: string;
  bankProofUrl?: string;
  documents: {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    publicId?: string | null;
    format?: string | null;
    resourceType?: string | null;
    fileSize?: number | null;
    status?: string | null;
    rejectionReason?: string | null;
    uploadedAt?: Date | string;
  }[];
  isRemoved?: boolean;
  hasPriorRemoval?: boolean;
  priorRemovalDate?: string;
  priorRemovalReason?: string;
  priorRemovalAdmin?: string;
  removalHistory?: SellerRemovalRecord[];
}

// In-memory global array for single designated seller fallback
let mockSellers: SellerProfile[] = [
  {
    id: "cmvcbbtm80001txgw8dd0r3lk",
    userId: "user_3KopVGVdy94cAVqZ4lzQjtWRCMK",
    userName: "AR ECO INDIA",
    companyName: "AR ECO INDIA",
    businessType: "Manufacturer",
    description: "Certified manufacturer of 100% biodegradable and compostable sugarcane bagasse tableware and eco-friendly packaging.",
    website: "https://earthcentric.in",
    phone: "+91 8868882388",
    ownerName: "AR ECO INDIA",
    founderName: "AR ECO INDIA",
    verificationStatus: "APPROVED",
    badges: ["Verified Business", "Verified Sustainable Manufacturer", "Eco Certified"],
    documents: [],
  }
];

export async function getSellerProfile(userId: string): Promise<SellerProfile | null> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return mockSellers.find((s) => s.userId === userId) || null;
    }

    const seller = await db.seller.findUnique({
      where: { userId },
      include: {
        documents: true,
        user: true,
      },
    });

    if (!seller) return null;

    const removalHistory = await getSellerRemovalHistoryInternal(seller.userId, seller.id);
    const hasPriorRemoval = removalHistory.length > 0;
    const isRemoved = seller.verificationStatus === "REJECTED" && (seller.rejectionReason?.startsWith("[SELLER_REMOVED]:") || false);

    return {
      id: seller.id,
      userId: seller.userId,
      ...(seller.user?.name ? { userName: seller.user?.name } : {}),
      ...(seller.user ? { user: { name: seller.user.name, email: seller.user.email } } : {}),
      companyName: seller.companyName,
      businessType: seller.businessType,
      ...(seller.description ? { description: seller.description } : {}),
      ...(getUrlFromDb(seller.logoUrl) ? { logoUrl: getUrlFromDb(seller.logoUrl) } : {}),
      ...(getUrlFromDb(seller.logoUrl) ? { companyLogo: getUrlFromDb(seller.logoUrl) } : {}),
      ...(seller.website ? { website: seller.website } : {}),
      ...(seller.gstNumber ? { gstNumber: seller.gstNumber } : {}),
      ...(seller.panNumber ? { panNumber: decrypt(seller.panNumber) || seller.panNumber } : {}),
      ...(seller.declaredRevenue ? { declaredRevenue: seller.declaredRevenue } : {}),
      verificationStatus: seller.verificationStatus as any,
      badges: seller.badges,
      ...(seller.rejectionReason ? { rejectionReason: seller.rejectionReason } : {}),
      trustScore: seller.trustScore,
      ...(seller.phone ? { phone: seller.phone } : {}),
      ...((seller.user?.name || seller.ownerName) ? { ownerName: (seller.user?.name || seller.ownerName)! } : {}),
      ...((seller.user?.name || seller.founderName) ? { founderName: (seller.user?.name || seller.founderName)! } : {}),
      ...(seller.aadharNumber ? { aadharNumber: decrypt(seller.aadharNumber) || seller.aadharNumber } : {}),
      ...(seller.factoryAddress ? { factoryAddress: seller.factoryAddress } : {}),
      ...(seller.pickupAddress ? { pickupAddress: seller.pickupAddress } : {}),
      ...(seller.companyAddress ? { companyAddress: seller.companyAddress } : {}),
      ...(seller.bankAccountNo ? { bankAccountNo: seller.bankAccountNo } : {}),
      ...(seller.bankName ? { bankName: seller.bankName } : {}),
      ...(seller.bankIfsc ? { bankIfsc: seller.bankIfsc } : {}),
      ...(getUrlFromDb(seller.bankProofUrl) ? { bankProofUrl: getUrlFromDb(seller.bankProofUrl) } : {}),
      ...(seller.createdAt ? { createdAt: seller.createdAt } : {}),
      ...(seller.verifiedAt ? { verifiedAt: seller.verifiedAt } : {}),
      isRemoved,
      hasPriorRemoval,
      ...(hasPriorRemoval ? {
        priorRemovalDate: removalHistory[0].removedAt,
        priorRemovalReason: removalHistory[0].removalReason,
        priorRemovalAdmin: removalHistory[0].removedBy,
        removalHistory,
      } : {}),
      documents: seller.documents.map((doc: any) => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.fileName,
        fileUrl: getUrlFromDb(doc.fileUrl),
        publicId: doc.publicId || null,
        format: doc.format || null,
        resourceType: doc.resourceType || "image",
        fileSize: doc.fileSize || null,
        status: doc.status || "PENDING",
        rejectionReason: doc.rejectionReason || null,
        uploadedAt: doc.uploadedAt,
      })),
    };
  } catch (e) {
    return mockSellers.find((s) => s.userId === userId) || null;
  }
}

export async function getSellerProfileById(id: string): Promise<SellerProfile | null> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const s = mockSellers.find((sel) => sel.id === id || sel.userId === id);
      if (s) {
        const hist = await getMockSellerRemovalHistory(s.userId, s.id);
        return {
          ...s,
          hasPriorRemoval: hist.length > 0,
          removalHistory: hist,
          isRemoved: s.isRemoved || (s.rejectionReason?.startsWith("[SELLER_REMOVED]:") || false),
        };
      }
      return null;
    }

    let seller = await db.seller.findUnique({
      where: { id },
      include: { documents: true, user: true },
    });

    if (!seller) {
      seller = await db.seller.findUnique({
        where: { userId: id },
        include: { documents: true, user: true },
      });
    }

    if (!seller) return null;

    const removalHistory = await getSellerRemovalHistoryInternal(seller.userId, seller.id);
    const hasPriorRemoval = removalHistory.length > 0;
    const isRemoved = seller.verificationStatus === "REJECTED" && (seller.rejectionReason?.startsWith("[SELLER_REMOVED]:") || false);

    return {
      id: seller.id,
      userId: seller.userId,
      ...(seller.user?.name ? { userName: seller.user?.name } : {}),
      ...(seller.user ? { user: { name: seller.user.name, email: seller.user.email } } : {}),
      companyName: seller.companyName,
      businessType: seller.businessType,
      ...(seller.description ? { description: seller.description } : {}),
      ...(getUrlFromDb(seller.logoUrl) ? { logoUrl: getUrlFromDb(seller.logoUrl) } : {}),
      ...(getUrlFromDb(seller.logoUrl) ? { companyLogo: getUrlFromDb(seller.logoUrl) } : {}),
      ...(seller.website ? { website: seller.website } : {}),
      ...(seller.gstNumber ? { gstNumber: seller.gstNumber } : {}),
      ...(seller.panNumber ? { panNumber: decrypt(seller.panNumber) || seller.panNumber } : {}),
      ...(seller.declaredRevenue ? { declaredRevenue: seller.declaredRevenue } : {}),
      verificationStatus: seller.verificationStatus as any,
      badges: seller.badges,
      ...(seller.rejectionReason ? { rejectionReason: seller.rejectionReason } : {}),
      trustScore: seller.trustScore,
      ...(seller.phone ? { phone: seller.phone } : {}),
      ...((seller.user?.name || seller.ownerName) ? { ownerName: (seller.user?.name || seller.ownerName)! } : {}),
      ...((seller.user?.name || seller.founderName) ? { founderName: (seller.user?.name || seller.founderName)! } : {}),
      ...(seller.aadharNumber ? { aadharNumber: decrypt(seller.aadharNumber) || seller.aadharNumber } : {}),
      ...(seller.factoryAddress ? { factoryAddress: seller.factoryAddress } : {}),
      ...(seller.pickupAddress ? { pickupAddress: seller.pickupAddress } : {}),
      ...(seller.companyAddress ? { companyAddress: seller.companyAddress } : {}),
      ...(seller.bankAccountNo ? { bankAccountNo: seller.bankAccountNo } : {}),
      ...(seller.bankName ? { bankName: seller.bankName } : {}),
      ...(seller.bankIfsc ? { bankIfsc: seller.bankIfsc } : {}),
      ...(getUrlFromDb(seller.bankProofUrl) ? { bankProofUrl: getUrlFromDb(seller.bankProofUrl) } : {}),
      ...(seller.createdAt ? { createdAt: seller.createdAt } : {}),
      ...(seller.verifiedAt ? { verifiedAt: seller.verifiedAt } : {}),
      isRemoved,
      hasPriorRemoval,
      ...(hasPriorRemoval ? {
        priorRemovalDate: removalHistory[0].removedAt,
        priorRemovalReason: removalHistory[0].removalReason,
        priorRemovalAdmin: removalHistory[0].removedBy,
        removalHistory,
      } : {}),
      documents: seller.documents.map((doc: any) => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.fileName,
        fileUrl: getUrlFromDb(doc.fileUrl),
        publicId: doc.publicId || null,
        format: doc.format || null,
        resourceType: doc.resourceType || "image",
        fileSize: doc.fileSize || null,
        status: doc.status || "PENDING",
        rejectionReason: doc.rejectionReason || null,
        uploadedAt: doc.uploadedAt,
      })),
    };
  } catch (e) {
    return mockSellers.find((s) => s.userId === id || s.id === id) || null;
  }
}

export async function submitSellerVerification(data: {
  userId: string;
  companyName: string;
  businessType: string;
  description: string;
  website: string;
  gstNumber: string;
  panNumber: string;
  logoBase64?: string;
  logoUrl?: string;
  declaredRevenue?: string;
  phone?: string;
  ownerName?: string;
  factoryAddress?: string;
  pickupAddress?: string;
  companyAddress?: string;
  bankAccountNo?: string;
  bankName?: string;
  bankIfsc?: string;
  documents: {
    type: "GST" | "PAN" | "BUSINESS_REGISTRATION" | "SUSTAINABILITY_CERTIFICATE" | "MANUFACTURING_PROOF" | "BANK_PROOF" | "AADHAR" | string;
    fileName: string;
    fileBase64?: string;
    fileUrl?: string;
    publicId?: string | null;
    format?: string | null;
    resourceType?: string | null;
    fileSize?: number | null;
  }[];
}): Promise<SellerProfile> {
  // Process documents: preserve verified pre-uploaded URLs, or upload base64 if provided
  const uploadedDocs = await Promise.all(
    data.documents.map(async (doc) => {
      let secureUrl = doc.fileUrl;
      let publicId = doc.publicId || null;
      let format = doc.format || null;
      let resourceType = doc.resourceType || "image";
      let fileSize = doc.fileSize || null;

      if (!secureUrl && doc.fileBase64 && doc.fileBase64 !== "existing" && doc.fileBase64 !== "mock_base64") {
        try {
          const res = await uploadImage(doc.fileBase64, "verification");
          secureUrl = getUrlFromDb(res);
          publicId = getPublicIdFromDb(res);
        } catch (uploadErr) {
          console.error(`Failed to upload ${doc.type} document:`, uploadErr);
        }
      }

      return {
        type: doc.type,
        fileName: doc.fileName,
        fileUrl: secureUrl || "",
        publicId,
        format,
        resourceType,
        fileSize,
        status: "PENDING",
      };
    })
  );

  let uploadedLogoUrl: string | null = data.logoUrl || null;
  if (!uploadedLogoUrl && data.logoBase64 && data.logoBase64 !== "existing") {
    try {
      const res = await uploadImage(data.logoBase64, "sellers/logos");
      uploadedLogoUrl = getUrlFromDb(res);
    } catch (logoErr) {
      console.error("Failed to upload logo during verification:", logoErr);
    }
  }

  const sellerId = `sel-${Math.random().toString(36).substring(2, 9)}`;
  const setPendingSellerSession = async () => {
    try {
      await setEarthcentricSessionCookie({
        id: data.userId,
        role: "SELLER",
        sellerStatus: "PENDING",
      });
    } catch (cookieError) {
      console.warn("Could not refresh the seller session after application submission:", cookieError);
    }
  };

  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const existing = mockSellers.find((s) => s.userId === data.userId);
      if (existing) {
        // Delete mock assets if any (no-op in practice, but safe)
        for (const doc of existing.documents) {
          const publicId = getPublicIdFromDb(doc.fileUrl);
          if (publicId) {
            await deleteImage(publicId);
          }
        }
        // Update existing record
        existing.companyName = data.companyName;
        existing.businessType = data.businessType;
        existing.description = data.description;
        existing.website = data.website;
        existing.gstNumber = data.gstNumber;
        existing.panNumber = data.panNumber;
        existing.declaredRevenue = data.declaredRevenue;
        existing.verificationStatus = "PENDING";
        if (uploadedLogoUrl) existing.logoUrl = uploadedLogoUrl;
        existing.documents = uploadedDocs.map((doc, index) => ({
          id: `doc-${index}-${Math.random().toString(36).substring(2, 6)}`,
          type: doc.type,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
        }));
        await setPendingSellerSession();
        return {
          ...existing,
          documents: existing.documents.map(doc => ({ ...doc, fileUrl: getUrlFromDb(doc.fileUrl) }))
        };
      }

      const newSeller: SellerProfile = {
        id: sellerId,
        userId: data.userId,
        companyName: data.companyName,
        businessType: data.businessType,
        description: data.description,
        ...(uploadedLogoUrl ? { logoUrl: uploadedLogoUrl } : {}),
        website: data.website,
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
        declaredRevenue: data.declaredRevenue,
        verificationStatus: "PENDING",
        badges: [],
        documents: uploadedDocs.map((doc, index) => ({
          id: `doc-${index}-${Math.random().toString(36).substring(2, 6)}`,
          type: doc.type,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
        })),
      };
      mockSellers.push(newSeller);
      await setPendingSellerSession();
      return {
        ...newSeller,
        documents: newSeller.documents.map(doc => ({ ...doc, fileUrl: getUrlFromDb(doc.fileUrl) }))
      };
    }

    // Database: Delete existing documents from Cloudinary before replacing
    try {
      const existingSeller = await db.seller.findUnique({
        where: { userId: data.userId },
        include: { documents: true },
      });
      if (existingSeller) {
        for (const doc of existingSeller.documents) {
          const publicId = getPublicIdFromDb(doc.fileUrl);
          if (publicId) {
            await deleteImage(publicId);
          }
        }
      }
    } catch (dbErr) {
      console.error("Error cleaning up old seller verification documents:", dbErr);
    }

    // Find bank proof if uploaded
    const bankProofDoc = uploadedDocs.find(d => d.type === "BANK_PROOF");

    // Database Insert/Upsert
    const seller = await db.seller.upsert({
      where: { userId: data.userId },
      create: {
        id: sellerId,
        userId: data.userId,
        companyName: data.companyName,
        businessType: data.businessType,
        description: data.description,
        logoUrl: uploadedLogoUrl,
        website: data.website,
        gstNumber: data.gstNumber,
        panNumber: encrypt(data.panNumber) || data.panNumber,
        declaredRevenue: data.declaredRevenue,
        verificationStatus: "PENDING",
        phone: data.phone,
        ownerName: data.ownerName,
        founderName: (data as any).founderName || data.ownerName,
        aadharNumber: encrypt((data as any).aadharNumber) || (data as any).aadharNumber,
        factoryAddress: data.factoryAddress,
        pickupAddress: data.pickupAddress,
        companyAddress: data.companyAddress,
        bankAccountNo: data.bankAccountNo,
        bankName: data.bankName,
        bankIfsc: data.bankIfsc,
        bankProofUrl: bankProofDoc?.fileUrl,
        documents: {
          create: uploadedDocs
            .filter((d) => Boolean(d.fileUrl))
            .map((d) => ({
              type: d.type as any,
              fileName: d.fileName,
              fileUrl: d.fileUrl,
              publicId: d.publicId,
              format: d.format,
              resourceType: d.resourceType,
              fileSize: d.fileSize,
              status: "PENDING",
            })),
        },
      },
      update: {
        companyName: data.companyName,
        businessType: data.businessType,
        description: data.description,
        website: data.website,
        gstNumber: data.gstNumber,
        panNumber: encrypt(data.panNumber) || data.panNumber,
        declaredRevenue: data.declaredRevenue,
        verificationStatus: "PENDING",
        ...(uploadedLogoUrl !== null ? { logoUrl: uploadedLogoUrl } : {}),
        phone: data.phone,
        ownerName: data.ownerName,
        founderName: (data as any).founderName || data.ownerName,
        aadharNumber: encrypt((data as any).aadharNumber) || (data as any).aadharNumber,
        factoryAddress: data.factoryAddress,
        pickupAddress: data.pickupAddress,
        companyAddress: data.companyAddress,
        bankAccountNo: data.bankAccountNo,
        bankName: data.bankName,
        bankIfsc: data.bankIfsc,
        bankProofUrl: bankProofDoc?.fileUrl || null,
        documents: {
          deleteMany: {}, // Clear old documents
          create: uploadedDocs
            .filter((d) => Boolean(d.fileUrl))
            .map((d) => ({
              type: d.type as any,
              fileName: d.fileName,
              fileUrl: d.fileUrl,
              publicId: d.publicId,
              format: d.format,
              resourceType: d.resourceType,
              fileSize: d.fileSize,
              status: "PENDING",
            })),
        },
      },
      include: {
        documents: true,
      },
    });

    // Update User Role to SELLER if it wasn't already
    await db.user.update({
      where: { id: data.userId },
      data: { role: "SELLER" },
    });

    await createAdminNotification(
      "New Seller Verification",
      `Seller "${data.companyName}" submitted their verification documents for review.`,
      "sellers"
    );

    await setPendingSellerSession();

    return {
      id: seller.id,
      userId: seller.userId,
      companyName: seller.companyName,
      businessType: seller.businessType,
      ...(seller.description ? { description: seller.description } : {}),
      ...(getUrlFromDb(seller.logoUrl) ? { logoUrl: getUrlFromDb(seller.logoUrl) } : {}),
      ...(getUrlFromDb(seller.logoUrl) ? { companyLogo: getUrlFromDb(seller.logoUrl) } : {}),
      ...(seller.declaredRevenue ? { declaredRevenue: seller.declaredRevenue } : {}),
      verificationStatus: seller.verificationStatus as any,
      badges: seller.badges,
      trustScore: seller.trustScore,
      ...(seller.phone ? { phone: seller.phone } : {}),
      ...(seller.ownerName ? { ownerName: seller.ownerName } : {}),
      ...(seller.founderName ? { founderName: seller.founderName } : {}),
      ...(seller.aadharNumber ? { aadharNumber: seller.aadharNumber } : {}),
      ...(seller.factoryAddress ? { factoryAddress: seller.factoryAddress } : {}),
      ...(seller.pickupAddress ? { pickupAddress: seller.pickupAddress } : {}),
      ...(seller.companyAddress ? { companyAddress: seller.companyAddress } : {}),
      ...(seller.bankAccountNo ? { bankAccountNo: seller.bankAccountNo } : {}),
      ...(seller.bankName ? { bankName: seller.bankName } : {}),
      ...(seller.bankIfsc ? { bankIfsc: seller.bankIfsc } : {}),
      ...(getUrlFromDb(seller.bankProofUrl) ? { bankProofUrl: getUrlFromDb(seller.bankProofUrl) } : {}),
      documents: seller.documents.map((d: any) => ({
        id: d.id,
        type: d.type,
        fileName: d.fileName,
        fileUrl: getUrlFromDb(d.fileUrl),
        publicId: d.publicId || null,
        format: d.format || null,
        resourceType: d.resourceType || "image",
        fileSize: d.fileSize || null,
        status: d.status || "PENDING",
        rejectionReason: d.rejectionReason || null,
        uploadedAt: d.uploadedAt,
      })),
    };
  } catch (error) {
    console.error("Seller verification submission failed:", error);
    throw new Error("Could not save your seller application. Please retry or contact support.");
  }
}

export async function updateSellerProfile(
  userId: string,
  data: {
    companyName?: string;
    description?: string;
    phone?: string;
    logoBase64?: string | null;
    removeLogo?: boolean;
    bankName?: string;
    bankAccountNo?: string;
    bankIfsc?: string;
  }
): Promise<{ success: boolean; profile?: SellerProfile | null; error?: string }> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    let uploadedLogoUrl: string | null | undefined = undefined;
    if (data.removeLogo) {
      uploadedLogoUrl = null;
    } else if (data.logoBase64) {
      uploadedLogoUrl = await uploadImage(data.logoBase64, "sellers/logos");
    }

    if (isMock) {
      const existing = mockSellers.find((s) => s.userId === userId || s.id === userId);
      if (existing) {
        if (data.companyName) existing.companyName = data.companyName;
        if (data.description) existing.description = data.description;
        if (data.phone) existing.phone = data.phone;
        if (uploadedLogoUrl !== undefined) if (uploadedLogoUrl) existing.logoUrl = uploadedLogoUrl;
        if (data.bankName) existing.bankName = data.bankName;
        if (data.bankAccountNo) existing.bankAccountNo = data.bankAccountNo;
        if (data.bankIfsc) existing.bankIfsc = data.bankIfsc;
        
        return { success: true, profile: existing };
      }
      return { success: false, error: "Profile not found." };
    }

    const seller = await db.seller.findFirst({
      where: { OR: [{ id: userId }, { userId }] },
    });

    if (!seller) {
      return { success: false, error: "Seller profile not found." };
    }

    const updatedSeller = await db.seller.update({
      where: { id: seller.id },
      data: {
        companyName: data.companyName,
        description: data.description,
        phone: data.phone,
        ...(uploadedLogoUrl !== undefined ? { logoUrl: uploadedLogoUrl } : {}),
        bankName: data.bankName,
        bankAccountNo: data.bankAccountNo,
        bankIfsc: data.bankIfsc,
      },
      include: {
        documents: true,
        user: true,
      }
    });

    const mappedProfile: SellerProfile = {
      id: updatedSeller.id,
      userId: updatedSeller.userId,
      ...(updatedSeller.user?.name ? { userName: updatedSeller.user?.name } : {}),
      companyName: updatedSeller.companyName,
      businessType: updatedSeller.businessType,
      ...(updatedSeller.description ? { description: updatedSeller.description } : {}),
      ...(getUrlFromDb(updatedSeller.logoUrl) ? { logoUrl: getUrlFromDb(updatedSeller.logoUrl) } : {}),
      ...(getUrlFromDb(updatedSeller.logoUrl) ? { companyLogo: getUrlFromDb(updatedSeller.logoUrl) } : {}),
      ...(updatedSeller.website ? { website: updatedSeller.website } : {}),
      ...(updatedSeller.gstNumber ? { gstNumber: updatedSeller.gstNumber } : {}),
      ...(updatedSeller.panNumber ? { panNumber: updatedSeller.panNumber } : {}),
      verificationStatus: updatedSeller.verificationStatus as any,
      badges: updatedSeller.badges,
      trustScore: updatedSeller.trustScore,
      ...(updatedSeller.phone ? { phone: updatedSeller.phone } : {}),
      ...(updatedSeller.ownerName ? { ownerName: updatedSeller.ownerName } : {}),
      ...(updatedSeller.bankAccountNo ? { bankAccountNo: updatedSeller.bankAccountNo } : {}),
      ...(updatedSeller.bankName ? { bankName: updatedSeller.bankName } : {}),
      ...(updatedSeller.bankIfsc ? { bankIfsc: updatedSeller.bankIfsc } : {}),
      documents: updatedSeller.documents.map((d: any) => ({
        id: d.id,
        type: d.type,
        fileName: d.fileName,
        fileUrl: getUrlFromDb(d.fileUrl),
      })),
    };

    return { success: true, profile: mappedProfile };
  } catch (err: any) {
    console.error("Error updating seller profile:", err);
    return { success: false, error: err.message || "Failed to update profile." };
  }
}

export async function getSellerDashboardStats(
  sellerId: string,
  filterType: "overall" | "daily" | "monthly" | "yearly" = "overall",
  selectedDate?: string,
  selectedMonth?: string,
  selectedYear?: string
) {
  try {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (filterType === "daily" && selectedDate) {
      startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (filterType === "monthly" && selectedMonth) {
      const [y, m] = selectedMonth.split("-").map(Number);
      startDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
      endDate = new Date(y, m, 0, 23, 59, 59, 999);
    } else if (filterType === "yearly" && selectedYear) {
      const y = Number(selectedYear);
      startDate = new Date(y, 0, 1, 0, 0, 0, 0);
      endDate = new Date(y, 11, 31, 23, 59, 59, 999);
    }

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const scale = filterType === "daily" ? 0.05 : filterType === "monthly" ? 0.45 : filterType === "yearly" ? 0.9 : 1;
      const baseRev = Math.round(156900 * scale);
      const baseOrders = Math.max(1, Math.round(38 * scale));
      const baseProducts = Math.max(1, Math.round(6 * scale));
      return {
        revenue: baseRev,
        grossRevenue: baseRev,
        cancelledRevenue: 0,
        ordersCount: baseOrders,
        totalOrdersCount: baseOrders,
        cancelledOrdersCount: 0,
        productsCount: baseProducts,
        rating: 4.8,
        mostSoldProduct: "Bamboo Fiber Sheets",
        salesConversion: 3.4,
        averageOrderValue: Math.round(baseRev / baseOrders),
        totalStoreVisits: Math.round(baseOrders / 0.034),
        environmentalImpact: {
          carbonOffset: Math.floor(baseRev * 0.005) + 20,
          plasticAvoided: Math.floor(baseRev * 0.001) + 5,
          ecoTreePoints: Math.floor(baseRev * 0.0002) + 1,
        },
        categoryBreakdown: [
          { name: "Disposables", percentage: 45 },
          { name: "Kitchenware", percentage: 30 },
          { name: "Personal Care", percentage: 25 },
        ],
        productSalesMap: {
          "p1": Math.round(142 * scale),
          "p2": Math.round(98 * scale),
          "p3": Math.round(67 * scale),
          "p4": Math.round(234 * scale),
        },
      };
    }

    // Resolve seller ID candidate keys
    const seller = await db.seller.findFirst({
      where: { OR: [{ id: sellerId }, { userId: sellerId }] },
    });
    const candidateSellerIds = Array.from(new Set([sellerId, seller?.id, seller?.userId].filter(Boolean) as string[]));

    // DB Aggregations - Product Count filtered by Product Created Date / productDate
    const productWhere: any = {
      isArchived: false,
      sellerId: { in: candidateSellerIds },
    };
    if (startDate || endDate) {
      productWhere.OR = [
        {
          productDate: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        },
        {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        },
      ];
    }

    const productsCount = await db.product.count({
      where: productWhere,
    });

    // Fetch orders containing products from this seller filtered by Order Date
    const orderWhere: any = {
      payment: {
        status: "COMPLETED",
      },
    };
    if (startDate || endDate) {
      orderWhere.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const orderItems = await db.orderItem.findMany({
      where: {
        product: {
          sellerId: { in: candidateSellerIds },
        },
        order: orderWhere,
      },
      include: {
        order: {
          include: {
            cancellations: {
              where: { status: "APPROVED" },
              select: { id: true, refundAmount: true, snapshotItems: true },
            },
          },
        },
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    let activeRevenue = 0;
    let cancelledRevenue = 0;
    let grossRevenue = 0;
    const activeOrderIds = new Set<string>();
    const allOrderIds = new Set<string>();
    const productSales: Record<string, { name: string; count: number }> = {};
    const catMap: Record<string, number> = {};

    for (const item of orderItems) {
      const itemTotal = item.price * item.quantity;
      grossRevenue += itemTotal;
      allOrderIds.add(item.orderId);

      const approvedCancellation = item.order.cancellations?.[0];
      let isItemReturnedOrCancelled = false;
      let returnedQty = 0;

      if (item.order.status === "CANCELLED" || item.order.status === "REFUNDED" || item.order.status === "RETURNED") {
        isItemReturnedOrCancelled = true;
        returnedQty = item.quantity;
      } else if (approvedCancellation) {
        const snapshots = (approvedCancellation.snapshotItems as any[]) || [];
        if (snapshots.length === 0) {
          isItemReturnedOrCancelled = true;
          returnedQty = item.quantity;
        } else {
          const matchedSnap = snapshots.find((s: any) => s.productId === item.productId);
          if (matchedSnap) {
            returnedQty = Math.min(item.quantity, matchedSnap.quantity ?? item.quantity);
            if (returnedQty >= item.quantity) {
              isItemReturnedOrCancelled = true;
            }
          }
        }
      }

      const activeQty = Math.max(0, item.quantity - returnedQty);
      const activeItemRevenue = item.price * activeQty;
      const cancelledItemRevenue = item.price * returnedQty;

      activeRevenue += activeItemRevenue;
      cancelledRevenue += cancelledItemRevenue;

      if (activeQty > 0) {
        activeOrderIds.add(item.orderId);
      }

      // Track active product sales count
      if (!productSales[item.productId]) {
        productSales[item.productId] = { name: item.product.name, count: 0 };
      }
      productSales[item.productId].count += activeQty;

      // Track active category breakdown
      if (activeQty > 0) {
        const cat = item.product.category?.name || "Other";
        catMap[cat] = (catMap[cat] || 0) + activeQty;
      }
    }

    const revenue = Math.round(activeRevenue * 100) / 100;
    const ordersCount = activeOrderIds.size;
    const totalOrdersCount = allOrderIds.size;
    const cancelledOrdersCount = Math.max(0, totalOrdersCount - ordersCount);

    let mostSoldProduct = "None yet";
    let maxCount = 0;
    for (const key in productSales) {
      if (productSales[key].count > maxCount) {
        maxCount = productSales[key].count;
        mostSoldProduct = productSales[key].name;
      }
    }

    const salesConversion = ordersCount > 0 ? 3.4 : 0;
    const totalStoreVisits = ordersCount > 0 ? Math.round(ordersCount / (3.4 / 100)) : 0;
    const averageOrderValue = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;

    const totalItems = Object.values(catMap).reduce((a, b) => a + b, 0);
    const categoryBreakdown = Object.entries(catMap)
      .map(([name, count]) => ({ name, percentage: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0 }))
      .sort((a, b) => b.percentage - a.percentage);

    const environmentalImpact = {
      carbonOffset: Math.floor(revenue * 0.005),
      plasticAvoided: Math.floor(revenue * 0.001),
      ecoTreePoints: Math.floor(revenue * 0.0002),
    };

    const productSalesMap: Record<string, number> = {};
    for (const key in productSales) {
      productSalesMap[key] = Math.max(0, productSales[key].count);
    }

    return {
      revenue,
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      cancelledRevenue: Math.round(cancelledRevenue * 100) / 100,
      ordersCount,
      totalOrdersCount,
      cancelledOrdersCount,
      productsCount,
      rating: 4.8,
      mostSoldProduct,
      salesConversion,
      averageOrderValue,
      totalStoreVisits,
      environmentalImpact,
      categoryBreakdown,
      productSalesMap,
    };
  } catch (e) {
    return {
      revenue: 0,
      grossRevenue: 0,
      cancelledRevenue: 0,
      ordersCount: 0,
      totalOrdersCount: 0,
      cancelledOrdersCount: 0,
      productsCount: 0,
      rating: 0,
      mostSoldProduct: "N/A",
      salesConversion: 0,
      averageOrderValue: 0,
      totalStoreVisits: 0,
      environmentalImpact: {
        carbonOffset: 0,
        plasticAvoided: 0,
        ecoTreePoints: 0,
      },
      categoryBreakdown: [],
      productSalesMap: {},
    };
  }
}

// Internal mock helper for admin approvals
export async function getMockSellersInternal() {
  return mockSellers;
}

let mockSellerRemovalHistory: SellerRemovalRecord[] = [];

export async function getMockSellerRemovalHistory(userId: string, sellerId?: string): Promise<SellerRemovalRecord[]> {
  return mockSellerRemovalHistory.filter(
    (r) => r.userId === userId || r.sellerId === userId || (sellerId && (r.sellerId === sellerId || r.userId === sellerId))
  );
}

export async function removeMockSellerInternal(userIdOrSellerId: string, reason: string, adminEmail: string) {
  const seller = mockSellers.find((s) => s.userId === userIdOrSellerId || s.id === userIdOrSellerId);
  if (!seller) return;

  const record: SellerRemovalRecord = {
    sellerId: seller.id,
    userId: seller.userId,
    userEmail: seller.user?.email || "seller@earthcentric.com",
    userName: seller.userName || seller.companyName,
    companyName: seller.companyName,
    businessType: seller.businessType,
    description: seller.description,
    website: seller.website,
    gstNumber: seller.gstNumber,
    panNumber: seller.panNumber,
    declaredRevenue: seller.declaredRevenue,
    trustScore: seller.trustScore,
    badges: seller.badges || [],
    phone: seller.phone,
    ownerName: seller.ownerName,
    founderName: seller.founderName,
    verifiedAt: seller.verifiedAt,
    previousStatus: seller.verificationStatus,
    removedAt: new Date().toISOString(),
    removalReason: reason || "Seller removed by administration.",
    removedBy: adminEmail || "Super Admin",
    documents: (seller.documents || []).map((d) => ({
      type: d.type,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      uploadedAt: d.uploadedAt,
    })),
  };

  mockSellerRemovalHistory.unshift(record);

  seller.verificationStatus = "REJECTED";
  seller.rejectionReason = `[SELLER_REMOVED]: ${reason}`;
  seller.badges = [];
  seller.isRemoved = true;
  seller.hasPriorRemoval = true;
  seller.priorRemovalDate = record.removedAt;
  seller.priorRemovalReason = record.removalReason;
  seller.priorRemovalAdmin = record.removedBy;
  seller.removalHistory = [record];
}

export async function getSellerRemovalHistoryInternal(userId: string, sellerId?: string): Promise<SellerRemovalRecord[]> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (isMock) {
      return getMockSellerRemovalHistory(userId, sellerId);
    }

    const logs = await db.auditLog.findMany({
      where: {
        action: "REMOVE_SELLER",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const matching: SellerRemovalRecord[] = [];
    for (const log of logs) {
      if (!log.details) continue;
      try {
        const parsed = JSON.parse(log.details);
        if (
          parsed.userId === userId ||
          parsed.sellerId === userId ||
          (sellerId && (parsed.sellerId === sellerId || parsed.userId === sellerId))
        ) {
          matching.push(parsed);
        }
      } catch {}
    }

    return matching;
  } catch (e) {
    console.error("Error loading seller removal history internal:", e);
    return [];
  }
}

export async function updateMockSellerStatusInternal(userId: string, status: SellerProfile["verificationStatus"], badges: string[], reason?: string) {
  mockSellers = mockSellers.map((s) => {
    if (s.userId === userId) {
      return {
        ...s,
        verificationStatus: status,
        badges: status === "APPROVED" ? badges : [],
        rejectionReason: reason,
      };
    }
    return s;
  });
}

export async function getSellerAnalyticsTimeSeries(sellerId: string) {
  const dailyIncome = [];
  const dailyOrders = [];
  const monthlyIncome = [];
  const monthlyOrders = [];
  const yearlyIncome = [];
  const yearlyOrders = [];
  const now = new Date();

  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  if (isMock) {
    // Generate realistic mock data
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const base = isWeekend ? 5000 : 2500;
      const val = Math.floor(base + Math.random() * 3000);
      const ords = Math.floor(val / 800) + 1;
      dailyIncome.push({ name: dateStr, income: val });
      dailyOrders.push({ name: dateStr, orders: ords });
    }
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const val = Math.floor(75000 + Math.random() * 45000);
      const ords = Math.floor(val / 750) + 1;
      monthlyIncome.push({ name: dateStr, income: val });
      monthlyOrders.push({ name: dateStr, orders: ords });
    }
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - i);
      const dateStr = d.getFullYear().toString();
      const val = Math.floor(950000 + Math.random() * 400000);
      const ords = Math.floor(val / 750) + 1;
      yearlyIncome.push({ name: dateStr, income: val });
      yearlyOrders.push({ name: dateStr, orders: ords });
    }
    return {
      daily: { income: dailyIncome, orders: dailyOrders },
      monthly: { income: monthlyIncome, orders: monthlyOrders },
      yearly: { income: yearlyIncome, orders: yearlyOrders },
    };
  }

  let payments: any[] = [];
  let orders: any[] = [];

  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const seller = await db.seller.findFirst({
        where: { OR: [{ id: sellerId }, { userId: sellerId }] }
      });
      if (seller) {
        const candidateSellerIds = Array.from(new Set([seller.id, seller.userId, sellerId].filter(Boolean) as string[]));
        const orderItems = await db.orderItem.findMany({
          where: {
            product: { sellerId: { in: candidateSellerIds } },
            order: { payment: { status: "COMPLETED" } }
          },
          include: {
            order: {
              select: {
                id: true,
                status: true,
                createdAt: true,
                cancellations: {
                  where: { status: "APPROVED" },
                  select: { id: true, refundAmount: true, snapshotItems: true },
                },
              },
            },
          },
        });

        // Group active items by orderId so each order is only counted once for active orders
        const orderActiveMap = new Map<string, { createdAt: Date; activeAmount: number }>();

        orderItems.forEach((item: any) => {
          const approvedCancellation = item.order.cancellations?.[0];
          let returnedQty = 0;

          if (item.order.status === "CANCELLED" || item.order.status === "REFUNDED" || item.order.status === "RETURNED") {
            returnedQty = item.quantity;
          } else if (approvedCancellation) {
            const snapshots = (approvedCancellation.snapshotItems as any[]) || [];
            if (snapshots.length === 0) {
              returnedQty = item.quantity;
            } else {
              const matchedSnap = snapshots.find((s: any) => s.productId === item.productId);
              if (matchedSnap) {
                returnedQty = Math.min(item.quantity, matchedSnap.quantity ?? item.quantity);
              }
            }
          }

          const activeQty = Math.max(0, item.quantity - returnedQty);
          const activeAmount = item.price * activeQty;

          if (!orderActiveMap.has(item.orderId)) {
            orderActiveMap.set(item.orderId, {
              createdAt: item.order.createdAt,
              activeAmount: 0,
            });
          }
          const curr = orderActiveMap.get(item.orderId)!;
          curr.activeAmount += activeAmount;
        });

        orderActiveMap.forEach((entry) => {
          if (entry.activeAmount > 0) {
            orders.push({ createdAt: entry.createdAt });
            payments.push({ amount: entry.activeAmount, createdAt: entry.createdAt });
          }
        });
      }
    }
  } catch (e) {
    console.error("Error fetching seller analytics:", e);
  }

  // Helper to aggregate data
  const aggregate = (datePredicate: (d: Date) => boolean) => {
    let income = 0;
    let ordersCount = 0;
    payments.forEach(p => { if (datePredicate(new Date(p.createdAt))) income += p.amount; });
    orders.forEach(o => { if (datePredicate(new Date(o.createdAt))) ordersCount += 1; });
    return { income, orders: ordersCount };
  };

  // Daily (last 30 days)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const agg = aggregate(date => date.toDateString() === d.toDateString());
    dailyIncome.push({ name: dateStr, income: agg.income });
    dailyOrders.push({ name: dateStr, orders: agg.orders });
  }

  // Monthly (last 12 months)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const agg = aggregate(date => date.getMonth() === d.getMonth() && date.getFullYear() === d.getFullYear());
    monthlyIncome.push({ name: dateStr, income: agg.income });
    monthlyOrders.push({ name: dateStr, orders: agg.orders });
  }

  // Yearly (last 5 years)
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - i);
    const dateStr = d.getFullYear().toString();
    const agg = aggregate(date => date.getFullYear() === d.getFullYear());
    yearlyIncome.push({ name: dateStr, income: agg.income });
    yearlyOrders.push({ name: dateStr, orders: agg.orders });
  }

  return {
    daily: { income: dailyIncome, orders: dailyOrders },
    monthly: { income: monthlyIncome, orders: monthlyOrders },
    yearly: { income: yearlyIncome, orders: yearlyOrders },
  };
}

export async function updateSellerLogo(sellerId: string, base64Image: string): Promise<string> {
  const resultJson = await uploadImage(base64Image, "seller-profile");
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    const sellers = await getMockSellersInternal();
    const existing = sellers.find((s) => s.id === sellerId || s.userId === sellerId);
    if (existing) {
      existing.logoUrl = resultJson;
    }
    return resultJson;
  }
  
  try {
    const existingSeller = await db.seller.findUnique({
      where: { id: sellerId },
      select: { logoUrl: true }
    });
    
    if (existingSeller && existingSeller.logoUrl) {
      const oldPublicId = getPublicIdFromDb(existingSeller.logoUrl);
      if (oldPublicId) {
        await deleteImage(oldPublicId);
      }
    }
    
    await db.seller.update({
      where: { id: sellerId },
      data: { logoUrl: resultJson }
    });
  } catch (error) {
    console.error("Failed to update seller logo in DB:", error);
  }
  
  return resultJson;
}

export async function updateSellerBanner(sellerId: string, base64Image: string): Promise<string> {
  const resultJson = await uploadImage(base64Image, "seller-banner");
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    const sellers = await getMockSellersInternal();
    const existing = sellers.find((s) => s.id === sellerId || s.userId === sellerId);
    if (existing) {
      (existing as any).bannerUrl = resultJson;
    }
  }
  
  return resultJson;
}

export async function getVerifiedSellers() {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return mockSellers.filter(s => s.verificationStatus === "APPROVED" && !s.isRemoved);
    }

    const sellers = await db.seller.findMany({
      where: {
        verificationStatus: "APPROVED",
        user: { role: "SELLER" },
      },
      take: 8,
      include: {
        products: {
          take: 1,
        }
      }
    });

    return sellers.map((seller: any) => ({
      id: seller.id,
      userId: seller.userId,
      companyName: seller.companyName,
      description: seller.description || "",
      logoUrl: getUrlFromDb(seller.logoUrl) || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400",
      badges: seller.badges,
      sustainabilityScore: 90
    }));
  } catch (e) {
    console.error("Failed to fetch verified sellers", e);
    return [];
  }
}

export async function getAllBrands() {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const uniqueMap = new Map<string, { id: string; companyName: string }>();
      mockSellers.filter(s => s.verificationStatus === "APPROVED" && !s.isRemoved).forEach(s => {
        if (!uniqueMap.has(s.companyName)) {
          uniqueMap.set(s.companyName, { id: s.id, companyName: s.companyName });
        }
      });
      if (!uniqueMap.has("Earth Centric")) {
        uniqueMap.set("Earth Centric", { id: "seller-pkg", companyName: "Earth Centric" });
      }
      return Array.from(uniqueMap.values()).sort((a, b) => a.companyName.localeCompare(b.companyName));
    }

    const sellers = await db.seller.findMany({
      where: {
        verificationStatus: "APPROVED",
        user: { role: "SELLER" },
        products: {
          some: {
            isApproved: true,
            status: "APPROVED"
          }
        }
      },
      select: {
        id: true,
        companyName: true,
      },
      orderBy: {
        companyName: "asc",
      },
    });

    const uniqueMap = new Map<string, { id: string; companyName: string }>();
    sellers.forEach((s: any) => {
      if (s.companyName && !uniqueMap.has(s.companyName)) {
        uniqueMap.set(s.companyName, { id: s.id, companyName: s.companyName });
      }
    });

    if (uniqueMap.size === 0) {
      return [
        { id: "cmvcbbtm80001txgw8dd0r3lk", companyName: "AR ECO INDIA" }
      ];
    }

    return Array.from(uniqueMap.values()).sort((a, b) => a.companyName.localeCompare(b.companyName));
  } catch (e) {
    console.error("Failed to fetch all brands", e);
    return [
      { id: "cmvcbbtm80001txgw8dd0r3lk", companyName: "AR ECO INDIA" }
    ];
  }
}

export async function submit3StepSellerVerification(data: {
  userId: string;
  companyName: string;
  founderName: string;
  businessType: string;
  description: string;
  website?: string;
  phone?: string;
  gstNumber: string;
  panNumber: string;
  aadharNumber: string;
  logoUrl?: string;
  companyAddress?: string;
  factoryAddress?: string;
  pickupAddress?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  documents: {
    type: string;
    fileName: string;
    fileBase64?: string;
    fileUrl?: string;
    publicId?: string | null;
    format?: string | null;
    resourceType?: string | null;
    fileSize?: number | null;
  }[];
  product: {
    name: string;
    description: string;
    categoryName: string;
    price: number;
    wholesalePrice?: number;
    originalPrice?: number;
    stock: number;
    unit?: string;
    sustainabilityScore: number;
    sustainabilityDetail: string;
    materialUsed?: string;
    imageUrls: string[];
  };
}): Promise<SellerProfile> {
  // Server-side centralized validation across all 3 steps to prevent API bypass
  const gstDoc = data.documents.find((d) => d.type === "GST");
  const panDoc = data.documents.find((d) => d.type === "PAN");
  const aadharDoc = data.documents.find((d) => d.type === "AADHAR");

  const val = validateFullApplication({
    company: {
      companyName: data.companyName,
      founderName: data.founderName,
      businessType: data.businessType,
      phone: data.phone || "",
      description: data.description,
      companyAddress: data.companyAddress || "",
      website: data.website,
      factoryAddress: data.factoryAddress,
      pickupAddress: data.pickupAddress,
      logoUrl: data.logoUrl,
    },
    legal: {
      gstNumber: data.gstNumber,
      gstDoc: gstDoc?.fileUrl ? { name: gstDoc.fileName, url: gstDoc.fileUrl } : null,
      panNumber: data.panNumber,
      panDoc: panDoc?.fileUrl ? { name: panDoc.fileName, url: panDoc.fileUrl } : null,
      aadharNumber: data.aadharNumber,
      aadharDoc: aadharDoc?.fileUrl ? { name: aadharDoc.fileName, url: aadharDoc.fileUrl } : null,
      bankName: data.bankName,
      bankAccountNo: data.bankAccountNo,
      bankIfsc: data.bankIfsc,
    },
    product: {
      name: data.product.name,
      categoryName: data.product.categoryName,
      unit: data.product.unit || "Piece",
      price: data.product.price,
      wholesalePrice: data.product.wholesalePrice,
      originalPrice: data.product.originalPrice,
      stock: data.product.stock,
      description: data.product.description,
      materialUsed: data.product.materialUsed,
      imageUrls: data.product.imageUrls,
    },
  });

  if (!val.valid) {
    const allErrors = [
      ...Object.values(val.errors.company),
      ...Object.values(val.errors.legal),
      ...Object.values(val.errors.product),
    ];
    const firstError = allErrors[0] || "Incomplete seller application details.";
    throw new Error(`Validation Error: ${firstError}`);
  }

  if (!data.product.imageUrls || data.product.imageUrls.length < 5) {
    throw new Error("Validation Error: Step 3 requires at least 5 uploaded product images.");
  }

  const sellerProfile = await submitSellerVerification({
    userId: data.userId,
    companyName: data.companyName,
    businessType: data.businessType,
    description: data.description,
    website: data.website || "",
    gstNumber: data.gstNumber,
    panNumber: data.panNumber,
    phone: data.phone || "",
    ownerName: data.founderName,
    companyAddress: data.companyAddress,
    factoryAddress: data.factoryAddress,
    pickupAddress: data.pickupAddress,
    bankName: data.bankName,
    bankAccountNo: data.bankAccountNo,
    bankIfsc: data.bankIfsc,
    logoUrl: data.logoUrl,
    documents: data.documents as any,
  });

  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (isMock) {
      const existing = mockSellers.find((s) => s.userId === data.userId || s.id === sellerProfile.id);
      if (existing) {
        existing.founderName = data.founderName;
        existing.ownerName = data.founderName;
        existing.aadharNumber = data.aadharNumber;
        if (data.logoUrl) existing.logoUrl = data.logoUrl;
      }
    } else {
      await db.seller.update({
        where: { id: sellerProfile.id },
        data: {
          founderName: data.founderName,
          ownerName: data.founderName,
          aadharNumber: encrypt(data.aadharNumber) || data.aadharNumber,
          ...(data.logoUrl ? { logoUrl: data.logoUrl } : {}),
        },
      });
    }
  } catch (err) {
    console.error("Error updating extra seller fields in submit3StepSellerVerification:", err);
  }

  try {
    const prod = await createProduct({
      name: data.product.name,
      description: data.product.description + (data.product.materialUsed ? `\n\nMaterial: ${data.product.materialUsed}` : "") + (data.product.unit ? `\n\nUnit: ${data.product.unit}` : ""),
      price: Number(data.product.price),
      ...(data.product.wholesalePrice ? { wholesalePrice: Number(data.product.wholesalePrice) } : {}),
      ...(data.product.originalPrice ? { originalPrice: Number(data.product.originalPrice) } : {}),
      stock: Number(data.product.stock),
      categoryName: data.product.categoryName || "General",
      sustainabilityScore: Number(data.product.sustainabilityScore || 90),
      sustainabilityDetail: data.product.sustainabilityDetail || "Eco-friendly verified product",
      imageUrls: data.product.imageUrls,
      sellerId: sellerProfile.id,
      sellerName: data.companyName,
    });
    if (prod) {
      prod.isApproved = false;
      const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
      if (!isMock) {
        try {
          await db.product.update({ where: { id: prod.id }, data: { isApproved: false, status: "PENDING_APPROVAL" as any } });
        } catch {}
      }
    }
  } catch (prodErr) {
    console.error("Error creating initial product in submit3StepSellerVerification:", prodErr);
  }

  await createAdminNotification(
    "New 3-Step Seller Application 🚀",
    `Seller "${data.companyName}" submitted complete 3-step verification (Company, Documents, First Product).`,
    "sellers"
  );

  return {
    ...sellerProfile,
    founderName: data.founderName,
    ownerName: data.founderName,
    aadharNumber: data.aadharNumber,
  };
}

export interface SellerCustomer {
  id: string;
  name: string;
  email: string;
  phone: string; // Defaults to "Not Available" if missing
  countryCode?: string;
  profilePicture?: string;
  registrationDate: string;
  totalOrders: number;
  totalSpending: number;
  lastOrderDate: string;
  status: "ACTIVE" | "INACTIVE" | "VIP";
}

export async function getSellerCustomers(sellerId: string): Promise<SellerCustomer[]> {
  try {
    const orders = await getOrdersBySeller(sellerId);
    const customerMap = new Map<string, SellerCustomer>();

    orders.forEach((o) => {
      const email = o.user?.email?.trim().toLowerCase();
      if (!o.userId || !email || !o.user?.emailVerified) return;

      const key = o.userId;
      const existing = customerMap.get(key);

      const phoneNum = o.user?.phone && o.user.phone.trim() ? o.user.phone : "Not Available";
      const orderDateStr = new Date(o.createdAt).toISOString().split("T")[0];

      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpending += o.totalAmount;
        if (phoneNum !== "Not Available" && existing.phone === "Not Available") {
          existing.phone = phoneNum;
        }
        if (new Date(o.createdAt) > new Date(existing.lastOrderDate)) {
          existing.lastOrderDate = orderDateStr;
        }
        if (new Date(o.createdAt) < new Date(existing.registrationDate)) {
          existing.registrationDate = orderDateStr;
        }
        if (existing.totalSpending >= 5000 || existing.totalOrders >= 3) {
          existing.status = "VIP";
        }
      } else {
        const customer: SellerCustomer = {
          id: o.userId,
          name: o.user?.name || "Customer",
          email,
          phone: phoneNum,
          countryCode: "+91",
          ...(o.user.image ? { profilePicture: o.user.image } : {}),
          registrationDate: orderDateStr,
          totalOrders: 1,
          totalSpending: o.totalAmount,
          lastOrderDate: orderDateStr,
          status: o.totalAmount >= 5000 ? "VIP" : "ACTIVE",
        };
        customerMap.set(key, customer);
      }
    });

    return Array.from(customerMap.values());
  } catch (e) {
    console.error("getSellerCustomers error:", e);
    return [];
  }
}
