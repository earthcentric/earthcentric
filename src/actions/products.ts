"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadImage, deleteImage, getUrlFromDb, getPublicIdFromDb } from "@/lib/cloudinary";
import { createAdminNotification } from "@/actions/notifications";
import { verifyAuthenticatedUser } from "@/lib/auth-server";
import { upsertCategory, findExistingCategory } from "@/actions/categories";

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
  includeUnapproved?: boolean;
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
  enabled?: boolean;
  discountType?: "PERCENTAGE" | "FIXED";
  discountValue?: number;
  startDate?: string | null;
  endDate?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string | Date;
}

export interface BuyXGetYOffer {
  enabled: boolean;
  buyQuantity?: number;
  getQuantity?: number;
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
  reviews?: ProductReviewItem[];
  badgeType?: "verified" | "bestseller" | "eco";
  moq?: number;
  wholesalePrice?: number;
  originalPrice?: number;
  bulkPriceSlabs?: any;
  bulkOrderQuantity?: number | null; // Seller wholesale: default bulk quantity
  bulkOrderPrice?: number | null;    // Seller wholesale: total price for that bulk quantity
  tierDiscounts?: TierDiscount[] | { enabled: boolean; tiers: TierDiscount[] } | any | null;
  individualDiscount?: IndividualDiscount | any | null;
  buyXGetYOffer?: BuyXGetYOffer | any | null;
  highlights?: string[];
  technicalSpecs?: string[];
  status?: string;
  rejectionReason?: string | null;
  productDate?: Date | string;
  createdAt?: Date;
}

export interface ProductReviewItem {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  productName?: string;
}

