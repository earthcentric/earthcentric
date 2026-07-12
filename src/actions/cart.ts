"use server";

import db from "@/lib/db";
import { getProductById } from "./products";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  sustainabilityScore: number;
  sellerName: string;
  sellerId: string;
  moq?: number;
}

/**
 * Retrieves the database cart items for a user.
 * Creates a Cart record if none exists.
 */
export async function getDbCart(userId: string): Promise<CartItem[]> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return [];
    }

    let cart = await db.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      cart = await db.cart.create({
        data: { userId },
        include: { items: true },
      });
    }

    const items: CartItem[] = [];
    for (const item of cart.items) {
      const product = await getProductById(item.productId);
      if (product) {
        items.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images[0] || "",
          quantity: item.quantity,
          sustainabilityScore: product.sustainabilityScore,
          sellerName: product.seller.companyName,
          sellerId: product.sellerId,
          moq: product.moq,
        });
      }
    }

    return items;
  } catch (error) {
    console.error("Failed to retrieve cart from DB:", error);
    return [];
  }
}

/**
 * Adds an item to the user's database cart (increments quantity if already exists).
 */
export async function addToDbCart(userId: string, productId: string, quantity: number): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return false;
    }

    const cart = await db.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    await db.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      update: {
        quantity: { increment: quantity },
      },
      create: {
        cartId: cart.id,
        productId,
        quantity,
      },
    });

    return true;
  } catch (error) {
    console.error(`Failed to add product ${productId} to DB cart:`, error);
    return false;
  }
}

/**
 * Updates the quantity of a cart item in the database. Removes the item if quantity <= 0.
 */
export async function updateDbCartQuantity(userId: string, productId: string, quantity: number): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return false;
    }

    const cart = await db.cart.findUnique({
      where: { userId },
    });

    if (!cart) return false;

    if (quantity <= 0) {
      await db.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          productId,
        },
      });
    } else {
      await db.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId,
          },
        },
        update: { quantity },
        create: {
          cartId: cart.id,
          productId,
          quantity,
        },
      });
    }

    return true;
  } catch (error) {
    console.error(`Failed to update DB cart quantity for product ${productId}:`, error);
    return false;
  }
}

/**
 * Removes an item from the user's database cart.
 */
export async function removeFromDbCart(userId: string, productId: string): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return false;
    }

    const cart = await db.cart.findUnique({
      where: { userId },
    });

    if (!cart) return false;

    await db.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        productId,
      },
    });

    return true;
  } catch (error) {
    console.error(`Failed to remove product ${productId} from DB cart:`, error);
    return false;
  }
}

/**
 * Clears all items in the user's database cart.
 */
export async function clearDbCart(userId: string): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return false;
    }

    const cart = await db.cart.findUnique({
      where: { userId },
    });

    if (!cart) return false;

    await db.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return true;
  } catch (error) {
    console.error("Failed to clear DB cart:", error);
    return false;
  }
}

/**
 * Merges guest cart items (from local storage) into the authenticated user's database cart.
 */
export async function syncLocalCartToDb(userId: string, localItems: { id: string; quantity: number }[]): Promise<CartItem[]> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return [];
    }

    const cart = await db.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    for (const item of localItems) {
      await db.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: item.id,
          },
        },
        update: {
          quantity: { increment: item.quantity },
        },
        create: {
          cartId: cart.id,
          productId: item.id,
          quantity: item.quantity,
        },
      });
    }

    return await getDbCart(userId);
  } catch (error) {
    console.error("Failed to sync local cart to database:", error);
    return await getDbCart(userId);
  }
}
