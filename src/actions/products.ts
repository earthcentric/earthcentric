"use server";

import db from "@/lib/db";
import { uploadImage, deleteImage, getUrlFromDb, getPublicIdFromDb } from "@/lib/cloudinary";
import { createAdminNotification } from "@/actions/notifications";

export interface ProductFilter {
  category?: string;
  minSustainabilityScore?: number;
  verifiedOnly?: boolean;
  minRating?: number;
  priceRange?: [number, number];
  search?: string;
  sortBy?: "newest" | "popular" | "rating" | "price-asc" | "price-desc";
  sellerId?: string;
  dealsOnly?: boolean;
  newArrivalsOnly?: boolean;
  filterType?: "overall" | "daily" | "monthly" | "yearly";
  selectedDate?: string;
  selectedMonth?: string;
  selectedYear?: string;
}

export interface SellerInfo {
  id: string;
  companyName: string;
  badges: string[];
  logoUrl?: string;
  companyLogo?: string;
  trustScore?: number;
}

export interface TierDiscount {
  minQuantity: number;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
}

export interface IndividualDiscount {
  id?: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  startDate?: string | null;
  endDate?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string | Date;
}

export interface BuyXGetYOffer {
  enabled: boolean;
  buyQuantity: number;
  getQuantity: number;
  maxFreeQuantity?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  sustainabilityScore?: number;
  sustainabilityDetail?: string;
  images: string[];
  category: string;
  categoryId: string;
  isApproved: boolean;
  sellerId: string;
  seller: SellerInfo;
  certifications: string[];
  rating: number;
  reviewsCount: number;
  badgeType?: "verified" | "bestseller" | "eco";
  moq?: number;
  wholesalePrice?: number;
  originalPrice?: number;
  bulkPriceSlabs?: any;
  tierDiscounts?: TierDiscount[] | null;
  individualDiscount?: IndividualDiscount | null;
  buyXGetYOffer?: BuyXGetYOffer | null;
  productDate?: Date | string;
  createdAt?: Date;
}

