"use server";

import db from "@/lib/db";

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
}

// ── Predefined sustainable categories (seeded into DB on first use) ──────────
const SUSTAINABLE_CATEGORIES = [
  { name: "Clothing & Apparel",         slug: "clothing",            description: "Sustainable, organic, and ethically made garments" },
  { name: "Paper Plates & Tableware",   slug: "paper-plates",        description: "Compostable and recycled paper tableware" },
  { name: "Fertilizers & Soil",         slug: "fertilizers",         description: "Organic and natural fertilizers for sustainable farming" },
  { name: "Bamboo Products",            slug: "bamboo",              description: "Eco-friendly bamboo-based everyday items" },
  { name: "Reusable Bags & Packaging",  slug: "reusable-packaging",  description: "Sustainable alternatives to single-use plastics" },
  { name: "Biodegradable Cutlery",      slug: "cutlery",             description: "Plant-based, compostable cutlery and utensils" },
  { name: "Organic Personal Care",      slug: "personal-care",       description: "Chemical-free, cruelty-free personal hygiene products" },
  { name: "Eco Stationery",             slug: "stationery",          description: "Recycled paper notebooks, pens, and office supplies" },
  { name: "Natural Cleaning Products",  slug: "cleaning",            description: "Non-toxic, biodegradable household cleaning solutions" },
  { name: "Sustainable Home Decor",     slug: "home-decor",          description: "Upcycled and natural material home furnishings" },
  { name: "Compostable Disposables",    slug: "disposables",         description: "Single-use items that fully biodegrade" },
  { name: "Organic Food & Spices",      slug: "food",                description: "Certified organic food products and spices" },
];

// Ensure all default categories exist in the DB
export async function seedCategories(): Promise<void> {
  try {
    const count = await db.category.count();
    if (count > 0) return;
    for (const cat of SUSTAINABLE_CATEGORIES) {
      await db.category.create({
        data: { name: cat.name, slug: cat.slug, description: cat.description },
      });
    }
  } catch (e) {
    console.error("seedCategories failed:", e);
  }
}

// Fetch all categories with live product counts
export async function getCategories(): Promise<CategoryInfo[]> {
  try {
    // Seed first to ensure categories exist
    await seedCategories();

    const cats = await db.category.findMany({
      include: {
        _count: { select: { products: { where: { isApproved: true, isArchived: false } } } },
      },
      orderBy: { name: "asc" },
    });

    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? undefined,
      productCount: c._count.products,
    }));
  } catch (e) {
    console.error("getCategories failed, returning predefined list:", e);
    // Fallback: return static list with 0 counts
    return SUSTAINABLE_CATEGORIES.map((c, i) => ({
      id: `cat-${i}`,
      name: c.name,
      slug: c.slug,
      description: c.description,
      productCount: 0,
    }));
  }
}

// Get a single category by slug
export async function getCategoryBySlug(slug: string): Promise<CategoryInfo | null> {
  try {
    const cat = await db.category.findUnique({
      where: { slug },
      include: {
        _count: { select: { products: { where: { isApproved: true, isArchived: false } } } },
      },
    });
    if (!cat) return null;
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? undefined,
      productCount: cat._count.products,
    };
  } catch (e) {
    return null;
  }
}
