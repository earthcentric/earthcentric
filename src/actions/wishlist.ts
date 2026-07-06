"use server";

import db from "@/lib/db";
import { getProductById, ProductItem } from "./products";

export interface WishlistItemData {
  id: string;
  productId: string;
  product: ProductItem;
  createdAt: Date;
}

export async function getWishlist(userId: string): Promise<WishlistItemData[]> {
  try {
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

    // Map items to include detailed product information
    const itemsData: WishlistItemData[] = [];
    for (const item of wishlist.items) {
      const product = await getProductById(item.productId);
      if (product) {
        itemsData.push({
          id: item.id,
          productId: item.productId,
          product,
          createdAt: item.createdAt,
        });
      }
    }

    return itemsData;
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return [];
  }
}

export async function getWishlistIds(userId: string): Promise<string[]> {
  try {
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

export async function toggleWishlist(userId: string, productId: string): Promise<{ success: boolean; isWishlisted: boolean }> {
  try {
    let wishlist = await db.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await db.wishlist.create({
        data: { userId },
      });
    }

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
      return { success: true, isWishlisted: false };
    } else {
      // Add it
      await db.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId,
        },
      });
      return { success: true, isWishlisted: true };
    }
  } catch (error) {
    console.error("Error toggling wishlist item:", error);
    return { success: false, isWishlisted: false };
  }
}
