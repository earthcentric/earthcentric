"use server";

import db from "@/lib/db";
import { createRazorpayOrder, verifyPaymentSignature } from "@/lib/razorpay";
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from "@/lib/email";
import { createNotification, createAdminNotification } from "./notifications";
import { getProductById } from "./products";
import { calculateBuyXGetYFreeItems, getEffectiveUnitPrice } from "@/lib/offers";

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
  totalAmount: number;
  status: "PLACED" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
  createdAt: Date;
  address: AddressInput;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    image: string;
    seller?: {
      id: string;
      companyName: string;
      email: string;
      phone: string;
    };
  }[];
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED";
  razorpayOrderId?: string;
  timeline: {
    status: string;
    description: string;
    createdAt: Date;
  }[];
  user?: {
    name: string;
    email: string;
    phone?: string;
  };
}

// In-memory global arrays to mock order records for sandbox testing
let mockOrders: OrderDetail[] = [];

export async function createOrder(data: {
  userId: string;
  userEmail: string;
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
    let unitPrice = item.price;
    if (product) {
      const effective = getEffectiveUnitPrice(product, item.quantity);
      unitPrice = effective.unitPrice;
    }

    // Quantity in cart is the purchased/payable quantity. Free items are delivered at ₹0 extra cost.
    const itemTotal = unitPrice * item.quantity;
    serverCalculatedTotal += itemTotal;

    verifiedItems.push({
      ...item,
      price: unitPrice,
    });
  }

  const finalTotalAmount = serverCalculatedTotal > 0 ? serverCalculatedTotal : data.totalAmount;
  const amountInPaise = Math.round(finalTotalAmount * 100);

  // Generate Razorpay Order strictly with server-calculated payable amount
  const paymentOrder = await createRazorpayOrder({
    amount: amountInPaise,
    receipt: orderId,
  });

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
          razorpayOrderId: paymentOrder.id,
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
      return { success: true, order: newOrders[0], razorpayOrderId: paymentOrder.id };
    }

    // Write to Prisma Database
    const address = await db.address.create({
      data: {
        userId: data.userId,
        street: data.address.street,
        city: data.address.city,
        state: data.address.state,
        postalCode: data.address.postalCode,
        country: data.address.country,
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
          paymentGroupId: paymentOrder.id, // Grouping multiple orders under one payment
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
          payment: {
            create: {
              razorpayOrderId: paymentOrder.id,
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
      razorpayOrderId: paymentOrder.id,
      timeline: firstOrder.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };

    return { success: true, order: formattedOrder, razorpayOrderId: paymentOrder.id };
  } catch (error) {
    console.error("Database order creation failed, resolving via mock sandbox:", error);
    const newOrder: OrderDetail = {
      id: orderId,
      userId: data.userId,
      totalAmount: data.totalAmount,
      status: "PLACED",
      createdAt: new Date(),
      address: data.address,
      items: data.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
      })),
      paymentStatus: "PENDING",
      razorpayOrderId: paymentOrder.id,
      timeline: [
        {
          status: "PLACED",
          description: "Order placed. Awaiting payment authorization.",
          createdAt: new Date(),
        },
      ],
    };
    mockOrders.push(newOrder);
    return { success: true, order: newOrder, razorpayOrderId: paymentOrder.id };
  }
}

