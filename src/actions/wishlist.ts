"use server";

import db from "@/lib/db";
import { getProductById, ProductItem } from "./products";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Non-fatal if invoked outside Next request context
  }
}

export interface WishlistItemData {
  id: string;
  productId: string;
  product: ProductItem;
  createdAt: Date;
}

/**
 * Fetch full wishlist item data for an authenticated user.
 * Runs product lookups in parallel for fast response times.
 */
export async function getWishlist(userId: string): Promise<WishlistItemData[]> {
  try {
    if (!userId) return [];

    const wishlist = await db.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!wishlist || wishlist.items.length === 0) {
      return [];
    }

    // Parallel resolution of product data
    const itemsData = await Promise.all(
      wishlist.items.map(async (item) => {
        try {
          const product = await getProductById(item.productId);
          if (!product) return null;
          return {
            id: item.id,
            productId: item.productId,
            product,
            createdAt: item.createdAt,
          };
        } catch (err) {
          console.error(`Error resolving product ${item.productId} in wishlist:`, err);
          return null;
        }
      })
    );

    return itemsData.filter(Boolean) as WishlistItemData[];
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return [];
  }
}

/**
 * Fetch full product data for guest wishlist items given their product IDs.
 */
export async function getWishlistProductsByIds(productIds: string[]): Promise<WishlistItemData[]> {
  try {
    if (!productIds || productIds.length === 0) return [];

    const itemsData = await Promise.all(
      productIds.map(async (productId) => {
        try {
          const product = await getProductById(productId);
          if (!product) return null;
          return {
            id: `guest-${productId}`,
            productId,
            product,
            createdAt: new Date(),
          };
        } catch (err) {
          console.error(`Error resolving guest product ${productId}:`, err);
          return null;
        }
      })
    );

    return itemsData.filter(Boolean) as WishlistItemData[];
  } catch (error) {
    console.error("Error fetching guest wishlist items:", error);
    return [];
  }
}

/**
 * Fetch just the wishlisted product IDs for an authenticated user.
 */
export async function getWishlistIds(userId: string): Promise<string[]> {
  try {
    if (!userId) return [];

    const wishlist = await db.wishlist.findUnique({
      where: { userId },
      include: {
        items: true,
      },
    });

    if (!wishlist) return [];
    return wishlist.items.map((item) => item.productId);
  } catch (error) {
    console.error("Error fetching wishlist IDs:", error);
    return [];
  }
}

/**
 * Toggle a product in an authenticated user's wishlist (Add if missing, Remove if present).
 * Safe against race conditions via upsert and handles non-existent users/products defensively.
 */
export async function toggleWishlist(
  userId: string,
  productId: string
): Promise<{ success: boolean; isWishlisted: boolean }> {
  try {
    if (!userId || !productId) {
      return { success: false, isWishlisted: false };
    }

    // Verify user exists in database to prevent foreign key violation
    const userExists = await db.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      console.warn(`toggleWishlist: user ${userId} does not exist in DB yet.`);
      return { success: false, isWishlisted: false };
    }

    // Verify product exists in database to prevent foreign key violation
    const productExists = await db.product.findUnique({ where: { id: productId } });
    if (!productExists) {
      console.warn(`toggleWishlist: product ${productId} does not exist in DB.`);
      return { success: false, isWishlisted: false };
    }

    // Ensure wishlist container exists for user
    const wishlist = await db.wishlist.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const existingItem = await db.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId,
        },
      },
    });

    if (existingItem) {
      // Remove it
      await db.wishlistItem.delete({
        where: { id: existingItem.id },
      });
      safeRevalidatePath("/wishlist");
      return { success: true, isWishlisted: false };
    } else {
      // Add it
      await db.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId,
        },
      });
      safeRevalidatePath("/wishlist");
      return { success: true, isWishlisted: true };
    }
  } catch (error) {
    console.error("Error toggling wishlist item:", error);
    return { success: false, isWishlisted: false };
  }
}

/**
 * Sync guest wishlist product IDs into database when user logs in or registers.
 */
export async function syncGuestWishlistToDb(
  userId: string,
  productIds: string[]
): Promise<string[]> {
  try {
    if (!userId || !productIds || productIds.length === 0) {
      return getWishlistIds(userId);
    }

    const userExists = await db.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return [];
    }

    const wishlist = await db.wishlist.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    for (const productId of productIds) {
      const productExists = await db.product.findUnique({ where: { id: productId } });
      if (!productExists) continue;

      await db.wishlistItem.upsert({
        where: {
          wishlistId_productId: {
            wishlistId: wishlist.id,
            productId,
          },
        },
        update: {},
        create: {
          wishlistId: wishlist.id,
          productId,
        },
      });
    }

    safeRevalidatePath("/wishlist");
    return getWishlistIds(userId);
  } catch (error) {
    console.error("Error syncing guest wishlist to DB:", error);
    return getWishlistIds(userId);
  }
}

/**
 * Clear all items from a user's wishlist in DB.
 */
export async function clearUserWishlist(userId: string): Promise<boolean> {
  try {
    if (!userId) return false;

    const wishlist = await db.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) return true;

    await db.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id },
    });

    safeRevalidatePath("/wishlist");
    return true;
  } catch (error) {
    console.error("Error clearing user wishlist:", error);
    return false;
  }
}
