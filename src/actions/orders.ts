"use server";

import db from "@/lib/db";
import { createCashfreeOrder, verifyPaymentSignature } from "@/lib/cashfree";
import {
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendCancellationRequestedEmail,
  sendCancellationApprovedEmail,
  sendAutoCancellationEmail,
  sendCancellationRejectedEmail,
} from "@/lib/email";
import { createNotification, createAdminNotification } from "./notifications";
import { getProductById } from "./products";
import { calculateBuyXGetYFreeItems, getEffectiveUnitPrice } from "@/lib/offers";
import { verifyAdminAuth, verifyAuthenticatedUser, verifySellerAuth } from "@/lib/auth-server";
import {
  applyCashfreeRefundWebhook,
  refreshCancellationRefund as refreshCashfreeCancellationRefund,
  retryFailedCancellationRefund,
  startCancellationRefund,
  type RefundState,
} from "@/lib/order-cancellations";

const CANCELLATION_AUTO_APPROVE_HOURS = 24;

export interface OrderItemInput {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  sellerId?: string;
}

export interface AddressInput {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderDetail {
  id: string;
  userId: string;
  sellerId?: string | null;
  seller?: {
    id: string;
    companyName: string;
    email?: string;
    phone?: string;
  };
  totalAmount: number;
  status: "PLACED" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "REFUNDED";
  createdAt: Date;
  estimatedDeliveryDate?: Date | string | null;
  deliveredAt?: Date | string | null;
  address: AddressInput;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    image: string;
    sku?: string;
    sellerId?: string;
    sellerName?: string;
    seller?: {
      id: string;
      companyName: string;
      email: string;
      phone: string;
    };
  }[];
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED";
  cancellation?: {
    id: string;
    status: string;
    reason: string;
    requestedAt: Date;
    reviewedAt?: Date | null;
    adminNote?: string | null;
    rejectionReason?: string | null;
    isAutoApproved?: boolean;
    refundStatus: RefundState;
    refundAmount?: number | null;
    cashfreeRefundReference?: string | null;
    refundArn?: string | null;
    refundError?: string | null;
  };
  cashfreeOrderId?: string;
  cashfreePaymentSessionId?: string;
  timeline: {
    status: string;
    description: string;
    createdAt: Date;
  }[];
  user?: {
    name: string;
    email: string;
    phone?: string;
    image?: string | null;
    emailVerified?: Date | null;
  };
}

// In-memory global arrays to mock order records for sandbox testing
let mockOrders: OrderDetail[] = [];

function mapLatestCancellation(cancellations?: {
  id: string;
  status: string;
  reason: string;
  requestedAt: Date;
  reviewedAt: Date | null;
  adminNote: string | null;
  rejectionReason?: string | null;
  isAutoApproved?: boolean;
  refundStatus: string;
  refundAmount: number | null;
  cashfreeRefundReference: string | null;
  refundArn: string | null;
  refundError: string | null;
}[]): OrderDetail["cancellation"] {
  const cancellation = cancellations?.[0];
  if (!cancellation) return undefined;
  return {
    id: cancellation.id,
    status: cancellation.status,
    reason: cancellation.reason,
    requestedAt: cancellation.requestedAt,
    reviewedAt: cancellation.reviewedAt,
    adminNote: cancellation.adminNote,
    rejectionReason: cancellation.rejectionReason,
    isAutoApproved: cancellation.isAutoApproved,
    refundStatus: cancellation.refundStatus as RefundState,
    refundAmount: cancellation.refundAmount,
    cashfreeRefundReference: cancellation.cashfreeRefundReference,
    refundArn: cancellation.refundArn,
    refundError: cancellation.refundError,
  };
}

