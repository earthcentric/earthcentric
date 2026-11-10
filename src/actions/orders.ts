"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import {
  createCashfreeOrder,
  fetchCashfreeOrderPayments,
  verifyPaymentSignature,
  getSecureAppUrl,
} from "@/lib/cashfree";
import {
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendCancellationRequestedEmail,
  sendCancellationApprovedEmail,
  sendDeliveredReturnApprovedEmail,
  sendReturnCollectionUpdateEmail,
  sendAutoCancellationEmail,
  sendCancellationRejectedEmail,
} from "@/lib/email";
import { createNotification, createAdminNotification } from "@/lib/notification-service";
import { calculateBuyXGetYFreeItems, getEffectiveUnitPrice } from "@/lib/offers";
import { verifyAdminAuth, verifyAuthenticatedUser, verifySellerAuth } from "@/lib/auth-server";
import {
  applyCashfreeRefundWebhook,
  refreshCancellationRefund as refreshCashfreeCancellationRefund,
  retryFailedCancellationRefund,
  startCancellationRefund,
  type RefundState,
} from "@/lib/order-cancellations";
import { validateGSTIN, validateIndianMobile, validateGstAndPhone } from "@/lib/gstin";
import { quoteSellerShipments } from "@/lib/shipping";
import { calculateCheckoutLine } from "@/lib/checkout-pricing";

const CANCELLATION_WINDOW_HOURS = 72; // 3 days (72 hours) duration cancellation policy

export interface OrderItemInput {
  productId: string;
  name: string;
  price: number;
  quantity: number; // Represents number of boxes in bulk model
  image: string;
  sellerId?: string;
  boxes?: number;
  unitsPerBox?: number;
  totalUnits?: number;
  pricePerBox?: number;
  sellerBasePrice?: number;
  commissionRate?: number;
  commissionAmount?: number;
  sellerNetAmount?: number;
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
  isDemo?: boolean;
  userId: string;
  sellerId?: string | null;
  seller?: {
    id: string;
    companyName: string;
    email?: string;
    phone?: string;
  };
  totalAmount: number;
  shippingFee?: number;
  grossAmount?: number;
  totalSellerBaseAmount?: number;
  commissionRate?: number;
  commissionAmount?: number;
  sellerNetAmount?: number;
  totalBoxes?: number;
  gstin?: string;
  status: "PLACED" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "REFUNDED";
  createdAt: Date;
  estimatedDeliveryDate?: Date | string | null;
  deliveredAt?: Date | string | null;
  address: AddressInput;
  items: {
    productId: string;
    name: string;
    quantity: number; // boxes
    boxes?: number;
    unitsPerBox?: number;
    totalUnits?: number;
    price: number;
    pricePerBox?: number;
    sellerBasePrice?: number;
    commissionRate?: number;
    commissionAmount?: number;
    sellerNetAmount?: number;
    image: string;
    sku?: string;
    sellerId?: string;
    sellerName?: string;
    seller?: {
      id: string;
      companyName: string;
      email?: string;
      phone?: string;
    };
  }[];
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED";
  cancellation?: {
    id: string;
    status: string;
    type?: string;
    deliveredAt?: Date | string | null;
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
    returnCollection?: {
      id: string;
      status: string;
      collectionDeadline: Date | string;
      scheduledAt?: Date | string | null;
      collectedAt?: Date | string | null;
      inspectedAt?: Date | string | null;
      failureReason?: string | null;
      notes?: string | null;
    } | null;
  };
  cancellations?: any[];
  cashfreeOrderId?: string;
  cashfreePaymentSessionId?: string;
  timeline: {
    status: string;
    description: string;
    createdAt: Date;
  }[];
  user?: {
    name: string;
    email?: string;
    phone?: string;
    image?: string | null;
    emailVerified?: Date | null;
  };
  isForwardedToSeller?: boolean;
  forwardedAt?: Date | string | null;
  forwardedByAdminEmail?: string | null;
  assignedSellerId?: string | null;
  adminFulfillmentInstructions?: string | null;
  fulfillmentDeadline?: Date | string | null;
  adminReviewStatus?: string;
  orderReceivedFrom?: string;
}

// In-memory global arrays to mock order records for sandbox testing
let mockOrders: OrderDetail[] = [];

function mapLatestCancellation(cancellations?: any[]): OrderDetail["cancellation"] {
  const cancellation = cancellations?.[0];
  if (!cancellation) return undefined;
  return {
    id: cancellation.id,
    status: cancellation.status,
    type: cancellation.type || "CANCELLATION",
    deliveredAt: cancellation.deliveredAt,
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
    returnCollection: cancellation.returnCollection
      ? {
          id: cancellation.returnCollection.id,
          status: cancellation.returnCollection.status,
          collectionDeadline: cancellation.returnCollection.collectionDeadline,
          scheduledAt: cancellation.returnCollection.scheduledAt,
          collectedAt: cancellation.returnCollection.collectedAt,
          inspectedAt: cancellation.returnCollection.inspectedAt,
          failureReason: cancellation.returnCollection.failureReason,
          notes: cancellation.returnCollection.notes,
        }
      : null,
  };
}

