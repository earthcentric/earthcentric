import { NextResponse } from "next/server";
import db from "@/lib/db";

// Predefined sustainable categories (always available as fallback)
const FALLBACK_CATEGORIES = [
  { id: "c-1",  name: "Clothing & Apparel",        slug: "clothing",           description: "Sustainable, organic, and ethically made garments" },
  { id: "c-2",  name: "Paper Plates & Tableware",  slug: "paper-plates",       description: "Compostable and recycled paper tableware" },
  { id: "c-3",  name: "Fertilizers & Soil",        slug: "fertilizers",        description: "Organic and natural fertilizers for sustainable farming" },
  { id: "c-4",  name: "Bamboo Products",            slug: "bamboo",             description: "Eco-friendly bamboo-based everyday items" },
  { id: "c-5",  name: "Reusable Bags & Packaging", slug: "reusable-packaging", description: "Sustainable alternatives to single-use plastics" },
  { id: "c-6",  name: "Biodegradable Cutlery",      slug: "cutlery",            description: "Plant-based, compostable cutlery and utensils" },
  { id: "c-7",  name: "Organic Personal Care",      slug: "personal-care",      description: "Chemical-free, cruelty-free personal hygiene products" },
  { id: "c-8",  name: "Eco Stationery",             slug: "stationery",         description: "Recycled paper notebooks, pens, and office supplies" },
  { id: "c-9",  name: "Natural Cleaning Products",  slug: "cleaning",           description: "Non-toxic, biodegradable household cleaning solutions" },
  { id: "c-10", name: "Sustainable Home Decor",     slug: "home-decor",         description: "Upcycled and natural material home furnishings" },
  { id: "c-11", name: "Compostable Disposables",    slug: "disposables",        description: "Single-use items that fully biodegrade" },
  { id: "c-12", name: "Organic Food & Spices",      slug: "food",               description: "Certified organic food products and spices" },
];

export async function GET() {
  try {
    // Try to seed + fetch from DB
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      // Check if we already have categories seeded
      const count = await db.category.count();
      if (count === 0) {
        // Seed categories only once when DB is empty
        for (const cat of FALLBACK_CATEGORIES) {
          await db.category.create({
            data: { name: cat.name, slug: cat.slug, description: cat.description },
          }).catch(() => {});
        }
      }

      const cats = await db.category.findMany({
        include: {
          _count: { select: { products: { where: { isApproved: true, isArchived: false } } } },
        },
        orderBy: { name: "asc" },
      });

      const categories = cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? undefined,
        productCount: (c as any)._count?.products ?? 0,
      }));

      return NextResponse.json({ categories });
    }
  } catch (e) {
    // Fall through to fallback
    console.error("categories API DB error:", e);
  }

  // Always return fallback categories so the UI is never empty
  const categories = FALLBACK_CATEGORIES.map((c) => ({ ...c, productCount: 0 }));
  return NextResponse.json({ categories });
}
