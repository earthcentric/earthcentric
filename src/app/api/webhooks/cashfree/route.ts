import { NextRequest, NextResponse } from "next/server";
import { verifyCashfreeWebhookSignature } from "@/lib/cashfree";
import db from "@/lib/db";
import { createNotification } from "@/actions/notifications";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { applyCashfreeRefundWebhook } from "@/lib/order-cancellations";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");

    if (!signature || !timestamp) {
      console.warn("[Cashfree Webhook] Missing x-webhook-signature or x-webhook-timestamp headers");
      return NextResponse.json(
        { error: "Missing webhook signature or timestamp" },
        { status: 400 }
      );
    }

    const rawBody = await req.text();

    // Cryptographic signature validation
    const isValid = await verifyCashfreeWebhookSignature(signature, rawBody, timestamp);
    if (!isValid) {
      console.error("[Cashfree Webhook] Signature verification failed for request");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[Cashfree Webhook] Failed to parse webhook JSON payload:", parseErr);
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventType = payload.type || "";
    const orderData = payload.data?.order || payload.order || {};
    const paymentData = payload.data?.payment || payload.payment || {};
    const refundData = payload.data?.refund || payload.refund || {};
    const cashfreeOrderId = orderData.order_id || payload.order_id || refundData.order_id;
    const cashfreePaymentId = paymentData.cf_payment_id || payload.cf_payment_id || String(paymentData.payment_id || "");
    const paymentStatus = paymentData.payment_status || orderData.order_status || "";

    console.log(`[Cashfree Webhook] Verified event ${eventType} for order: ${cashfreeOrderId}, status: ${paymentStatus}`);

    if (eventType.includes("REFUND") && cashfreeOrderId && refundData.refund_id && refundData.refund_status) {
      if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
        await applyCashfreeRefundWebhook({
          orderId: cashfreeOrderId,
          refundId: refundData.refund_id,
          status: refundData.refund_status,
          refundReference:
            refundData.cf_refund_id == null ? undefined : String(refundData.cf_refund_id),
          refundArn: refundData.refund_arn,
          amount: refundData.refund_amount,
          description: refundData.status_description,
        });
      }
      return NextResponse.json({ status: "SUCCESS", message: "Refund webhook processed." });
    }

    // Process payment success events
    const isSuccess =
      eventType === "PAYMENT_SUCCESS_WEBHOOK" ||
      eventType === "ORDER_PAID" ||
      paymentStatus === "SUCCESS";

    if (isSuccess && cashfreeOrderId) {
      if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
        try {
          // 1. Update Payment record
          await db.payment.updateMany({
            where: { cashfreeOrderId },
            data: {
              cashfreePaymentId: String(cashfreePaymentId),
              cashfreeSignature: signature,
              status: "COMPLETED",
            },
          });

          // 2. Find all associated orders (single or multi-seller payment group)
          const dbOrders = await db.order.findMany({
            where: {
              OR: [
                { paymentGroupId: cashfreeOrderId },
                { id: cashfreeOrderId.replace(/^EC-ORD-/, "") },
                { payment: { cashfreeOrderId } },
              ],
            },
            include: { user: true },
          });

          for (const order of dbOrders) {
            if (order.status === "CANCELLED" || order.status === "REFUNDED") {
              const approvedCancellation = await db.orderCancellation.findFirst({
                where: { orderId: order.id, status: "APPROVED" },
                orderBy: { requestedAt: "desc" },
                select: { id: true },
              });
              if (approvedCancellation) {
                const { startCancellationRefund } = await import("@/lib/order-cancellations");
                await startCancellationRefund(approvedCancellation.id);
              }
              continue;
            }

            const changed = await db.order.updateMany({
              where: { id: order.id, status: { notIn: ["CANCELLED", "REFUNDED"] } },
              data: { status: "CONFIRMED" },
            });
            if (changed.count === 0) continue;

            await db.orderTimeline.create({
              data: {
                orderId: order.id,
                status: "CONFIRMED",
                description: "Payment verified via Cashfree secure webhook. Sent to supplier fulfillment.",
              },
            });

            if (order.userId) {
              await createNotification(
                order.userId,
                "Order Paid & Confirmed ✅",
                `Your order ${order.id} payment was verified and confirmed via Cashfree.`,
                `/orders/${order.id}`
              ).catch((e) => console.error("Webhook notification error:", e));
            }

            if (order.user?.email) {
              await sendOrderConfirmationEmail(
                order.user.email,
                order.id,
                order.totalAmount
              ).catch((e) => console.error("Webhook confirmation email error:", e));
            }
          }
        } catch (dbErr) {
          console.error("[Cashfree Webhook] Database update error:", dbErr);
        }
      }
    }

    return NextResponse.json({
      status: "SUCCESS",
      message: "Webhook processed and signature verified",
    });
  } catch (error: any) {
    console.error("[Cashfree Webhook] Unhandled error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
