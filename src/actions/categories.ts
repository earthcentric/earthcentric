"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { verifyAdminAuth } from "@/lib/auth-server";

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

// ── Slug normalization helper ────────────────────────────────────────────────
export function normalizeCategorySlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Predefined sustainable categories (seeded into DB on first use) ──────────
export const SUSTAINABLE_CATEGORIES = [
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

// Get ALL categories (including those with 0 products) for category selection
export async function getAllCategoriesForTypeahead(): Promise<{ id: string; name: string; slug: string; description?: string; productCount: number }[]> {
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
      description: c.description ?? undefined,
      productCount: c._count.products,
    }));
  } catch (e) {
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

/**
 * Find existing category by ID, name (case-insensitive), or slug.
 * Crucially, does NOT create new categories.
 */
export async function findExistingCategory(
  identifier?: string | null
): Promise<{ id: string; name: string; slug: string; description?: string | null } | null> {
  if (!identifier || typeof identifier !== "string") return null;
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  const normalizedSlug = normalizeCategorySlug(trimmed);

  try {
    await seedCategories();

    const cat = await db.category.findFirst({
      where: {
        OR: [
          { id: trimmed },
          { name: { equals: trimmed, mode: "insensitive" } },
          { slug: normalizedSlug },
          { slug: trimmed.toLowerCase() },
        ],
      },
    });

    if (cat) {
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      };
    }
  } catch (e) {
    console.error("findExistingCategory error:", e);
  }

  // Predefined fallback lookup
  const fallback = SUSTAINABLE_CATEGORIES.find(
    (c) =>
      c.slug === normalizedSlug ||
      c.name.toLowerCase() === trimmed.toLowerCase() ||
      c.slug === trimmed.toLowerCase()
  );
  if (fallback) {
    return {
      id: `c_${fallback.slug}`,
      name: fallback.name,
      slug: fallback.slug,
      description: fallback.description,
    };
  }

  return null;
}

/**
 * Super Admin: Create a new category with explicit name, slug, and optional description.
 * Only Super Admin users can call this operation.
 */
export async function adminCreateCategory(
  data: { name: string; slug?: string; description?: string },
  adminEmail?: string
): Promise<{ success: boolean; category?: CategoryInfo; error?: string }> {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.authorized) {
      return {
        success: false,
        error: "Unauthorized: Super Admin permissions are required to create marketplace categories.",
      };
    }
    const effectiveAdminEmail = auth.email || adminEmail || "admin@earthcentric.com";

    const trimmedName = data.name?.trim();
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, error: "Category name must be at least 2 characters long." };
    }
    if (trimmedName.length > 120) {
      return { success: false, error: "Category name cannot exceed 120 characters." };
    }

    const slug = data.slug && data.slug.trim().length > 0
      ? normalizeCategorySlug(data.slug)
      : normalizeCategorySlug(trimmedName);

    if (!slug) {
      return { success: false, error: "Invalid category slug generated." };
    }

    // Check for conflict
    const conflict = await db.category.findFirst({
      where: {
        OR: [
          { name: { equals: trimmedName, mode: "insensitive" } },
          { slug },
        ],
      },
    });

    if (conflict) {
      return {
        success: false,
        error: `A category named "${conflict.name}" or with slug "/${conflict.slug}" already exists.`,
      };
    }

    const created = await db.category.create({
      data: {
        name: trimmedName,
        slug,
        description: data.description?.trim() || null,
      },
    });

    await db.auditLog.create({
      data: {
        action: "CATEGORY_CREATED",
        details: `Super Admin created category "${created.name}" (Slug: ${created.slug})`,
        adminEmail: effectiveAdminEmail,
      },
    }).catch(() => {});

    revalidatePath("/marketplace");
    revalidatePath("/api/categories");
    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");

    return {
      success: true,
      category: {
        id: created.id,
        name: created.name,
        slug: created.slug,
        description: created.description || undefined,
        productCount: 0,
      },
    };
  } catch (e: any) {
    console.error("adminCreateCategory error:", e);
    return { success: false, error: e?.message || "Failed to create category." };
  }
}

/**
 * Super Admin: Update category details including Name, URL Slug, and Description.
 */