export async function createOrder(data: {
  addressId: string;
  checkoutRequestId: string;
  userPhone?: string;
  items: { productId: string; quantity: number }[];
  gstin?: string;
}) {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    return {
      success: false,
      error: "Checkout is unavailable in demo mode. Configure the database-backed checkout to accept real orders.",
    };
  }

  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId || !auth.email) {
    return { success: false, error: "Please sign in with a verified buyer account before checking out." };
  }
  if (auth.role === "BUYER" && !auth.buyerOnboardingCompleted) {
    return { success: false, error: "Mandatory mobile and OTP verification required before checking out." };
  }
  if (typeof data.checkoutRequestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.checkoutRequestId)) {
    return { success: false, error: "This checkout request is invalid. Refresh checkout and try again." };
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { success: false, error: "Your cart is empty." };
  }
  if (new Set(data.items.map((item) => item?.productId)).size !== data.items.length) {
    return { success: false, error: "The cart contains duplicate product lines. Refresh your cart and try again." };
  }

  const buyer = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true, phone: true, role: true, gstStatus: true, gstin: true },
  });
  if (!buyer) {
    return { success: false, error: "Your account could not be verified. Please sign in again." };
  }
  const priorCheckout = await db.order.findFirst({
    where: { userId: buyer.id, checkoutRequestId: data.checkoutRequestId },
    select: { id: true },
  });
  if (priorCheckout) {
    return {
      success: false,
      error: "This checkout has already been initialized. Check your orders before starting another payment.",
    };
  }
  const address = await db.address.findFirst({
    where: { id: data.addressId, userId: auth.userId, NOT: { street: { startsWith: "[Deleted]" } } },
  });
  if (!address) {
    return { success: false, error: "Select a saved delivery address belonging to your account." };
  }

  const orderId = `ord-${randomUUID()}`;

  // Requirement 2 & 6: Bulk Box & GST Validation
  const hasBulkBoxes = data.items.some((it) => Number(it.quantity) >= 2);
  const gstinCheck = validateGSTIN(data.gstin);
  if (!gstinCheck.isValid) {
    return {
      success: false,
      error: gstinCheck.error || "GSTIN and registered mobile number are required to unlock bulk pricing. Please verify your details to view the price for additional boxes.",
    };
  }
  const validatedGstin = gstinCheck.normalizedGstin!;

  if (hasBulkBoxes) {
    const isGstApproved = buyer?.role === "ADMIN" || buyer?.gstStatus === "APPROVED";
    if (!isGstApproved) {
      return {
        success: false,
        error: `Commercial bulk orders of 2 or more boxes require approved GST verification by EarthCentric Super Admin. Your current status is ${buyer?.gstStatus || "PENDING"}. Please order single boxes or wait for review.`,
      };
    }
    const phoneCheck = validateIndianMobile(data.userPhone);
    if (!phoneCheck.isValid) {
      return {
        success: false,
        error: phoneCheck.error || "GSTIN and registered mobile number are required to unlock bulk pricing. Please verify your details to view the price for additional boxes.",
      };
    }
  }

  // Server-side recalculation & validation of box quantities, item prices, and commission snapshots
  let serverCalculatedTotal = 0;
  const shippingItems: { productId: string; quantity: number }[] = [];
  const verifiedItems: (OrderItemInput & { itemTotal: number })[] = [];

  for (const item of data.items) {
    // Requirement 4: Box-Based Bulk Ordering Only - No Retail Purchases
    const boxQty = Number(item.quantity);
    if (!Number.isInteger(boxQty) || boxQty < 1) {
      return {
        success: false,
        error: "Invalid box quantity. Minimum bulk order quantity is 1 complete box.",
      };
    }

    const product = await db.product.findUnique({
      where: { id: item.productId },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    if (!product) {
      return { success: false, error: "A product in your cart could not be found." };
    }
    if (!product.isApproved || product.status !== "APPROVED") {
      return {
        success: false,
        error: `Cannot purchase "${product.name}". It is not currently active or approved on the marketplace.`
      };
    }
    if (product.stock !== undefined && product.stock < boxQty) {
      return {
        success: false,
        error: `Insufficient stock for "${product.name}". Available: ${product.stock} boxes, requested: ${boxQty} boxes.`
      };
    }

    const price = calculateCheckoutLine(product, boxQty);
    const { unitsPerBox, totalUnits } = price;

    serverCalculatedTotal += price.itemTotal;
    shippingItems.push({ productId: product.id, quantity: boxQty });

    verifiedItems.push({
      productId: product.id,
      name: product.name,
      price: price.unitPrice,
      pricePerBox: price.unitPrice,
      quantity: boxQty,
      boxes: boxQty,
      unitsPerBox,
      totalUnits,
      sellerBasePrice: price.sellerBasePrice,
      commissionRate: price.commissionRate,
      commissionAmount: price.commissionAmount,
      sellerNetAmount: price.sellerNetAmount,
      sellerId: product.sellerId,
      image: product.images[0]?.url || "",
      itemTotal: price.itemTotal,
    });
  }

  const finalTotalAmount = Math.round(serverCalculatedTotal * 100) / 100;
  if (!Number.isFinite(finalTotalAmount) || finalTotalAmount <= 0) {
    return { success: false, error: "The order total is invalid. Please refresh your cart and try again." };
  }

  let shippingQuote;
  try {
    shippingQuote = await quoteSellerShipments(address.id, buyer.id, shippingItems);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not validate shipping for this order.",
    };
  }
  const payableTotal = Math.round((finalTotalAmount + shippingQuote.totalFee) * 100) / 100;

  // Generate Cashfree Order strictly with server-calculated payable amount
  let paymentOrder: Awaited<ReturnType<typeof createCashfreeOrder>>;
  const customerPhone = (data.userPhone || buyer.phone || "").replace(/\D/g, "").slice(-10);
  try {
    const appBaseUrl = getSecureAppUrl();
    paymentOrder = await createCashfreeOrder({
      amount: payableTotal,
      orderId: orderId,
      customer: {
        id: buyer.id,
        name: buyer.name || buyer.email.split("@")[0],
        email: buyer.email,
        phone: customerPhone
      },
      returnUrl: `${appBaseUrl}/orders/${orderId}`,
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
    const itemsBySeller: Record<string, (OrderItemInput & { itemTotal: number })[]> = {};
    for (const item of verifiedItems) {
      const sId = item.sellerId;
      if (!sId) return { success: false, error: "A product is missing its seller assignment." };
      if (!itemsBySeller[sId]) {
        itemsBySeller[sId] = [];
      }
      itemsBySeller[sId].push(item);
    }

    await db.user.update({
      where: { id: buyer.id },
      data: { ...(customerPhone ? { phone: customerPhone } : {}) },
    });

    type CreatedCheckoutOrder = Prisma.OrderGetPayload<{
      include: {
        items: { include: { product: { include: { images: true } } } };
        timeline: true;
      };
    }>;
    const createdOrders: CreatedCheckoutOrder[] = [];
    let index = 0;
    for (const [sellerId, items] of Object.entries(itemsBySeller)) {
      const orderGrossAmount = Math.round(items.reduce((sum, item) => sum + (item.itemTotal ?? (item.price * item.quantity)), 0) * 100) / 100;
      const orderSellerBaseAmount = Math.round(items.reduce((sum, item) => sum + ((item.sellerBasePrice ?? 0) * item.quantity), 0) * 100) / 100;
      const orderCommission = Math.round(items.reduce((sum, item) => sum + (item.commissionAmount || 0), 0) * 100) / 100;
      const orderSellerNet = Math.round((orderGrossAmount - orderCommission) * 100) / 100;
      const orderTotalBoxes = items.reduce((sum, item) => sum + item.quantity, 0);
      const orderCommissionRate = orderSellerBaseAmount > 0 
        ? Math.round((orderCommission / orderSellerBaseAmount) * 100 * 10) / 10 
        : (orderGrossAmount > 0 ? Math.round((orderCommission / orderGrossAmount) * 100 * 10) / 10 : 20.0);
      const splitOrderId = `${orderId}-${index}`;
      const sId = sellerId;
      const shipment = shippingQuote.shipments.find((entry) => entry.sellerId === sId);
      if (!shipment) {
        return { success: false, error: "Shipping could not be calculated for one of the seller shipments." };
      }

      const order = await db.order.create({
        data: {
          id: splitOrderId,
          userId: buyer.id,
          checkoutRequestId: data.checkoutRequestId,
          addressId: address.id,
          totalAmount: orderGrossAmount,
          shippingFee: shipment.fee,
          grossAmount: orderGrossAmount,
          totalSellerBaseAmount: orderSellerBaseAmount,
          commissionRate: orderCommissionRate,
          commissionAmount: orderCommission,
          sellerNetAmount: orderSellerNet,
          totalBoxes: orderTotalBoxes,
          gstin: validatedGstin,
          isForwardedToSeller: false,
          adminReviewStatus: "PENDING_REVIEW",
          assignedSellerId: sId,
          status: "PLACED",
          sellerId: sId,
          paymentGroupId: paymentOrder.order_id, // Grouping multiple orders under one payment
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity, // boxes
              boxes: item.quantity,
              unitsPerBox: item.unitsPerBox || 100,
              totalUnits: item.totalUnits || (item.quantity * 100),
              pricePerBox: item.price,
              price: item.price,
              sellerBasePrice: item.sellerBasePrice,
              commissionRate: item.commissionRate || 20.0,
              commissionAmount: item.commissionAmount || 0,
              sellerNetAmount: item.sellerNetAmount || (item.price * item.quantity),
            })),
          },
          payment: {
            create: {
              cashfreeOrderId: paymentOrder.order_id,
              amount: orderGrossAmount + shipment.fee,
              status: "PENDING",
            },
          },
          timeline: {
            create: {
              status: "PLACED",
              description: "Bulk order placed. Awaiting payment authorization.",
            },
          },
          shipmentSnapshot: {
            create: {
              sellerId: sId,
              warehouseAddress: shipment.warehouse,
              buyerAddress: {
                label: address.label,
                street: address.street,
                landmark: address.landmark,
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: address.country,
                latitude: address.latitude,
                longitude: address.longitude,
                geocodingProvider: address.geocodingProvider,
                providerLocationId: address.providerLocationId,
              },
              warehousePin: shipment.warehouse.postalCode,
              buyerPin: address.postalCode,
              shippingZone: shipment.zone,
              routeDistanceKm: shipment.routeDistanceKm,
              routeDurationMinutes: shipment.routeDurationMinutes,
              routeProvider: shipment.routeProvider,
              estimateStatus: shipment.estimateStatus,
              configurationVersion: shippingQuote.configurationVersion,
              feeBreakdown: { ...shipment.breakdown },
              estimatedMinDays: shipment.estimatedMinDays,
              estimatedMaxDays: shipment.estimatedMaxDays,
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
      shippingFee: firstOrder.shippingFee,
      grossAmount: firstOrder.grossAmount ?? firstOrder.totalAmount,
      commissionRate: firstOrder.commissionRate ?? 10.0,
      commissionAmount: firstOrder.commissionAmount ?? 0,
      sellerNetAmount: firstOrder.sellerNetAmount ?? firstOrder.totalAmount,
      totalBoxes: firstOrder.totalBoxes ?? 1,
      gstin: validatedGstin,
      isForwardedToSeller: false,
      adminReviewStatus: "PENDING_REVIEW",
      assignedSellerId: (firstOrder as any).assignedSellerId || null,
      status: firstOrder.status as any,
      createdAt: firstOrder.createdAt,
      address: {
        street: address.street,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
      items: firstOrder.items.map((it) => ({
        productId: it.productId,
        name: it.product.name,
        quantity: it.quantity,
        boxes: it.boxes ?? it.quantity,
        unitsPerBox: it.unitsPerBox ?? 100,
        totalUnits: it.totalUnits ?? (it.quantity * 100),
        price: it.price,
        pricePerBox: it.pricePerBox ?? it.price,
        commissionRate: it.commissionRate ?? 10.0,
        commissionAmount: it.commissionAmount ?? 0,
        sellerNetAmount: it.sellerNetAmount ?? it.price * it.quantity,
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
      shippingQuote,
      payableTotal,
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
  _cashfreePaymentId: string,
  _signature: string,
  _userEmail: string
): Promise<boolean> {
  void _cashfreePaymentId;
  void _signature;
  void _userEmail;
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) return false;
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId || !auth.email) return false;

  try {
    const ownedOrder = await db.order.findFirst({
      where: {
        userId: auth.userId,
        OR: [
          { id: orderId },
          { id: `${orderId}-0` },
          { paymentGroupId: orderId },
        ],
      },
      select: {
        id: true,
        totalAmount: true,
        shippingFee: true,
        paymentGroupId: true,
        payment: { select: { cashfreeOrderId: true } },
      },
    });
    if (!ownedOrder) return false;
    const cashfreeOrderId = ownedOrder.paymentGroupId || ownedOrder.payment?.cashfreeOrderId;
    if (!cashfreeOrderId) return false;

    const relatedOrders = await db.order.findMany({
      where: {
        userId: auth.userId,
        OR: [
          { paymentGroupId: cashfreeOrderId },
          { id: ownedOrder.id },
        ],
      },
      select: { totalAmount: true, shippingFee: true },
    });
    const expectedAmount = Math.round(
      relatedOrders.reduce((total, order) => total + order.totalAmount + order.shippingFee, 0) * 100
    ) / 100;
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return false;

    const payments = await fetchCashfreeOrderPayments(cashfreeOrderId);
    const successfulPayment = payments.find(
      (payment) =>
        payment.payment_status === "SUCCESS" &&
        payment.payment_currency === "INR" &&
        Math.round(Number(payment.payment_amount) * 100) === Math.round(expectedAmount * 100)
    );
    if (!successfulPayment) return false;

    // Update in DB (update all payments associated with this Cashfree Order ID)
    await db.payment.updateMany({
      where: { cashfreeOrderId: cashfreeOrderId },
      data: {
        ...(successfulPayment.cf_payment_id != null
          ? { cashfreePaymentId: String(successfulPayment.cf_payment_id) }
          : {}),
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
          description: "Payment confirmed. Order received by EarthCentric Super Admin for mediation and review.",
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
        "Order Confirmed ✅",
        `Your order ${orderId} has been confirmed. EarthCentric is preparing fulfillment.`,
        `/orders/${orderId}`
      ).catch((e) => console.error("Failed to create notification:", e));
    }

    // Alert Super Admin for order mediation & forwarding
    await createAdminNotification(
      "New Order Received for Review",
      `Order ${orderId} has been paid and is waiting for Super Admin review and seller assignment.`,
      "/admin/dashboard"
    ).catch((e) => console.error("Failed to notify admin:", e));

    const buyerName = dbOrder?.user?.name || undefined;
    const orderAddress = dbOrder?.address;

    await sendOrderConfirmationEmail(
      auth.email,
      orderId,
      (dbOrder?.totalAmount || 0) + (dbOrder?.shippingFee || 0),
      {
      buyerName,
      placedAt: dbOrder?.createdAt,
      items: (dbOrder?.items || []).map((it) => ({
        name: it.product?.name || "Product",
        quantity: it.quantity,
        price: it.price,
        image: it.product?.images?.[0]?.url || undefined,
        sellerName: "EarthCentric",
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
      }
    );
    return true;
  } catch (error) {
    console.error("Failed to update database payment confirmation:", error);
    return false;
  }
}

export async function forwardOrderToSellerByAdmin(params: {
  orderId: string;
  sellerId?: string;
  fulfillmentInstructions?: string;
  fulfillmentDeadline?: string | Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    const adminAuth = await verifyAdminAuth();
    if (!adminAuth.authorized) {
      return { success: false, error: "Super Admin authorization required to forward orders." };
    }
    const adminEmail = adminAuth.email;

    const { orderId, sellerId, fulfillmentInstructions, fulfillmentDeadline } = params;
    const deadlineDate = fulfillmentDeadline ? new Date(fulfillmentDeadline) : new Date(Date.now() + 48 * 3600 * 1000);
    const instructions = fulfillmentInstructions?.trim() || "Pack utilizing 100% biodegradable FSC certified packaging. Dispatch via EarthCentric logistics partner within designated deadline.";

    if (isMock) {
      let found = false;
      mockOrders = mockOrders.map((o) => {
        if (o.id === orderId || o.id === `${orderId}-0`) {
          found = true;
          return {
            ...o,
            isForwardedToSeller: true,
            forwardedAt: new Date(),
            forwardedByAdminEmail: adminEmail,
            assignedSellerId: sellerId || o.assignedSellerId || o.sellerId || "cmvcbbtm80001txgw8dd0r3lk",
            sellerId: sellerId || o.assignedSellerId || o.sellerId || "cmvcbbtm80001txgw8dd0r3lk",
            adminFulfillmentInstructions: instructions,
            fulfillmentDeadline: deadlineDate,
            adminReviewStatus: "FORWARDED_TO_SELLER",
            status: "CONFIRMED",
            timeline: [
              ...o.timeline,
              {
                status: "CONFIRMED",
                description: `Order reviewed & forwarded by EarthCentric Admin (${adminEmail}) to fulfillment hub. Special instructions: ${instructions}`,
                createdAt: new Date(),
              },
            ],
          };
        }
        return o;
      });

      if (!found) {
        return { success: false, error: "Order not found in mock store." };
      }
      return { success: true };
    }

    // DB mode
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        seller: { select: { id: true, userId: true, companyName: true } },
        items: { include: { product: { select: { sellerId: true } } } },
      },
    });

    if (!order) {
      return { success: false, error: `Order ${orderId} not found.` };
    }

    // Resolve target seller ID
    const targetSellerId = sellerId || order.assignedSellerId || order.sellerId || order.items[0]?.product?.sellerId;
    if (!targetSellerId) {
      return { success: false, error: "Please select a valid seller to forward this order to." };
    }

    // Fetch seller user ID for notification
    const targetSeller = await db.seller.findUnique({
      where: { id: targetSellerId },
      select: { id: true, userId: true, companyName: true },
    });

    await db.$transaction([
      db.order.update({
        where: { id: orderId },
        data: {
          isForwardedToSeller: true,
          forwardedAt: new Date(),
          forwardedByAdminEmail: adminEmail,
          assignedSellerId: targetSellerId,
          sellerId: targetSellerId,
          adminFulfillmentInstructions: instructions,
          fulfillmentDeadline: deadlineDate,
          adminReviewStatus: "FORWARDED_TO_SELLER",
          status: order.status === "PLACED" ? "CONFIRMED" : order.status,
        },
      }),
      db.orderTimeline.create({
        data: {
          orderId,
          status: "CONFIRMED",
          description: `Order reviewed and forwarded by EarthCentric to fulfillment partner. Special instructions: ${instructions}`,
        },
      }),
    ]);

    // Notify seller under EarthCentric branding
    if (targetSeller?.userId) {
      await createNotification(
        targetSeller.userId,
        "New Order Received from EarthCentric 📦",
        `Order EC-ORD-${orderId.substring(4, 10).toUpperCase()} has been forwarded to you for fulfillment. Please review the instructions and dispatch before the deadline.`,
        "/seller/dashboard"
      ).catch((e) => console.error("Failed to notify seller:", e));
    }

    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");
    revalidatePath(`/orders/${orderId}`);

    return { success: true };
  } catch (error: any) {
    console.error("forwardOrderToSellerByAdmin failed:", error);
    return { success: false, error: error?.message || "Failed to forward order to seller." };
  }
}

export async function getOrderById(orderId: string): Promise<OrderDetail | null> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId) return null;
  const isAdmin = auth.role === "ADMIN" || (await verifyAdminAuth()).authorized;
  try {
    if (isMock) {
      const order = mockOrders.find(
        (o) =>
          o.id === orderId ||
          o.id === `${orderId}-0` ||
          o.cashfreeOrderId === orderId
      );
      if (!order) return null;
      const isOrderBuyer = order.userId === auth.userId;
      const isOrderSeller =
        auth.role === "SELLER" &&
        order.isForwardedToSeller === true &&
        (order.isDemo === true || order.items.some((item) => item.sellerId === auth.sellerId));
      if (!isAdmin && !isOrderBuyer && !isOrderSeller) return null;
      if (isOrderSeller && !isAdmin && !order.isForwardedToSeller) return null;
      if (isOrderSeller && !isAdmin && order.isDemo) {
        return {
          ...order,
          sellerId: auth.sellerId,
          assignedSellerId: auth.sellerId,
          orderReceivedFrom: "EarthCentric",
          user: { name: "EarthCentric" },
          address: {
            street: "EarthCentric Central Fulfillment Hub",
            city: order.address.city,
            state: order.address.state,
            postalCode: order.address.postalCode,
            country: order.address.country,
          },
          items: order.items.map((item) => ({ ...item, sellerId: auth.sellerId })),
        };
      }
      return order;
    }

    const cleanId = orderId.trim();
    const order = await db.order.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { id: `${cleanId}-0` },
          { paymentGroupId: cleanId },
          { payment: { cashfreeOrderId: cleanId } },
          { id: { equals: cleanId, mode: "insensitive" as const } },
          { paymentGroupId: { equals: cleanId, mode: "insensitive" as const } },
        ],
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
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
        cancellations: { orderBy: { requestedAt: "desc" }, take: 1, include: { returnCollection: true } },
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) return null;

    // Auto-reconcile payment status from Cashfree if still marked pending
    if (order.payment && order.payment.status !== "COMPLETED" && order.payment.cashfreeOrderId) {
      try {
        const isPaid = await verifyPaymentSignature(order.payment.cashfreeOrderId);
        if (isPaid) {
          await db.payment.updateMany({
            where: { cashfreeOrderId: order.payment.cashfreeOrderId },
            data: { status: "COMPLETED" },
          });
          await db.order.updateMany({
            where: {
              OR: [
                { id: order.id },
                { paymentGroupId: order.payment.cashfreeOrderId },
              ],
              status: { notIn: ["CANCELLED", "REFUNDED"] },
            },
            data: { status: "CONFIRMED" },
          });
          order.status = "CONFIRMED" as any;
          if (order.payment) order.payment.status = "COMPLETED" as any;
        }
      } catch (reconcileErr) {
        console.warn("Order get auto-reconcile skipped:", reconcileErr);
      }
    }

    const isOrderSeller =
      auth.authorized &&
      auth.role === "SELLER" &&
      (auth.sellerId === order.sellerId ||
        auth.sellerId === (order as any).assignedSellerId ||
        order.items.some((item) => item.product.sellerId === auth.sellerId));
    const isOrderBuyer = auth.userId === order.userId;

    // If an authenticated user is trying to view someone else's order (and is not admin/seller):
    if (!isAdmin && !isOrderSeller && !isOrderBuyer) {
      return null;
    }

    // Orders must NOT appear in Seller Portal before Super Admin forwards them
    if (isOrderSeller && !isAdmin && !(order as any).isForwardedToSeller) {
      return null;
    }

    const grossAmount = order.grossAmount ?? order.totalAmount;
    const commissionRate = order.commissionRate ?? 10.0;
    const commissionAmount = order.commissionAmount ?? Math.round(((grossAmount * commissionRate) / 100) * 100) / 100;
    const sellerNetAmount = order.sellerNetAmount ?? Math.round((grossAmount - commissionAmount) * 100) / 100;
    const totalBoxes = order.totalBoxes ?? order.items.reduce((s, it) => s + (it.boxes || it.quantity), 0);

    return {
      id: order.id,
      userId: order.userId,
      orderReceivedFrom: isOrderSeller && !isAdmin ? "EarthCentric" : undefined,
      user: isOrderSeller && !isAdmin ? {
        name: "EarthCentric",
      } : (order.user ? {
        name: order.user.name || "Customer",
        email: isAdmin ? (order.user.email || "") : undefined,
      } : undefined),
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      grossAmount,
      commissionRate,
      commissionAmount,
      sellerNetAmount,
      totalBoxes,
      gstin: isAdmin ? (order.gstin || undefined) : isOrderBuyer ? (order.gstin || undefined) : undefined,
      status: order.status as any,
      isForwardedToSeller: (order as any).isForwardedToSeller ?? false,
      forwardedAt: (order as any).forwardedAt ?? null,
      forwardedByAdminEmail: isAdmin ? (order as any).forwardedByAdminEmail : null,
      assignedSellerId: (order as any).assignedSellerId ?? order.sellerId ?? null,
      adminFulfillmentInstructions: (order as any).adminFulfillmentInstructions ?? null,
      fulfillmentDeadline: (order as any).fulfillmentDeadline ?? null,
      adminReviewStatus: (order as any).adminReviewStatus ?? "PENDING_REVIEW",
      createdAt: order.createdAt,
      address: isOrderSeller && !isAdmin ? {
        street: "EarthCentric Central Fulfillment Hub",
        city: order.address.city,
        state: order.address.state,
        postalCode: order.address.postalCode,
        country: order.address.country,
      } : {
        street: order.address.street,
        city: order.address.city,
        state: order.address.state,
        postalCode: order.address.postalCode,
        country: order.address.country,
      },
      items: order.items.map((it) => {
        const boxes = it.boxes ?? it.quantity;
        const unitsPerBox = it.unitsPerBox ?? (it.product as any).unitsPerBox ?? 100;
        const totalUnits = it.totalUnits ?? (boxes * unitsPerBox);
        const pricePerBox = it.pricePerBox ?? it.price;
        const itemCommissionRate = it.commissionRate ?? commissionRate;
        const itemCommission = it.commissionAmount ?? Math.round(((pricePerBox * boxes * itemCommissionRate) / 100) * 100) / 100;
        const itemSellerNet = it.sellerNetAmount ?? Math.round(((pricePerBox * boxes) - itemCommission) * 100) / 100;

        return {
          productId: it.productId,
          name: it.product.name,
          quantity: boxes,
          boxes,
          unitsPerBox,
          totalUnits,
          price: pricePerBox,
          pricePerBox,
          commissionRate: itemCommissionRate,
          commissionAmount: itemCommission,
          sellerNetAmount: itemSellerNet,
          image: it.product.images[0]?.url || "",
        };
      }),
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

export async function getOrdersByUser(_userId: string): Promise<OrderDetail[]> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId || auth.userId !== _userId) return [];

  try {
    if (isMock) {
      return mockOrders
        .filter((o) => o.userId === auth.userId && o.paymentStatus === "COMPLETED")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const dbOrders = await db.order.findMany({
      where: {
        userId: auth.userId,
        status: { not: "CANCELLED" },
      },
      include: {
        address: true,
        user: { select: { id: true, email: true, name: true } },
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
        cancellations: { orderBy: { requestedAt: "desc" }, take: 1, include: { returnCollection: true } },
        timeline: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Auto-reconcile any pending payments directly with Cashfree
    for (const ord of dbOrders) {
      if (ord.payment && ord.payment.status !== "COMPLETED" && ord.payment.cashfreeOrderId) {
        try {
          const isPaid = await verifyPaymentSignature(ord.payment.cashfreeOrderId);
          if (isPaid) {
            await db.payment.updateMany({
              where: { cashfreeOrderId: ord.payment.cashfreeOrderId },
              data: { status: "COMPLETED" },
            });
            await db.order.updateMany({
              where: { id: ord.id },
              data: { status: "CONFIRMED" },
            });
            ord.status = "CONFIRMED" as any;
            if (ord.payment) ord.payment.status = "COMPLETED" as any;
          }
        } catch (e) {
          // non-fatal
        }
      }
    }

    return dbOrders.map((order) => {
      const deliveredEvent = order.timeline?.find((t) => t.status === "DELIVERED");
      return {
        id: order.id,
        userId: order.userId,
        totalAmount: order.totalAmount,
        status: order.status as any,
        createdAt: order.createdAt,
        estimatedDeliveryDate: new Date(new Date(order.createdAt).getTime() + 4 * 24 * 60 * 60 * 1000),
        deliveredAt: deliveredEvent?.createdAt || null,
        address: {
          street: order.address?.street || "Delivery Address",
          city: order.address?.city || "",
          state: order.address?.state || "",
          postalCode: order.address?.postalCode || "",
          country: order.address?.country || "India",
        },
        items: (order.items || []).map((it) => ({
          productId: it.productId,
          name: it.product?.name || "Sustainable Product",
          quantity: it.quantity,
          price: it.price,
          image: it.product?.images?.[0]?.url || "",
          sku: it.product?.slug || it.productId?.slice(0, 8).toUpperCase() || "SKU-PROD",
          sellerId: it.product?.sellerId,
          sellerName: "EarthCentric",
          seller: { id: "earthcentric", companyName: "EarthCentric" },
        })),
        paymentStatus: (order.payment?.status as any) || "PENDING",
        cancellation: mapLatestCancellation(order.cancellations),
        ...(order.payment?.cashfreeOrderId ? { cashfreeOrderId: order.payment.cashfreeOrderId } : {}),
        timeline: (order.timeline || []).map((t) => ({
          status: t.status,
          description: t.description,
          createdAt: t.createdAt,
        })),
      };
    });
  } catch (e) {
    console.error("getOrdersByUser failed:", e);
    return [];
  }
}

export async function updateOrderStatus(orderId: string, status: OrderDetail["status"], description: string, _buyerEmail?: string) {
  void _buyerEmail;
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    const adminAuth = await verifyAdminAuth();
    const sellerAuth = adminAuth.authorized ? null : await verifySellerAuth();
    if (!adminAuth.authorized && !sellerAuth?.authorized) return false;
    if (status === "CANCELLED" || status === "REFUNDED") {
      console.warn("Cancellation and refund statuses must use the cancellation workflow.");
      return false;
    }

    if (isMock) {
      const currentOrder = mockOrders.find((o) => o.id === orderId);
      if (!currentOrder) return false;
      if (
        !adminAuth.authorized &&
        !currentOrder.items.some((item) => item.sellerId === sellerAuth?.sellerId)
      ) {
        return false;
      }
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
      return true;
    }

    let emailToSend: string | undefined;
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true } },
        seller: { select: { id: true, userId: true, verificationStatus: true } },
        items: { include: { product: { select: { sellerId: true } } } },
      },
    });
    if (!order || order.status === "CANCELLED" || order.status === "REFUNDED") return false;
    emailToSend = order.user?.email;

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

      const targetSellerId = resolvedSellerId || (sellerAuth?.userId ? (await db.seller.findUnique({ where: { userId: sellerAuth.userId }, select: { id: true } }))?.id : null);
      if (targetSellerId) {
        const { checkSellerActivation } = await import("@/lib/auth-server");
        const act = await checkSellerActivation(targetSellerId);
        if (!act.active) {
          console.warn("Seller account not active in updateOrderStatus:", act.error);
          return false;
        }
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
  const auth = await verifySellerAuth(sellerIdOrUserId);
  if (!auth.authorized) {
    throw new Error("Seller sign-in is required to view seller orders.");
  }
  const adminAuth = await verifyAdminAuth();
  const requestedSellerId = adminAuth.authorized ? sellerIdOrUserId : auth.sellerId;
  if (!requestedSellerId) throw new Error("No seller profile is linked to this account.");
  try {
    if (isMock) {
      // In mock mode, initialize sample box-based commercial orders if mockOrders is empty
      if (mockOrders.length === 0) {
        mockOrders = [
          {
            id: "demo-ord-8834a",
            isDemo: true,
            userId: "buyer-1",
            user: { name: "Commercial Buyer" },
            totalAmount: 10000,
            grossAmount: 10000,
            commissionRate: 10.0,
            commissionAmount: 1000,
            sellerNetAmount: 9000,
            totalBoxes: 5,
            status: "CONFIRMED",
            createdAt: new Date(Date.now() - 3600000 * 4),
            address: { street: "EarthCentric Central Fulfillment Hub", city: "Bengaluru", state: "Karnataka", postalCode: "560001", country: "India" },
            isForwardedToSeller: true,
            orderReceivedFrom: "EarthCentric",
            adminReviewStatus: "FORWARDED_TO_SELLER",
            adminFulfillmentInstructions: "Standard EarthCentric eco-packaging. Prepare for logistics courier pickup.",
            items: [{
              productId: "prod-pdf-1",
              name: "Sauce Dip Bowl (Bulk Pack)",
              quantity: 5,
              boxes: 5,
              unitsPerBox: 100,
              totalUnits: 500,
              price: 2000,
              pricePerBox: 2000,
              commissionRate: 10.0,
              commissionAmount: 1000,
              sellerNetAmount: 9000,
              image: "/images/products/product_p1_1.png"
            }],
            paymentStatus: "PENDING",
            timeline: [],
          },
          {
            id: "demo-ord-4921b",
            isDemo: true,
            userId: "buyer-2",
            user: { name: "Commercial Buyer" },
            totalAmount: 6000,
            grossAmount: 6000,
            commissionRate: 10.0,
            commissionAmount: 600,
            sellerNetAmount: 5400,
            totalBoxes: 3,
            status: "PLACED",
            createdAt: new Date(Date.now() - 3600000 * 2),
            address: { street: "EarthCentric Fulfillment Hub", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India" },
            items: [
              {
                productId: "prod-pdf-2",
                name: "Round Plate 10 Inch (Bulk)",
                quantity: 3,
                boxes: 3,
                unitsPerBox: 50,
                totalUnits: 150,
                price: 2000,
                pricePerBox: 2000,
                commissionRate: 10.0,
                commissionAmount: 600,
                sellerNetAmount: 5400,
                image: "/images/products/product_p1_2.png"
              }
            ],
            paymentStatus: "PENDING",
            timeline: [],
          }
        ];
      }
      return mockOrders
        .filter((order) => order.isDemo && order.isForwardedToSeller === true)
        .map((order) => ({
          ...order,
          sellerId: requestedSellerId,
          assignedSellerId: requestedSellerId,
          items: order.items.map((item) => ({ ...item, sellerId: requestedSellerId })),
        }));
    }

    // Resolve seller ID candidate keys
    let seller = await db.seller.findUnique({ where: { id: requestedSellerId } });
    if (!seller) {
      seller = await db.seller.findUnique({ where: { userId: requestedSellerId } });
    }
    
    const candidateSellerIds = Array.from(
      new Set([requestedSellerId, seller?.id, seller?.userId].filter(Boolean) as string[])
    );

    const dbOrders = await db.order.findMany({
      where: {
        payment: {
          status: "COMPLETED",
        },
        isForwardedToSeller: true,
        OR: [
          { sellerId: { in: candidateSellerIds } },
          { assignedSellerId: { in: candidateSellerIds } },
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
        user: { select: { id: true, name: true } }, // Privacy: Exclude buyer email and phone
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

    return dbOrders.map((order) => {
      const grossAmount = order.grossAmount ?? order.totalAmount;
      const commissionRate = order.commissionRate ?? 10.0;
      const commissionAmount = order.commissionAmount ?? Math.round(((grossAmount * commissionRate) / 100) * 100) / 100;
      const sellerNetAmount = order.sellerNetAmount ?? Math.round((grossAmount - commissionAmount) * 100) / 100;
      const totalBoxes = order.totalBoxes ?? order.items.reduce((sum, it) => sum + (it.boxes || it.quantity), 0);

      return {
        id: order.id,
        userId: order.userId,
        orderReceivedFrom: "EarthCentric",
        // Requirement 3: Strictly Minimum Necessary Info - Never expose buyer personal details
        user: {
          name: "EarthCentric",
        },
        totalAmount: order.totalAmount,
        grossAmount,
        commissionRate,
        commissionAmount,
        sellerNetAmount,
        totalBoxes,
        status: order.status as any,
        isForwardedToSeller: true,
        forwardedAt: (order as any).forwardedAt,
        adminFulfillmentInstructions: (order as any).adminFulfillmentInstructions || "Pack utilizing 100% biodegradable FSC certified packaging. Dispatch via EarthCentric logistics partner.",
        fulfillmentDeadline: (order as any).fulfillmentDeadline,
        adminReviewStatus: (order as any).adminReviewStatus || "FORWARDED_TO_SELLER",
        createdAt: order.createdAt,
        // Requirement 3: Strictly Buyer Privacy - Mask private shipping address to EarthCentric Hub
        address: {
          street: "EarthCentric Central Fulfillment Hub",
          city: order.address.city,
          state: order.address.state,
          postalCode: order.address.postalCode,
          country: order.address.country,
        },
        items: order.items.map((it) => {
          const boxes = it.boxes ?? it.quantity;
          const unitsPerBox = it.unitsPerBox ?? (it.product as any).unitsPerBox ?? (it.product as any).bulkOrderQuantity ?? 100;
          const totalUnits = it.totalUnits ?? (boxes * unitsPerBox);
          const pricePerBox = it.pricePerBox ?? it.price;
          const itemCommissionRate = it.commissionRate ?? commissionRate;
          const basePrice = (it as any).sellerBasePrice ?? (it.product as any).sellerBasePrice;
          const itemCommission = it.commissionAmount ?? (basePrice ? Math.round((basePrice * (itemCommissionRate / 100) * boxes) * 100) / 100 : Math.round(((pricePerBox * boxes * itemCommissionRate) / 100) * 100) / 100);
          const itemSellerNet = it.sellerNetAmount ?? (basePrice ? Math.round((basePrice * boxes) * 100) / 100 : Math.round(((pricePerBox * boxes) - itemCommission) * 100) / 100);

          return {
            productId: it.productId,
            name: it.product.name,
            quantity: boxes,
            boxes,
            unitsPerBox,
            totalUnits,
            price: pricePerBox,
            pricePerBox,
            commissionRate: itemCommissionRate,
            commissionAmount: itemCommission,
            sellerNetAmount: itemSellerNet,
            image: it.product.images[0]?.url || "",
          };
        }),
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
    console.error("getOrdersBySeller failed:", e);
    throw new Error("Could not retrieve seller orders. Please try again.");
  }
}

export async function getAllOrdersForAdmin(): Promise<OrderDetail[]> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) throw new Error("Super Admin access is required to view all orders.");
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
        user: { select: { name: true, email: true, phone: true } },
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
        cancellations: {
          include: {
            returnCollection: true,
          },
          orderBy: { requestedAt: "desc" },
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

      const grossAmount = order.grossAmount ?? order.totalAmount;
      const commissionRate = order.commissionRate ?? 10.0;
      const commissionAmount = order.commissionAmount ?? Math.round(((grossAmount * commissionRate) / 100) * 100) / 100;
      const sellerNetAmount = order.sellerNetAmount ?? Math.round((grossAmount - commissionAmount) * 100) / 100;
      const totalBoxes = order.totalBoxes ?? order.items.reduce((sum, it) => sum + (it.boxes || it.quantity), 0);

      return {
        id: order.id,
        userId: order.userId,
        sellerId: order.sellerId || (order as any).assignedSellerId || resolvedSeller?.id || null,
        assignedSellerId: (order as any).assignedSellerId || order.sellerId || resolvedSeller?.id || null,
        isForwardedToSeller: (order as any).isForwardedToSeller ?? false,
        forwardedAt: (order as any).forwardedAt ?? null,
        forwardedByAdminEmail: (order as any).forwardedByAdminEmail ?? null,
        adminFulfillmentInstructions: (order as any).adminFulfillmentInstructions ?? null,
        fulfillmentDeadline: (order as any).fulfillmentDeadline ?? null,
        adminReviewStatus: (order as any).adminReviewStatus ?? "PENDING_REVIEW",
        seller: resolvedSeller,
        totalAmount: order.totalAmount,
        grossAmount,
        commissionRate,
        commissionAmount,
        sellerNetAmount,
        totalBoxes,
        gstin: order.gstin || undefined,
        status: order.status as any,
        createdAt: order.createdAt,
        address: {
          street: order.address.street,
          city: order.address.city,
          state: order.address.state,
          postalCode: order.address.postalCode,
          country: order.address.country,
        },
        items: order.items.map((it) => {
          const boxes = it.boxes ?? it.quantity;
          const unitsPerBox = it.unitsPerBox ?? (it.product as any).unitsPerBox ?? 100;
          const totalUnits = it.totalUnits ?? (boxes * unitsPerBox);
          const pricePerBox = it.pricePerBox ?? it.price;
          const itemCommissionRate = it.commissionRate ?? commissionRate;
          const basePrice = (it as any).sellerBasePrice ?? (it.product as any).sellerBasePrice;
          const itemCommission = it.commissionAmount ?? (basePrice ? Math.round((basePrice * (itemCommissionRate / 100) * boxes) * 100) / 100 : Math.round(((pricePerBox * boxes * itemCommissionRate) / 100) * 100) / 100);
          const itemSellerNet = it.sellerNetAmount ?? (basePrice ? Math.round((basePrice * boxes) * 100) / 100 : Math.round(((pricePerBox * boxes) - itemCommission) * 100) / 100);

          return {
            productId: it.productId,
            name: it.product.name,
            quantity: boxes,
            boxes,
            unitsPerBox,
            totalUnits,
            price: pricePerBox,
            pricePerBox,
            commissionRate: itemCommissionRate,
            commissionAmount: itemCommission,
            sellerNetAmount: itemSellerNet,
            image: it.product.images[0]?.url || "",
            seller: it.product?.seller ? {
              id: it.product.seller.id,
              companyName: it.product.seller.companyName,
              email: it.product.seller.user?.email || "",
              phone: it.product.seller.phone || "Not provided",
            } : resolvedSeller,
          };
        }),
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
          phone: (order.user as any)?.phone || "",
        },
        cancellation: mapLatestCancellation(order.cancellations),
        cancellations: order.cancellations || [],
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
  requester: { userId: string; email: string; role: string; sellerId?: string },
  options?: { selectedProductIds?: string[]; itemQuantities?: Record<string, number> }
): Promise<{ success: boolean; error?: string; cancellationId?: string; autoApproved?: boolean }> {
  try {
    const cleanedReason = reason.trim();
    if (cleanedReason.length < 8 || cleanedReason.length > 500) {
      return { success: false, error: "Please provide a reason between 8 and 500 characters." };
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        seller: { select: { id: true, userId: true, companyName: true } },
        user: { select: { id: true, name: true, email: true } },
        payment: { select: { status: true, amount: true, cashfreeOrderId: true } },
        timeline: { orderBy: { createdAt: "asc" } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
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

    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return { success: false, error: "This order has already been cancelled or refunded." };
    }
    if (order.status === "SHIPPED") {
      return { success: false, error: "This order cannot be cancelled while in transit. Once delivered, you can request a return." };
    }
    if (!["PLACED", "CONFIRMED", "PACKED", "DELIVERED"].includes(order.status)) {
      return { success: false, error: "Cancellation or return is not available for this order status." };
    }
    if (order.cancellations.length > 0) {
      return { success: false, error: "An active cancellation or return request already exists for this order." };
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
      return { success: false, error: "You can only request cancellation or return for your own order." };
    }

    const isDelivered = order.status === "DELIVERED";
    const requestType = isDelivered ? "RETURN" : "CANCELLATION";
    let deliveryDate: Date | null = null;
    let shouldAutoApprove = false;

    if (isDelivered) {
      const deliveredEvent = order.timeline.find((t) => t.status === "DELIVERED");
      deliveryDate = order.deliveredAt || deliveredEvent?.createdAt || order.updatedAt;
      const deliveryTime = new Date(deliveryDate).getTime();
      const daysSinceDelivery = (Date.now() - deliveryTime) / (1000 * 60 * 60 * 24);

      // Return window policy: 7 days from delivery date
      if (requester.role !== "ADMIN" && daysSinceDelivery > 7) {
        return {
          success: false,
          error: "Return period expired. Returns can only be requested within 7 days of delivery.",
        };
      }
    } else {
      // Pre-shipment: check order age against 3-day (72-hour) cancellation policy
      const orderCreatedAt = new Date(order.createdAt).getTime();
      const ageHours = (Date.now() - orderCreatedAt) / (1000 * 60 * 60);

      if (requester.role !== "ADMIN" && ageHours > CANCELLATION_WINDOW_HOURS) {
        return {
          success: false,
          error: "Cancellation period expired. Orders can only be cancelled within 3 days (72 hours) of placement.",
        };
      }

      // First 24-hour pre-shipment automatic cancellation policy
      if (ageHours <= 24 && ["PLACED", "CONFIRMED", "PACKED"].includes(order.status)) {
        shouldAutoApprove = true;
      }
    }

    // Determine affected items
    let itemsToProcess = order.items;
    if (options?.selectedProductIds && options.selectedProductIds.length > 0) {
      const filtered = order.items.filter((it) => options.selectedProductIds!.includes(it.productId));
      if (filtered.length > 0) {
        itemsToProcess = filtered;
      }
    }

    const snapshotItems = itemsToProcess.map((it) => {
      const returnQty = options?.itemQuantities?.[it.productId] ?? it.quantity;
      return {
        productId: it.productId,
        sku: it.product?.slug || it.productId.slice(0, 8).toUpperCase(),
        name: it.product?.name || "Product",
        quantity: Math.min(Math.max(1, returnQty), it.quantity),
        price: it.price,
        subtotal: it.price * Math.min(Math.max(1, returnQty), it.quantity),
        image: it.product?.images?.[0]?.url || "",
        sellerId: it.product?.sellerId || order.sellerId,
        sellerName: it.product?.seller?.companyName || order.seller?.companyName || "EarthCentric Seller",
      };
    });

    let calculatedRefundAmount = order.totalAmount + (order.shippingFee || 0);
    if (options?.selectedProductIds && options.selectedProductIds.length > 0) {
      const itemsSum = snapshotItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
      calculatedRefundAmount = Math.min(Math.round(itemsSum * 100) / 100, order.totalAmount);
      const allItemsReturned = snapshotItems.length === order.items.length &&
        order.items.every((orderItem) => {
          const returned = snapshotItems.find((snapshotItem) => snapshotItem.productId === orderItem.productId);
          return returned?.quantity === orderItem.quantity;
        });
      if (allItemsReturned) calculatedRefundAmount += order.shippingFee || 0;
    }

    const resultingRefundStatus: RefundState =
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
          status: shouldAutoApprove ? "APPROVED" : "REQUESTED",
          type: requestType,
          deliveredAt: deliveryDate,
          isAutoApproved: shouldAutoApprove,
          refundStatus: resultingRefundStatus,
          refundAmount: calculatedRefundAmount,
          snapshotItems,
          reviewedAt: shouldAutoApprove ? new Date() : null,
          reviewedByUserId: shouldAutoApprove ? "SYSTEM_AUTO" : null,
          reviewedByEmail: shouldAutoApprove ? "system@earthcentric.com" : null,
        },
      });

      if (shouldAutoApprove) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "CANCELLED" },
        });

        // Restore stock for auto-approved pre-shipment cancellation
        for (const item of snapshotItems) {
          if (item.productId && item.quantity > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            }).catch((err) => console.warn(`Could not restore stock for product ${item.productId}:`, err));
          }
        }

        await tx.orderTimeline.create({
          data: {
            orderId,
            status: "CANCELLED",
            description: `Order automatically cancelled within 24-hour pre-shipment policy. Reason: ${cleanedReason}. Refund initiated.`,
          },
        });
      } else {
        await tx.orderTimeline.create({
          data: {
            orderId,
            status: order.status,
            description: isDelivered
              ? `${requester.role === "SELLER" ? "Seller" : "Buyer"} requested return for delivered order. Reason: ${cleanedReason}. Awaiting Super Admin review, collection, and refund approval.`
              : `${requester.role === "SELLER" ? "Seller" : "Buyer"} requested cancellation (within 3-day window). Reason: ${cleanedReason}. Awaiting Super Admin review and refund approval.`,
          },
        });
      }

      return record;
    });

    if (shouldAutoApprove) {
      if (resultingRefundStatus === "PENDING") {
        await startCancellationRefund(cancellation.id).catch((err) =>
          console.error("Auto-cancellation refund error:", err)
        );
      }
      await sendAutoCancellationEmail(requester.email, {
        orderId,
        customerName: order.user?.name || undefined,
        items: snapshotItems.map((it) => ({ name: it.name, quantity: it.quantity, price: it.price })),
        refundAmount: calculatedRefundAmount,
        cancelDate: new Date(),
      }).catch((err) => console.error("Auto-cancellation email error:", err));

      await createNotification(
        order.userId,
        "Order Cancelled Automatically ⚡",
        `Order ${orderId} was cancelled per our instant 24-hour policy. Refund of ₹${calculatedRefundAmount.toFixed(2)} is being processed.`,
        `/orders/${orderId}`
      ).catch((e) => console.error("Notification error:", e));
    } else {
      // Send confirmation email
      await sendCancellationRequestedEmail(requester.email, {
        orderId,
        customerName: order.user?.name || undefined,
        items: snapshotItems,
        refundAmount: calculatedRefundAmount,
        requestDate: new Date(),
      }).catch((err) => console.error("Cancellation requested email error:", err));

      const requesterLabel = requester.role === "SELLER" ? "Seller" : "Buyer";
      const actionLabel = isDelivered ? "Return" : "Cancellation";
      await createNotification(
        order.userId,
        `${actionLabel} request received ⏳`,
        `${actionLabel} requested for order ${orderId}. Your request is awaiting Super Admin review and approval. Once approved, the refund will be initiated.`,
        `/orders/${orderId}`
      ).catch((e) => console.error("Notification error:", e));

      await createAdminNotification(
        `Order ${actionLabel.toLowerCase()} needs review`,
        `${requesterLabel} requested ${actionLabel.toLowerCase()} for order ${orderId}${isDelivered ? " (Delivered Order Return)" : " (within 3-day policy)"}. Reason: ${cleanedReason}`,
        "cancellations"
      ).catch((e) => console.error("Admin alert error:", e));
    }

    try {
      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/cancellations");
      revalidatePath("/admin/dashboard");
      revalidatePath("/orders");
      revalidatePath(`/orders/${orderId}`);
    } catch (_) {}

    return { success: true, autoApproved: shouldAutoApprove, cancellationId: cancellation.id };
  } catch (e) {
    console.error("createCancellationRequest failed:", e);
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      e.code === "P2002"
    ) {
      return { success: false, error: "An active cancellation or return request already exists for this order." };
    }
    return { success: false, error: "Failed to submit the request." };
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

export async function cancelOrder(
  orderId: string,
  userId?: string,
  reason?: string,
  options?: { selectedProductIds?: string[]; itemQuantities?: Record<string, number> }
) {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    return { success: false, error: "Cancellation review requires the configured database." };
  }
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId || !auth.email) {
    return { success: false, error: "Sign in to the account that placed this order." };
  }
  if (userId && auth.userId !== userId && auth.role !== "ADMIN") {
    return { success: false, error: "You can only request cancellation or return for your own order." };
  }
  return createCancellationRequest(
    orderId,
    reason || "Buyer requested cancellation/return.",
    {
      userId: auth.userId,
      email: auth.email,
      role: auth.role === "ADMIN" ? "ADMIN" : "BUYER",
    },
    options
  );
}

export async function requestDeliveredOrderReturn(
  orderId: string,
  reason: string,
  options?: { selectedProductIds?: string[]; itemQuantities?: Record<string, number> }
) {
  return cancelOrder(orderId, undefined, reason, options);
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
  } else if (filterStatus === "RETURNS") {
    whereClause = { type: "RETURN" };
  } else if (filterStatus === "CANCELLATIONS") {
    whereClause = { type: "CANCELLATION" };
  }

  return db.orderCancellation.findMany({
    where: whereClause,
    include: {
      returnCollection: true,
      order: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          seller: { select: { id: true, companyName: true, phone: true } },
          payment: true,
          address: true,
          timeline: { orderBy: { createdAt: "asc" } },
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

  const auth = await verifySellerAuth(sellerIdOrUserId);
  if (!auth.authorized) {
    throw new Error("Seller access required to view cancelled orders.");
  }
  const adminAuth = await verifyAdminAuth();
  const requestedSellerId = adminAuth.authorized ? sellerIdOrUserId : auth.sellerId;
  if (!requestedSellerId) throw new Error("No seller profile is linked to this account.");

  // Resolve seller ID
  let seller = await db.seller.findUnique({ where: { id: requestedSellerId } });
  if (!seller) {
    seller = await db.seller.findUnique({ where: { userId: requestedSellerId } });
  }
  const candidateIds = Array.from(new Set([requestedSellerId, seller?.id, seller?.userId].filter(Boolean) as string[]));

  // Orders that either have a cancellation record OR are in CANCELLED/REFUNDED/RETURNED status
  const orders = await db.order.findMany({
    where: {
      OR: [
        { sellerId: { in: candidateIds } },
        { items: { some: { product: { sellerId: { in: candidateIds } } } } },
      ],
      AND: [
        {
          OR: [
            { status: { in: ["CANCELLED", "REFUNDED", "RETURNED"] } },
            { cancellations: { some: {} } },
          ],
        },
      ],
    },
    include: {
      user: { select: { name: true, email: true } },
      address: { select: { city: true, state: true } },
      timeline: { orderBy: { createdAt: "asc" } },
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
        include: {
          returnCollection: true,
        },
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
    const deliveredEvent = o.timeline?.find((t) => t.status === "DELIVERED");

    return {
      orderId: o.id,
      orderCreatedAt: o.createdAt,
      orderStatus: o.status,
      deliveredAt: o.deliveredAt || deliveredEvent?.createdAt || null,
      totalAmount: o.totalAmount,
      sellerSubtotal,
      sellerItems: sellerItems.map((it) => ({
        productId: it.productId,
        name: it.product.name,
        image: it.product.images[0]?.url || "",
        sku: it.product.slug || it.productId.slice(0, 8).toUpperCase(),
        price: it.price,
        quantity: it.quantity,
      })),
      cancellation: latestCancellation
        ? {
            id: latestCancellation.id,
            status: latestCancellation.status, // REQUESTED, APPROVED, REJECTED
            type: latestCancellation.type || "CANCELLATION",
            deliveredAt: latestCancellation.deliveredAt || o.deliveredAt || deliveredEvent?.createdAt || null,
            isAutoApproved: latestCancellation.isAutoApproved,
            reason: latestCancellation.reason,
            adminNote: latestCancellation.adminNote,
            rejectionReason: latestCancellation.rejectionReason,
            requestedAt: latestCancellation.requestedAt,
            reviewedAt: latestCancellation.reviewedAt,
            refundStatus: latestCancellation.refundStatus,
            refundAmount: latestCancellation.refundAmount,
            returnCollection: latestCancellation.returnCollection
              ? {
                  id: latestCancellation.returnCollection.id,
                  status: latestCancellation.returnCollection.status,
                  collectionDeadline: latestCancellation.returnCollection.collectionDeadline,
                  scheduledAt: latestCancellation.returnCollection.scheduledAt,
                  collectedAt: latestCancellation.returnCollection.collectedAt,
                  inspectedAt: latestCancellation.returnCollection.inspectedAt,
                  failureReason: latestCancellation.returnCollection.failureReason,
                  notes: latestCancellation.returnCollection.notes,
                }
              : null,
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
        returnCollection: true,
        order: {
          include: {
            payment: true,
            user: { select: { id: true, name: true, email: true } },
            timeline: { orderBy: { createdAt: "asc" } },
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
      return { success: false, error: "This request is no longer awaiting review." };
    }

    const isReturn = cancellation.type === "RETURN" || cancellation.order.status === "DELIVERED";

    if (decision === "APPROVE") {
      if (!isReturn && !["PLACED", "CONFIRMED", "PACKED"].includes(cancellation.order.status)) {
        return { success: false, error: "The pre-shipment order has already shipped or completed." };
      }
      if (isReturn && !["DELIVERED", "CONFIRMED", "PACKED", "PLACED", "RETURNED"].includes(cancellation.order.status)) {
        return { success: false, error: "This order is not eligible for return approval." };
      }
    }

    const resultingRefundStatus: RefundState =
      decision === "REJECT"
        ? "NOT_REQUIRED"
        : cancellation.order.payment?.status === "COMPLETED"
          ? "PENDING"
          : cancellation.order.payment?.status === "PENDING"
            ? "PENDING_PAYMENT"
            : "NOT_REQUIRED";

    const collectionDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

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
        throw new Error("This cancellation/return request was already reviewed.");
      }

      if (decision === "APPROVE") {
        if (isReturn) {
          // 1. Create ReturnCollection record with 5-day deadline
          await tx.returnCollection.create({
            data: {
              cancellationId,
              orderId: cancellation.orderId,
              status: "COLLECTION_PENDING",
              approvedAt: new Date(),
              collectionDeadline,
              notes: note || null,
            },
          });

          // 2. Update order status to RETURNED
          await tx.order.update({
            where: { id: cancellation.orderId },
            data: { status: "RETURNED" },
          });

          // 3. Add timeline entry
          await tx.orderTimeline.create({
            data: {
              orderId: cancellation.orderId,
              status: "RETURNED",
              description: `Return request approved by Super Admin. Collection scheduled within 5 days (deadline: ${collectionDeadline.toLocaleDateString("en-IN")}). Cashfree refund initiated.${note ? ` Admin note: ${note}` : ""}`,
            },
          });
        } else {
          // Pre-shipment cancellation
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

          // Restore product stock for pre-shipment cancelled items
          const itemsToRestore = (cancellation.snapshotItems as any[]) || cancellation.order.items || [];
          for (const item of itemsToRestore) {
            if (item.productId && item.quantity > 0) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              }).catch((err) => console.warn(`Could not restore stock for product ${item.productId}:`, err));
            }
          }

          await tx.orderTimeline.create({
            data: {
              orderId: cancellation.orderId,
              status: "CANCELLED",
              description: `Cancellation approved by Super Admin. Reason: ${cancellation.reason}. Refund status: ${resultingRefundStatus}.${note ? ` Admin note: ${note}` : ""}`,
            },
          });
        }
      } else {
        // Rejection
        await tx.orderTimeline.create({
          data: {
            orderId: cancellation.orderId,
            status: cancellation.order.status,
            description: `${isReturn ? "Return" : "Cancellation"} request rejected by Super Admin. Reason: ${note}`,
          },
        });
      }
    });

    try {
      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/cancellations");
      revalidatePath("/admin/dashboard");
      revalidatePath("/orders");
      revalidatePath(`/orders/${cancellation.orderId}`);
    } catch (_) {}

    const customerEmail = cancellation.order.user?.email || cancellation.requestedByEmail;
    const customerName = cancellation.order.user?.name || undefined;

    if (decision === "APPROVE") {
      const refundAmount = cancellation.refundAmount || cancellation.order.totalAmount;
      const snapshot = (cancellation.snapshotItems as any[]) || [];
      const productNames = snapshot.map((it: any) => it.name).filter(Boolean).join(", ") || cancellation.order.items[0]?.product?.name || "Product";
      const totalQty = snapshot.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0) || cancellation.order.items.reduce((s, it) => s + it.quantity, 0) || 1;
      const deliveredEvent = cancellation.order.timeline?.find((t) => t.status === "DELIVERED");
      const deliveryDate = cancellation.deliveredAt || cancellation.order.deliveredAt || deliveredEvent?.createdAt || null;

      if (isReturn) {
        // Send required delivered return approved email with 5-day collection details
        if (customerEmail) {
          await sendDeliveredReturnApprovedEmail(customerEmail, {
            orderId: cancellation.orderId,
            customerName,
            productName: productNames,
            quantity: totalQty,
            orderDate: cancellation.order.createdAt,
            deliveryDate,
            refundAmount,
            approvalDate: new Date(),
            refundInitiated: resultingRefundStatus === "PENDING",
          }).catch((err) => console.error("Delivered return approved email error:", err));
        }

        await createNotification(
          cancellation.order.userId,
          "Return request approved ✅",
          `Return approved for order ${cancellation.orderId}. Return collection will be arranged within 5 days. Refund of ₹${refundAmount.toLocaleString("en-IN")} is being initiated via Cashfree.`,
          `/orders/${cancellation.orderId}`
        ).catch((e) => console.error("Notification error:", e));
      } else {
        // Pre-shipment cancellation approved email
        if (customerEmail) {
          await sendCancellationApprovedEmail(customerEmail, {
            orderId: cancellation.orderId,
            customerName,
            approvedAmount: refundAmount,
            approvalDate: new Date(),
            refundStatus: resultingRefundStatus,
            refundInitiated: resultingRefundStatus === "PENDING",
          }).catch((err) => console.error("Cancellation approved email error:", err));
        }

        const buyerMessage =
          resultingRefundStatus === "PENDING"
            ? `Order ${cancellation.orderId} was cancelled. Refund of ₹${refundAmount.toLocaleString("en-IN")} is being initiated.`
            : resultingRefundStatus === "PENDING_PAYMENT"
              ? `Order ${cancellation.orderId} was cancelled. Payment is pending; refund eligibility will be checked if payment completes.`
              : `Order ${cancellation.orderId} was cancelled. No captured payment was found.`;

        await createNotification(
          cancellation.order.userId,
          "Order cancellation approved ✅",
          buyerMessage,
          `/orders/${cancellation.orderId}`
        ).catch((e) => console.error("Notification error:", e));
      }

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
        `${isReturn ? "Return" : "Cancellation"} request declined 📋`,
        `${isReturn ? "Return" : "Cancellation"} for order ${cancellation.orderId} was not approved. Reason: ${note}`,
        `/orders/${cancellation.orderId}`
      ).catch((e) => console.error("Notification error:", e));

      return { success: true, refundStatus: "NOT_REQUIRED" };
    }
  } catch (error) {
    console.error("reviewOrderCancellation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to review the request.",
    };
  }
}