export async function createOrder(data: {
  userId: string;
  userEmail: string;
  userPhone?: string;
  address: AddressInput;
  items: OrderItemInput[];
  totalAmount: number;
}) {
  const orderId = `ord-${Math.random().toString(36).substring(2, 9)}`;

  // Server-side recalculation & validation of item prices, individual product discounts, tier discounts & Buy X Get Y offers
  let serverCalculatedTotal = 0;
  const verifiedItems: OrderItemInput[] = [];

  for (const item of data.items) {
    const product = await getProductById(item.productId);
    if (!product) {
      return { success: false, error: `Product not found: ${item.name}` };
    }
    if (!product.isApproved || product.status !== "APPROVED") {
      return {
        success: false,
        error: `Cannot purchase "${product.name}". It is not currently active or approved on the marketplace.`
      };
    }
    if (product.stock !== undefined && product.stock < item.quantity) {
      return {
        success: false,
        error: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}.`
      };
    }

    const effective = getEffectiveUnitPrice(product, item.quantity);
    const unitPrice = effective.unitPrice;

    // Quantity in cart is the purchased/payable quantity. Free items are delivered at ₹0 extra cost.
    const itemTotal = Math.round(unitPrice * item.quantity * 100) / 100;
    serverCalculatedTotal += itemTotal;

    verifiedItems.push({
      ...item,
      price: unitPrice,
    });

    // Check for active Buy X Get Y promotion
    const freeQuantity = calculateBuyXGetYFreeItems(product.buyXGetYOffer, item.quantity);
    if (freeQuantity > 0) {
      verifiedItems.push({
        productId: item.productId,
        name: `${item.name} (Free Item - BXGY Offer)`,
        price: 0,
        quantity: freeQuantity,
        image: item.image,
        sellerId: item.sellerId || product.sellerId,
      });
    }
  }

  const finalTotalAmount = serverCalculatedTotal > 0 ? serverCalculatedTotal : data.totalAmount;
  if (!Number.isFinite(finalTotalAmount) || finalTotalAmount <= 0) {
    return { success: false, error: "The order total is invalid. Please refresh your cart and try again." };
  }

  // Generate Cashfree Order strictly with server-calculated payable amount
  let paymentOrder: Awaited<ReturnType<typeof createCashfreeOrder>>;
  const customerPhone = data.userPhone ? data.userPhone.replace(/\D/g, "").slice(-10) : "";
  try {
    paymentOrder = await createCashfreeOrder({
      amount: finalTotalAmount,
      orderId: orderId,
      customer: {
        id: data.userId,
        name: data.userEmail.split("@")[0],
        email: data.userEmail,
        phone: customerPhone
      }
    });
  } catch (error) {
    console.error("Cashfree order initialization failed; see sanitized Cashfree provider log.");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Cashfree could not initialize payment. Please try again.",
    };
  }

  try {
    // Group items by sellerId
    const itemsBySeller: Record<string, OrderItemInput[]> = {};
    const mockSellerId = "mock-seller-id";
    for (const item of verifiedItems) {
      const sId = item.sellerId || mockSellerId;
      if (!itemsBySeller[sId]) {
        itemsBySeller[sId] = [];
      }
      itemsBySeller[sId].push(item);
    }

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const newOrders: OrderDetail[] = [];
      Object.entries(itemsBySeller).forEach(([sellerId, items], index) => {
        const orderAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const splitOrderId = `${orderId}-${index}`;
        const newOrder: OrderDetail = {
          id: splitOrderId,
          userId: data.userId,
          totalAmount: orderAmount,
          status: "PLACED",
          createdAt: new Date(),
          address: data.address,
          items: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image: item.image,
          })),
          paymentStatus: "PENDING",
          cashfreeOrderId: paymentOrder.order_id,
          cashfreePaymentSessionId: paymentOrder.payment_session_id,
          timeline: [
            {
              status: "PLACED",
              description: "Order placed. Awaiting payment authorization.",
              createdAt: new Date(),
            },
          ],
        };
        mockOrders.push(newOrder);
        newOrders.push(newOrder);
      });
      return {
        success: true,
        order: newOrders[0],
        cashfreeOrderId: paymentOrder.order_id,
        paymentSessionId: paymentOrder.payment_session_id,
        paymentMode: paymentOrder.mode,
      };
    }

    // Ensure user exists in database before creating address
    try {
      await db.user.upsert({
        where: { id: data.userId },
        update: {
          ...(customerPhone ? { phone: customerPhone } : {}),
        },
        create: {
          id: data.userId,
          email: data.userEmail || `${data.userId}@earthcentric.com`,
          name: data.userEmail ? data.userEmail.split("@")[0] : "Customer",
          phone: customerPhone || null,
          role: "BUYER",
        },
      });
    } catch (upsertError) {
      console.warn("User upsert skipped or handled:", upsertError);
    }

    // Write to Prisma Database
    const address = await db.address.create({
      data: {
        userId: data.userId,
        street: data.address.street || (data.address as any).addressLine1 || "123 Eco Way",
        city: data.address.city || "Bengaluru",
        state: data.address.state || "Karnataka",
        postalCode: data.address.postalCode || (data.address as any).pincode || "560001",
        country: data.address.country || "India",
      },
    });

    const createdOrders = [];
    let index = 0;
    for (const [sellerId, items] of Object.entries(itemsBySeller)) {
      const orderAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const splitOrderId = `${orderId}-${index}`;
      const sId = sellerId === mockSellerId ? undefined : sellerId;

      const order = await db.order.create({
        data: {
          id: splitOrderId,
          userId: data.userId,
          addressId: address.id,
          totalAmount: orderAmount,
          status: "PLACED",
          sellerId: sId,
          paymentGroupId: paymentOrder.order_id, // Grouping multiple orders under one payment
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
          payment: {
            create: {
              cashfreeOrderId: paymentOrder.order_id,
              amount: orderAmount,
              status: "PENDING",
            },
          },
          timeline: {
            create: {
              status: "PLACED",
              description: "Order placed. Awaiting payment authorization.",
            },
          },
        },
        include: {
          items: {
            include: {
              product: {
                include: { images: true },
              },
            },
          },
          timeline: true,
        },
      });
      createdOrders.push(order);
      index++;
    }

    const firstOrder = createdOrders[0];
    const formattedOrder: OrderDetail = {
      id: firstOrder.id,
      userId: firstOrder.userId,
      totalAmount: firstOrder.totalAmount,
      status: firstOrder.status as any,
      createdAt: firstOrder.createdAt,
      address: data.address,
      items: firstOrder.items.map((it) => ({
        productId: it.productId,
        name: it.product.name,
        quantity: it.quantity,
        price: it.price,
        image: it.product.images[0]?.url || "",
      })),
      paymentStatus: "PENDING",
      cashfreeOrderId: paymentOrder.order_id,
      cashfreePaymentSessionId: paymentOrder.payment_session_id,
      timeline: firstOrder.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };

    return {
      success: true,
      order: formattedOrder,
      cashfreeOrderId: paymentOrder.order_id,
      paymentSessionId: paymentOrder.payment_session_id,
      paymentMode: paymentOrder.mode,
    };
  } catch (error) {
    console.error("Order persistence failed after Cashfree order initialization:", error);
    return {
      success: false,
      error: "The order could not be saved. Payment has not been started; please try again.",
    };
  }
}

export async function confirmOrderPayment(
  orderId: string,
  cashfreePaymentId: string,
  signature: string,
  userEmail: string
): Promise<boolean> {
  // 1. Verify Signature
  let cashfreeOrderId = "";
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    const order = mockOrders.find((o) => o.id === orderId);
    cashfreeOrderId = order ? order.cashfreeOrderId || "" : "";
  } else {
    try {
      const dbPayment = await db.payment.findFirst({
        where: { orderId: orderId },
        select: { cashfreeOrderId: true },
      });
      cashfreeOrderId = dbPayment?.cashfreeOrderId || "";
    } catch (e) {
      console.warn("Failed to retrieve payment from database, checking mock:", e);
      const order = mockOrders.find((o) => o.id === orderId);
      cashfreeOrderId = order ? order.cashfreeOrderId || "" : "";
    }
  }

  const isValid = await verifyPaymentSignature(cashfreeOrderId);

  if (!isValid) {
    console.error("Signature verification failed for order", orderId, "with cashfreeOrderId", cashfreeOrderId);
    return false;
  }

  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      mockOrders = mockOrders.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            status: "CONFIRMED",
            paymentStatus: "COMPLETED",
            timeline: [
              ...o.timeline,
              {
                status: "CONFIRMED",
                description: "Payment confirmed. Order sent to supplier fulfillment queue.",
                createdAt: new Date(),
              },
            ],
          };
        }
        return o;
      });

      const updated = mockOrders.find((o) => o.id === orderId);
      if (updated) {
        const mockAddr = updated.address;
        await sendOrderConfirmationEmail(userEmail, orderId, updated.totalAmount, {
          buyerName: (updated as any).user?.name || undefined,
          placedAt: updated.createdAt,
          items: (updated.items || []).map((it: any) => ({
            name: it.name,
            quantity: it.quantity,
            price: it.price,
            image: it.image || undefined,
            sellerName: it.seller?.companyName || undefined,
          })),
          shippingAddress: mockAddr
            ? {
                street: mockAddr.street,
                city: mockAddr.city,
                state: mockAddr.state,
                postalCode: mockAddr.postalCode,
                country: mockAddr.country,
              }
            : undefined,
          paymentMethod: "Cashfree",
        });
      }
      return true;
    }

    // Update in DB (update all payments associated with this Cashfree Order ID)
    await db.payment.updateMany({
      where: { cashfreeOrderId: cashfreeOrderId },
      data: {
        cashfreePaymentId,
        cashfreeSignature: signature,
        status: "COMPLETED",
      },
    });

    // Find all orders in this payment group
    const dbOrders = await db.order.findMany({
      where: { paymentGroupId: cashfreeOrderId },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        cancellations: {
          where: { status: "APPROVED" },
          orderBy: { requestedAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    
    const ordersToUpdate = dbOrders.length > 0 ? dbOrders : [{ id: orderId, totalAmount: 0 }];

    for (const ord of ordersToUpdate) {
      if ("status" in ord && (ord.status === "CANCELLED" || ord.status === "REFUNDED")) {
        if (ord.cancellations[0]) {
          await startCancellationRefund(ord.cancellations[0].id);
        }
        continue;
      }

      await db.order.updateMany({
        where: { id: ord.id, status: { notIn: ["CANCELLED", "REFUNDED"] } },
        data: { status: "CONFIRMED" },
      });

      await db.orderTimeline.create({
        data: {
          orderId: ord.id,
          status: "CONFIRMED",
          description: "Payment confirmed. Order sent to supplier fulfillment queue.",
        },
      });
    }

    const dbOrder = await db.order.findUnique({
      where: { id: orderId },
      include: {
        address: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                images: {
                  take: 1,
                },
                seller: {
                  select: {
                    companyName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (dbOrder?.userId) {
      await createNotification(
        dbOrder.userId,
        "Order Booked & Confirmed ✅",
        `Your order ${orderId} has been confirmed and sent to fulfillment!`,
        `/orders/${orderId}`
      ).catch((e) => console.error("Failed to create notification:", e));
    }

    const buyerName = dbOrder?.user?.name || undefined;
    const orderAddress = dbOrder?.address;

    await sendOrderConfirmationEmail(userEmail, orderId, dbOrder?.totalAmount || 0, {
      buyerName,
      placedAt: dbOrder?.createdAt,
      items: (dbOrder?.items || []).map((it) => ({
        name: it.product?.name || "Product",
        quantity: it.quantity,
        price: it.price,
        image: it.product?.images?.[0]?.url || undefined,
        sellerName: it.product?.seller?.companyName || undefined,
      })),
      shippingAddress: orderAddress
        ? {
            street: orderAddress.street,
            city: orderAddress.city,
            state: orderAddress.state,
            postalCode: orderAddress.postalCode,
            country: orderAddress.country,
          }
        : undefined,
      paymentMethod: "Cashfree",
    });
    return true;
  } catch (error) {
    console.error("Failed to update database payment confirmation, updating mock:", error);
    mockOrders = mockOrders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          status: "CONFIRMED",
          paymentStatus: "COMPLETED",
          timeline: [
            ...o.timeline,
            {
              status: "CONFIRMED",
              description: "Payment confirmed. Order sent to supplier fulfillment queue.",
              createdAt: new Date(),
            },
          ],
        };
      }
      return o;
    });
    return true;
  }
}

export async function getOrderById(orderId: string): Promise<OrderDetail | null> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  try {
    if (isMock) {
      return mockOrders.find((o) => o.id === orderId) || null;
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        address: true,
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
        payment: true,
        cancellations: { orderBy: { requestedAt: "desc" }, take: 1 },
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) return null;
    const auth = await verifyAuthenticatedUser();
    const isAdmin = auth.authorized && (auth.role === "ADMIN" || (await verifyAdminAuth()).authorized);
    const isOrderSeller =
      auth.authorized &&
      auth.role === "SELLER" &&
      (auth.sellerId === order.sellerId ||
        order.items.some((item) => item.product.sellerId === auth.sellerId));
    if (!auth.authorized || (!isAdmin && auth.userId !== order.userId && !isOrderSeller)) {
      return null;
    }

    return {
      id: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      status: order.status as any,
      createdAt: order.createdAt,
      address: {
        street: order.address.street,
        city: order.address.city,
        state: order.address.state,
        postalCode: order.address.postalCode,
        country: order.address.country,
      },
      items: order.items.map((it) => ({
        productId: it.productId,
        name: it.product.name,
        quantity: it.quantity,
        price: it.price,
        image: it.product.images[0]?.url || "",
      })),
      paymentStatus: (order.payment?.status as any) || "PENDING",
      cancellation: mapLatestCancellation(order.cancellations),
      ...(order.payment?.cashfreeOrderId ? { cashfreeOrderId: order.payment.cashfreeOrderId } : {}),
      timeline: order.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  } catch (e) {
    console.error("getOrderById failed:", e);
    return null;
  }
}

export async function getOrdersByUser(userId: string): Promise<OrderDetail[]> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (!isMock) {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || auth.userId !== userId) {
      throw new Error("You can only view orders belonging to your signed-in account.");
    }
  }
  try {
    if (isMock) {
      return mockOrders
        .filter((o) => o.userId === userId && o.paymentStatus === "COMPLETED")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const dbOrders = await db.order.findMany({
      where: {
        userId,
        payment: {
          status: "COMPLETED",
        },
      },
      include: {
        address: true,
        items: {
          include: {
            product: {
              include: {
                images: true,
                seller: { select: { id: true, companyName: true } },
              },
            },
          },
        },
        payment: true,
        cancellations: { orderBy: { requestedAt: "desc" }, take: 1 },
        timeline: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return dbOrders.map((order) => {
      const deliveredEvent = order.timeline.find((t) => t.status === "DELIVERED");
      return {
        id: order.id,
        userId: order.userId,
        totalAmount: order.totalAmount,
        status: order.status as any,
        createdAt: order.createdAt,
        estimatedDeliveryDate: new Date(new Date(order.createdAt).getTime() + 4 * 24 * 60 * 60 * 1000),
        deliveredAt: deliveredEvent?.createdAt || null,
        address: {
          street: order.address.street,
          city: order.address.city,
          state: order.address.state,
          postalCode: order.address.postalCode,
          country: order.address.country,
        },
        items: order.items.map((it) => ({
          productId: it.productId,
          name: it.product.name,
          quantity: it.quantity,
          price: it.price,
          image: it.product.images[0]?.url || "",
          sku: it.product.slug || it.productId.slice(0, 8).toUpperCase(),
          sellerId: it.product.sellerId,
          sellerName: it.product.seller?.companyName || "EarthCentric Partner",
        })),
        paymentStatus: (order.payment?.status as any) || "PENDING",
        cancellation: mapLatestCancellation(order.cancellations),
        ...(order.payment?.cashfreeOrderId ? { cashfreeOrderId: order.payment.cashfreeOrderId } : {}),
        timeline: order.timeline.map((t) => ({
          status: t.status,
          description: t.description,
          createdAt: t.createdAt,
        })),
      };
    });
  } catch (e) {
    console.error("getOrdersByUser failed:", e);
    throw new Error("Could not retrieve your orders. Please try again.");
  }
}

export async function updateOrderStatus(orderId: string, status: OrderDetail["status"], description: string, buyerEmail?: string) {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (status === "CANCELLED" || status === "REFUNDED") {
      console.warn("Cancellation and refund statuses must use the cancellation workflow.");
      return false;
    }

    if (isMock) {
      let updatedOrder: OrderDetail | undefined;
      mockOrders = mockOrders.map((o) => {
        if (o.id === orderId) {
          if (o.status === status || o.status === "CANCELLED" || o.status === "REFUNDED") {
            updatedOrder = o;
            return o;
          }
          updatedOrder = {
            ...o,
            status,
            timeline: [...o.timeline, { status, description, createdAt: new Date() }],
          };
          return {
            ...updatedOrder,
          };
        }
        return o;
      });
      if (!updatedOrder) return false;

      if (updatedOrder !== mockOrders.find((o) => o.id === orderId) && buyerEmail) {
        if (status === "CONFIRMED") {
          const ord = mockOrders.find((o) => o.id === orderId);
          if (ord) {
            const mockAddr = ord.address;
            await sendOrderConfirmationEmail(buyerEmail, orderId, ord.totalAmount, {
              buyerName: (ord as any).user?.name || undefined,
              placedAt: ord.createdAt,
              items: (ord.items || []).map((it: any) => ({
                name: it.name,
                quantity: it.quantity,
                price: it.price,
                image: it.image || undefined,
                sellerName: it.seller?.companyName || undefined,
              })),
              shippingAddress: mockAddr
                ? {
                    street: mockAddr.street,
                    city: mockAddr.city,
                    state: mockAddr.state,
                    postalCode: mockAddr.postalCode,
                    country: mockAddr.country,
                  }
                : undefined,
            }).catch((err) => console.error("Failed to send mock order confirmation email:", err));
          }
        } else {
          await sendOrderStatusEmail(buyerEmail, orderId, status, description).catch((err) =>
            console.error("Failed to send order status email:", err)
          );
        }
      }
      return true;
    }

    const adminAuth = await verifyAdminAuth();
    const sellerAuth = adminAuth.authorized ? null : await verifySellerAuth();
    if (!adminAuth.authorized && !sellerAuth?.authorized) return false;

    let emailToSend = buyerEmail;
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true } },
        seller: { select: { id: true, userId: true, verificationStatus: true } },
        items: { include: { product: { select: { sellerId: true } } } },
      },
    });
    if (!order || order.status === "CANCELLED" || order.status === "REFUNDED") return false;

    if (!adminAuth.authorized) {
      let resolvedSellerId = sellerAuth?.sellerId;
      if (!resolvedSellerId && sellerAuth?.userId) {
        const s = await db.seller.findUnique({ where: { userId: sellerAuth.userId } });
        if (s) resolvedSellerId = s.id;
      }

      const matchesSeller =
        order.sellerId === resolvedSellerId ||
        order.seller?.id === resolvedSellerId ||
        order.seller?.userId === sellerAuth?.userId ||
        order.items.some((item) => item.product.sellerId === resolvedSellerId || item.product.sellerId === sellerAuth?.userId);

      const sellerProfile = resolvedSellerId
        ? await db.seller.findUnique({
            where: { id: resolvedSellerId },
            select: { verificationStatus: true },
          })
        : (sellerAuth?.userId
          ? await db.seller.findUnique({
              where: { userId: sellerAuth.userId },
              select: { verificationStatus: true },
            })
          : null);

      if (!matchesSeller || sellerProfile?.verificationStatus !== "APPROVED") {
        console.warn("Seller mismatch or not approved in updateOrderStatus:", { matchesSeller, verificationStatus: sellerProfile?.verificationStatus });
        return false;
      }

      const nextSellerStatus: Partial<Record<OrderDetail["status"], OrderDetail["status"]>> = {
        PLACED: "CONFIRMED",
        CONFIRMED: "PACKED",
        PACKED: "SHIPPED",
        SHIPPED: "DELIVERED",
      };
      if (nextSellerStatus[order.status as OrderDetail["status"]] !== status) {
        console.warn(`Invalid status transition for order ${orderId}: current=${order.status}, requested=${status}, expected=${nextSellerStatus[order.status as OrderDetail["status"]]}`);
        return false;
      }
    }

    if (order.status === status) return true;
    if (!emailToSend) {
      emailToSend = order?.user?.email;
    }

    await db.$transaction([
      db.order.update({
        where: { id: orderId },
        data: { status },
      }),
      db.orderTimeline.create({
        data: {
          orderId,
          status,
          description,
        },
      }),
    ]);

    // Send order confirmation or status alert email
    if (emailToSend) {
      if (status === "CONFIRMED") {
        const fullOrder = await db.order.findUnique({
          where: { id: orderId },
          include: {
            address: true,
            user: { select: { name: true, email: true } },
            items: {
              include: {
                product: {
                  include: {
                    images: { take: 1 },
                    seller: { select: { companyName: true } },
                  },
                },
              },
            },
          },
        });
        if (fullOrder) {
          await sendOrderConfirmationEmail(emailToSend, orderId, fullOrder.totalAmount, {
            buyerName: fullOrder.user?.name || undefined,
            placedAt: fullOrder.createdAt,
            items: fullOrder.items.map((it) => ({
              name: it.product?.name || "Product",
              quantity: it.quantity,
              price: it.price,
              image: it.product?.images?.[0]?.url || undefined,
              sellerName: it.product?.seller?.companyName || undefined,
            })),
            shippingAddress: fullOrder.address
              ? {
                  street: fullOrder.address.street,
                  city: fullOrder.address.city,
                  state: fullOrder.address.state,
                  postalCode: fullOrder.address.postalCode,
                  country: fullOrder.address.country,
                }
              : undefined,
            paymentMethod: "Online Payment",
          }).catch((err) => console.error("Failed to send order confirmation email:", err));
        }
      } else {
        await sendOrderStatusEmail(emailToSend, orderId, status, description).catch((err) =>
          console.error("Failed to send order status email:", err)
        );
      }
    }
    
    // Send Notification to Buyer
    if (order?.user?.id) {
      await createNotification(order.user.id, `Order ${status}`, `Your order ${orderId} is now ${status}. ${description}`, `/orders`);
    }

    return true;
  } catch (e) {
    console.error("updateOrderStatus failed:", e);
    return false;
  }
}

export async function getOrdersBySeller(sellerIdOrUserId: string): Promise<OrderDetail[]> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (!isMock) {
    const auth = await verifySellerAuth();
    if (!auth.authorized) {
      throw new Error("Seller sign-in is required to view seller orders.");
    }
    if (auth.sellerId && auth.sellerId !== sellerIdOrUserId && auth.userId !== sellerIdOrUserId) {
      throw new Error("You can only view orders for your own seller account.");
    }
  }
  try {
    if (isMock) {
      // In mock mode, initialize sample orders if mockOrders is empty
      if (mockOrders.length === 0) {
        mockOrders = [
          {
            id: "ord-8834a",
            userId: "buyer-1",
            user: { name: "Harshavardhan Sharma", email: "harsha.sharma@gmail.com", phone: "+91 98765 43210" },
            totalAmount: 1899,
            status: "CONFIRMED",
            createdAt: new Date(Date.now() - 3600000 * 4),
            address: { street: "12 Baker St", city: "London", state: "Greater London", postalCode: "NW1 6XE", country: "UK" },
            items: [{ productId: "p1", name: "Organic Cotton Classic Tee", quantity: 1, price: 1899, image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=100&auto=format&fit=crop&q=80" }],
            paymentStatus: "COMPLETED",
            timeline: [],
          },
          {
            id: "ord-4921b",
            userId: "buyer-2",
            user: { name: "Aarav Patel", email: "aarav.patel@yahoo.com", phone: "+91 98123 45678" },
            totalAmount: 4198,
            status: "PLACED",
            createdAt: new Date(Date.now() - 3600000 * 2),
            address: { street: "44 MG Road", city: "Bangalore", state: "Karnataka", postalCode: "560001", country: "India" },
            items: [
              { productId: "p2", name: "Zero-Waste Bamboo Cutlery Set", quantity: 1, price: 699, image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=100&auto=format&fit=crop&q=80" },
              { productId: "p3", name: "Solar Powered Portable Charger", quantity: 1, price: 3499, image: "https://images.unsplash.com/photo-1620286127226-a36113702e51?w=100&auto=format&fit=crop&q=80" }
            ],
            paymentStatus: "PENDING",
            timeline: [],
          }
        ];
      }
      return mockOrders.filter((o) => o.paymentStatus === "COMPLETED");
    }

    // Resolve seller ID candidate keys
    let seller = await db.seller.findUnique({ where: { id: sellerIdOrUserId } });
    if (!seller) {
      seller = await db.seller.findUnique({ where: { userId: sellerIdOrUserId } });
    }
    
    const candidateSellerIds = Array.from(
      new Set([sellerIdOrUserId, seller?.id, seller?.userId].filter(Boolean) as string[])
    );

    const dbOrders = await db.order.findMany({
      where: {
        payment: {
          status: "COMPLETED",
        },
        OR: [
          { sellerId: { in: candidateSellerIds } },
          {
            items: {
              some: {
                product: {
                  sellerId: { in: candidateSellerIds },
                },
              },
            },
          },
        ],
      },
      include: {
        address: true,
        user: { select: { id: true, name: true, email: true, phone: true, image: true, emailVerified: true } },
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
        payment: true,
        cancellations: { orderBy: { requestedAt: "desc" }, take: 1 },
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return dbOrders.map((order) => ({
      id: order.id,
      userId: order.userId,
      user: order.user ? {
        name: order.user.name || "Customer",
        email: order.user.email || "",
        phone: order.user.phone || "",
        image: order.user.image,
        emailVerified: order.user.emailVerified,
      } : undefined,
      totalAmount: order.totalAmount,
      status: order.status as any,
      createdAt: order.createdAt,
      address: {
        street: order.address.street,
        city: order.address.city,
        state: order.address.state,
        postalCode: order.address.postalCode,
        country: order.address.country,
      },
      items: order.items.map((it) => ({
        productId: it.productId,
        name: it.product.name,
        quantity: it.quantity,
        price: it.price,
        image: it.product.images[0]?.url || "",
      })),
      paymentStatus: (order.payment?.status as any) || "PENDING",
      cancellation: mapLatestCancellation(order.cancellations),
      ...(order.payment?.cashfreeOrderId ? { cashfreeOrderId: order.payment.cashfreeOrderId } : {}),
      timeline: order.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    }));
  } catch (e) {
    console.error("getOrdersBySeller failed:", e);
    throw new Error("Could not retrieve seller orders. Please try again.");
  }
}

export async function getAllOrdersForAdmin(): Promise<OrderDetail[]> {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
    const auth = await verifyAdminAuth();
    if (!auth.authorized) throw new Error("Super Admin access is required to view all orders.");
  }
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      if (mockOrders.length === 0) {
        await getOrdersBySeller("seller-1");
      }
      return mockOrders.filter((order) => order.paymentStatus === "COMPLETED");
    }

    const dbOrders = await db.order.findMany({
      where: {
        payment: { is: { status: "COMPLETED" } },
      },
      include: {
        address: true,
        user: { select: { name: true, email: true } },
        seller: {
          select: {
            id: true,
            companyName: true,
            phone: true,
            user: { select: { email: true } },
          },
        },
        items: {
          include: {
            product: {
              include: {
                images: true,
                seller: {
                  include: {
                    user: { select: { email: true } }
                  }
                }
              },
            },
          },
        },
        payment: true,
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return dbOrders.map((order) => {
      const primaryItemSeller = order.items.find((it) => it.product?.seller)?.product?.seller;
      const resolvedSeller = order.seller ? {
        id: order.seller.id,
        companyName: order.seller.companyName,
        email: order.seller.user?.email || "",
        phone: order.seller.phone || "Not provided",
      } : (primaryItemSeller ? {
        id: primaryItemSeller.id,
        companyName: primaryItemSeller.companyName,
        email: primaryItemSeller.user?.email || "",
        phone: primaryItemSeller.phone || "Not provided",
      } : undefined);

      return {
        id: order.id,
        userId: order.userId,
        sellerId: order.sellerId || resolvedSeller?.id || null,
        seller: resolvedSeller,
        totalAmount: order.totalAmount,
        status: order.status as any,
        createdAt: order.createdAt,
        address: {
          street: order.address.street,
          city: order.address.city,
          state: order.address.state,
          postalCode: order.address.postalCode,
          country: order.address.country,
        },
        items: order.items.map((it) => ({
          productId: it.productId,
          name: it.product.name,
          quantity: it.quantity,
          price: it.price,
          image: it.product.images[0]?.url || "",
          seller: it.product?.seller ? {
            id: it.product.seller.id,
            companyName: it.product.seller.companyName,
            email: it.product.seller.user?.email || "",
            phone: it.product.seller.phone || "Not provided",
          } : resolvedSeller,
        })),
        paymentStatus: (order.payment?.status as any) || "PENDING",
        ...(order.payment?.cashfreeOrderId ? { cashfreeOrderId: order.payment.cashfreeOrderId } : {}),
        timeline: order.timeline.map((t) => ({
          status: t.status,
          description: t.description,
          createdAt: t.createdAt,
        })),
        user: {
          name: order.user?.name || "Anonymous User",
          email: order.user?.email || "unknown@email.com",
        }
      };
    });
  } catch (e) {
    console.error("Failed to fetch all orders for admin:", e);
    throw new Error("Could not retrieve platform orders. Please try again.");
  }
}

async function createCancellationRequest(
  orderId: string,
  reason: string,
  requester: { userId: string; email: string; role: string; sellerId?: string }
): Promise<{ success: boolean; error?: string; cancellationId?: string; autoApproved?: boolean }> {
  try {
    const cleanedReason = reason.trim();
    if (cleanedReason.length < 8 || cleanedReason.length > 500) {
      return { success: false, error: "Please provide a cancellation reason between 8 and 500 characters." };
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        seller: { select: { id: true, userId: true, companyName: true } },
        user: { select: { id: true, name: true, email: true } },
        payment: { select: { status: true, amount: true, cashfreeOrderId: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sellerId: true,
                images: { take: 1, select: { url: true } },
                seller: { select: { id: true, companyName: true } },
              },
            },
          },
        },
        cancellations: {
          where: { status: { in: ["REQUESTED", "APPROVED"] } },
          select: { id: true, status: true },
        },
      },
    });
    if (!order) return { success: false, error: "Order not found." };

    if (order.status === "SHIPPED" || order.status === "DELIVERED") {
      return { success: false, error: "This order cannot be cancelled because it has already been shipped." };
    }
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return { success: false, error: "This order has already been cancelled." };
    }
    if (!["PLACED", "CONFIRMED", "PACKED"].includes(order.status)) {
      return { success: false, error: "Cancellation is only available before shipment." };
    }
    if (order.cancellations.length > 0) {
      return { success: false, error: "An active cancellation request already exists for this order." };
    }

    if (requester.role === "SELLER") {
      const belongsToSeller =
        requester.sellerId === order.seller?.id ||
        requester.userId === order.seller?.userId ||
        order.items.some((item) => item.product.sellerId === requester.sellerId);
      if (!belongsToSeller) {
        return { success: false, error: "You can only request cancellation for your own seller orders." };
      }
    } else if (requester.role === "BUYER" && requester.userId !== order.userId) {
      return { success: false, error: "You can only request cancellation for your own order." };
    }

    // Check order age against configurable 24-hour cutoff
    const orderCreatedAt = new Date(order.createdAt).getTime();
    const ageHours = (Date.now() - orderCreatedAt) / (1000 * 60 * 60);
    const isAutoApproved = ageHours <= CANCELLATION_AUTO_APPROVE_HOURS;

    const snapshotItems = order.items.map((it) => ({
      productId: it.productId,
      name: it.product?.name || "Product",
      quantity: it.quantity,
      price: it.price,
      image: it.product?.images?.[0]?.url || "",
      sellerId: it.product?.sellerId,
      sellerName: it.product?.seller?.companyName,
    }));

    if (isAutoApproved) {
      // CASE A: Within first 24 hours -> Automatically approved by backend
      const refundStatus: RefundState =
        order.payment?.status === "COMPLETED"
          ? "PENDING"
          : order.payment?.status === "PENDING"
            ? "PENDING_PAYMENT"
            : "NOT_REQUIRED";

      const cancellation = await db.$transaction(async (tx) => {
        const record = await tx.orderCancellation.create({
          data: {
            orderId,
            activeOrderId: orderId,
            requestedByUserId: requester.userId,
            requestedByEmail: requester.email,
            requestedByRole: requester.role,
            reason: cleanedReason,
            status: "APPROVED",
            isAutoApproved: true,
            adminNote: "Automatically approved under 24-hour pre-shipment policy.",
            reviewedAt: new Date(),
            reviewedByUserId: "SYSTEM_AUTO_POLICY",
            reviewedByEmail: "system@earthcentric.com",
            refundStatus,
            refundAmount: order.totalAmount,
            snapshotItems,
          },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: "CANCELLED" },
        });
        await tx.orderTimeline.create({
          data: {
            orderId,
            status: "CANCELLED",
            description: `Order automatically cancelled within 24 hours per policy. Reason: ${cleanedReason}. Refund initiated.`,
          },
        });
        return record;
      });

      // Initiate refund through gateway if payment was completed
      if (order.payment?.status === "COMPLETED") {
        await startCancellationRefund(cancellation.id).catch((err) =>
          console.error("Auto cancellation start refund error:", err)
        );
      }

      // EMAIL 4 — AUTOMATIC CANCELLATION WITHIN 24 HOURS
      await sendAutoCancellationEmail(requester.email, {
        orderId,
        customerName: order.user?.name || undefined,
        items: snapshotItems,
        refundAmount: order.totalAmount,
        cancelDate: new Date(),
      }).catch((err) => console.error("Auto cancellation email error:", err));

      // Notifications
      await createNotification(
        order.userId,
        "Order Cancelled ⚡",
        `Your order ${orderId} has been cancelled per our 24-hour policy. Refund of ₹${order.totalAmount.toLocaleString("en-IN")} initiated.`,
        `/orders/${orderId}`
      ).catch((e) => console.error("Notification error:", e));

      await createAdminNotification(
        "Order Auto-Cancelled (24h Policy)",
        `Order ${orderId} was automatically cancelled within 24 hours. Reason: ${cleanedReason}`,
        "cancellations"
      ).catch((e) => console.error("Admin notification error:", e));

      return { success: true, autoApproved: true, cancellationId: cancellation.id };
    } else {
      // CASE B: Older than 24 hours -> Pending Super Admin review
      const cancellation = await db.$transaction(async (tx) => {
        const record = await tx.orderCancellation.create({
          data: {
            orderId,
            activeOrderId: orderId,
            requestedByUserId: requester.userId,
            requestedByEmail: requester.email,
            requestedByRole: requester.role,
            reason: cleanedReason,
            status: "REQUESTED",
            isAutoApproved: false,
            refundStatus: order.payment?.status === "COMPLETED" ? "PENDING" : "PENDING_PAYMENT",
            refundAmount: order.totalAmount,
            snapshotItems,
          },
        });
        await tx.orderTimeline.create({
          data: {
            orderId,
            status: order.status,
            description: `${requester.role === "SELLER" ? "Seller" : "Buyer"} requested cancellation. Reason: ${cleanedReason}. Awaiting Super Admin review.`,
          },
        });
        return record;
      });

      // EMAIL 2 — CANCELLATION REQUEST RECEIVED
      await sendCancellationRequestedEmail(requester.email, {
        orderId,
        customerName: order.user?.name || undefined,
        items: snapshotItems,
        refundAmount: order.totalAmount,
        requestDate: new Date(),
      }).catch((err) => console.error("Cancellation requested email error:", err));

      const requesterLabel = requester.role === "SELLER" ? "Seller" : "Buyer";
      await createNotification(
        order.userId,
        "Cancellation request received ⏳",
        `Cancellation requested for order ${orderId}. Our team will review your request and provide a decision within 24–48 hours.`,
        `/orders/${orderId}`
      ).catch((e) => console.error("Notification error:", e));

      await createAdminNotification(
        "Order cancellation needs review",
        `${requesterLabel} requested cancellation for order ${orderId}. Reason: ${cleanedReason}`,
        "cancellations"
      ).catch((e) => console.error("Admin alert error:", e));

      return { success: true, autoApproved: false, cancellationId: cancellation.id };
    }
  } catch (e) {
    console.error("createCancellationRequest failed:", e);
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      e.code === "P2002"
    ) {
      return { success: false, error: "An active cancellation request already exists for this order." };
    }
    return { success: false, error: "Failed to submit the cancellation request." };
  }
}

export async function requestOrderCancellation(orderId: string, reason: string) {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    return { success: false, error: "Cancellation review and refunds require the configured database and Cashfree account." };
  }
  const auth = await verifySellerAuth();
  if (!auth.authorized || !auth.userId || !auth.sellerId) {
    return { success: false, error: "Sign in with an approved seller account to request cancellation." };
  }
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, role: true },
  });
  if (!user || user.role !== "SELLER") {
    return { success: false, error: "A verified seller account is required." };
  }
  return createCancellationRequest(orderId, reason, {
    userId: auth.userId,
    email: user.email,
    role: "SELLER",
    sellerId: auth.sellerId,
  });
}

export async function cancelOrder(orderId: string, userId: string, reason?: string) {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    return { success: false, error: "Cancellation review requires the configured database." };
  }
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || auth.userId !== userId || !auth.email) {
    return { success: false, error: "Sign in to the account that placed this order." };
  }
  // Allow any logged-in user to cancel their own personal order
  return createCancellationRequest(orderId, reason || "Buyer requested cancellation.", {
    userId: auth.userId,
    email: auth.email,
    role: "BUYER",
  });
}

export async function getOrderCancellationsForAdmin(filterStatus?: string) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) return [];
  const auth = await verifyAdminAuth();
  if (!auth.authorized) throw new Error("Super Admin access is required to review cancellations.");

  let whereClause: any = {};
  if (filterStatus === "PENDING" || filterStatus === "REQUESTED") {
    whereClause = { status: "REQUESTED" };
  } else if (filterStatus === "APPROVED") {
    whereClause = { status: "APPROVED" };
  } else if (filterStatus === "REJECTED") {
    whereClause = { status: "REJECTED" };
  } else if (filterStatus === "REFUND_PROCESSING") {
    whereClause = { refundStatus: { in: ["PENDING", "PENDING_PAYMENT"] } };
  } else if (filterStatus === "REFUNDED") {
    whereClause = { refundStatus: "SUCCESS" };
  } else if (filterStatus === "REFUND_FAILED") {
    whereClause = { refundStatus: "FAILED" };
  }

  return db.orderCancellation.findMany({
    where: whereClause,
    include: {
      order: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          seller: { select: { id: true, companyName: true, phone: true } },
          payment: true,
          address: true,
          items: {
            include: {
              product: {
                include: {
                  images: { take: 1 },
                  seller: { select: { id: true, companyName: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { status: "asc" },
      { requestedAt: "desc" },
    ],
  });
}

export async function getSellerCancelledOrders(sellerIdOrUserId: string) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) return [];

  const auth = await verifySellerAuth();
  if (!auth.authorized) {
    throw new Error("Seller access required to view cancelled orders.");
  }

  // Resolve seller ID
  let seller = await db.seller.findUnique({ where: { id: sellerIdOrUserId } });
  if (!seller) {
    seller = await db.seller.findUnique({ where: { userId: sellerIdOrUserId } });
  }
  const candidateIds = Array.from(new Set([sellerIdOrUserId, seller?.id, seller?.userId].filter(Boolean) as string[]));

  // Orders that either have a cancellation record OR are in CANCELLED/REFUNDED status
  const orders = await db.order.findMany({
    where: {
      OR: [
        { sellerId: { in: candidateIds } },
        { items: { some: { product: { sellerId: { in: candidateIds } } } } },
      ],
      AND: [
        {
          OR: [
            { status: { in: ["CANCELLED", "REFUNDED"] } },
            { cancellations: { some: {} } },
          ],
        },
      ],
    },
    include: {
      user: { select: { name: true, email: true } },
      address: { select: { city: true, state: true } },
      items: {
        include: {
          product: {
            include: {
              images: { take: 1 },
            },
          },
        },
      },
      payment: true,
      cancellations: {
        orderBy: { requestedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => {
    // Only include items belonging to this seller
    const sellerItems = o.items.filter(
      (it) => candidateIds.includes(it.product.sellerId) || candidateIds.includes(o.sellerId || "")
    );
    const sellerSubtotal = sellerItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
    const latestCancellation = o.cancellations[0];

    return {
      orderId: o.id,
      orderCreatedAt: o.createdAt,
      orderStatus: o.status,
      totalAmount: o.totalAmount,
      sellerSubtotal,
      sellerItems: sellerItems.map((it) => ({
        productId: it.productId,
        name: it.product.name,
        image: it.product.images[0]?.url || "",
        price: it.price,
        quantity: it.quantity,
      })),
      cancellation: latestCancellation
        ? {
            id: latestCancellation.id,
            status: latestCancellation.status, // REQUESTED, APPROVED, REJECTED
            isAutoApproved: latestCancellation.isAutoApproved,
            reason: latestCancellation.reason,
            adminNote: latestCancellation.adminNote,
            rejectionReason: latestCancellation.rejectionReason,
            requestedAt: latestCancellation.requestedAt,
            reviewedAt: latestCancellation.reviewedAt,
            refundStatus: latestCancellation.refundStatus,
            refundAmount: latestCancellation.refundAmount,
          }
        : null,
      buyer: {
        name: o.user?.name || "Customer",
        city: o.address?.city || "",
        state: o.address?.state || "",
      },
    };
  });
}

export async function reviewOrderCancellation(
  cancellationId: string,
  decision: "APPROVE" | "REJECT",
  adminNote: string
): Promise<{ success: boolean; error?: string; refundStatus?: RefundState }> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized || !auth.userId || !auth.email) {
    return { success: false, error: "Super Admin access is required." };
  }
  const note = adminNote.trim();
  if (decision === "REJECT" && note.length < 8) {
    return { success: false, error: "Provide a rejection reason of at least 8 characters." };
  }
  if (note.length > 500) {
    return { success: false, error: "The administrator note must be 500 characters or fewer." };
  }

  try {
    const cancellation = await db.orderCancellation.findUnique({
      where: { id: cancellationId },
      include: {
        order: {
          include: {
            payment: true,
            user: { select: { id: true, name: true, email: true } },
            items: {
              include: {
                product: { select: { name: true, images: { take: 1, select: { url: true } } } },
              },
            },
          },
        },
      },
    });
    if (!cancellation || cancellation.status !== "REQUESTED") {
      return { success: false, error: "This cancellation request is no longer awaiting review." };
    }
    if (decision === "APPROVE" && !["PLACED", "CONFIRMED", "PACKED"].includes(cancellation.order.status)) {
      return { success: false, error: "The order has shipped or reached a terminal state; handle it as a return/dispute instead." };
    }

    const resultingRefundStatus: RefundState =
      decision === "REJECT"
        ? "NOT_REQUIRED"
        : cancellation.order.payment?.status === "COMPLETED"
          ? "PENDING"
          : cancellation.order.payment?.status === "PENDING"
            ? "PENDING_PAYMENT"
            : "NOT_REQUIRED";

    await db.$transaction(async (tx) => {
      const changedCancellation = await tx.orderCancellation.updateMany({
        where: { id: cancellationId, status: "REQUESTED" },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          ...(decision === "REJECT" ? { activeOrderId: null } : {}),
          adminNote: note || null,
          rejectionReason: decision === "REJECT" ? note : null,
          reviewedAt: new Date(),
          reviewedByUserId: auth.userId,
          reviewedByEmail: auth.email,
          refundStatus: resultingRefundStatus,
          refundUpdatedAt: new Date(),
        },
      });
      if (changedCancellation.count !== 1) {
        throw new Error("This cancellation request was already reviewed.");
      }

      if (decision === "APPROVE") {
        const changedOrder = await tx.order.updateMany({
          where: {
            id: cancellation.orderId,
            status: { in: ["PLACED", "CONFIRMED", "PACKED"] },
          },
          data: { status: "CANCELLED" },
        });
        if (changedOrder.count !== 1) {
          throw new Error("The order status changed while the cancellation was being reviewed.");
        }
      }

      await tx.orderTimeline.create({
        data: {
          orderId: cancellation.orderId,
          status: decision === "APPROVE" ? "CANCELLED" : cancellation.order.status,
          description:
            decision === "APPROVE"
              ? `Cancellation approved by Super Admin. Reason: ${cancellation.reason}. Refund status: ${resultingRefundStatus}.${note ? ` Admin note: ${note}` : ""}`
              : `Cancellation rejected by Super Admin. Reason: ${note}`,
        },
      });
    });

    const customerEmail = cancellation.order.user?.email || cancellation.requestedByEmail;
    const customerName = cancellation.order.user?.name || undefined;

    if (decision === "APPROVE") {
      // EMAIL 3 — CANCELLATION APPROVED
      if (customerEmail) {
        await sendCancellationApprovedEmail(customerEmail, {
          orderId: cancellation.orderId,
          customerName,
          approvedAmount: cancellation.refundAmount || cancellation.order.totalAmount,
          approvalDate: new Date(),
          refundStatus: resultingRefundStatus,
          refundInitiated: resultingRefundStatus === "PENDING",
        }).catch((err) => console.error("Cancellation approved email error:", err));
      }

      const buyerMessage =
        resultingRefundStatus === "PENDING"
          ? `Order ${cancellation.orderId} was cancelled. Refund of ₹${cancellation.order.totalAmount.toLocaleString("en-IN")} is being initiated.`
          : resultingRefundStatus === "PENDING_PAYMENT"
            ? `Order ${cancellation.orderId} was cancelled. Payment is still pending; refund eligibility will be checked if payment completes.`
            : `Order ${cancellation.orderId} was cancelled. No captured payment was found, so no refund is currently due.`;

      await createNotification(
        cancellation.order.userId,
        "Order cancellation approved ✅",
        buyerMessage,
        `/orders/${cancellation.orderId}`
      ).catch((e) => console.error("Notification error:", e));

      let refundStatus: RefundState = resultingRefundStatus;
      if (resultingRefundStatus === "PENDING") {
        const refund = await startCancellationRefund(cancellationId).catch((err) => ({
          status: "FAILED" as RefundState,
          error: err.message,
        }));
        refundStatus = refund.status;
      }
      return { success: true, refundStatus };
    } else {
      // Rejection
      // EMAIL 5 — CANCELLATION REJECTED
      if (customerEmail) {
        await sendCancellationRejectedEmail(customerEmail, {
          orderId: cancellation.orderId,
          customerName,
          rejectionReason: note,
          reviewDate: new Date(),
        }).catch((err) => console.error("Cancellation rejected email error:", err));
      }

      await createNotification(
        cancellation.order.userId,
        "Cancellation request declined 📋",
        `Cancellation for order ${cancellation.orderId} was not approved. Reason: ${note}`,
        `/orders/${cancellation.orderId}`
      ).catch((e) => console.error("Notification error:", e));

      return { success: true, refundStatus: "NOT_REQUIRED" };
    }
  } catch (error) {
    console.error("reviewOrderCancellation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to review the cancellation request.",
    };
  }
}

export async function refreshOrderCancellationRefund(cancellationId: string) {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return { success: false, error: "Super Admin access is required." };
  try {
    const status = await refreshCashfreeCancellationRefund(cancellationId);
    return { success: true, status };
  } catch (error) {
    console.error("refreshOrderCancellationRefund failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Could not refresh refund status." };
  }
}

export async function retryOrderCancellationRefund(cancellationId: string) {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return { success: false, error: "Super Admin access is required." };
  try {
    const result = await retryFailedCancellationRefund(cancellationId);
    return { success: true, status: result.status, error: result.error };
  } catch (error) {
    console.error("retryOrderCancellationRefund failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Could not retry the refund." };
  }
}

export async function resumePendingOrderCancellationRefund(cancellationId: string) {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return { success: false, error: "Super Admin access is required." };
  try {
    const cancellation = await db.orderCancellation.findUnique({ where: { id: cancellationId } });
    if (!cancellation || cancellation.status !== "APPROVED" || cancellation.refundStatus !== "PENDING") {
      return { success: false, error: "Only an approved pending refund can be safely resumed." };
    }
    const result = await startCancellationRefund(cancellationId);
    return { success: true, status: result.status, error: result.error };
  } catch (error) {
    console.error("resumePendingOrderCancellationRefund failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Could not resume refund processing." };
  }
}

export async function cancelOrderAsAdmin(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string; refundStatus?: RefundState }> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized || !auth.userId || !auth.email) {
    return { success: false, error: "Super Admin access is required." };
  }
  const request = await createCancellationRequest(orderId, reason, {
    userId: auth.userId,
    email: auth.email,
    role: "ADMIN",
  });
  if (!request.success || !request.cancellationId) {
    return { success: false, error: request.error };
  }
  return reviewOrderCancellation(request.cancellationId, "APPROVE", "Cancellation initiated by Super Admin.");
}

export async function trackOrderById(orderIdInput: string, sellerIdFilter?: string) {
  const cleanId = orderIdInput.trim();
  if (!cleanId) return { success: false, error: "Please provide a valid Order Track ID." };

  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      let order = mockOrders.find(
        (o) => o.id.toLowerCase() === cleanId.toLowerCase() || o.id.toLowerCase().includes(cleanId.toLowerCase())
      );

      if (!order) {
        return { success: false, error: `No order found matching Tracking ID "${cleanId}".` };
      }

      let sellerItems = order.items;
      if (sellerIdFilter) {
        sellerItems = order.items.filter(
          (it: any) =>
            it.sellerId === sellerIdFilter ||
            it.seller?.id === sellerIdFilter ||
            it.sellerUserId === sellerIdFilter
        );
        if (sellerItems.length === 0 && order.items.length > 0) {
          sellerItems = [order.items[0]];
        }
      }

      const brandTotalAmount = sellerItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      return {
        success: true,
        order: {
          ...order,
          items: sellerItems,
          brandTotalAmount,
          user: {
            name: (order as any).user?.name || "Verified Buyer",
            email: (order as any).user?.email || "buyer@earthcentric.com",
            phone: (order as any).user?.phone || "+91 9876543210",
          },
        },
      };
    }

    // Database lookup (only paid orders)
    const dbOrder = await db.order.findFirst({
      where: {
        payment: { status: "COMPLETED" },
        OR: [
          { id: { equals: cleanId, mode: "insensitive" } },
          { id: { contains: cleanId, mode: "insensitive" } },
          { paymentGroupId: { equals: cleanId, mode: "insensitive" } },
        ],
      },
      include: {
        address: true,
        user: { select: { name: true, email: true, phone: true } },
        items: {
          include: {
            product: {
              include: {
                images: true,
                seller: { select: { id: true, companyName: true, userId: true } },
              },
            },
          },
        },
        payment: true,
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!dbOrder) {
      return { success: false, error: `No order found matching Tracking ID "${cleanId}".` };
    }

    let items = dbOrder.items.map((it) => ({
      productId: it.productId,
      name: it.product.name,
      quantity: it.quantity,
      price: it.price,
      image: it.product.images[0]?.url || "",
      sellerId: it.product.seller.id,
      sellerUserId: it.product.seller.userId,
      sellerName: it.product.seller.companyName,
    }));

    if (sellerIdFilter) {
      items = items.filter(
        (it) => it.sellerId === sellerIdFilter || it.sellerUserId === sellerIdFilter
      );
      if (items.length === 0) {
        return { success: false, error: `No items belonging to your brand exist under Tracking ID "${cleanId}".` };
      }
    }

    const brandTotalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const formattedOrder = {
      id: dbOrder.id,
      userId: dbOrder.userId,
      totalAmount: dbOrder.totalAmount,
      brandTotalAmount,
      status: dbOrder.status as any,
      createdAt: dbOrder.createdAt,
      address: {
        street: dbOrder.address.street,
        city: dbOrder.address.city,
        state: dbOrder.address.state,
        postalCode: dbOrder.address.postalCode,
        country: dbOrder.address.country,
      },
      user: {
        name: dbOrder.user?.name || "Customer",
        email: dbOrder.user?.email || "N/A",
        phone: dbOrder.user?.phone || "N/A",
      },
      items,
      paymentStatus: (dbOrder.payment?.status as any) || "PENDING",
      ...(dbOrder.payment?.cashfreeOrderId ? { cashfreeOrderId: dbOrder.payment.cashfreeOrderId } : {}),
      timeline: dbOrder.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };

    return { success: true, order: formattedOrder };
  } catch (e) {
    console.error("trackOrderById failed:", e);
    return { success: false, error: "Error retrieving order details." };
  }
}