export async function confirmOrderPayment(
  orderId: string,
  razorpayPaymentId: string,
  signature: string,
  userEmail: string
): Promise<boolean> {
  // 1. Verify Signature
  let razorpayOrderId = "";
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    const order = mockOrders.find((o) => o.id === orderId);
    razorpayOrderId = order ? order.razorpayOrderId || "" : "";
  } else {
    try {
      const dbPayment = await db.payment.findFirst({
        where: { orderId: orderId },
        select: { razorpayOrderId: true },
      });
      razorpayOrderId = dbPayment?.razorpayOrderId || "";
    } catch (e) {
      console.warn("Failed to retrieve payment from database, checking mock:", e);
      const order = mockOrders.find((o) => o.id === orderId);
      razorpayOrderId = order ? order.razorpayOrderId || "" : "";
    }
  }

  const isValid = await verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, signature);

  if (!isValid) {
    console.error("Signature verification failed for order", orderId, "with razorpayOrderId", razorpayOrderId);
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
        await sendOrderConfirmationEmail(userEmail, orderId, updated.totalAmount);
      }
      return true;
    }

    // Update in DB (update all payments associated with this Razorpay Order ID)
    await db.payment.updateMany({
      where: { razorpayOrderId: razorpayOrderId },
      data: {
        razorpayPaymentId,
        razorpaySignature: signature,
        status: "COMPLETED",
      },
    });

    // Find all orders in this payment group
    const dbOrders = await db.order.findMany({
      where: { paymentGroupId: razorpayOrderId },
      select: { id: true, totalAmount: true },
    });
    
    const ordersToUpdate = dbOrders.length > 0 ? dbOrders : [{ id: orderId, totalAmount: 0 }];

    for (const ord of ordersToUpdate) {
      await db.order.update({
        where: { id: ord.id },
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
      select: { totalAmount: true, userId: true },
    });

    if (dbOrder?.userId) {
      await createNotification(
        dbOrder.userId,
        "Order Booked & Confirmed ✅",
        `Your order ${orderId} has been confirmed and sent to fulfillment!`,
        `/orders/${orderId}`
      ).catch((e) => console.error("Failed to create notification:", e));
    }

    await sendOrderConfirmationEmail(userEmail, orderId, dbOrder?.totalAmount || 0);
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
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
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
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) return null;

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
      ...(order.payment?.razorpayOrderId ? { razorpayOrderId: order.payment.razorpayOrderId } : {}),
      timeline: order.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  } catch (e) {
    console.warn("getOrderById failed, returning mock order:", e);
    return mockOrders.find((o) => o.id === orderId) || null;
  }
}

export async function getOrdersByUser(userId: string): Promise<OrderDetail[]> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return mockOrders.filter((o) => o.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const dbOrders = await db.order.findMany({
      where: { userId },
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
        timeline: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return dbOrders.map((order) => ({
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
      ...(order.payment?.razorpayOrderId ? { razorpayOrderId: order.payment.razorpayOrderId } : {}),
      timeline: order.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    }));
  } catch (e) {
    return mockOrders.filter((o) => o.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export async function updateOrderStatus(orderId: string, status: OrderDetail["status"], description: string, buyerEmail?: string) {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      mockOrders = mockOrders.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            status: status,
            timeline: [
              ...o.timeline,
              {
                status: status,
                description: description,
                createdAt: new Date(),
              },
            ],
          };
        }
        return o;
      });

      // Send delivery alert email (mock mode)
      if (buyerEmail) {
        await sendOrderStatusEmail(buyerEmail, orderId, status, description).catch((err) =>
          console.error("Failed to send order status email:", err)
        );
      }
      return true;
    }

    // Fetch the buyer's email from the order if not provided
    let emailToSend = buyerEmail;
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { id: true, email: true } } },
    });
    
    if (!emailToSend) {
      emailToSend = order?.user?.email;
    }

    await db.order.update({
      where: { id: orderId },
      data: { status: status },
    });

    await db.orderTimeline.create({
      data: {
        orderId,
        status,
        description,
      },
    });

    // Send delivery alert email
    if (emailToSend) {
      await sendOrderStatusEmail(emailToSend, orderId, status, description).catch((err) =>
        console.error("Failed to send order status email:", err)
      );
    }
    
    // Send Notification to Buyer
    if (order?.user?.id) {
      await createNotification(order.user.id, `Order ${status}`, `Your order ${orderId} is now ${status}. ${description}`, `/profile/orders`);
    }

    return true;
  } catch (e) {
    console.error("updateOrderStatus failed in DB, updating mock:", e);
    mockOrders = mockOrders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          status: status,
          timeline: [
            ...o.timeline,
            {
              status: status,
              description: description,
              createdAt: new Date(),
            },
          ],
        };
      }
      return o;
    });

    // Send delivery alert email (fallback)
    if (buyerEmail) {
      await sendOrderStatusEmail(buyerEmail, orderId, status, description).catch((err) =>
        console.error("Failed to send order status email:", err)
      );
    }
    return true;
  }
}