// Global mock items for fallback mode
const MOCK_PRODUCTS: ProductItem[] = [
  {
    id: "pkg1",
    name: "Plant-Starch Spoon Pack of 50",
    slug: "plant-starch-spoon-pack-50",
    description: "Stronger than plastic, compostable. Heat resistant up to 104°C. Perfect for hot and cold foods.",
    price: 199,
    originalPrice: 299,
    stock: 500,
    sustainabilityScore: 98,
    sustainabilityDetail: "Made from 100% plant-starch materials, GMO-free corn. Fully compostable in commercial facilities.",
    images: ["https://images.unsplash.com/photo-1591871937573-74dbba515c4c?w=600&auto=format&fit=crop&q=80"],
    category: "Cutlery",
    categoryId: "c_cutlery",
    isApproved: true,
    sellerId: "seller-pkg",
    bulkPriceSlabs: [
      { min: 1, price: 199 },
      { min: 10, price: 179 },
      { min: 50, price: 149 }
    ],
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business", "Premium Verified Seller"],
    },
    certifications: ["BPI Certified", "USDA Biobased"],
    rating: 4.8,
    reviewsCount: 212,
    badgeType: "verified",
    createdAt: new Date(),
  },
  {
    id: "pkg2",
    name: "2-Compartment Bagasse Meal Tray",
    slug: "2-compartment-bagasse-meal-tray",
    description: "Sturdy, leak-proof sugarcane pulp tray. Microwave & freezer safe. Oil and water resistant.",
    price: 249,
    stock: 350,
    sustainabilityScore: 97,
    sustainabilityDetail: "Made from natural sugarcane bagasse. 100% biodegradable and compostable. No plastic or wax lining.",
    images: ["https://images.unsplash.com/photo-1543083503-4c902cff990d?w=600&auto=format&fit=crop&q=80"],
    category: "Bagasse Trays",
    categoryId: "c_bagasse",
    isApproved: true,
    sellerId: "seller-pkg",
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business", "Premium Verified Seller"],
    },
    certifications: ["FSC Certified", "FDA Approved"],
    rating: 4.8,
    reviewsCount: 210,
    badgeType: "verified",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "pkg3",
    name: "Medium Bagasse Clamshell (Pack of 25)",
    slug: "medium-bagasse-clamshell-25",
    description: "Microwave safe, 100% compostable food container. Lock-tab closure design prevents accidental spills.",
    price: 269,
    stock: 400,
    sustainabilityScore: 97,
    sustainabilityDetail: "Renewable agricultural byproduct (sugarcane). Breaks down in 90 days in compost heap.",
    images: ["https://images.unsplash.com/photo-1599839575945-a9e5af0c3fa5?w=600&auto=format&fit=crop&q=80"],
    category: "Clamshells",
    categoryId: "c_clamshell",
    isApproved: true,
    sellerId: "seller-pkg",
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business", "Premium Verified Seller"],
    },
    certifications: ["BPI Certified", "OK Compost"],
    rating: 4.8,
    reviewsCount: 198,
    badgeType: "verified",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
  {
    id: "pkg4",
    name: "Paper Hand Towels Dispenser Pack",
    slug: "paper-hand-towels-dispenser-pack",
    description: "Ideal for washrooms and kitchens. Soft, absorbent, and multi-fold paper sheets. Fits standard dispensers.",
    price: 299,
    stock: 600,
    sustainabilityScore: 91,
    sustainabilityDetail: "Made from 100% recycled paper fiber. Chlorine-free process, zero bleaching agents.",
    images: ["https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80"],
    category: "Disposable",
    categoryId: "c_disposable",
    isApproved: true,
    sellerId: "seller-pkg",
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business"],
    },
    certifications: ["FSC Recycled", "EcoLogo Certified"],
    rating: 4.6,
    reviewsCount: 156,
    badgeType: "eco"
  },
  {
    id: "pkg5",
    name: "Eco Wooden Fork Pack of 50",
    slug: "eco-wooden-fork-pack-50",
    description: "Smooth finish, heat resistant forks. Heavy-weight grade birchwood. 100% natural, chemical-free.",
    price: 179,
    stock: 300,
    sustainabilityScore: 97,
    sustainabilityDetail: "Harvested from sustainably managed birch forests. Certified organic coating, compostable.",
    images: ["https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&auto=format&fit=crop&q=80"],
    category: "Cutlery",
    categoryId: "c_cutlery",
    isApproved: true,
    sellerId: "seller-pkg",
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business"],
    },
    certifications: ["FSC Certified", "USDA Biobased"],
    rating: 4.7,
    reviewsCount: 145,
    badgeType: "eco"
  },
  {
    id: "pkg6",
    name: "Bagasse Delivery Container - Small (Pack of 50)",
    slug: "bagasse-delivery-container-small-50",
    description: "Ideal for snacks and sides. High heat-retention properties. Breathable bagasse prevents food from getting soggy.",
    price: 399,
    stock: 250,
    sustainabilityScore: 96,
    sustainabilityDetail: "Zero emissions manufacturing. Derived from plant bagasse waste, fully biodegradable.",
    images: ["https://images.unsplash.com/photo-1599839575945-a9e5af0c3fa5?w=600&auto=format&fit=crop&q=80"],
    category: "Delivery Containers",
    categoryId: "c_delivery",
    isApproved: true,
    sellerId: "seller-pkg",
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business"],
    },
    certifications: ["BPI Certified", "OK Compost"],
    rating: 4.7,
    reviewsCount: 143,
    badgeType: "eco"
  },
  {
    id: "pkg7",
    name: "Biodegradable Bagasse Plates (Pack of 50)",
    slug: "biodegradable-bagasse-plates-50",
    description: "Super sturdy plates for hot & cold foods. Cut-resistant construction.",
    price: 349,
    stock: 280,
    sustainabilityScore: 98,
    sustainabilityDetail: "Premium bagasse sugar pulp. Toxic-free chemical treatment.",
    images: ["https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600&auto=format&fit=crop&q=80"],
    category: "Tableware",
    categoryId: "c_tableware",
    isApproved: true,
    sellerId: "seller-pkg",
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business", "Premium Verified Seller"],
    },
    certifications: ["BPI Certified", "FSC Certified"],
    rating: 4.9,
    reviewsCount: 112,
    badgeType: "verified"
  },
  {
    id: "pkg8",
    name: "Recycled Kraft Paper Bags (Pack of 100)",
    slug: "recycled-kraft-paper-bags-100",
    description: "Heavy-duty grocery and shopping bags with handles. Strong base support.",
    price: 499,
    stock: 150,
    sustainabilityScore: 95,
    sustainabilityDetail: "100% recycled wood pulp. Zero plastic materials.",
    images: ["https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80"],
    category: "Paper Products",
    categoryId: "c_paper",
    isApproved: true,
    sellerId: "seller-pkg",
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business"],
    },
    certifications: ["FSC Recycled", "PEFC Certified"],
    rating: 4.8,
    reviewsCount: 88,
    badgeType: "bestseller"
  },
  {
    id: "pkg9",
    name: "Eco-Friendly Bamboo Garbage Bags",
    slug: "eco-friendly-bamboo-garbage-bags",
    description: "Compostable, heavy-duty trash bags. Extremely tear-resistant.",
    price: 189,
    stock: 220,
    sustainabilityScore: 92,
    sustainabilityDetail: "Crafted from natural bamboo fibers, certified compostable.",
    images: ["https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&auto=format&fit=crop&q=80"],
    category: "Housekeeping",
    categoryId: "c_housekeeping",
    isApproved: true,
    sellerId: "seller-pkg",
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business"],
    },
    certifications: ["USDA Biobased", "OK Compost Home"],
    rating: 4.6,
    reviewsCount: 75,
    badgeType: "eco"
  },
  {
    id: "pkg10",
    name: "PLA Compostable Cups (Pack of 100)",
    slug: "pla-compostable-cups-100",
    description: "Cold cups made from corn starch PLA. High clarity and rigidity.",
    price: 299,
    stock: 180,
    sustainabilityScore: 96,
    sustainabilityDetail: "Starch-derived PLA polymer. Leaves zero toxic residues upon composting.",
    images: ["https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80"],
    category: "Disposable",
    categoryId: "c_disposable",
    isApproved: true,
    sellerId: "seller-pkg",
    seller: {
      id: "seller-pkg",
      companyName: "Earth Centric",
      badges: ["Verified Business", "Premium Verified Seller"],
    },
    certifications: ["BPI Certified", "EN 13432 Compliant"],
    rating: 4.7,
    reviewsCount: 104,
    badgeType: "verified"
  },
  {
    id: "p1",
    name: "Organic Cotton Classic Tee",
    slug: "organic-cotton-classic-tee",
    description: "Crafted from 100% GOTS-certified organic cotton, this t-shirt is dyed with non-toxic, eco-friendly pigments. Spun ethically in small batches by verified weavers. Zero microplastics, breathable, and designed for circular recycling.",
    price: 1899,
    originalPrice: 2699,
    stock: 45,
    sustainabilityScore: 95,
    sustainabilityDetail: "Saves 2,000 liters of water compared to conventional cotton. GOTS certified organic, fair-trade manufacturing, colored using natural vegetable dyes.",
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80"
    ],
    category: "Organic Apparel",
    categoryId: "c1",
    isApproved: true,
    sellerId: "seller-1",
    seller: {
      id: "seller-1",
      companyName: "EcoThreads Apparel",
      badges: ["Verified Business", "Verified Sustainable Manufacturer"],
      logoUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=100&auto=format&fit=crop&q=80"
    },
    certifications: ["GOTS Organic", "FairTrade Certified"],
    rating: 4.8,
    reviewsCount: 34
  },
  {
    id: "p2",
    name: "Zero-Waste Bamboo Cutlery Set",
    slug: "zero-waste-bamboo-cutlery",
    description: "An elegant, reusable cutlery kit for dining on the go. Made of premium sustainably harvested Moso bamboo. Includes a fork, knife, spoon, bamboo straw, and cleaning brush, nested inside a washable organic canvas wrap.",
    price: 699,
    stock: 120,
    sustainabilityScore: 90,
    sustainabilityDetail: "100% biodegradable bamboo. Pesticide-free farming. Eliminates single-use plastic waste from food takeout.",
    images: [
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&auto=format&fit=crop&q=80"
    ],
    category: "Zero-Waste Living",
    categoryId: "c2",
    isApproved: true,
    sellerId: "seller-1",
    seller: {
      id: "seller-1",
      companyName: "EcoThreads Apparel",
      badges: ["Verified Business", "Verified Sustainable Manufacturer"],
      logoUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=100&auto=format&fit=crop&q=80"
    },
    certifications: ["FSC Certified", "USDA Biobased"],
    rating: 4.6,
    reviewsCount: 18
  },
  {
    id: "p3",
    name: "Solar Powered Portable Charger",
    slug: "solar-portable-charger",
    description: "High-efficiency monocrystalline solar panels capture ambient sunlight to charge your smart devices on-the-go. Built with an outer chassis made from recycled sea plastic and shockproof upcycled rubber.",
    price: 3499,
    stock: 30,
    sustainabilityScore: 85,
    sustainabilityDetail: "Encourages renewable energy usage. Frame is crafted entirely from Ocean Bound Plastic. Certified RoHS compliant battery cells.",
    images: [
      "https://images.unsplash.com/photo-1620286127226-a36113702e51?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&auto=format&fit=crop&q=80"
    ],
    category: "Renewable Energy",
    categoryId: "c3",
    isApproved: true,
    sellerId: "seller-2",
    seller: {
      id: "seller-2",
      companyName: "SolTerra Systems",
      badges: ["Verified Business", "Premium Verified Seller"],
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80"
    },
    certifications: ["B-Corp Certified", "RoHS Compliant"],
    rating: 4.4,
    reviewsCount: 22
  },
  {
    id: "p4",
    name: "Minimalist Hemp Backpack",
    slug: "minimalist-hemp-backpack",
    description: "Super-durable daily pack constructed from pure natural hemp fibers and organic cotton canvas backing. Features an interior sleeve for a 15-inch laptop and multi-functional organization pockets. Natural water-resistant qualities.",
    price: 4999,
    stock: 15,
    sustainabilityScore: 92,
    sustainabilityDetail: "Hemp cultivation regenerates soil health through bioremediation and requires 50% less land than cotton. Biodegradable construction.",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1622560480654-d96214fdc887?w=800&auto=format&fit=crop&q=80"
    ],
    category: "Organic Apparel",
    categoryId: "c1",
    isApproved: true,
    sellerId: "seller-1",
    seller: {
      id: "seller-1",
      companyName: "EcoThreads Apparel",
      badges: ["Verified Business", "Verified Sustainable Manufacturer"],
    },
    certifications: ["GOTS Certified", "OEKO-TEX Standard"],
    rating: 4.9,
    reviewsCount: 15
  },
  {
    id: "p5",
    name: "Upcycled Glass Water Bottle",
    slug: "upcycled-glass-bottle",
    description: "Stylish, robust drinking vessel molded from 100% post-consumer recycled glass jars. Protected by a premium non-slip sleeve made from cork oak bark. Leak-proof natural wood cap with food-grade silicone seal.",
    price: 1299,
    stock: 50,
    sustainabilityScore: 88,
    sustainabilityDetail: "100% recycled glass composition reduces carbon output of raw manufacturing. Natural oak cork bark sleeve is renewable and biodegradable.",
    images: [
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80"
    ],
    category: "Zero-Waste Living",
    categoryId: "c2",
    isApproved: true,
    sellerId: "seller-2",
    seller: {
      id: "seller-2",
      companyName: "SolTerra Systems",
      badges: ["Verified Business", "Premium Verified Seller"],
    },
    certifications: ["Forest Stewardship Council (FSC)"],
    rating: 4.5,
    reviewsCount: 9
  },
  {
    id: "p6",
    name: "Solid Oak Recycled Cutting Board",
    slug: "solid-oak-cutting-board",
    description: "Premium kitchen cutting blocks crafted from upcycled oak wood offcuts collected from architectural build sites. Conditioned with high-grade organic cold-pressed flaxseed oil. Extremely knife-friendly, durable, and naturally antibacterial.",
    price: 2799,
    stock: 8,
    sustainabilityScore: 82,
    sustainabilityDetail: "Saves wood waste from landfills. Sanded and treated completely by hand without any chemical stains, binders, or synthetic adhesives.",
    images: [
      "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=800&auto=format&fit=crop&q=80"
    ],
    category: "Eco Home Goods",
    categoryId: "c4",
    isApproved: true,
    sellerId: "seller-1",
    seller: {
      id: "seller-1",
      companyName: "EcoThreads Apparel",
      badges: ["Verified Business", "Verified Sustainable Manufacturer"],
    },
    certifications: ["FSC Upcycled Wood"],
    rating: 4.7,
    reviewsCount: 29
  },
  {
    id: "p7",
    name: "Organic Herbal Solid Shampoo Bar",
    slug: "organic-herbal-solid-shampoo-bar",
    description: "Sulfate-free, plastic-free organic shampoo bar. Gently cleanses and moisturizes with natural herbal extracts and pure essential oils.",
    price: 120,
    originalPrice: 150,
    stock: 120,
    sustainabilityScore: 98,
    sustainabilityDetail: "100% biodegradable ingredients, completely zero-waste cardboard packaging. No synthetic preservatives or chemical surfactants.",
    images: [
      "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=800&auto=format&fit=crop&q=80"
    ],
    category: "Zero-Waste Living",
    categoryId: "c2",
    isApproved: true,
    sellerId: "seller-2",
    seller: {
      id: "seller-2",
      companyName: "SolTerra Systems",
      badges: ["Verified Business", "Premium Verified Seller"],
    },
    certifications: ["Cruelty-Free Certified", "USDA Organic Ingredients"],
    rating: 4.9,
    reviewsCount: 42,
    bulkPriceSlabs: [
      { min: 1, price: 120, total: 120 },
      { min: 2, price: 100, total: 200 }
    ]
  }
];