export async function updateReturnCollectionStatus(
  cancellationId: string,
  status: "COLLECTION_PENDING" | "SCHEDULED" | "COLLECTED" | "INSPECTION_PENDING" | "RETURNED_TO_SELLER" | "FAILED",
  details?: {
    notes?: string;
    failureReason?: string;
    scheduledAt?: Date | string;
    collectedAt?: Date | string;
  }
): Promise<{ success: boolean; error?: string; returnCollection?: any }> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) {
    return { success: false, error: "Super Admin access is required to update return collection." };
  }

  try {
    const cancellation = await db.orderCancellation.findUnique({
      where: { id: cancellationId },
      include: {
        returnCollection: true,
        order: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            items: true,
          },
        },
      },
    });

    if (!cancellation) {
      return { success: false, error: "Request record not found." };
    }

    const updatedCollection = await db.returnCollection.upsert({
      where: { cancellationId },
      update: {
        status,
        notes: details?.notes ?? undefined,
        failureReason: details?.failureReason ?? (status === "FAILED" ? "Collection attempt failed." : null),
        scheduledAt: details?.scheduledAt ? new Date(details.scheduledAt) : undefined,
        collectedAt: details?.collectedAt ? new Date(details.collectedAt) : (status === "COLLECTED" ? new Date() : undefined),
        inspectedAt: status === "INSPECTION_PENDING" || status === "RETURNED_TO_SELLER" ? new Date() : undefined,
      },
      create: {
        cancellationId,
        orderId: cancellation.orderId,
        status,
        collectionDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        notes: details?.notes || null,
        failureReason: details?.failureReason || null,
        scheduledAt: details?.scheduledAt ? new Date(details.scheduledAt) : null,
        collectedAt: status === "COLLECTED" ? new Date() : null,
      },
    });

    // When status reaches RETURNED_TO_SELLER, inspection is complete: restore product stock!
    if (status === "RETURNED_TO_SELLER") {
      const itemsToRestore = (cancellation.snapshotItems as any[]) || cancellation.order.items || [];
      for (const item of itemsToRestore) {
        if (item.productId && item.quantity > 0) {
          await db.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          }).catch((err) => console.warn(`Could not restore stock for product ${item.productId}:`, err));
        }
      }
    }

    await db.orderTimeline.create({
      data: {
        orderId: cancellation.orderId,
        status: cancellation.order.status,
        description: `Return collection status updated to ${status.replace(/_/g, " ")}.${details?.failureReason ? ` Failure reason: ${details.failureReason}.` : ""}${details?.notes ? ` Notes: ${details.notes}.` : ""}`,
      },
    });

    try {
      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/cancellations");
      revalidatePath("/admin/dashboard");
      revalidatePath("/orders");
      revalidatePath(`/orders/${cancellation.orderId}`);
    } catch (_) {}

    const customerEmail = cancellation.order.user?.email || cancellation.requestedByEmail;
    if (customerEmail) {
      await sendReturnCollectionUpdateEmail(customerEmail, {
        orderId: cancellation.orderId,
        customerName: cancellation.order.user?.name || undefined,
        status,
        notes: details?.notes,
        failureReason: details?.failureReason,
        scheduledDate: details?.scheduledAt,
      }).catch((e) => console.error("Return collection update email error:", e));
    }

    await createNotification(
      cancellation.order.userId,
      `Return Collection: ${status.replace(/_/g, " ")}`,
      `Return collection status for order ${cancellation.orderId} was updated to ${status.replace(/_/g, " ")}.`,
      `/orders/${cancellation.orderId}`
    ).catch((e) => console.error("Notification error:", e));

    return { success: true, returnCollection: updatedCollection };
  } catch (error) {
    console.error("updateReturnCollectionStatus failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update return collection status.",
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
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Sign in to track an order." };
    }
    const adminAuth = await verifyAdminAuth();
    const isAdmin = adminAuth.authorized;
    const sellerAuth = !isAdmin && auth.role === "SELLER" ? await verifySellerAuth() : null;
    if (!isAdmin && auth.role === "SELLER" && (!sellerAuth?.authorized || !sellerAuth.sellerId)) {
      return { success: false, error: "Seller access is required to track this order." };
    }
    if (
      !isAdmin &&
      sellerIdFilter &&
      (!sellerAuth ||
        (sellerIdFilter !== sellerAuth.sellerId && sellerIdFilter !== sellerAuth.userId))
    ) {
      return { success: false, error: "You can only track orders assigned to your seller account." };
    }
    const requestedSellerId = isAdmin ? sellerIdFilter : sellerAuth?.sellerId;

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      let order = mockOrders.find(
        (o) => o.id.toLowerCase() === cleanId.toLowerCase() || o.id.toLowerCase().includes(cleanId.toLowerCase())
      );

      if (!order) {
        return { success: false, error: `No order found matching Tracking ID "${cleanId}".` };
      }

      const isOrderBuyer = order.userId === auth.userId;
      const isOrderSeller =
        Boolean(sellerAuth?.sellerId) &&
        order.isForwardedToSeller === true &&
        (order.isDemo === true ||
          order.sellerId === sellerAuth?.sellerId ||
          order.assignedSellerId === sellerAuth?.sellerId ||
          order.items.some((item) => item.sellerId === sellerAuth?.sellerId));
      if (!isAdmin && !isOrderBuyer && !isOrderSeller) {
        return { success: false, error: "You are not authorized to track this order." };
      }

      const sellerItems = isOrderSeller
        ? order.items.filter((item) => order.isDemo || item.sellerId === sellerAuth?.sellerId)
        : requestedSellerId
          ? order.items.filter((item) => item.sellerId === requestedSellerId)
          : order.items;
      if (!sellerItems.length) {
        return { success: false, error: "No items belonging to your brand exist under this tracking ID." };
      }

      const brandTotalAmount = sellerItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      return {
        success: true,
        order: {
          ...order,
          ...(isOrderSeller && order.isDemo
            ? {
                sellerId: sellerAuth?.sellerId,
                assignedSellerId: sellerAuth?.sellerId,
                items: sellerItems.map((item) => ({ ...item, sellerId: sellerAuth?.sellerId })),
              }
            : { items: sellerItems }),
          brandTotalAmount,
          user: isOrderSeller || requestedSellerId ? {
            name: "Commercial Buyer (Verified)",
          } : {
            name: (order as any).user?.name || "Verified Buyer",
            email: (order as any).user?.email || "buyer@earthcentric.com",
            phone: (order as any).user?.phone || "+91 9876543210",
          },
          address: isOrderSeller || requestedSellerId ? {
            street: "EarthCentric Central Fulfillment Hub",
            city: order.address?.city || "Bengaluru",
            state: order.address?.state || "Karnataka",
            postalCode: order.address?.postalCode || "560001",
            country: order.address?.country || "India",
          } : order.address,
        },
      };
    }

    // Database lookup (only paid orders)
    let targetSellerId = requestedSellerId;
    if (isAdmin && targetSellerId) {
      const seller = await db.seller.findFirst({
        where: { OR: [{ id: targetSellerId }, { userId: targetSellerId }] },
        select: { id: true },
      });
      if (!seller) {
        return { success: false, error: "The selected seller could not be found." };
      }
      targetSellerId = seller.id;
    }
    const trackingFilter = {
      OR: [
        { id: { equals: cleanId, mode: "insensitive" as const } },
        { id: { contains: cleanId, mode: "insensitive" as const } },
        { paymentGroupId: { equals: cleanId, mode: "insensitive" as const } },
      ],
    };
    const sellerFilter = targetSellerId
      ? {
          OR: [
            { sellerId: targetSellerId },
            { assignedSellerId: targetSellerId },
            { items: { some: { product: { sellerId: targetSellerId } } } },
          ],
        }
      : undefined;
    const dbOrder = await db.order.findFirst({
      where: {
        payment: { status: "COMPLETED" },
        AND: [
          trackingFilter,
          ...(isAdmin ? (sellerFilter ? [sellerFilter] : []) : sellerFilter ? [sellerFilter] : [{ userId: auth.userId }]),
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

    if (targetSellerId) {
      items = items.filter(
        (it) => it.sellerId === targetSellerId
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
      address: targetSellerId ? {
        street: "EarthCentric Central Fulfillment Hub",
        city: dbOrder.address.city,
        state: dbOrder.address.state,
        postalCode: dbOrder.address.postalCode,
        country: dbOrder.address.country,
      } : {
        street: dbOrder.address.street,
        city: dbOrder.address.city,
        state: dbOrder.address.state,
        postalCode: dbOrder.address.postalCode,
        country: dbOrder.address.country,
      },
      user: targetSellerId ? {
        name: dbOrder.user?.name ? `Commercial Buyer (${dbOrder.user.name.split(" ")[0]})` : "Commercial Buyer",
      } : {
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
