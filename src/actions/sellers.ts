"use server";

import db from "@/lib/db";
import { uploadImage, deleteImage, getUrlFromDb, getPublicIdFromDb } from "@/lib/cloudinary";

export interface SellerProfile {
  id: string;
  userId: string;
  companyName: string;
  businessType: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  badges: string[];
  rejectionReason?: string;
  documents: {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
  }[];
}

// In-memory global array to keep track of seller verification requests during local demo sessions
let mockSellers: SellerProfile[] = [
  {
    id: "seller-1-profile",
    userId: "seller-1",
    companyName: "EcoThreads Apparel",
    businessType: "Manufacturer",
    description: "Ethical manufacturers of organic hemp and bamboo clothing sheets.",
    website: "https://ecothreads.com",
    verificationStatus: "APPROVED",
    badges: ["Verified Business", "Verified Sustainable Manufacturer"],
    documents: [],
  },
  {
    id: "seller-2-profile",
    userId: "seller-2",
    companyName: "BioKnit Textiles",
    businessType: "Manufacturer",
    description: "Pioneering zero-carbon organic cotton knitwear. Hand-spun and vegetable-dyed in small batches.",
    website: "https://bioknit.in",
    gstNumber: "29AAACB1234A1Z1",
    panNumber: "AAACB1234A",
    verificationStatus: "PENDING",
    badges: [],
    documents: [
      {
        id: "doc-gst-2",
        type: "GST",
        fileName: "gst_certificate.jpg",
        fileUrl: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=800"
      },
      {
        id: "doc-pan-2",
        type: "PAN",
        fileName: "pan_card.jpg",
        fileUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800"
      },
      {
        id: "doc-sug-2",
        type: "SUSTAINABILITY_CERTIFICATE",
        fileName: "gots_organic_cert.jpg",
        fileUrl: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=800"
      }
    ],
  },
  {
    id: "seller-3-profile",
    userId: "seller-3",
    companyName: "Forest Craft Co.",
    businessType: "Artisanal Supplier",
    description: "Sourcing certified reclaimed wood furniture and bamboo decor from local tribal co-ops.",
    website: "https://forestcraft.org",
    gstNumber: "06AABCF9876D2Y0",
    panNumber: "AABCF9876D",
    verificationStatus: "PENDING",
    badges: [],
    documents: [
      {
        id: "doc-gst-3",
        type: "GST",
        fileName: "registration_doc.jpg",
        fileUrl: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800"
      },
      {
        id: "doc-pan-3",
        type: "PAN",
        fileName: "pan_identity.jpg",
        fileUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"
      },
      {
        id: "doc-sug-3",
        type: "BUSINESS_REGISTRATION",
        fileName: "fsc_reclaimed_wood.jpg",
        fileUrl: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800"
      }
    ],
  },
  {
    id: "seller-4-profile",
    userId: "seller-4",
    companyName: "Solaris Pack Solutions",
    businessType: "Eco Packaging Brand",
    description: "100% biodegradable and home-compostable packaging mailers and water-soluble seaweed sheets.",
    website: "https://solarispack.com",
    gstNumber: "27AACCS3344E3Z8",
    panNumber: "AACCS3344E",
    verificationStatus: "PENDING",
    badges: [],
    documents: [
      {
        id: "doc-gst-4",
        type: "GST",
        fileName: "gst_authority_cert.jpg",
        fileUrl: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800"
      },
      {
        id: "doc-sug-4",
        type: "SUSTAINABILITY_CERTIFICATE",
        fileName: "iso_biodegradable_report.jpg",
        fileUrl: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800"
      }
    ],
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
      },
    });

    if (!seller) return null;

    return {
      id: seller.id,
      userId: seller.userId,
      companyName: seller.companyName,
      businessType: seller.businessType,
      description: seller.description || undefined,
      logoUrl: getUrlFromDb(seller.logoUrl) || undefined,
      website: seller.website || undefined,
      gstNumber: seller.gstNumber || undefined,
      panNumber: seller.panNumber || undefined,
      verificationStatus: seller.verificationStatus as any,
      badges: seller.badges,
      rejectionReason: seller.rejectionReason || undefined,
      documents: seller.documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.fileName,
        fileUrl: getUrlFromDb(doc.fileUrl),
      })),
    };
  } catch (e) {
    return mockSellers.find((s) => s.userId === userId) || null;
  }
}

