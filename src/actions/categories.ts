"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
}

export interface CategoryAttribute {
  key: string;   // e.g. "material", "size"
  label: string; // e.g. "Material", "Size"
  values: string[]; // e.g. ["Bagasse", "Bamboo"]
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
      }).catch(() => {});
    }
  } catch (e) {
    console.error("seedCategories failed:", e);
  }
}

// Fetch all categories with live product counts
export async function getCategories(): Promise<CategoryInfo[]> {
  try {
    await seedCategories();

    const cats = await db.category.findMany({
      include: {
        _count: {
          select: {
            products: {
              where: {
                isApproved: true,
                isArchived: false,
                seller: { verificationStatus: "APPROVED" },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return cats
      .filter((c) => {
        const isPredefined = SUSTAINABLE_CATEGORIES.some(
          (sc) => sc.slug === c.slug || sc.name.toLowerCase() === c.name.toLowerCase()
        );
        // Predefined categories remain visible; custom new categories ONLY appear if approved seller has approved products
        return isPredefined || c._count.products > 0;
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? undefined,
        productCount: c._count.products,
      }));
  } catch (e) {
    console.error("getCategories failed, returning predefined list:", e);
    return SUSTAINABLE_CATEGORIES.map((c, i) => ({
      id: `cat-${i}`,
      name: c.name,
      slug: c.slug,
      description: c.description,
      productCount: 0,
    }));
  }
}

// Get ALL categories (including those with 0 products) for seller typeahead
export async function getAllCategoriesForTypeahead(): Promise<{ id: string; name: string; slug: string; productCount: number }[]> {
  try {
    await seedCategories();
    const cats = await db.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: c._count.products,
    }));
  } catch (e) {
    return SUSTAINABLE_CATEGORIES.map((c, i) => ({
      id: `cat-${i}`,
      name: c.name,
      slug: c.slug,
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

/**
 * Upsert category: returns existing if name matches (case-insensitive),
 * or creates a new one. Handles concurrent creation with retry.
 */
export async function upsertCategory(name: string): Promise<{ id: string; name: string; slug: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name cannot be empty.");
  if (trimmed.length > 120) throw new Error("Category name cannot exceed 120 characters.");

  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  // Try to find existing (case-insensitive)
  let existing = await db.category.findFirst({
    where: {
      OR: [
        { name: { equals: trimmed, mode: "insensitive" } },
        { slug },
      ],
    },
  });

  if (existing) return { id: existing.id, name: existing.name, slug: existing.slug };

  // Create — handle race condition with findFirst fallback
  try {
    const created = await db.category.create({
      data: { name: trimmed, slug },
    });
    revalidatePath("/marketplace");
    revalidatePath("/api/categories");
    return { id: created.id, name: created.name, slug: created.slug };
  } catch (err: any) {
    // Unique constraint violation — another request beat us to it
    if (err.code === "P2002") {
      const retry = await db.category.findFirst({
        where: {
          OR: [
            { name: { equals: trimmed, mode: "insensitive" } },
            { slug },
          ],
        },
      });
      if (retry) return { id: retry.id, name: retry.name, slug: retry.slug };
    }
    throw err;
  }
}

/**
 * Get dynamic attribute filters for a category.
 * Parses technicalSpecs from all approved products in the category
 * and returns aggregated key→value sets.
 */
export async function getCategoryFilters(categorySlug: string): Promise<CategoryAttribute[]> {
  try {
    // Build where clause
    const whereClause: any = {
      isApproved: true,
      isArchived: false,
    };

    if (categorySlug && categorySlug !== "all") {
      whereClause.category = {
        OR: [
          { slug: categorySlug },
          { name: { equals: categorySlug, mode: "insensitive" } },
        ],
      };
    }

    const products = await db.product.findMany({
      where: whereClause,
      select: {
        technicalSpecs: true,
        materialUsed: true,
        price: true,
      },
    });

    // Aggregate attributes from technicalSpecs (format: "Label: Value")
    const attrMap = new Map<string, Set<string>>();

    // Add material if present
    for (const p of products) {
      if (p.materialUsed) {
        const key = "material";
        if (!attrMap.has(key)) attrMap.set(key, new Set());
        attrMap.get(key)!.add(p.materialUsed.trim());
      }
    }

    // Parse technicalSpecs
    for (const p of products) {
      const specs: string[] = (p.technicalSpecs as string[]) || [];
      for (const spec of specs) {
        const colonIdx = spec.indexOf(":");
        if (colonIdx === -1) continue;
        const rawLabel = spec.slice(0, colonIdx).trim();
        const rawValue = spec.slice(colonIdx + 1).trim();
        if (!rawLabel || !rawValue) continue;

        // Normalize label to a key
        const key = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");

        // Skip pure-number values (like dimensions with numbers only) and very long ones
        if (rawValue.length > 80) continue;

        if (!attrMap.has(key)) attrMap.set(key, new Set());
        attrMap.get(key)!.add(rawValue);
      }
    }

    // Convert map to sorted array, filter out keys with <2 distinct values or >20 values (too many)
    const result: CategoryAttribute[] = [];
    for (const [key, valSet] of attrMap.entries()) {
      if (valSet.size < 2 || valSet.size > 20) continue;
      const label = key
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      result.push({
        key,
        label,
        values: Array.from(valSet).sort(),
      });
    }

    // Sort by number of distinct values (most selective first)
    result.sort((a, b) => b.values.length - a.values.length);

    return result;
  } catch (e) {
    console.error("getCategoryFilters failed:", e);
    return [];
  }
}

// ── Admin: Rename a category ─────────────────────────────────────────────────
export async function renameCategory(
  categoryId: string,
  newName: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = newName.trim();
    if (!trimmed) return { success: false, error: "Name cannot be empty." };
    if (trimmed.length > 120) return { success: false, error: "Name too long." };

    const newSlug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    // Check for conflicts
    const conflict = await db.category.findFirst({
      where: {
        AND: [
          { id: { not: categoryId } },
          {
            OR: [
              { name: { equals: trimmed, mode: "insensitive" } },
              { slug: newSlug },
            ],
          },
        ],
      },
    });
    if (conflict) {
      return { success: false, error: `A category named "${conflict.name}" already exists. Use Merge instead.` };
    }

    await db.category.update({
      where: { id: categoryId },
      data: { name: trimmed, slug: newSlug },
    });

    await db.auditLog.create({
      data: {
        action: "CATEGORY_RENAMED",
        details: `Category ${categoryId} renamed to "${trimmed}"`,
        adminEmail,
      },
    });

    revalidatePath("/marketplace");
    revalidatePath("/api/categories");
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Admin: Merge two categories (move all products from source → target) ──────
export async function mergeCategories(
  sourceCategoryId: string,
  targetCategoryId: string,
  adminEmail: string
): Promise<{ success: boolean; movedCount?: number; error?: string }> {
  try {
    if (sourceCategoryId === targetCategoryId) {
      return { success: false, error: "Source and target must be different." };
    }

    const [source, target] = await Promise.all([
      db.category.findUnique({ where: { id: sourceCategoryId } }),
      db.category.findUnique({ where: { id: targetCategoryId } }),
    ]);

    if (!source) return { success: false, error: "Source category not found." };
    if (!target) return { success: false, error: "Target category not found." };

    // Move all products
    const { count } = await db.product.updateMany({
      where: { categoryId: sourceCategoryId },
      data: { categoryId: targetCategoryId },
    });

    // Delete source
    await db.category.delete({ where: { id: sourceCategoryId } });

    await db.auditLog.create({
      data: {
        action: "CATEGORIES_MERGED",
        details: `Merged "${source.name}" (${sourceCategoryId}) into "${target.name}" (${targetCategoryId}). Moved ${count} products.`,
        adminEmail,
      },
    });

    revalidatePath("/marketplace");
    revalidatePath("/api/categories");
    revalidatePath("/admin/dashboard");
    return { success: true, movedCount: count };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