// In-memory array to simulate newly added products during the demo session
let dynamicProducts: ProductItem[] = [];

export async function getDynamicProducts(): Promise<ProductItem[]> {
  return dynamicProducts;
}

export async function approveDynamicProduct(productId: string): Promise<void> {
  const prod = dynamicProducts.find((p) => p.id === productId);
  if (prod) {
    prod.isApproved = true;
  }
}

export async function rejectDynamicProduct(productId: string): Promise<void> {
  const prod = dynamicProducts.find((p) => p.id === productId);
  if (prod) {
    prod.isApproved = false;
  }
}

export async function approveAllSellerProductsBySellerId(sellerId: string): Promise<void> {
  dynamicProducts.forEach((p) => {
    if (p.sellerId === sellerId || p.seller?.id === sellerId) {
      p.isApproved = true;
    }
  });
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      await db.product.updateMany({
        where: {
          OR: [
            { sellerId: sellerId },
            { seller: { userId: sellerId } }
          ],
          isApproved: false,
        },
        data: {
          isApproved: true,
          status: "APPROVED" as any,
        }
      });
    }
  } catch (err) {
    console.error("approveAllSellerProductsBySellerId DB error:", err);
  }
}

export async function getSellerInitialProduct(sellerId: string): Promise<ProductItem | null> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const p = dynamicProducts.find(p => p.sellerId === sellerId || p.seller?.id === sellerId);
      return p || null;
    }
    const dbProd = await db.product.findFirst({
      where: {
        OR: [
          { sellerId: sellerId },
          { seller: { userId: sellerId } }
        ]
      },
      include: {
        images: true,
        category: true,
        seller: true,
      },
      orderBy: { createdAt: "desc" }
    });
    if (!dbProd) {
      const p = dynamicProducts.find(p => p.sellerId === sellerId || p.seller?.id === sellerId);
      return p || null;
    }
    return {
      id: dbProd.id,
      name: dbProd.name,
      slug: dbProd.slug,
      description: dbProd.description,
      price: dbProd.price,
      ...(dbProd.wholesalePrice ? { wholesalePrice: dbProd.wholesalePrice } : {}),
      ...(dbProd.originalPrice ? { originalPrice: dbProd.originalPrice } : {}),
      stock: dbProd.stock,
      sustainabilityScore: 85,
      sustainabilityDetail: "",
      images: dbProd.images.map(img => getUrlFromDb(img.url)),
      category: dbProd.category?.name || "General",
      categoryId: dbProd.categoryId,
      isApproved: dbProd.isApproved,
      sellerId: dbProd.sellerId,
      seller: {
        id: dbProd.seller.id,
        companyName: dbProd.seller.companyName,
        badges: dbProd.seller.badges,
        ...(getUrlFromDb(dbProd.seller.logoUrl) ? { logoUrl: getUrlFromDb(dbProd.seller.logoUrl) } : {}),
        ...(getUrlFromDb(dbProd.seller.logoUrl) ? { companyLogo: getUrlFromDb(dbProd.seller.logoUrl) } : {}),
      },
      certifications: [],
      rating: 5.0,
      reviewsCount: 0,
    };
  } catch (e) {
    console.error("getSellerInitialProduct error:", e);
    const p = dynamicProducts.find(p => p.sellerId === sellerId || p.seller?.id === sellerId);
    return p || null;
  }
}