function keepEarliestReviewPerBuyer<T extends { userId: string; productId: string | null; createdAt: Date }>(
  reviews: T[]
): T[] {
  const seen = new Set<string>();
  return [...reviews]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .filter((review) => {
      if (!review.productId) return false;
      const key = `${review.userId}:${review.productId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Global mock items for fallback mode
const MOCK_PRODUCTS: ProductItem[] = [
  {
    "id": "prod-pdf-1",
    "name": "Sauce Dip Bowl",
    "slug": "sauce-dip-bowl",
    "description": "Eco-friendly Sauce Dip Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_1.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Pieces/Pack: 50",
      "Pieces/Case: 4000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-2",
    "name": "Snack Plate",
    "slug": "snack-plate",
    "description": "Eco-friendly Snack Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_2.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Pieces/Pack: 50",
      "Pieces/Case: 3000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-3",
    "name": "Glass",
    "slug": "glass",
    "description": "Eco-friendly Glass made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_3.png"
    ],
    "category": "Tableware",
    "categoryId": "tableware",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-4",
    "name": "1D Tray",
    "slug": "1d-tray",
    "description": "Eco-friendly 1D Tray made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_4.png"
    ],
    "category": "Trays",
    "categoryId": "trays",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Pieces/Pack: 50",
      "Pieces/Case: 2000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-5",
    "name": "6\" x 6\" Clamshell Box",
    "slug": "6x6-clamshell-box",
    "description": "Eco-friendly 6\" x 6\" Clamshell Box made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_5.png"
    ],
    "category": "Clamshells",
    "categoryId": "clamshells",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 6\" x 6\"",
      "Pieces/Pack: 50",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-6",
    "name": "9\" x 9\" Clamshell Box",
    "slug": "9x9-clamshell-box",
    "description": "Eco-friendly 9\" x 9\" Clamshell Box made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_6.png"
    ],
    "category": "Clamshells",
    "categoryId": "clamshells",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 9\" x 9\"",
      "Pieces/Pack: 50",
      "Pieces/Case: 200",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-7",
    "name": "100 ml Round Bowl",
    "slug": "100-ml-round-bowl",
    "description": "Eco-friendly 100 ml Round Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_7.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Capacity: 100 ml",
      "Shape: Round",
      "Pieces/Pack: 50",
      "Pieces/Case: 4000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-8",
    "name": "120 ml Square Bowl",
    "slug": "120-ml-square-bowl",
    "description": "Eco-friendly 120 ml Square Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_8.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Capacity: 120 ml",
      "Shape: Square",
      "Pieces/Pack: 50",
      "Pieces/Case: 4000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-9",
    "name": "150 ml Kiwi Bowl",
    "slug": "150-ml-kiwi-bowl",
    "description": "Eco-friendly 150 ml Kiwi Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_9.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Capacity: 150 ml",
      "Type: Kiwi Bowl",
      "Pieces/Pack: 50",
      "Pieces/Case: 4000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-10",
    "name": "180 ml Deep Round Bowl",
    "slug": "180-ml-deep-round-bowl",
    "description": "Eco-friendly 180 ml Deep Round Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_10.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Capacity: 180 ml",
      "Shape: Deep Round",
      "Pieces/Pack: 50",
      "Pieces/Case: 2000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-11",
    "name": "180 ml Round Bowl",
    "slug": "180-ml-round-bowl",
    "description": "Eco-friendly 180 ml Round Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_11.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Capacity: 180 ml",
      "Shape: Round",
      "Pieces/Pack: 50",
      "Pieces/Case: 2000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-12",
    "name": "180 ml Square Bowl",
    "slug": "180-ml-square-bowl",
    "description": "Eco-friendly 180 ml Square Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p1_12.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Capacity: 180 ml",
      "Shape: Square",
      "Pieces/Pack: 50",
      "Pieces/Case: 2000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-13",
    "name": "240 ml Deep Round Bowl",
    "slug": "240-ml-deep-round-bowl",
    "description": "Eco-friendly 240 ml Deep Round Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_1.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Capacity: 240 ml",
      "Shape: Deep Round",
      "Pieces/Pack: 50",
      "Pieces/Case: 2000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-14",
    "name": "300 ml Deep Round Bowl",
    "slug": "300-ml-deep-round-bowl",
    "description": "Eco-friendly 300 ml Deep Round Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_2.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Capacity: 300 ml",
      "Shape: Deep Round",
      "Pieces/Pack: 50",
      "Pieces/Case: 2000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-15",
    "name": "360 ml Round Bowl",
    "slug": "360-ml-round-bowl",
    "description": "Eco-friendly 360 ml Round Bowl made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_3.png"
    ],
    "category": "Bowls",
    "categoryId": "bowls",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Capacity: 360 ml",
      "Shape: Round",
      "Pieces/Pack: 50",
      "Pieces/Case: 1800",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-16",
    "name": "4\" Sq Saucer Plate",
    "slug": "4-sq-saucer-plate",
    "description": "Eco-friendly 4\" Sq Saucer Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_4.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 4\" Square",
      "Type: Saucer Plate",
      "Pieces/Pack: 50",
      "Pieces/Case: 3000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-17",
    "name": "6\" Deep Round Plate",
    "slug": "6-deep-round-plate",
    "description": "Eco-friendly 6\" Deep Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_5.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 6\" Diameter",
      "Type: Deep Round Plate",
      "Pieces/Pack: 50",
      "Pieces/Case: 2000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-18",
    "name": "2 CP Plate",
    "slug": "2-cp-plate",
    "description": "Eco-friendly 2 CP Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_6.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Type: 2-Compartment Plate",
      "Pieces/Pack: 50",
      "Pieces/Case: 2000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-19",
    "name": "7\" Round Plate",
    "slug": "7-round-plate",
    "description": "Eco-friendly 7\" Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_7.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 7\" Diameter",
      "Shape: Round",
      "Pieces/Pack: 50",
      "Pieces/Case: 1800",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-20",
    "name": "7\" Square Plate",
    "slug": "7-square-plate",
    "description": "Eco-friendly 7\" Square Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_8.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 7\" Square",
      "Shape: Square",
      "Pieces/Pack: 50",
      "Pieces/Case: 1800",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-21",
    "name": "3CP Rectangular Plate",
    "slug": "3cp-rectangular-plate",
    "description": "Eco-friendly 3CP Rectangular Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_9.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Type: 3-Compartment Rectangular Plate",
      "Pieces/Pack: 50",
      "Pieces/Case: 1000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-22",
    "name": "9\" Round Plate",
    "slug": "9-round-plate",
    "description": "Eco-friendly 9\" Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_10.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 9\" Diameter",
      "Shape: Round",
      "Pieces/Pack: 50",
      "Pieces/Case: 1000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-23",
    "name": "9\" 3 CP Round Plate",
    "slug": "9-3-cp-round-plate",
    "description": "Eco-friendly 9\" 3 CP Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_11.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 9\" Diameter",
      "Type: 3-Compartment Round Plate",
      "Pieces/Pack: 25",
      "Pieces/Case: 1000",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-24",
    "name": "9\" Square Plate",
    "slug": "9-square-plate",
    "description": "Eco-friendly 9\" Square Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p2_12.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 50,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 9\" Square",
      "Shape: Square",
      "Pieces/Pack: 50",
      "Pieces/Case: 600",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-25",
    "name": "10\" Round Plate",
    "slug": "10-round-plate",
    "description": "Eco-friendly 10\" Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_1.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 10\" Diameter",
      "Shape: Round",
      "Pieces/Pack: 25",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-26",
    "name": "10\" 3CP Round Plate",
    "slug": "10-3cp-round-plate",
    "description": "Eco-friendly 10\" 3CP Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_2.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 10\" Diameter",
      "Type: 3-Compartment Round Plate",
      "Pieces/Pack: 25",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-27",
    "name": "10\" Square Plate",
    "slug": "10-square-plate",
    "description": "Eco-friendly 10\" Square Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_3.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 10\" Square",
      "Shape: Square",
      "Pieces/Pack: 25",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-28",
    "name": "10\" 3CP Square",
    "slug": "10-3cp-square",
    "description": "Eco-friendly 10\" 3CP Square made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_4.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 10\" Square",
      "Type: 3-Compartment Square Plate",
      "Pieces/Pack: 25",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-29",
    "name": "11\" Round Plate",
    "slug": "11-round-plate",
    "description": "Eco-friendly 11\" Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_5.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 11\" Diameter",
      "Shape: Round",
      "Pieces/Pack: 25",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-30",
    "name": "11\" 4CP Round Plate",
    "slug": "11-4cp-round-plate",
    "description": "Eco-friendly 11\" 4CP Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_6.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 11\" Diameter",
      "Type: 4-Compartment Round Plate",
      "Pieces/Pack: 25",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-31",
    "name": "12\" Round Plate",
    "slug": "12-round-plate",
    "description": "Eco-friendly 12\" Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_7.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 12\" Diameter",
      "Shape: Round",
      "Pieces/Pack: 25",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-32",
    "name": "12\" 4 CP Round Plate",
    "slug": "12-4-cp-round-plate",
    "description": "Eco-friendly 12\" 4 CP Round Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_8.png"
    ],
    "category": "Plates",
    "categoryId": "plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Dimensions: 12\" Diameter",
      "Type: 4-Compartment Round Plate",
      "Pieces/Pack: 25",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-33",
    "name": "4 CP Meal Plate",
    "slug": "4-cp-meal-plate",
    "description": "Eco-friendly 4 CP Meal Plate made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 1,
    "originalPrice": 1,
    "wholesalePrice": 1,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_9.png"
    ],
    "category": "Meal Trays & Plates",
    "categoryId": "meal-trays-plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Type: 4-Compartment Meal Plate",
      "Pieces/Pack: 25",
      "Pieces/Case: 500",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  },
  {
    "id": "prod-pdf-34",
    "name": "5 CP Meal Tray & Lid",
    "slug": "5-cp-meal-tray-and-lid",
    "description": "Eco-friendly 5 CP Meal Tray & Lid made from 100% biodegradable and compostable sugarcane bagasse.",
    "price": 2,
    "originalPrice": 2,
    "wholesalePrice": 2,
    "stock": 1000,
    "sustainabilityScore": 95,
    "sustainabilityDetail": "100% plant-based renewable agricultural waste fiber. Zero plastic and zero petroleum chemicals.",
    "images": [
      "/images/products/product_p3_10.png"
    ],
    "category": "Meal Trays & Plates",
    "categoryId": "meal-trays-plates",
    "isApproved": true,
    "sellerId": "cmvcbbtm80001txgw8dd0r3lk",
    "seller": {
      "id": "cmvcbbtm80001txgw8dd0r3lk",
      "companyName": "AR ECO INDIA",
      "badges": [
        "Verified Business",
        "Verified Sustainable Manufacturer",
        "Eco Certified"
      ],
      "logoUrl": "/images/products/product_p1_1.png",
      "trustScore": 98
    },
    "certifications": [
      "100% Biodegradable",
      "100% Compostable"
    ],
    "rating": 5,
    "reviewsCount": 12,
    "badgeType": "verified",
    "moq": 25,
    "highlights": [
      "100% Biodegradable & Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "Chemical-Free Sugarcane Bagasse"
    ],
    "technicalSpecs": [
      "Type: 5-Compartment Meal Tray with Matching Lid",
      "Pieces/Pack: 25",
      "Pieces/Case: 450",
      "100% Biodegradable",
      "100% Compostable",
      "Freezer & Microwave Safe",
      "Oil & Water Proof",
      "100% Organic",
      "No Chemical"
    ]
  }
];

let dynamicProducts: ProductItem[] = [];

export async function getDynamicProducts(): Promise<ProductItem[]> {
  return dynamicProducts;
}

export async function approveDynamicProduct(productId: string): Promise<void> {
  const prod = dynamicProducts.find((p) => p.id === productId);
  if (prod) {
    prod.isApproved = true;
    prod.status = "APPROVED";
  }
}

export async function rejectDynamicProduct(productId: string): Promise<void> {
  const prod = dynamicProducts.find((p) => p.id === productId);
  if (prod) {
    prod.isApproved = false;
    prod.status = "REJECTED";
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
      bulkOrderQuantity: (dbProd as any).bulkOrderQuantity ?? null,
      bulkOrderPrice: (dbProd as any).bulkOrderPrice ?? null,
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

    // Public marketplace requests only show approved items from active verified sellers.
    // Seller dashboards pass includeUnapproved: true to display pending/unapproved/rejected items.
    if (!filters.includeUnapproved) {
      whereClause.isApproved = true;
      whereClause.status = "APPROVED";
      whereClause.seller = {
        verificationStatus: "APPROVED",
        user: { role: "SELLER" }
      };
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
      const catFilter = filters.category;
      const catSlug = catFilter.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      andConditions.push({
        OR: [
          { category: { slug: catSlug } },
          { category: { name: { equals: catFilter, mode: "insensitive" } } },
          { category: { name: { contains: catFilter, mode: "insensitive" } } },
        ],
      });
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
          { category: { name: { contains: filters.search, mode: "insensitive" } } },
          { sustainabilityDetail: { contains: filters.search, mode: "insensitive" } },
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
          // MRP-based discount: has a higher original price set
          { originalPrice: { not: null } },
          // Bulk slab pricing
          { NOT: { bulkPriceSlabs: null } },
          // Wholesale bulk order configured
          { AND: [{ bulkOrderQuantity: { not: null } }, { bulkOrderPrice: { not: null } }] },
          // Active individual discount (approved, not null)
          { individualDiscount: { not: null } },
          // Tier discounts configured
          { tierDiscounts: { not: null } },
          // Buy X Get Y offer configured
          { buyXGetYOffer: { not: null } },
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

    const productIds = dbProducts.map((product) => product.id);
    const userIds = [...new Set(dbProducts.flatMap((product) => product.reviews.map((review) => review.userId)))];
    const deliveredItems = productIds.length > 0 && userIds.length > 0
      ? await db.orderItem.findMany({
          where: {
            productId: { in: productIds },
            order: {
              userId: { in: userIds },
              status: "DELIVERED",
              payment: { is: { status: "COMPLETED" } },
            },
          },
          select: {
            productId: true,
            order: { select: { userId: true } },
          },
        })
      : [];
    const deliveredPurchasePairs = new Set(
      deliveredItems.map((item) => `${item.order.userId}:${item.productId}`)
    );

    // Map Prisma models to unified ProductItem output
    const mappedProducts = dbProducts.map((p) => {
      const verifiedReviews = keepEarliestReviewPerBuyer(
        p.reviews.filter(
          (review) =>
            review.productId === p.id &&
            review.sellerId === null &&
            deliveredPurchasePairs.has(`${review.userId}:${p.id}`)
        )
      );
      const rating =
        verifiedReviews.length > 0
          ? verifiedReviews.reduce((acc, curr) => acc + curr.rating, 0) / verifiedReviews.length
          : 0;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        stock: p.stock,
        sustainabilityScore: p.sustainabilityScore ?? 85,
        sustainabilityDetail: p.sustainabilityDetail || "",
        status: p.status,
        rejectionReason: p.rejectionReason,
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
        reviewsCount: verifiedReviews.length,
        moq: p.moq ?? 1,
        wholesalePrice: p.wholesalePrice ?? (p.bulkOrderPrice && p.bulkOrderQuantity ? p.bulkOrderPrice / p.bulkOrderQuantity : undefined),
        ...(p.originalPrice ? { originalPrice: p.originalPrice } : {}),
        bulkPriceSlabs: p.bulkPriceSlabs,
        bulkOrderQuantity: (p as any).bulkOrderQuantity ?? null,
        bulkOrderPrice: (p as any).bulkOrderPrice ?? null,
        tierDiscounts: (p as any).tierDiscounts || null,
        individualDiscount: (p as any).individualDiscount || null,
        buyXGetYOffer: (p as any).buyXGetYOffer || null,
        highlights: (p as any).highlights || [],
        technicalSpecs: (p as any).technicalSpecs || [],
        productDate: (p as any).productDate ? new Date((p as any).productDate).toISOString().split("T")[0] : p.createdAt.toISOString().split("T")[0],
        createdAt: p.createdAt,
      };
    });

    if (filters.sortBy === "rating") {
      mappedProducts.sort((a, b) => b.rating - a.rating);
    } else if (filters.sortBy === "popular") {
      mappedProducts.sort((a, b) => b.reviewsCount - a.reviewsCount);
    }
    return mappedProducts;
  } catch (error) {
    console.warn("Database getProducts failed, falling back to mock:", error);
    return getMockProductsFiltered(filters);
  }
}

export async function getProductById(id: string): Promise<ProductItem | null> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const dyn = dynamicProducts.find((p) => p.id === id);
      if (dyn) return { ...dyn, rating: 0, reviewsCount: 0, reviews: [], status: dyn.status || (dyn.isApproved ? "APPROVED" : "PENDING_APPROVAL") };
      const mock = MOCK_PRODUCTS.find((p) => p.id === id);
      if (mock) return { ...mock, rating: 0, reviewsCount: 0, reviews: [], status: mock.status || (mock.isApproved ? "APPROVED" : "PENDING_APPROVAL") };
      return null;
    }

    const p = await db.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: true,
        seller: true,
        reviews: {
          where: {
            sellerId: null,
            user: {
              orders: {
                some: {
                  status: "DELIVERED",
                  payment: { is: { status: "COMPLETED" } },
                  items: { some: { productId: id } },
                },
              },
            },
          },
          include: {
            user: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!p) return null;

    const verifiedReviews = keepEarliestReviewPerBuyer(p.reviews);
    const rating =
      verifiedReviews.length > 0
        ? verifiedReviews.reduce((acc, curr) => acc + curr.rating, 0) / verifiedReviews.length
        : 0;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      stock: p.stock,
      sustainabilityScore: p.sustainabilityScore ?? 85,
      sustainabilityDetail: p.sustainabilityDetail || "",
      status: p.status,
      rejectionReason: p.rejectionReason,
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
      reviewsCount: verifiedReviews.length,
      reviews: verifiedReviews.map((review) => ({
        id: review.id,
        userName: review.user.name?.trim() || "Verified buyer",
        rating: review.rating,
        comment: review.comment || "",
        date: review.createdAt.toISOString(),
      })),
      ...(p.moq ? { moq: p.moq } : {}),
      ...(p.wholesalePrice ? { wholesalePrice: p.wholesalePrice } : {}),
      ...(p.originalPrice ? { originalPrice: p.originalPrice } : {}),
      bulkPriceSlabs: p.bulkPriceSlabs,
      bulkOrderQuantity: (p as any).bulkOrderQuantity ?? null,
      bulkOrderPrice: (p as any).bulkOrderPrice ?? null,
      tierDiscounts: (p as any).tierDiscounts || null,
      individualDiscount: (p as any).individualDiscount || null,
      buyXGetYOffer: (p as any).buyXGetYOffer || null,
      highlights: (p as any).highlights || [],
      technicalSpecs: (p as any).technicalSpecs || [],
      productDate: (p as any).productDate ? new Date((p as any).productDate).toISOString().split("T")[0] : p.createdAt.toISOString().split("T")[0],
      createdAt: p.createdAt,
    };
  } catch (error) {
    console.warn("Database getProductById failed, using mock:", error);
    const fallback = [...MOCK_PRODUCTS, ...dynamicProducts].find((p) => p.id === id);
    return fallback ? { ...fallback, rating: 0, reviewsCount: 0, reviews: [] } : null;
  }
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  stock: number;
  productDate?: string | Date;
  categoryName: string;
  categoryId?: string;
  sustainabilityScore?: number;
  sustainabilityDetail?: string;
  imageUrls: string[];
  sellerId: string;
  sellerName: string;
  moq?: number;
  wholesalePrice?: number;
  originalPrice?: number;
  bulkPriceSlabs?: any;
  bulkOrderQuantity?: number; // Seller wholesale: default bulk quantity
  bulkOrderPrice?: number;    // Seller wholesale: total price for that bulk quantity
  tierDiscounts?: TierDiscount[] | { enabled: boolean; tiers: TierDiscount[] } | any | null;
  individualDiscount?: IndividualDiscount | any | null;
  buyXGetYOffer?: BuyXGetYOffer | any | null;
  highlights?: string[]; // New optional field for product highlights
  technicalSpecs?: string[]; // New optional field for technical specifications
}): Promise<ProductItem> {
  // Enforce server-side seller activation check
  if (data.sellerId) {
    const { checkSellerActivation } = await import("@/lib/auth-server");
    const act = await checkSellerActivation(data.sellerId);
    if (!act.active) {
      throw new Error(act.error || "Seller account activation required. Please complete registration fee payment.");
    }
  }

  // Input validations
  if (!data.name || typeof data.name !== "string" || data.name.trim().length < 2) {
    throw new Error("Product name must be at least 2 characters.");
  }
  if (data.price === undefined || isNaN(Number(data.price)) || Number(data.price) <= 0) {
    throw new Error("Product price must be a valid positive number.");
  }
  if (data.stock === undefined || isNaN(Number(data.stock)) || Number(data.stock) < 0) {
    throw new Error("Product stock must be a non-negative number.");
  }
  const rawImages = (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0)
    ? data.imageUrls
    : ["https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=60"];
  const hasCategory = Boolean((data.categoryId && String(data.categoryId).trim().length > 0) || (data.categoryName && String(data.categoryName).trim().length > 0));
  if (!hasCategory) {
    throw new Error("Category is required.");
  }

  // Validate promotional rules ONLY if explicitly enabled
  if (data.individualDiscount && data.individualDiscount.enabled) {
    if (data.individualDiscount.discountValue !== undefined && data.individualDiscount.discountValue !== null) {
      const val = Number(data.individualDiscount.discountValue);
      if (val <= 0) {
        throw new Error("Individual discount value must be greater than 0.");
      }
      if (data.individualDiscount.discountType === "PERCENTAGE" && val > 100) {
        throw new Error("Individual discount percentage cannot exceed 100%.");
      }
      if (data.individualDiscount.discountType === "FIXED" && val >= Number(data.price)) {
        throw new Error("Fixed discount amount cannot exceed or equal the product price.");
      }
    }
  }

  if (data.tierDiscounts) {
    const isObj = typeof data.tierDiscounts === "object" && !Array.isArray(data.tierDiscounts);
    const isTierEnabled = isObj
      ? (data.tierDiscounts as any).enabled !== false
      : Array.isArray(data.tierDiscounts) && data.tierDiscounts.length > 0;
    const tiers: any[] = isObj
      ? ((data.tierDiscounts as any).tiers || [])
      : (Array.isArray(data.tierDiscounts) ? data.tierDiscounts : []);

    if (isTierEnabled && tiers.length > 0) {
      for (const t of tiers) {
        if (!t.minQuantity || Number(t.minQuantity) < 2) {
          throw new Error("Tier minimum quantity must be at least 2.");
        }
        if (!t.discountValue || Number(t.discountValue) <= 0) {
          throw new Error("Tier discount value must be greater than 0.");
        }
        if (t.discountType === "PERCENTAGE" && Number(t.discountValue) > 100) {
          throw new Error("Tier discount percentage cannot exceed 100%.");
        }
        if (t.discountType === "FIXED" && Number(t.discountValue) >= Number(data.price)) {
          throw new Error("Tier fixed discount cannot exceed or equal the product price.");
        }
      }
    }
  }

  if (data.buyXGetYOffer && data.buyXGetYOffer.enabled) {
    if (!data.buyXGetYOffer.buyQuantity || Number(data.buyXGetYOffer.buyQuantity) < 1) {
      throw new Error("Buy X quantity must be at least 1.");
    }
    if (!data.buyXGetYOffer.getQuantity || Number(data.buyXGetYOffer.getQuantity) < 1) {
      throw new Error("Get Y quantity must be at least 1.");
    }
  }

  try {
    // Process/upload all product images to Cloudinary (will return JSON strings)
    const uploadedImages = await Promise.all(
      rawImages.map(async (url) => {
        const secureUrl = await uploadImage(url, "product");
        return { url: secureUrl };
      })
    );

    const productDateVal = data.productDate ? new Date(data.productDate) : new Date();

    const isIndivEnabled = !!(data.individualDiscount && data.individualDiscount.enabled && Number(data.individualDiscount.discountValue) > 0);
    const isTierEnabled = !!(data.tierDiscounts && ((data.tierDiscounts as any).enabled !== false && (((data.tierDiscounts as any).tiers && (data.tierDiscounts as any).tiers.length > 0) || (Array.isArray(data.tierDiscounts) && data.tierDiscounts.length > 0))));
    const isBxgyEnabled = !!(data.buyXGetYOffer && data.buyXGetYOffer.enabled && Number(data.buyXGetYOffer.buyQuantity) >= 1 && Number(data.buyXGetYOffer.getQuantity) >= 1);

    const isMockDb = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (isMockDb) {
      const newProduct: ProductItem = {
        id: `prod-${Math.floor(Math.random() * 10000)}`,
        name: data.name,
        slug: `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
        description: data.description,
        price: Number(data.price),
        stock: Number(data.stock),
        productDate: productDateVal.toISOString().split("T")[0],
        sustainabilityScore: Number(data.sustainabilityScore) || 85,
        sustainabilityDetail: data.sustainabilityDetail || "",
        images: uploadedImages.map(img => getUrlFromDb(img.url)),
        category: data.categoryName,
        categoryId: `c_${data.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        status: "PENDING_APPROVAL",
        isApproved: false,
        rejectionReason: null,
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
        ...(data.bulkOrderQuantity ? { bulkOrderQuantity: Number(data.bulkOrderQuantity) } : {}),
        ...(data.bulkOrderPrice ? { bulkOrderPrice: Number(data.bulkOrderPrice) } : {}),
        tierDiscounts: isTierEnabled ? data.tierDiscounts : null,
        individualDiscount: isIndivEnabled ? { ...data.individualDiscount, status: "PENDING" } : null,
        buyXGetYOffer: isBxgyEnabled ? data.buyXGetYOffer : null,
        highlights: data.highlights || [],
        technicalSpecs: data.technicalSpecs || [],
        createdAt: new Date(),
      };
      
      dynamicProducts.push(newProduct);
      return newProduct;
    }

    // Find seller by either sellerId, userId, or user email to prevent FK mismatches
    let seller = await db.seller.findUnique({ where: { id: data.sellerId } });
    if (!seller) {
      seller = await db.seller.findUnique({ where: { userId: data.sellerId } });
    }
    if (!seller) {
      const user = await db.user.findFirst({
        where: {
          OR: [
            { id: data.sellerId },
            { email: data.sellerId }
          ]
        },
        include: { seller: true }
      });
      if (user?.seller) {
        seller = user.seller;
      }
    }
    if (!seller) {
      throw new Error(`Seller profile not found for ID or User ID: ${data.sellerId}`);
    }
    const resolvedSellerId = seller.id;

    // Handle Category look-up: only pre-approved categories allowed for sellers
    const categoryIdentifier = data.categoryId || data.categoryName;
    const category = await findExistingCategory(categoryIdentifier);
    if (!category) {
      throw new Error(`Invalid category: "${categoryIdentifier}". Only categories created by the Super Admin can be selected. Please choose an existing category.`);
    }

    const scoreVal = Number.isFinite(Number(data.sustainabilityScore))
      ? Math.round(Number(data.sustainabilityScore))
      : 85;
    const detailVal = data.sustainabilityDetail || "";

    const p = (await db.product.create({
      data: {
        name: data.name.trim(),
        slug: `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
        description: data.description,
        price: Number(data.price),
        stock: Number(data.stock),
        productDate: productDateVal,
        sustainabilityScore: scoreVal,
        sustainabilityDetail: detailVal,
        categoryId: category.id,
        sellerId: resolvedSellerId,
        status: "PENDING_APPROVAL",
        isApproved: false,
        rejectionReason: null,
        highlights: data.highlights || [],
        technicalSpecs: data.technicalSpecs || [],
        tierDiscounts: isTierEnabled ? (data.tierDiscounts as any) : null,
        individualDiscount: isIndivEnabled ? { ...(data.individualDiscount as any), status: "PENDING" } : null,
        buyXGetYOffer: isBxgyEnabled ? (data.buyXGetYOffer as any) : null,
        moq: data.moq ? Number(data.moq) : 1,
        wholesalePrice: data.wholesalePrice ? Number(data.wholesalePrice) : null,
        originalPrice: data.originalPrice ? Number(data.originalPrice) : null,
        bulkPriceSlabs: data.bulkPriceSlabs || null,
        ...(data.bulkOrderQuantity ? { bulkOrderQuantity: Number(data.bulkOrderQuantity) } : {}),
        ...(data.bulkOrderPrice ? { bulkOrderPrice: Number(data.bulkOrderPrice) } : {}),
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

    // Register discount approval requests in Super Admin workflow if any promotions were submitted
    if (isIndivEnabled) {
      try {
        await (db as any).discountApprovalRequest.create({
          data: {
            sellerId: resolvedSellerId,
            productId: p.id,
            discountType: "INDIVIDUAL",
            requestedAction: "ACTIVATE",
            status: "PENDING",
            proposedConfig: data.individualDiscount,
            currentConfig: null,
            requestedBy: data.sellerName || resolvedSellerId,
            requestedAt: new Date(),
          },
        });
      } catch (err) {
        console.warn("Could not create discountApprovalRequest for INDIVIDUAL:", err);
      }
    }

    if (isTierEnabled) {
      try {
        await (db as any).discountApprovalRequest.create({
          data: {
            sellerId: resolvedSellerId,
            productId: p.id,
            discountType: "TIER",
            requestedAction: "ACTIVATE",
            status: "PENDING",
            proposedConfig: data.tierDiscounts,
            currentConfig: null,
            requestedBy: data.sellerName || resolvedSellerId,
            requestedAt: new Date(),
          },
        });
      } catch (err) {
        console.warn("Could not create discountApprovalRequest for TIER:", err);
      }
    }

    if (isBxgyEnabled) {
      try {
        await (db as any).discountApprovalRequest.create({
          data: {
            sellerId: resolvedSellerId,
            productId: p.id,
            discountType: "BUY_X_GET_Y",
            requestedAction: "ACTIVATE",
            status: "PENDING",
            proposedConfig: data.buyXGetYOffer,
            currentConfig: null,
            requestedBy: data.sellerName || resolvedSellerId,
            requestedAt: new Date(),
          },
        });
      } catch (err) {
        console.warn("Could not create discountApprovalRequest for BUY_X_GET_Y:", err);
      }
    }

    await createAdminNotification(
      "Product Approval Required",
      `Seller "${p.seller.companyName}" added a new product "${p.name}" which requires Super Admin approval.`,
      "products"
    ).catch((error) => {
      console.error("Product was saved, but the Super Admin notification failed:", error);
    });

    try {
      revalidatePath("/");
      revalidatePath("/marketplace");
      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/dashboard");
    } catch (revalErr) {
      // Catch in case called from non-request context
    }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      stock: p.stock,
      sustainabilityScore: p.sustainabilityScore ?? scoreVal,
      sustainabilityDetail: p.sustainabilityDetail ?? detailVal,
      status: p.status,
      rejectionReason: p.rejectionReason,
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
      bulkOrderQuantity: (p as any).bulkOrderQuantity ?? null,
      bulkOrderPrice: (p as any).bulkOrderPrice ?? null,
      tierDiscounts: (p as any).tierDiscounts || null,
      individualDiscount: (p as any).individualDiscount || null,
      buyXGetYOffer: (p as any).buyXGetYOffer || null,
      highlights: (p as any).highlights || data.highlights || [],
      technicalSpecs: (p as any).technicalSpecs || data.technicalSpecs || [],
      productDate: p.productDate ? new Date(p.productDate).toISOString().split("T")[0] : p.createdAt.toISOString().split("T")[0],
    };
  } catch (error: any) {
    console.error("Failed to create product in DB:", error);
    throw new Error(error?.message || "Failed to create product. Ensure your database is correctly configured.");
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
    categoryId?: string;
    sustainabilityScore?: number;
    sustainabilityDetail?: string;
    moq?: number;
    wholesalePrice?: number;
    originalPrice?: number;
    bulkPriceSlabs?: any;
    bulkOrderQuantity?: number | null; // Seller wholesale: default bulk quantity
    bulkOrderPrice?: number | null;    // Seller wholesale: total price for that bulk quantity
    tierDiscounts?: TierDiscount[] | { enabled: boolean; tiers: TierDiscount[] } | any | null;
    individualDiscount?: IndividualDiscount | any | null;
    buyXGetYOffer?: BuyXGetYOffer | any | null;
    highlights?: string[];
    technicalSpecs?: string[];
    reapprovalRequired?: boolean;
    status?: string;
  }
): Promise<boolean> {
  try {
    const reapproval = data.reapprovalRequired ?? true;

    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const existingProd = await db.product.findUnique({ where: { id }, select: { sellerId: true } });
      if (existingProd?.sellerId) {
        const { checkSellerActivation } = await import("@/lib/auth-server");
        const act = await checkSellerActivation(existingProd.sellerId);
        if (!act.active) {
          throw new Error(act.error || "Seller account activation required. Please complete registration fee payment.");
        }
      }
    }

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
            bulkOrderQuantity: data.bulkOrderQuantity !== undefined ? (data.bulkOrderQuantity ? Number(data.bulkOrderQuantity) : null) : (p as any).bulkOrderQuantity,
            bulkOrderPrice: data.bulkOrderPrice !== undefined ? (data.bulkOrderPrice ? Number(data.bulkOrderPrice) : null) : (p as any).bulkOrderPrice,
            wholesalePrice: data.wholesalePrice !== undefined ? (data.wholesalePrice ? Number(data.wholesalePrice) : undefined) : (data.bulkOrderPrice && data.bulkOrderQuantity ? Number(data.bulkOrderPrice) / Number(data.bulkOrderQuantity) : p.wholesalePrice),
            tierDiscounts: data.tierDiscounts !== undefined ? data.tierDiscounts : null,
            individualDiscount: data.individualDiscount !== undefined ? data.individualDiscount : null,
            buyXGetYOffer: data.buyXGetYOffer !== undefined ? data.buyXGetYOffer : null,
            highlights: data.highlights !== undefined ? data.highlights : p.highlights,
            technicalSpecs: data.technicalSpecs !== undefined ? data.technicalSpecs : p.technicalSpecs,
            isApproved: reapproval ? false : p.isApproved,
            status: reapproval ? "PENDING_APPROVAL" : (data.status || p.status),
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
          bulkOrderQuantity: data.bulkOrderQuantity !== undefined ? (data.bulkOrderQuantity ? Number(data.bulkOrderQuantity) : null) : MOCK_PRODUCTS[idx].bulkOrderQuantity,
          bulkOrderPrice: data.bulkOrderPrice !== undefined ? (data.bulkOrderPrice ? Number(data.bulkOrderPrice) : null) : MOCK_PRODUCTS[idx].bulkOrderPrice,
          wholesalePrice: data.wholesalePrice !== undefined ? (data.wholesalePrice ? Number(data.wholesalePrice) : undefined) : (data.bulkOrderPrice && data.bulkOrderQuantity ? Number(data.bulkOrderPrice) / Number(data.bulkOrderQuantity) : (MOCK_PRODUCTS[idx].wholesalePrice ?? undefined)),
          tierDiscounts: data.tierDiscounts !== undefined ? data.tierDiscounts : null,
          individualDiscount: data.individualDiscount !== undefined ? data.individualDiscount : null,
          buyXGetYOffer: data.buyXGetYOffer !== undefined ? data.buyXGetYOffer : null,
          highlights: data.highlights !== undefined ? data.highlights : MOCK_PRODUCTS[idx].highlights,
          technicalSpecs: data.technicalSpecs !== undefined ? data.technicalSpecs : MOCK_PRODUCTS[idx].technicalSpecs,
          isApproved: reapproval ? false : MOCK_PRODUCTS[idx].isApproved,
          status: reapproval ? "PENDING_APPROVAL" : (data.status || MOCK_PRODUCTS[idx].status),
        };
      }
      return true;
    }

    // Database Update
    const updatePayload: any = {};
    if (data.name !== undefined) {
      updatePayload.name = data.name;
      updatePayload.slug = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.floor(Math.random() * 1000)}`;
    }
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.price !== undefined) updatePayload.price = Number(data.price);
    if (data.stock !== undefined) updatePayload.stock = Number(data.stock);
    if (data.productDate) updatePayload.productDate = new Date(data.productDate);
    if (data.sustainabilityScore !== undefined) updatePayload.sustainabilityScore = Number(data.sustainabilityScore);
    if (data.sustainabilityDetail !== undefined) updatePayload.sustainabilityDetail = data.sustainabilityDetail;
    if (data.moq !== undefined) updatePayload.moq = Number(data.moq);
    if (data.bulkOrderQuantity && data.bulkOrderPrice && Number(data.bulkOrderQuantity) > 0) {
      updatePayload.wholesalePrice = Number(data.bulkOrderPrice) / Number(data.bulkOrderQuantity);
    } else if (data.wholesalePrice !== undefined) {
      updatePayload.wholesalePrice = data.wholesalePrice ? Number(data.wholesalePrice) : null;
    }
    if (data.originalPrice !== undefined) updatePayload.originalPrice = data.originalPrice ? Number(data.originalPrice) : null;
    if (data.bulkPriceSlabs !== undefined) updatePayload.bulkPriceSlabs = data.bulkPriceSlabs;
    if (data.bulkOrderQuantity !== undefined) updatePayload.bulkOrderQuantity = data.bulkOrderQuantity ? Number(data.bulkOrderQuantity) : null;
    if (data.bulkOrderPrice !== undefined) updatePayload.bulkOrderPrice = data.bulkOrderPrice ? Number(data.bulkOrderPrice) : null;
    if (data.tierDiscounts !== undefined) updatePayload.tierDiscounts = data.tierDiscounts as any;
    if (data.individualDiscount !== undefined) {
      const indiv = data.individualDiscount as any;
      if (indiv && indiv.enabled !== false && Number(indiv.discountValue) > 0) {
        updatePayload.individualDiscount = {
          ...indiv,
          enabled: true,
          status: indiv.status === "APPROVED" && data.reapprovalRequired === false ? "APPROVED" : "PENDING",
        };
      } else {
        updatePayload.individualDiscount = {
          enabled: false,
          discountValue: 0,
        };
      }
    }
    if (data.buyXGetYOffer !== undefined) updatePayload.buyXGetYOffer = data.buyXGetYOffer as any;
    if (data.highlights !== undefined) updatePayload.highlights = data.highlights;
    if (data.technicalSpecs !== undefined) updatePayload.technicalSpecs = data.technicalSpecs;

    if (data.categoryName || data.categoryId) {
      const categoryIdentifier = data.categoryId || data.categoryName;
      const category = await findExistingCategory(categoryIdentifier);
      if (!category) {
        throw new Error(`Invalid category: "${categoryIdentifier}". Only categories created by the Super Admin can be selected. Please choose an existing category.`);
      }
      updatePayload.categoryId = category.id;
    }

    if (reapproval) {
      updatePayload.isApproved = false;
      updatePayload.status = "PENDING_APPROVAL";
      updatePayload.rejectionReason = null;
    } else if (data.status) {
      updatePayload.status = data.status as any;
      if (data.status === "APPROVED") {
        updatePayload.isApproved = true;
        updatePayload.rejectionReason = null;
      }
    }

    const updated = await db.product.update({
      where: { id },
      data: updatePayload,
      include: { seller: true }
    });

    if (reapproval) {
      await createAdminNotification(
        "Product Update Requires Approval",
        `Seller "${updated.seller?.companyName || 'Seller'}" updated product "${updated.name}". It requires re-approval.`,
        "products"
      ).catch(() => {});
    }

    try {
      revalidatePath("/");
      revalidatePath("/marketplace");
      revalidatePath(`/products/${id}`);
      if (updated.slug) {
        revalidatePath(`/products/${updated.slug}`);
      }
      revalidatePath("/seller/dashboard");
    } catch (e) {}

    return true;
  } catch (error) {
    console.error("Failed to update product in DB, updating mock:", error);
    // Fall back to memory update
    dynamicProducts = dynamicProducts.map((p) => {
      if (p.id === id) {
        const derivedWholesale = data.wholesalePrice !== undefined
          ? (data.wholesalePrice ? Number(data.wholesalePrice) : undefined)
          : (data.bulkOrderPrice && data.bulkOrderQuantity
            ? Number(data.bulkOrderPrice) / Number(data.bulkOrderQuantity)
            : p.wholesalePrice);
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
          bulkOrderQuantity: data.bulkOrderQuantity !== undefined ? (data.bulkOrderQuantity ? Number(data.bulkOrderQuantity) : null) : (p as any).bulkOrderQuantity,
          bulkOrderPrice: data.bulkOrderPrice !== undefined ? (data.bulkOrderPrice ? Number(data.bulkOrderPrice) : null) : (p as any).bulkOrderPrice,
          wholesalePrice: derivedWholesale,
          tierDiscounts: data.tierDiscounts !== undefined ? data.tierDiscounts : null,
          individualDiscount: data.individualDiscount !== undefined ? data.individualDiscount : null,
          buyXGetYOffer: data.buyXGetYOffer !== undefined ? data.buyXGetYOffer : null,
          highlights: data.highlights !== undefined ? data.highlights : p.highlights,
          technicalSpecs: data.technicalSpecs !== undefined ? data.technicalSpecs : p.technicalSpecs,
        };
      }
      return p;
    });
    const idx = MOCK_PRODUCTS.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const mockDerivedWholesale = data.wholesalePrice !== undefined
        ? (data.wholesalePrice ? Number(data.wholesalePrice) : undefined)
        : (data.bulkOrderPrice && data.bulkOrderQuantity
          ? Number(data.bulkOrderPrice) / Number(data.bulkOrderQuantity)
          : (MOCK_PRODUCTS[idx].wholesalePrice ?? undefined));
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
        bulkOrderQuantity: data.bulkOrderQuantity !== undefined ? (data.bulkOrderQuantity ? Number(data.bulkOrderQuantity) : null) : MOCK_PRODUCTS[idx].bulkOrderQuantity,
        bulkOrderPrice: data.bulkOrderPrice !== undefined ? (data.bulkOrderPrice ? Number(data.bulkOrderPrice) : null) : MOCK_PRODUCTS[idx].bulkOrderPrice,
        wholesalePrice: mockDerivedWholesale,
        tierDiscounts: data.tierDiscounts !== undefined ? data.tierDiscounts : null,
        individualDiscount: data.individualDiscount !== undefined ? data.individualDiscount : null,
        buyXGetYOffer: data.buyXGetYOffer !== undefined ? data.buyXGetYOffer : null,
        highlights: data.highlights !== undefined ? data.highlights : MOCK_PRODUCTS[idx].highlights,
        technicalSpecs: data.technicalSpecs !== undefined ? data.technicalSpecs : MOCK_PRODUCTS[idx].technicalSpecs,
      };
    }
    return true;
  }
}

export async function archiveProduct(id: string): Promise<boolean> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const existingProd = await db.product.findUnique({ where: { id }, select: { sellerId: true } });
      if (existingProd?.sellerId) {
        const { checkSellerActivation } = await import("@/lib/auth-server");
        const act = await checkSellerActivation(existingProd.sellerId);
        if (!act.active) {
          throw new Error(act.error || "Seller account activation required. Please complete registration fee payment.");
        }
      }
    }

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
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const existingProd = await db.product.findUnique({ where: { id }, select: { sellerId: true } });
      if (existingProd?.sellerId) {
        const { checkSellerActivation } = await import("@/lib/auth-server");
        const act = await checkSellerActivation(existingProd.sellerId);
        if (!act.active) {
          throw new Error(act.error || "Seller account activation required. Please complete registration fee payment.");
        }
      }
    }

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
  let list = Array.from(map.values()).map((product) => ({
    ...product,
    rating: 0,
    reviewsCount: 0,
    reviews: [],
  }));

  if (!filters.includeUnapproved) {
    list = list.filter((p) => p.isApproved && (p.status === "APPROVED" || !p.status));
  }

  if (filters.sellerId) {
    list = list.filter((p) => p.sellerId === filters.sellerId || p.seller.id === filters.sellerId);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.sustainabilityDetail || "").toLowerCase().includes(q)
    );
  }

  if (filters.category && filters.category !== "all") {
    const catFilter = filters.category.toLowerCase();
    list = list.filter((p) => {
      const catSlug = p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const catName = p.category.toLowerCase();
      return catSlug === catFilter || catName === catFilter || catName.includes(catFilter) || catFilter.includes(catName);
    });
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
    list = list.filter((p) => {
      // MRP discount
      if (p.originalPrice && p.originalPrice > p.price) return true;
      // Bulk slab pricing
      if (p.bulkPriceSlabs && (p.bulkPriceSlabs as any[]).length > 0) return true;
      // Wholesale bulk order
      if (p.bulkOrderQuantity && p.bulkOrderPrice) return true;
      // Individual discount (any value set)
      if (p.individualDiscount && (p.individualDiscount as any).discountValue) return true;
      // Tier discounts
      const tiers = p.tierDiscounts;
      if (tiers) {
        if (Array.isArray(tiers) && tiers.length > 0) return true;
        if ((tiers as any).tiers && (tiers as any).tiers.length > 0) return true;
      }
      // Buy X Get Y
      if (p.buyXGetYOffer && (p.buyXGetYOffer as any).buyQuantity) return true;
      return false;
    });
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
    rating: 0,
    reviewsCount: 0,
    reviews: [],
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
    const authenticatedUser = await verifyAuthenticatedUser();
    if (!authenticatedUser.authorized || authenticatedUser.userId !== data.userId) {
      return { success: false, error: "Please sign in with the account that placed the order." };
    }

    const comment = typeof data.comment === "string" ? data.comment.trim() : "";
    if (
      typeof data.productId !== "string" ||
      !data.productId.trim() ||
      !Number.isInteger(data.rating) ||
      data.rating < 1 ||
      data.rating > 5 ||
      comment.length < 1 ||
      comment.length > 2000
    ) {
      return { success: false, error: "Enter a rating from 1 to 5 and a review of up to 2,000 characters." };
    }

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return { success: false, error: "Verified reviews are unavailable until the database is connected." };
    }

    const isEligible = await isProductReviewEligible(authenticatedUser.userId, data.productId);
    if (!isEligible) {
      return {
        success: false,
        error: "Only verified buyers who have received this item can leave one review per product.",
      };
    }

    await db.review.create({
      data: {
        userId: authenticatedUser.userId,
        productId: data.productId,
        rating: data.rating,
        comment,
        imageUrls: data.imageUrls || [],
      },
    });

    revalidatePath(`/products/${data.productId}`);
    revalidatePath("/");
    revalidatePath("/marketplace");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { success: false, error: "You have already reviewed this product." };
    }
    console.error("Failed to submit review:", error);
    return { success: false, error: "An unexpected error occurred while saving your review." };
  }
}

export async function checkReviewEligibility(userId: string, productId: string): Promise<boolean> {
  try {
    const authenticatedUser = await verifyAuthenticatedUser();
    if (!authenticatedUser.authorized || authenticatedUser.userId !== userId) return false;
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return false;
    }

    return isProductReviewEligible(userId, productId);
  } catch (error) {
    console.error("Failed to check review eligibility:", error);
    return false;
  }
}

async function isProductReviewEligible(userId: string, productId: string): Promise<boolean> {
  const [deliveredOrder, existingReview] = await Promise.all([
    db.order.findFirst({
      where: {
        userId,
        status: "DELIVERED",
        payment: { is: { status: "COMPLETED" } },
        items: {
          some: {
            productId,
          },
        },
      },
      select: { id: true },
    }),
    db.review.findFirst({
      where: { userId, productId, sellerId: null },
      select: { id: true },
    }),
  ]);

  return Boolean(deliveredOrder && !existingReview);
}

export async function getVerifiedProductReviews(
  productId?: string,
  requestedLimit = 6
): Promise<ProductReviewItem[]> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) return [];
    const maxLimit = productId ? 500 : 12;
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), maxLimit)
      : 6;
    const reviews = await db.review.findMany({
      where: {
        productId: productId || { not: null },
        sellerId: null,
        ...(productId
          ? {
              user: {
                orders: {
                  some: {
                    status: "DELIVERED",
                    payment: { is: { status: "COMPLETED" } },
                    items: { some: { productId } },
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        userId: true,
        productId: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { name: true } },
        product: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      ...(productId ? {} : { take: 500 }),
    });

    let verifiedReviews = reviews;
    if (!productId && reviews.length > 0) {
      const productIds = [...new Set(reviews.map((review) => review.productId).filter((id): id is string => Boolean(id)))];
      const userIds = [...new Set(reviews.map((review) => review.userId))];
      const deliveredItems = await db.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: {
            userId: { in: userIds },
            status: "DELIVERED",
            payment: { is: { status: "COMPLETED" } },
          },
        },
        select: {
          productId: true,
          order: { select: { userId: true } },
        },
      });
      const deliveredPairs = new Set(deliveredItems.map((item) => `${item.order.userId}:${item.productId}`));
      verifiedReviews = reviews.filter(
        (review) => review.productId && deliveredPairs.has(`${review.userId}:${review.productId}`)
      );
    }

    const uniqueVerifiedReviews = keepEarliestReviewPerBuyer(verifiedReviews)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return uniqueVerifiedReviews.slice(0, limit).map((review) => ({
      id: review.id,
      userName: review.user.name?.trim() || "Verified buyer",
      rating: review.rating,
      comment: review.comment || "",
      date: review.createdAt.toISOString(),
      ...(review.product ? { productName: review.product.name } : {}),
    }));
  } catch (error) {
    console.error("Failed to load verified product reviews:", error);
    return [];
  }
}

export async function getReviewedProductIds(userId: string, productIds: string[]): Promise<string[]> {
  try {
    const authenticatedUser = await verifyAuthenticatedUser();
    if (!authenticatedUser.authorized || authenticatedUser.userId !== userId) return [];
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock") || productIds.length === 0) return [];

    const reviews = await db.review.findMany({
      where: { userId, productId: { in: productIds }, sellerId: null },
      select: { productId: true },
    });
    return reviews.flatMap((review) => review.productId ? [review.productId] : []);
  } catch (error) {
    console.error("Failed to load the user's reviewed products:", error);
    return [];
  }
}