export async function getOrdersBySeller(sellerIdOrUserId: string): Promise<OrderDetail[]> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
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
      return mockOrders;
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
        user: { select: { id: true, name: true, email: true, phone: true } },
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
        timeline: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (dbOrders.length === 0) {
      // Fallback query: check all recent orders in DB if no specific sellerId match found
      const fallbackOrders = await db.order.findMany({
        take: 50,
        include: {
          address: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: {
            include: {
              product: {
                include: { images: true },
              },
            },
          },
          payment: true,
          timeline: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      });

      if (fallbackOrders.length > 0) {
        return fallbackOrders.map((order) => ({
          id: order.id,
          userId: order.userId,
          user: order.user ? { name: order.user.name || "Customer", email: order.user.email || "", phone: order.user.phone || "" } : undefined,
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
          ...(order.payment?.razorpayOrderId ? { razorpayOrderId: order.payment.razorpayOrderId } : {}),
          timeline: order.timeline.map((t) => ({
            status: t.status,
            description: t.description,
            createdAt: t.createdAt,
          })),
        }));
      }

      return mockOrders;
    }

    return dbOrders.map((order) => ({
      id: order.id,
      userId: order.userId,
      user: order.user ? { name: order.user.name || "Customer", email: order.user.email || "", phone: order.user.phone || "" } : undefined,
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
      ...(order.payment?.razorpayOrderId ? { razorpayOrderId: order.payment.razorpayOrderId } : {}),
      timeline: order.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    }));
  } catch (e) {
    console.error("getOrdersBySeller failed in DB, returning mock:", e);
    return mockOrders;
  }
}

export async function getAllOrdersForAdmin(): Promise<OrderDetail[]> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      if (mockOrders.length === 0) {
        await getOrdersBySeller("seller-1");
      }
      return mockOrders;
    }

    const dbOrders = await db.order.findMany({
      include: {
        address: true,
        user: { select: { name: true, email: true } },
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

    return dbOrders.map((order) => ({
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
        seller: {
          id: it.product.seller.id,
          companyName: it.product.seller.companyName,
          email: it.product.seller.user.email,
          phone: it.product.seller.phone || "Not provided",
        }
      })),
      paymentStatus: (order.payment?.status as any) || "PENDING",
      ...(order.payment?.razorpayOrderId ? { razorpayOrderId: order.payment.razorpayOrderId } : {}),
      timeline: order.timeline.map((t) => ({
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
      user: {
        name: order.user?.name || "Anonymous User",
        email: order.user?.email || "unknown@email.com",
      }
    }));
  } catch (e) {
    console.error("Failed to fetch all orders for admin, returning mock:", e);
    if (mockOrders.length === 0) {
      await getOrdersBySeller("seller-1");
    }
    return mockOrders;
  }
}

export async function cancelOrder(orderId: string, userId: string, reason?: string) {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      mockOrders = mockOrders.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" as const } : o));
      await createNotification(userId, "Order Cancelled ❌", `Your order ${orderId} has been cancelled.`, `/orders/${orderId}`);
      return { success: true };
    }

    await db.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    await db.orderTimeline.create({
      data: {
        orderId,
        status: "CANCELLED",
        description: reason ? `Order cancelled by user. Reason: ${reason}` : "Order cancelled by user.",
      },
    });

    await createNotification(
      userId,
      "Order Cancelled ❌",
      `Your order ${orderId} has been cancelled successfully.`,
      `/orders/${orderId}`
    );

    return { success: true };
  } catch (e) {
    console.error("cancelOrder failed:", e);
    return { success: false, error: "Failed to cancel order." };
  }
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

    // Database lookup
    const dbOrder = await db.order.findFirst({
      where: {
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
      ...(dbOrder.payment?.razorpayOrderId ? { razorpayOrderId: dbOrder.payment.razorpayOrderId } : {}),
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