export async function getProducts(filters: ProductFilter = {}): Promise<ProductItem[]> {
  try {
    // Check database connection. If DATABASE_URL is not set or is 'mock', trigger fallback
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return getMockProductsFiltered(filters);
    }

    // Prisma DB Query
    const whereClause: any = {
      isArchived: false,
    };

    // Public marketplace requests only show approved items.
    // Seller dashboards bypass this to display pending/unapproved items too.
    if (!filters.sellerId) {
      whereClause.isApproved = true;
    }

    // Use AND array to compose filters safely (avoids OR clause conflicts)
    const andConditions: any[] = [];

    if (filters.sellerId) {
      andConditions.push({
        OR: [
          { sellerId: filters.sellerId },
          { seller: { userId: filters.sellerId } }
        ]
      });
    }

    if (filters.category) {
      whereClause.category = {
        slug: filters.category,
      };
    }

    if (filters.minSustainabilityScore) {
      whereClause.sustainabilityScore = {
        gte: filters.minSustainabilityScore,
      };
    }

    if (filters.verifiedOnly) {
      whereClause.seller = {
        verificationStatus: "APPROVED",
      };
    }

    if (filters.search) {
      andConditions.push({
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
        ]
      });
    }

    if (filters.priceRange) {
      whereClause.price = {
        gte: filters.priceRange[0],
        lte: filters.priceRange[1],
      };
    }

    if (filters.dealsOnly) {
      andConditions.push({
        OR: [
          { originalPrice: { not: null } },
          { NOT: { bulkPriceSlabs: null } }
        ]
      });
    }

    if (filters.newArrivalsOnly) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      whereClause.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (filters.filterType && filters.filterType !== "overall") {
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      if (filters.filterType === "daily" && filters.selectedDate) {
        startDate = new Date(filters.selectedDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(filters.selectedDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (filters.filterType === "monthly" && filters.selectedMonth) {
        const [y, m] = filters.selectedMonth.split("-").map(Number);
        startDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
        endDate = new Date(y, m, 0, 23, 59, 59, 999);
      } else if (filters.filterType === "yearly" && filters.selectedYear) {
        const y = Number(filters.selectedYear);
        startDate = new Date(y, 0, 1, 0, 0, 0, 0);
        endDate = new Date(y, 11, 31, 23, 59, 59, 999);
      }

      if (startDate || endDate) {
        andConditions.push({
          OR: [
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
          ],
        });
      }
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    // Sorting options mapping
    let orderBy: any = { createdAt: "desc" };
    if (filters.sortBy === "price-asc") orderBy = { price: "asc" };
    if (filters.sortBy === "price-desc") orderBy = { price: "desc" };
    if (filters.sortBy === "rating") orderBy = { reviews: { _count: "desc" } }; // Simplified sorting

    const dbProducts = await db.product.findMany({
      where: whereClause,
      include: {
        category: true,
        images: true,
        seller: true,
        reviews: true,
      },
      orderBy,
    });

    // Map Prisma models to unified ProductItem output
    return dbProducts.map((p) => {
      const rating =
        p.reviews.length > 0
          ? p.reviews.reduce((acc, curr) => acc + curr.rating, 0) / p.reviews.length
          : 4.5; // fallback default
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        stock: p.stock,
        sustainabilityScore: 85,
        sustainabilityDetail: "",
        images: p.images.map((img) => getUrlFromDb(img.url)),
        category: p.category.name,
        categoryId: p.categoryId,
        isApproved: p.isApproved,
        sellerId: p.sellerId,
        seller: {
          id: p.seller.id,
          companyName: p.seller.companyName,
          badges: p.seller.badges,
          ...(getUrlFromDb(p.seller.logoUrl) ? { logoUrl: getUrlFromDb(p.seller.logoUrl) } : {}),
          ...(getUrlFromDb(p.seller.logoUrl) ? { companyLogo: getUrlFromDb(p.seller.logoUrl) } : {}),
        },
        certifications: [], // dynamically loaded
        rating,
        reviewsCount: p.reviews.length,
        ...(p.originalPrice ? { originalPrice: p.originalPrice } : {}),
        bulkPriceSlabs: p.bulkPriceSlabs,
        tierDiscounts: (p as any).tierDiscounts || null,
        individualDiscount: (p as any).individualDiscount || null,
        buyXGetYOffer: (p as any).buyXGetYOffer || null,
        productDate: (p as any).productDate ? new Date((p as any).productDate).toISOString().split("T")[0] : p.createdAt.toISOString().split("T")[0],
        createdAt: p.createdAt,
      };
    });
  } catch (error) {
    console.warn("Database getProducts failed, falling back to mock:", error);
    return getMockProductsFiltered(filters);
  }
}

export async function getProductById(id: string): Promise<ProductItem | null> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const dyn = dynamicProducts.find((p) => p.id === id);
      if (dyn) return dyn;
      const mock = MOCK_PRODUCTS.find((p) => p.id === id);
      if (mock) return mock;
      return null;
    }

    const p = await db.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: true,
        seller: true,
        reviews: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!p) return null;

    const rating =
      p.reviews.length > 0
        ? p.reviews.reduce((acc, curr) => acc + curr.rating, 0) / p.reviews.length
        : 4.5;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      stock: p.stock,
      sustainabilityScore: 85,
      sustainabilityDetail: "",
      images: p.images.map((img) => getUrlFromDb(img.url)),
      category: p.category.name,
      categoryId: p.categoryId,
      isApproved: p.isApproved,
      sellerId: p.sellerId,
      seller: {
        id: p.seller.id,
        companyName: p.seller.companyName,
        badges: p.seller.badges,
        ...(getUrlFromDb(p.seller.logoUrl) ? { logoUrl: getUrlFromDb(p.seller.logoUrl) } : {}),
        ...(getUrlFromDb(p.seller.logoUrl) ? { companyLogo: getUrlFromDb(p.seller.logoUrl) } : {}),
      },
      certifications: [],
      rating,
      reviewsCount: p.reviews.length,
      ...(p.moq ? { moq: p.moq } : {}),
      ...(p.wholesalePrice ? { wholesalePrice: p.wholesalePrice } : {}),
      ...(p.originalPrice ? { originalPrice: p.originalPrice } : {}),
      bulkPriceSlabs: p.bulkPriceSlabs,
      tierDiscounts: (p as any).tierDiscounts || null,
      individualDiscount: (p as any).individualDiscount || null,
      buyXGetYOffer: (p as any).buyXGetYOffer || null,
      productDate: (p as any).productDate ? new Date((p as any).productDate).toISOString().split("T")[0] : p.createdAt.toISOString().split("T")[0],
      createdAt: p.createdAt,
    };
  } catch (error) {
    console.warn("Database getProductById failed, using mock:", error);
    return [...MOCK_PRODUCTS, ...dynamicProducts].find((p) => p.id === id) || null;
  }
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  stock: number;
  productDate?: string | Date;
  categoryName: string;
  sustainabilityScore?: number;
  sustainabilityDetail?: string;
  imageUrls: string[];
  sellerId: string;
  sellerName: string;
  moq?: number;
  wholesalePrice?: number;
  originalPrice?: number;
  bulkPriceSlabs?: any;
  tierDiscounts?: TierDiscount[] | null;
  individualDiscount?: IndividualDiscount | null;
  buyXGetYOffer?: BuyXGetYOffer | null;
}): Promise<ProductItem> {
  try {
    // Process/upload all product images to Cloudinary (will return JSON strings)
    const uploadedImages = await Promise.all(
      data.imageUrls.map(async (url) => {
        const secureUrl = await uploadImage(url, "product");
        return { url: secureUrl };
      })
    );

    const productDateVal = data.productDate ? new Date(data.productDate) : new Date();

    const isMockDb = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (isMockDb) {
      const isSellerApproved = data.sellerId === "seller-1" || data.sellerId === "seller-pkg" || data.sellerId.includes("seller");
      const newProduct: ProductItem = {
        id: `prod-${Math.floor(Math.random() * 10000)}`,
        name: data.name,
        slug: `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.floor(Math.random() * 1000)}`,
        description: data.description,
        price: Number(data.price),
        stock: Number(data.stock),
        productDate: productDateVal.toISOString().split("T")[0],
        sustainabilityScore: Number(data.sustainabilityScore),
        sustainabilityDetail: data.sustainabilityDetail,
        images: uploadedImages.map(img => getUrlFromDb(img.url)),
        category: data.categoryName,
        categoryId: `c_${data.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        isApproved: isSellerApproved,
        sellerId: data.sellerId,
        seller: {
          id: data.sellerId,
          companyName: data.sellerName || "Seller",
          badges: ["Verified Business"],
        },
        certifications: ["EarthCentric Verified"],
        rating: 5.0,
        reviewsCount: 0,
        moq: data.moq ? Number(data.moq) : 1,
        ...(data.wholesalePrice ? { wholesalePrice: Number(data.wholesalePrice) } : {}),
        ...(data.originalPrice ? { originalPrice: Number(data.originalPrice) } : {}),
        bulkPriceSlabs: data.bulkPriceSlabs || null,
        tierDiscounts: data.tierDiscounts || null,
        individualDiscount: data.individualDiscount || null,
        buyXGetYOffer: data.buyXGetYOffer || null,
        createdAt: new Date(),
      };
      
      dynamicProducts.push(newProduct);
      return newProduct;
    }

    // Find seller by either sellerId or userId to prevent FK mismatches
    let seller = await db.seller.findUnique({ where: { id: data.sellerId } });
    if (!seller) {
      seller = await db.seller.findUnique({ where: { userId: data.sellerId } });
    }
    if (!seller) {
      throw new Error(`Seller profile not found for ID or User ID: ${data.sellerId}`);
    }
    const resolvedSellerId = seller.id;
    const autoApprove = seller.verificationStatus === "APPROVED";

    // Handle Category look-up/creation
    let category = await db.category.findUnique({ where: { name: data.categoryName } });
    if (!category) {
      category = await db.category.create({
        data: {
          name: data.categoryName,
          slug: data.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        },
      });
    }

    const p = (await db.product.create({
      data: {
        name: data.name,
        slug: `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.floor(Math.random() * 1000)}`,
        description: data.description,
        price: Number(data.price),
        stock: Number(data.stock),
        productDate: productDateVal,
        sustainabilityScore: Number(data.sustainabilityScore),
        sustainabilityDetail: data.sustainabilityDetail,
        categoryId: category.id,
        sellerId: resolvedSellerId,
        isApproved: autoApprove,
        ...(data.tierDiscounts ? { tierDiscounts: (data.tierDiscounts as any) } : {}),
        ...(data.individualDiscount ? { individualDiscount: (data.individualDiscount as any) } : {}),
        ...(data.buyXGetYOffer ? { buyXGetYOffer: (data.buyXGetYOffer as any) } : {}),
        moq: data.moq ? Number(data.moq) : 1,
        wholesalePrice: data.wholesalePrice ? Number(data.wholesalePrice) : null,
        originalPrice: data.originalPrice ? Number(data.originalPrice) : null,
        bulkPriceSlabs: data.bulkPriceSlabs || null,
        images: {
          create: uploadedImages,
        },
      } as any,
      include: {
        category: true,
        images: true,
        seller: true,
      },
    })) as any;

    if (!autoApprove) {
      await createAdminNotification(
        "Product Approval Required",
        `Seller "${p.seller.companyName}" added a new product "${p.name}" which requires approval.`,
        "products"
      );
    }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      stock: p.stock,
      sustainabilityScore: 85,
      sustainabilityDetail: "",
      images: p.images.map((img: any) => getUrlFromDb(img.url)),
      category: p.category.name,
      categoryId: p.categoryId,
      isApproved: p.isApproved,
      sellerId: p.sellerId,
      seller: {
        id: p.seller.id,
        companyName: p.seller.companyName,
        badges: p.seller.badges,
        ...(getUrlFromDb(p.seller.logoUrl) ? { logoUrl: getUrlFromDb(p.seller.logoUrl) } : {}),
        ...(getUrlFromDb(p.seller.logoUrl) ? { companyLogo: getUrlFromDb(p.seller.logoUrl) } : {}),
      },
      certifications: ["EarthCentric Verified"],
      rating: 5.0,
      reviewsCount: 0,
      ...(p.moq ? { moq: p.moq } : {}),
      ...(p.wholesalePrice ? { wholesalePrice: p.wholesalePrice } : {}),
      ...(p.originalPrice ? { originalPrice: p.originalPrice } : {}),
      bulkPriceSlabs: p.bulkPriceSlabs,
      tierDiscounts: (p as any).tierDiscounts || null,
      individualDiscount: (p as any).individualDiscount || null,
      buyXGetYOffer: (p as any).buyXGetYOffer || null,
      productDate: p.productDate ? new Date(p.productDate).toISOString().split("T")[0] : p.createdAt.toISOString().split("T")[0],
    };
  } catch (error) {
    console.error("Failed to create product in DB:", error);
    throw new Error("Failed to create product. Ensure your database is correctly configured.");
  }
}

export async function updateProduct(
  id: string,
  data: {
    name: string;
    description: string;
    price: number;
    stock: number;
    productDate?: string | Date;
    categoryName: string;
    sustainabilityScore?: number;
    sustainabilityDetail?: string;
    moq?: number;
    wholesalePrice?: number;
    originalPrice?: number;
    bulkPriceSlabs?: any;
    tierDiscounts?: TierDiscount[] | null;
    individualDiscount?: IndividualDiscount | null;
    buyXGetYOffer?: BuyXGetYOffer | null;
  }
): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      dynamicProducts = dynamicProducts.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            name: data.name,
            slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            description: data.description,
            price: Number(data.price),
            stock: Number(data.stock),
            ...(data.productDate ? { productDate: typeof data.productDate === 'string' ? data.productDate : new Date(data.productDate).toISOString().split("T")[0] } : {}),
            category: data.categoryName,
            sustainabilityScore: Number(data.sustainabilityScore),
            sustainabilityDetail: data.sustainabilityDetail,
            ...(data.originalPrice ? { originalPrice: Number(data.originalPrice) } : {}),
            bulkPriceSlabs: data.bulkPriceSlabs || null,
            tierDiscounts: data.tierDiscounts !== undefined ? data.tierDiscounts : null,
            individualDiscount: data.individualDiscount !== undefined ? data.individualDiscount : null,
            buyXGetYOffer: data.buyXGetYOffer !== undefined ? data.buyXGetYOffer : null,
          };
        }
        return p;
      });
      const idx = MOCK_PRODUCTS.findIndex((p) => p.id === id);
      if (idx !== -1) {
        MOCK_PRODUCTS[idx] = {
          ...MOCK_PRODUCTS[idx],
          name: data.name,
          slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          description: data.description,
          price: Number(data.price),
          stock: Number(data.stock),
          category: data.categoryName,
          sustainabilityScore: Number(data.sustainabilityScore),
          sustainabilityDetail: data.sustainabilityDetail,
          ...(data.originalPrice ? { originalPrice: Number(data.originalPrice) } : {}),
          bulkPriceSlabs: data.bulkPriceSlabs || null,
          tierDiscounts: data.tierDiscounts !== undefined ? data.tierDiscounts : null,
          individualDiscount: data.individualDiscount !== undefined ? data.individualDiscount : null,
          buyXGetYOffer: data.buyXGetYOffer !== undefined ? data.buyXGetYOffer : null,
        };
      }
      return true;
    }

    // Database Update
    let category = await db.category.findUnique({ where: { name: data.categoryName } });
    if (!category) {
      category = await db.category.create({
        data: {
          name: data.categoryName,
          slug: data.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        },
      });
    }

    await db.product.update({
      where: { id },
      data: {
        name: data.name,
        slug: `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.floor(Math.random() * 1000)}`,
        description: data.description,
        price: Number(data.price),
        stock: Number(data.stock),
        ...(data.productDate ? { productDate: new Date(data.productDate) } : {}),
        sustainabilityScore: Number(data.sustainabilityScore),
        sustainabilityDetail: data.sustainabilityDetail,
        categoryId: category.id,
        isApproved: false,
        moq: data.moq ? Number(data.moq) : 1,
        wholesalePrice: data.wholesalePrice ? Number(data.wholesalePrice) : null,
        originalPrice: data.originalPrice ? Number(data.originalPrice) : null,
        bulkPriceSlabs: data.bulkPriceSlabs || null,
        tierDiscounts: data.tierDiscounts !== undefined ? (data.tierDiscounts as any) : null,
        individualDiscount: data.individualDiscount !== undefined ? (data.individualDiscount as any) : null,
        buyXGetYOffer: data.buyXGetYOffer !== undefined ? (data.buyXGetYOffer as any) : null,
      } as any,
    });

    return true;
  } catch (error) {
    console.error("Failed to update product in DB, updating mock:", error);
    // Fall back to memory update
    dynamicProducts = dynamicProducts.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          name: data.name,
          slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          description: data.description,
          price: Number(data.price),
          stock: Number(data.stock),
          category: data.categoryName,
          sustainabilityScore: Number(data.sustainabilityScore),
          sustainabilityDetail: data.sustainabilityDetail,
          ...(data.originalPrice ? { originalPrice: Number(data.originalPrice) } : {}),
          bulkPriceSlabs: data.bulkPriceSlabs || null,
          tierDiscounts: data.tierDiscounts !== undefined ? data.tierDiscounts : null,
          individualDiscount: data.individualDiscount !== undefined ? data.individualDiscount : null,
          buyXGetYOffer: data.buyXGetYOffer !== undefined ? data.buyXGetYOffer : null,
        };
      }
      return p;
    });
    const idx = MOCK_PRODUCTS.findIndex((p) => p.id === id);
    if (idx !== -1) {
      MOCK_PRODUCTS[idx] = {
        ...MOCK_PRODUCTS[idx],
        name: data.name,
        slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: data.description,
        price: Number(data.price),
        stock: Number(data.stock),
        category: data.categoryName,
        sustainabilityScore: Number(data.sustainabilityScore),
        sustainabilityDetail: data.sustainabilityDetail,
        ...(data.originalPrice ? { originalPrice: Number(data.originalPrice) } : {}),
        bulkPriceSlabs: data.bulkPriceSlabs || null,
        tierDiscounts: data.tierDiscounts !== undefined ? data.tierDiscounts : null,
        individualDiscount: data.individualDiscount !== undefined ? data.individualDiscount : null,
        buyXGetYOffer: data.buyXGetYOffer !== undefined ? data.buyXGetYOffer : null,
      };
    }
    return true;
  }
}

export async function archiveProduct(id: string): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      dynamicProducts = dynamicProducts.filter((p) => p.id !== id);
      return true;
    }

    // Delete product images from Cloudinary before archiving
    try {
      const product = await db.product.findUnique({
        where: { id },
        include: { images: true }
      });
      if (product) {
        for (const img of product.images) {
          const publicId = getPublicIdFromDb(img.url);
          if (publicId) {
            await deleteImage(publicId);
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete product images from Cloudinary during archiving:", err);
    }

    await db.product.update({
      where: { id },
      data: { isArchived: true },
    });
    return true;
  } catch (e) {
    console.error("Archive product failed, removing mock:", e);
    dynamicProducts = dynamicProducts.filter((p) => p.id !== id);
    return true;
  }
}

export async function updateProductStock(id: string, newStock: number): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      dynamicProducts = dynamicProducts.map((p) => {
        if (p.id === id) return { ...p, stock: newStock };
        return p;
      });
      const idx = MOCK_PRODUCTS.findIndex((p) => p.id === id);
      if (idx !== -1) {
        MOCK_PRODUCTS[idx].stock = newStock;
      }
      return true;
    }

    await db.product.update({
      where: { id },
      data: { stock: newStock },
    });
    return true;
  } catch (e) {
    console.error("updateProductStock failed, fallback to mock:", e);
    dynamicProducts = dynamicProducts.map((p) => {
      if (p.id === id) return { ...p, stock: newStock };
      return p;
    });
    const idx = MOCK_PRODUCTS.findIndex((p) => p.id === id);
    if (idx !== -1) {
      MOCK_PRODUCTS[idx].stock = newStock;
    }
    return true;
  }
}

function getMockProductsFiltered(filters: ProductFilter): ProductItem[] {
  const map = new Map<string, ProductItem>();
  MOCK_PRODUCTS.forEach((p) => map.set(p.id, p));
  dynamicProducts.forEach((p) => map.set(p.id, p));
  let list = Array.from(map.values());

  if (filters.sellerId) {
    list = list.filter((p) => p.sellerId === filters.sellerId || p.seller.id === filters.sellerId);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }

  if (filters.category && filters.category !== "all") {
    const catSlug = filters.category.toLowerCase();
    list = list.filter((p) => p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-") === catSlug);
  }

  if (filters.minSustainabilityScore) {
    list = list.filter((p) => (p.sustainabilityScore || 0) >= (filters.minSustainabilityScore || 0));
  }

  if (filters.verifiedOnly) {
    list = list.filter((p) => p.seller.badges.includes("Verified Business") || p.seller.badges.includes("Verified Sustainable Manufacturer"));
  }

  if (filters.priceRange) {
    list = list.filter((p) => p.price >= filters.priceRange![0] && p.price <= filters.priceRange![1]);
  }

  if (filters.dealsOnly) {
    list = list.filter((p) => (p.originalPrice && p.originalPrice > p.price) || (p.bulkPriceSlabs && p.bulkPriceSlabs.length > 0));
  }

  if (filters.newArrivalsOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    list = list.filter((p) => {
      const pDate = p.createdAt ? new Date(p.createdAt) : new Date();
      pDate.setHours(0, 0, 0, 0);
      return pDate.getTime() === today.getTime();
    });
  }

  if (filters.sortBy) {
    if (filters.sortBy === "price-asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (filters.sortBy === "price-desc") {
      list.sort((a, b) => b.price - a.price);
    } else if (filters.sortBy === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (filters.sortBy === "popular") {
      list.sort((a, b) => b.reviewsCount - a.reviewsCount);
    }
  }

  return list.map(p => ({
    ...p,
    seller: {
      ...p.seller,
      ...(p.seller.logoUrl ? { companyLogo: p.seller.logoUrl } : {}),
    }
  }));
}

export async function addProductReview(data: {
  userId: string;
  productId: string;
  rating: number;
  comment: string;
  imageUrls?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const isEligible = await checkReviewEligibility(data.userId, data.productId);
    if (!isEligible) {
      return {
        success: false,
        error: "Only verified buyers who have received delivery of this item can leave a review.",
      };
    }

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const p = MOCK_PRODUCTS.find((mp) => mp.id === data.productId);
      if (p) {
        const totalRating = p.rating * p.reviewsCount + Number(data.rating);
        p.reviewsCount += 1;
        p.rating = totalRating / p.reviewsCount;
      }
      return { success: true };
    }

    // Create the review in DB
    await db.review.create({
      data: {
        userId: data.userId,
        productId: data.productId,
        rating: Number(data.rating),
        comment: data.comment,
        imageUrls: data.imageUrls || [],
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to submit review:", error);
    return { success: false, error: "An unexpected error occurred while saving your review." };
  }
}

export async function checkReviewEligibility(userId: string, productId: string): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const { getOrdersByUser } = await import("@/actions/orders");
      const userOrders = await getOrdersByUser(userId);
      const hasDelivered = userOrders.some(
        (o) =>
          o.status === "DELIVERED" &&
          o.items.some((i) => i.productId === productId || productId.includes(i.productId))
      );
      return hasDelivered;
    }

    const deliveredOrders = await db.order.findMany({
      where: {
        userId,
        status: "DELIVERED",
        items: {
          some: {
            productId,
          },
        },
      },
    });

    return deliveredOrders.length > 0;
  } catch (error) {
    console.error("Failed to check review eligibility:", error);
    return false;
  }
}
