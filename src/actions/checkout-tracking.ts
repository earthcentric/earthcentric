"use server";

import db from "@/lib/db";

export interface CartItemSnapshot {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  sellerId?: string;
}

/**
 * Returns the configurable checkout abandonment period in minutes.
 * Defaults to 30 minutes (or can be set via CHECKOUT_ABANDONMENT_MINUTES or CHECKOUT_ABANDONMENT_HOURS in .env).
 */
export async function getAbandonmentThresholdMinutes(): Promise<number> {
  if (process.env.CHECKOUT_ABANDONMENT_MINUTES) {
    const mins = parseInt(process.env.CHECKOUT_ABANDONMENT_MINUTES, 10);
    if (!isNaN(mins) && mins > 0) return mins;
  }
  if (process.env.CHECKOUT_ABANDONMENT_HOURS) {
    const hours = parseFloat(process.env.CHECKOUT_ABANDONMENT_HOURS);
    if (!isNaN(hours) && hours > 0) return Math.round(hours * 60);
  }
  return 30; // Default: 30 minutes
}

/**
 * Persists or updates an AbandonedCheckout record whenever checkout is initiated.
 */
export async function trackCheckoutInitiated(params: {
  userId: string;
  checkoutRequestId?: string;
  totalAmount: number;
  items: CartItemSnapshot[];
}) {
  try {
    const { userId, checkoutRequestId, totalAmount, items } = params;
    if (!userId || !items || items.length === 0) return;

    if (checkoutRequestId) {
      const existing = await db.abandonedCheckout.findUnique({
        where: { checkoutRequestId },
      });

      if (existing) {
        // Increment attempts and update snapshot if needed
        await db.abandonedCheckout.update({
          where: { checkoutRequestId },
          data: {
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
            totalAmount,
            cartSnapshot: items as any,
          },
        });
        return;
      }
    }

    await db.abandonedCheckout.create({
      data: {
        userId,
        checkoutRequestId: checkoutRequestId || null,
        cartSnapshot: items as any,
        totalAmount,
        checkoutStartedAt: new Date(),
        paymentStatus: "PENDING",
        attemptCount: 1,
        lastAttemptAt: new Date(),
        isAbandoned: false,
      },
    });
  } catch (error) {
    console.error("trackCheckoutInitiated error:", error);
  }
}

/**
 * Marks an AbandonedCheckout record as resolved when payment succeeds.
 * Excludes it completely from abandoned checkouts.
 */
export async function resolveAbandonedCheckout(checkoutRequestIdOrPaymentGroupId: string) {
  try {
    if (!checkoutRequestIdOrPaymentGroupId) return;

    // 1. Try finding by checkoutRequestId directly
    await db.abandonedCheckout.updateMany({
      where: {
        OR: [
          { checkoutRequestId: checkoutRequestIdOrPaymentGroupId },
        ],
      },
      data: {
        paymentStatus: "COMPLETED",
        isAbandoned: false,
        resolvedAt: new Date(),
      },
    });

    // 2. Also find any orders associated with this checkoutRequestId or paymentGroupId
    const matchingOrders = await db.order.findMany({
      where: {
        OR: [
          { checkoutRequestId: checkoutRequestIdOrPaymentGroupId },
          { paymentGroupId: checkoutRequestIdOrPaymentGroupId },
          { id: checkoutRequestIdOrPaymentGroupId },
        ],
      },
      select: { checkoutRequestId: true },
    });

    for (const ord of matchingOrders) {
      if (ord.checkoutRequestId) {
        await db.abandonedCheckout.updateMany({
          where: { checkoutRequestId: ord.checkoutRequestId },
          data: {
            paymentStatus: "COMPLETED",
            isAbandoned: false,
            resolvedAt: new Date(),
          },
        });
      }
    }
  } catch (error) {
    console.error("resolveAbandonedCheckout error:", error);
  }
}