export async function adminUpdateCategory(
  categoryId: string,
  data: { name?: string; slug?: string; description?: string },
  adminEmail?: string
): Promise<{ success: boolean; category?: CategoryInfo; error?: string }> {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.authorized) {
      return {
        success: false,
        error: "Unauthorized: Super Admin permissions are required to edit categories.",
      };
    }
    const effectiveAdminEmail = auth.email || adminEmail || "admin@earthcentric.com";

    const existing = await db.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) {
      return { success: false, error: "Category not found." };
    }

    const updatedName = data.name !== undefined ? data.name.trim() : existing.name;
    if (!updatedName || updatedName.length < 2) {
      return { success: false, error: "Category name must be at least 2 characters long." };
    }
    if (updatedName.length > 120) {
      return { success: false, error: "Category name cannot exceed 120 characters." };
    }

    const updatedSlug = data.slug !== undefined && data.slug.trim().length > 0
      ? normalizeCategorySlug(data.slug)
      : (data.name ? normalizeCategorySlug(updatedName) : existing.slug);

    if (!updatedSlug) {
      return { success: false, error: "Category slug cannot be empty." };
    }

    // Check conflict with other categories
    const conflict = await db.category.findFirst({
      where: {
        AND: [
          { id: { not: categoryId } },
          {
            OR: [
              { name: { equals: updatedName, mode: "insensitive" } },
              { slug: updatedSlug },
            ],
          },
        ],
      },
    });

    if (conflict) {
      return {
        success: false,
        error: `Another category named "${conflict.name}" or using slug "/${conflict.slug}" already exists. Use Merge instead.`,
      };
    }

    const updated = await db.category.update({
      where: { id: categoryId },
      data: {
        name: updatedName,
        slug: updatedSlug,
        ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
      },
    });

    await db.auditLog.create({
      data: {
        action: "CATEGORY_UPDATED",
        details: `Updated category "${existing.name}" → "${updated.name}" (Slug: ${updated.slug})`,
        adminEmail: effectiveAdminEmail,
      },
    }).catch(() => {});

    revalidatePath("/marketplace");
    revalidatePath("/api/categories");
    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");

    return {
      success: true,
      category: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description || undefined,
        productCount: existing._count.products,
      },
    };
  } catch (e: any) {
    console.error("adminUpdateCategory error:", e);
    return { success: false, error: e?.message || "Failed to update category." };
  }
}

/**
 * Backward compatible rename category action for Super Admin.
 */
export async function renameCategory(
  categoryId: string,
  newName: string,
  adminEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const res = await adminUpdateCategory(categoryId, { name: newName }, adminEmail);
  return { success: res.success, error: res.error };
}

/**
 * Super Admin: Merge two categories using a database transaction.
 * Moves all products referencing sourceCategoryId to targetCategoryId before deleting source.
 */
export async function mergeCategories(
  sourceCategoryId: string,
  targetCategoryId: string,
  adminEmail?: string
): Promise<{ success: boolean; movedCount?: number; error?: string }> {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.authorized) {
      return { success: false, error: "Unauthorized: Super Admin permissions required to merge categories." };
    }
    const effectiveAdminEmail = auth.email || adminEmail || "admin@earthcentric.com";

    if (sourceCategoryId === targetCategoryId) {
      return { success: false, error: "Source and target categories must be different." };
    }

    const [source, target] = await Promise.all([
      db.category.findUnique({ where: { id: sourceCategoryId } }),
      db.category.findUnique({ where: { id: targetCategoryId } }),
    ]);

    if (!source) return { success: false, error: "Source category not found." };
    if (!target) return { success: false, error: "Target category not found." };

    // Execute atomic merge inside a database transaction
    const result = await db.$transaction(async (tx) => {
      // Reassign all products
      const { count } = await tx.product.updateMany({
        where: { categoryId: sourceCategoryId },
        data: { categoryId: targetCategoryId },
      });

      // Safely delete source category
      await tx.category.delete({ where: { id: sourceCategoryId } });

      await tx.auditLog.create({
        data: {
          action: "CATEGORIES_MERGED",
          details: `Merged category "${source.name}" (${sourceCategoryId}) into "${target.name}" (${targetCategoryId}). Moved ${count} product(s).`,
          adminEmail: effectiveAdminEmail,
        },
      });

      return count;
    });

    revalidatePath("/marketplace");
    revalidatePath("/api/categories");
    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");

    return { success: true, movedCount: result };
  } catch (e: any) {
    console.error("mergeCategories error:", e);
    return { success: false, error: e?.message || "Failed to merge categories." };
  }
}

/**
 * Super Admin: Delete a category with safeguards.
 * If the category has associated products, deletion is blocked unless reassignToCategoryId is specified.
 */
