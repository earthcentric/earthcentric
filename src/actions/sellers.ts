"use server";

import db from "@/lib/db";
import { uploadImage, deleteImage, getUrlFromDb, getPublicIdFromDb } from "@/lib/cloudinary";
import { createAdminNotification } from "@/actions/notifications";
import { createProduct } from "./products";
import { cookies } from "next/headers";

export interface SellerProfile {
  id: string;
  userId: string;
  userName?: string;
  user?: { name: string | null; email: string };
  companyName: string;
  businessType: string;
  description?: string;
  logoUrl?: string;
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
    founderName: "Rohan Mehta",
    aadharNumber: "9876 5432 1098",
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
        user: true,
      },
    });

    if (!seller) return null;

    return {
      id: seller.id,
      userId: seller.userId,
      userName: seller.user?.name || undefined,
      user: seller.user ? { name: seller.user.name, email: seller.user.email } : undefined,
      companyName: seller.companyName,
      businessType: seller.businessType,
      description: seller.description || undefined,
      logoUrl: getUrlFromDb(seller.logoUrl) || undefined,
      website: seller.website || undefined,
      gstNumber: seller.gstNumber || undefined,
      panNumber: seller.panNumber || undefined,
      declaredRevenue: seller.declaredRevenue || undefined,
      verificationStatus: seller.verificationStatus as any,
      badges: seller.badges,
      rejectionReason: seller.rejectionReason || undefined,
      trustScore: seller.trustScore,
      phone: seller.phone || undefined,
      ownerName: seller.user?.name || seller.ownerName || undefined,
      founderName: seller.user?.name || seller.founderName || undefined,
      aadharNumber: seller.aadharNumber || undefined,
      factoryAddress: seller.factoryAddress || undefined,
      pickupAddress: seller.pickupAddress || undefined,
      companyAddress: seller.companyAddress || undefined,
      bankAccountNo: seller.bankAccountNo || undefined,
      bankName: seller.bankName || undefined,
      bankIfsc: seller.bankIfsc || undefined,
      bankProofUrl: getUrlFromDb(seller.bankProofUrl) || undefined,
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
      include: { documents: true, user: true },
    });

    if (!seller) return null;

    return {
      id: seller.id,
      userId: seller.userId,
      userName: seller.user?.name || undefined,
      user: seller.user ? { name: seller.user.name, email: seller.user.email } : undefined,
      companyName: seller.companyName,
      businessType: seller.businessType,
      description: seller.description || undefined,
      logoUrl: getUrlFromDb(seller.logoUrl) || undefined,
      website: seller.website || undefined,
      gstNumber: seller.gstNumber || undefined,
      panNumber: seller.panNumber || undefined,
      declaredRevenue: seller.declaredRevenue || undefined,
      verificationStatus: seller.verificationStatus as any,
      badges: seller.badges,
      rejectionReason: seller.rejectionReason || undefined,
      trustScore: seller.trustScore,
      phone: seller.phone || undefined,
      ownerName: seller.user?.name || seller.ownerName || undefined,
      founderName: seller.user?.name || seller.founderName || undefined,
      aadharNumber: seller.aadharNumber || undefined,
      factoryAddress: seller.factoryAddress || undefined,
      pickupAddress: seller.pickupAddress || undefined,
      companyAddress: seller.companyAddress || undefined,
      bankAccountNo: seller.bankAccountNo || undefined,
      bankName: seller.bankName || undefined,
      bankIfsc: seller.bankIfsc || undefined,
      bankProofUrl: getUrlFromDb(seller.bankProofUrl) || undefined,
      documents: seller.documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.fileName,
        fileUrl: getUrlFromDb(doc.fileUrl),
      })),
    };
  } catch (e) {
    return mockSellers.find((s) => s.userId === id) || null;
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

  // Set the session cookie to update the user's role to SELLER and status to PENDING
  try {
    const cookieStore = await cookies();
    cookieStore.set('earthcentric_session', JSON.stringify({
      id: data.userId,
      role: 'SELLER',
      sellerStatus: 'PENDING'
    }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });
  } catch (cookieErr) {
    console.warn("Failed to set session cookie inside submitSellerVerification:", cookieErr);
  }

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
        website: data.website,
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
        declaredRevenue: data.declaredRevenue,
        verificationStatus: "PENDING",
        phone: data.phone,
        ownerName: data.ownerName,
        founderName: (data as any).founderName || data.ownerName,
        aadharNumber: (data as any).aadharNumber,
        factoryAddress: data.factoryAddress,
        pickupAddress: data.pickupAddress,
        companyAddress: data.companyAddress,
        bankAccountNo: data.bankAccountNo,
        bankName: data.bankName,
        bankIfsc: data.bankIfsc,
        bankProofUrl: bankProofDoc?.fileUrl,
        documents: {
          create: uploadedDocs.map((d) => ({
            type: d.type as any,
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
        declaredRevenue: data.declaredRevenue,
        verificationStatus: "PENDING",
        phone: data.phone,
        ownerName: data.ownerName,
        founderName: (data as any).founderName || data.ownerName,
        aadharNumber: (data as any).aadharNumber,
        factoryAddress: data.factoryAddress,
        pickupAddress: data.pickupAddress,
        companyAddress: data.companyAddress,
        bankAccountNo: data.bankAccountNo,
        bankName: data.bankName,
        bankIfsc: data.bankIfsc,
        bankProofUrl: bankProofDoc?.fileUrl || null,
        documents: {
          deleteMany: {}, // Clear old documents
          create: uploadedDocs.map((d) => ({
            type: d.type as any,
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

    await createAdminNotification(
      "New Seller Verification",
      `Seller "${data.companyName}" submitted their verification documents for review.`,
      "sellers"
    );

    return {
      id: seller.id,
      userId: seller.userId,
      companyName: seller.companyName,
      businessType: seller.businessType,
      description: seller.description || undefined,
      declaredRevenue: seller.declaredRevenue || undefined,
      verificationStatus: seller.verificationStatus as any,
      badges: seller.badges,
      trustScore: seller.trustScore,
      phone: seller.phone || undefined,
      ownerName: seller.ownerName || undefined,
      founderName: seller.founderName || undefined,
      aadharNumber: seller.aadharNumber || undefined,
      factoryAddress: seller.factoryAddress || undefined,
      pickupAddress: seller.pickupAddress || undefined,
      companyAddress: seller.companyAddress || undefined,
      bankAccountNo: seller.bankAccountNo || undefined,
      bankName: seller.bankName || undefined,
      bankIfsc: seller.bankIfsc || undefined,
      bankProofUrl: getUrlFromDb(seller.bankProofUrl) || undefined,
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
        totalStoreVisits: 1118, // 38 / 0.034 = 1118
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
    const totalStoreVisits = ordersCount > 0 ? Math.round(ordersCount / (salesConversion / 100)) : 150;
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
      revenue: 0,
      ordersCount: 0,
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
        const orderItems = await db.orderItem.findMany({
          where: { product: { sellerId: seller.id }, order: { payment: { status: "COMPLETED" } } },
          include: { order: { select: { createdAt: true } } }
        });
        
        const uniqueOrders = new Set<string>();
        orderItems.forEach(item => {
          if (!uniqueOrders.has(item.orderId)) {
            uniqueOrders.add(item.orderId);
            orders.push({ createdAt: item.order.createdAt });
          }
          payments.push({ amount: item.price * item.quantity, createdAt: item.order.createdAt });
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

export async function getAllBrands() {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const uniqueMap = new Map<string, { id: string; companyName: string }>();
      mockSellers.forEach(s => {
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
      select: {
        id: true,
        companyName: true,
      },
      orderBy: {
        companyName: "asc",
      },
    });

    const uniqueMap = new Map<string, { id: string; companyName: string }>();
    sellers.forEach(s => {
      if (s.companyName && !uniqueMap.has(s.companyName)) {
        uniqueMap.set(s.companyName, { id: s.id, companyName: s.companyName });
      }
    });

    if (uniqueMap.size === 0) {
      return [
        { id: "seller-pkg", companyName: "Earth Centric" },
        { id: "seller-1-profile", companyName: "EcoThreads Apparel" },
        { id: "seller-2-profile", companyName: "BioKnit Textiles" },
        { id: "seller-3-profile", companyName: "Forest Craft Co." }
      ].sort((a, b) => a.companyName.localeCompare(b.companyName));
    }

    return Array.from(uniqueMap.values()).sort((a, b) => a.companyName.localeCompare(b.companyName));
  } catch (e) {
    console.error("Failed to fetch all brands", e);
    return [
      { id: "seller-pkg", companyName: "Earth Centric" },
      { id: "seller-1-profile", companyName: "EcoThreads Apparel" },
      { id: "seller-2-profile", companyName: "BioKnit Textiles" },
      { id: "seller-3-profile", companyName: "Forest Craft Co." }
    ].sort((a, b) => a.companyName.localeCompare(b.companyName));
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
  documents: {
    type: string;
    fileName: string;
    fileBase64: string;
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
          aadharNumber: data.aadharNumber,
          ...(data.logoUrl ? { logoUrl: data.logoUrl } : {})
        }
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
      wholesalePrice: data.product.wholesalePrice ? Number(data.product.wholesalePrice) : undefined,
      originalPrice: data.product.originalPrice ? Number(data.product.originalPrice) : undefined,
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