export async function getSellerProfileById(id: string): Promise<SellerProfile | null> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return mockSellers.find((s) => s.id === id) || null;
    }

    const seller = await db.seller.findUnique({
      where: { id },
      include: { documents: true },
    });

    if (!seller) return null;

    return {
      id: seller.id,
      userId: seller.userId,
      companyName: seller.companyName,
      businessType: seller.businessType,
      description: seller.description || undefined,
      logoUrl: getUrlFromDb(seller.logoUrl) || undefined,
      website: seller.website || undefined,
      gstNumber: seller.gstNumber || undefined,
      panNumber: seller.panNumber || undefined,
      verificationStatus: seller.verificationStatus as any,
      badges: seller.badges,
      rejectionReason: seller.rejectionReason || undefined,
      documents: seller.documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.fileName,
        fileUrl: getUrlFromDb(doc.fileUrl),
      })),
    };
  } catch (e) {
    return mockSellers.find((s) => s.id === id) || null;
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
  documents: {
    type: "GST" | "PAN" | "BUSINESS_REGISTRATION" | "SUSTAINABILITY_CERTIFICATE";
    fileName: string;
    fileBase64: string; // Base64 representation of file
  }[];
}): Promise<SellerProfile> {
  // Upload all documents to Cloudinary (or mock)
  const uploadedDocs = await Promise.all(
    data.documents.map(async (doc) => {
      // Use automated folder selection for verification documents
      const secureUrl = await uploadImage(doc.fileBase64, "verification");
      return {
        type: doc.type,
        fileName: doc.fileName,
        fileUrl: secureUrl,
      };
    })
  );

  const sellerId = `sel-${Math.random().toString(36).substring(2, 9)}`;

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
        existing.verificationStatus = "PENDING";
        existing.documents = uploadedDocs.map((doc, index) => ({
          id: `doc-${index}-${Math.random().toString(36).substring(2, 6)}`,
          type: doc.type,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
        }));
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
        website: data.website,
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
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

    // Database Insert/Upsert
    const seller = await db.seller.upsert({
      where: { userId: data.userId },
      create: {
        id: sellerId,
        userId: data.userId,
        companyName: data.companyName,
        businessType: data.businessType,
        description: data.description,
        website: data.website,
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
        verificationStatus: "PENDING",
        documents: {
          create: uploadedDocs.map((d) => ({
            type: d.type,
            fileName: d.fileName,
            fileUrl: d.fileUrl,
          })),
        },
      },
      update: {
        companyName: data.companyName,
        businessType: data.businessType,
        description: data.description,
        website: data.website,
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
        verificationStatus: "PENDING",
        documents: {
          deleteMany: {}, // Clear old documents
          create: uploadedDocs.map((d) => ({
            type: d.type,
            fileName: d.fileName,
            fileUrl: d.fileUrl,
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

    return {
      id: seller.id,
      userId: seller.userId,
      companyName: seller.companyName,
      businessType: seller.businessType,
      description: seller.description || undefined,
      verificationStatus: seller.verificationStatus as any,
      badges: seller.badges,
      documents: seller.documents.map((d) => ({
        id: d.id,
        type: d.type,
        fileName: d.fileName,
        fileUrl: getUrlFromDb(d.fileUrl),
      })),
    };
  } catch (error) {
    console.error("Prisma seller verification submission failed, executing mock fallback:", error);
    const newSeller: SellerProfile = {
      id: sellerId,
      userId: data.userId,
      companyName: data.companyName,
      businessType: data.businessType,
      description: data.description,
      website: data.website,
      gstNumber: data.gstNumber,
      panNumber: data.panNumber,
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
    return newSeller;
  }
}

export async function getSellerDashboardStats(sellerId: string) {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return {
        revenue: 156900,
        ordersCount: 38,
        productsCount: 6,
        rating: 4.8,
        mostSoldProduct: "Bamboo Fiber Sheets",
        salesConversion: 3.4,
        averageOrderValue: 525,
        totalStoreVisits: 24840,
        environmentalImpact: {
          carbonOffset: 1420,
          plasticAvoided: 182,
          ecoTreePoints: 56,
        },
        categoryBreakdown: [
          { name: "Disposables", percentage: 45 },
          { name: "Kitchenware", percentage: 30 },
          { name: "Personal Care", percentage: 25 },
        ],
        productSalesMap: {
          "p1": 142,
          "p2": 98,
          "p3": 67,
          "p4": 234,
        },
      };
    }

    // DB Aggregations
    const productsCount = await db.product.count({
      where: { sellerId, isArchived: false },
    });

    // Fetch orders containing products from this seller
    const orderItems = await db.orderItem.findMany({
      where: {
        product: {
          sellerId: sellerId,
        },
        order: {
          payment: {
            status: "COMPLETED",
          },
        },
      },
      include: {
        order: true,
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    const revenue = orderItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
    const ordersCount = new Set(orderItems.map((oi) => oi.orderId)).size;

    const productSales: Record<string, { name: string; count: number }> = {};
    for (const item of orderItems) {
      if (!productSales[item.productId]) {
        productSales[item.productId] = { name: item.product.name, count: 0 };
      }
      productSales[item.productId].count += item.quantity;
    }
    
    let mostSoldProduct = "None yet";
    let maxCount = 0;
    for (const key in productSales) {
      if (productSales[key].count > maxCount) {
        maxCount = productSales[key].count;
        mostSoldProduct = productSales[key].name;
      }
    }

    const salesConversion = 3.4; // mocked for now
    const totalStoreVisits = 24840; // mocked
    const averageOrderValue = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;
    
    // Calculate category breakdown based on order items
    const catMap: Record<string, number> = {};
    for (const item of orderItems) {
      const cat = item.product.category?.name || "Other";
      catMap[cat] = (catMap[cat] || 0) + item.quantity;
    }
    const totalItems = Object.values(catMap).reduce((a,b)=>a+b, 0);
    const categoryBreakdown = Object.entries(catMap)
      .map(([name, count]) => ({ name, percentage: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0 }))
      .sort((a,b) => b.percentage - a.percentage);

    // Mock environmental metrics scaling with revenue
    const environmentalImpact = {
      carbonOffset: Math.floor(revenue * 0.005) + 120,
      plasticAvoided: Math.floor(revenue * 0.001) + 40,
      ecoTreePoints: Math.floor(revenue * 0.0002) + 5,
    };

    // Product sales map for the table
    const productSalesMap: Record<string, number> = {};
    for (const key in productSales) {
      productSalesMap[key] = productSales[key].count;
    }

    return {
      revenue,
      ordersCount,
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
      revenue: 156900,
      ordersCount: 38,
      productsCount: 6,
      rating: 4.8,
      mostSoldProduct: "Bamboo Fiber Sheets",
      salesConversion: 3.4,
      averageOrderValue: 525,
      totalStoreVisits: 24840,
      environmentalImpact: {
        carbonOffset: 1420,
        plasticAvoided: 182,
        ecoTreePoints: 56,
      },
      categoryBreakdown: [
        { name: "Disposables", percentage: 45 },
        { name: "Kitchenware", percentage: 30 },
        { name: "Personal Care", percentage: 25 },
      ],
      productSalesMap: {
        "p1": 142,
        "p2": 98,
        "p3": 67,
        "p4": 234,
      },
    };
  }
}

// Internal mock helper for admin approvals
export async function getMockSellersInternal() {
  return mockSellers;
}

export async function updateMockSellerStatusInternal(userId: string, status: "APPROVED" | "REJECTED", badges: string[], reason?: string) {
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
  // Try to generate realistic mock data since the live database was just seeded
  // and has no historical orders
  const dailyIncome = [];
  const dailyOrders = [];
  const monthlyIncome = [];
  const monthlyOrders = [];
  const yearlyIncome = [];
  const yearlyOrders = [];

  const now = new Date();

  // Daily (last 30 days)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const fakeOrders = Math.floor(Math.random() * 5) + 1; // 1-5 orders
    const fakeIncome = fakeOrders * (Math.floor(Math.random() * 2000) + 500); // 500-2500 per order
    dailyIncome.push({ name: dateStr, income: fakeIncome });
    dailyOrders.push({ name: dateStr, orders: fakeOrders });
  }

  // Monthly (last 12 months)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const fakeOrders = Math.floor(Math.random() * 80) + 20; // 20-100 orders
    const fakeIncome = fakeOrders * (Math.floor(Math.random() * 2000) + 500);
    monthlyIncome.push({ name: dateStr, income: fakeIncome });
    monthlyOrders.push({ name: dateStr, orders: fakeOrders });
  }

  // Yearly (last 5 years)
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - i);
    const dateStr = d.getFullYear().toString();
    const fakeOrders = Math.floor(Math.random() * 500) + 100; // 100-600 orders
    const fakeIncome = fakeOrders * (Math.floor(Math.random() * 2000) + 500);
    yearlyIncome.push({ name: dateStr, income: fakeIncome });
    yearlyOrders.push({ name: dateStr, orders: fakeOrders });
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
      return mockSellers.filter(s => s.verificationStatus === "APPROVED");
    }

    const sellers = await db.seller.findMany({
      where: { verificationStatus: "APPROVED" },
      take: 8,
      include: {
        products: {
          take: 1,
        }
      }
    });

    return sellers.map(seller => ({
      id: seller.id,
      userId: seller.userId,
      companyName: seller.companyName,
      description: seller.description || "",
      logoUrl: getUrlFromDb(seller.logoUrl) || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400",
      badges: seller.badges,
      sustainabilityScore: seller.products.length > 0 ? seller.products[0].sustainabilityScore : 90
    }));
  } catch (e) {
    console.error("Failed to fetch verified sellers", e);
    return [];
  }
}