export async function deleteCategory(
  categoryId: string,
  options?: { reassignToCategoryId?: string },
  adminEmail?: string
): Promise<{ success: boolean; movedCount?: number; productCount?: number; error?: string }> {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.authorized) {
      return { success: false, error: "Unauthorized: Super Admin permissions required to delete categories." };
    }
    const effectiveAdminEmail = auth.email || adminEmail || "admin@earthcentric.com";

    const category = await db.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      return { success: false, error: "Category not found." };
    }

    const productCount = category._count.products;

    // Safeguard: do not silently delete or orphan products
    if (productCount > 0) {
      if (!options?.reassignToCategoryId) {
        return {
          success: false,
          productCount,
          error: `Cannot delete "${category.name}" because it contains ${productCount} active product(s). Please reassign products to another category or merge it first.`,
        };
      }

      if (options.reassignToCategoryId === categoryId) {
        return { success: false, error: "Reassignment target cannot be the same category being deleted." };
      }

      const target = await db.category.findUnique({ where: { id: options.reassignToCategoryId } });
      if (!target) {
        return { success: false, error: "Reassignment destination category does not exist." };
      }

      // Execute safe reassignment + deletion in a transaction
      const movedCount = await db.$transaction(async (tx) => {
        const { count } = await tx.product.updateMany({
          where: { categoryId },
          data: { categoryId: options.reassignToCategoryId },
        });

        await tx.category.delete({ where: { id: categoryId } });

        await tx.auditLog.create({
          data: {
            action: "CATEGORY_DELETED_WITH_REASSIGNMENT",
            details: `Deleted category "${category.name}" (${categoryId}) and reassigned ${count} product(s) to "${target.name}".`,
            adminEmail: effectiveAdminEmail,
          },
        });

        return count;
      });

      revalidatePath("/marketplace");
      revalidatePath("/api/categories");
      revalidatePath("/admin/dashboard");
      revalidatePath("/seller/dashboard");

      return { success: true, movedCount };
    }

    // 0 products: safe to delete directly
    await db.category.delete({ where: { id: categoryId } });

    await db.auditLog.create({
      data: {
        action: "CATEGORY_DELETED",
        details: `Deleted empty category "${category.name}" (${categoryId})`,
        adminEmail: effectiveAdminEmail,
      },
    }).catch(() => {});

    revalidatePath("/marketplace");
    revalidatePath("/api/categories");
    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");

    return { success: true, movedCount: 0 };
  } catch (e: any) {
    console.error("deleteCategory error:", e);
    return { success: false, error: e?.message || "Failed to delete category." };
  }
}

/**
 * Upsert category: checks if category exists; if not, checks Super Admin authorization.
 * Non-admins cannot create categories through this or any other action.
 */
export async function upsertCategory(name: string): Promise<{ id: string; name: string; slug: string }> {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error("Category name cannot be empty.");

  const existing = await findExistingCategory(trimmed);
  if (existing) {
    return { id: existing.id, name: existing.name, slug: existing.slug };
  }

  // Reject unauthorized attempts to create new categories
  const auth = await verifyAdminAuth();
  if (!auth.authorized) {
    throw new Error(
      `Category "${trimmed}" does not exist. Only Super Admins can create new categories. Please choose an existing category.`
    );
  }

  const res = await adminCreateCategory({ name: trimmed }, auth.email);
  if (!res.success || !res.category) {
    throw new Error(res.error || "Failed to create category");
  }

  return { id: res.category.id, name: res.category.name, slug: res.category.slug };
}

/**
 * Get dynamic attribute filters for a category.
 * Parses technicalSpecs from all approved products in the category.
 */
export async function getCategoryFilters(categorySlug: string): Promise<CategoryAttribute[]> {
  try {
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

    const attrMap = new Map<string, Set<string>>();

    for (const p of products) {
      if (p.materialUsed) {
        const key = "material";
        if (!attrMap.has(key)) attrMap.set(key, new Set());
        attrMap.get(key)!.add(p.materialUsed.trim());
      }
    }

    for (const p of products) {
      const specs: string[] = (p.technicalSpecs as string[]) || [];
      for (const spec of specs) {
        const colonIdx = spec.indexOf(":");
        if (colonIdx === -1) continue;
        const rawLabel = spec.slice(0, colonIdx).trim();
        const rawValue = spec.slice(colonIdx + 1).trim();
        if (!rawLabel || !rawValue) continue;

        const key = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        if (rawValue.length > 80) continue;

        if (!attrMap.has(key)) attrMap.set(key, new Set());
        attrMap.get(key)!.add(rawValue);
      }
    }

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

    result.sort((a, b) => b.values.length - a.values.length);
    return result;
  } catch (e) {
    console.error("getCategoryFilters failed:", e);
    return [];
  }
}
