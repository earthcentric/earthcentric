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

    const eventType = payload.type || payload.event || "";
    const orderData = payload.data?.order || payload.order || {};
    const paymentData = payload.data?.payment || payload.payment || {};
    const refundData = payload.data?.refund || payload.refund || {};
    const transferData = payload.data?.transfer || payload.transfer || (payload.data?.transfer_id || payload.transfer_id ? (payload.data || payload) : {}) || {};
    const cashfreeOrderId = orderData.order_id || payload.order_id || refundData.order_id;
    const cashfreePaymentId = paymentData.cf_payment_id || payload.cf_payment_id || String(paymentData.payment_id || "");
    const paymentStatus = paymentData.payment_status || orderData.order_status || "";

    console.log(`[Cashfree Webhook] Verified event ${eventType} for order: ${cashfreeOrderId}, status: ${paymentStatus}`);

    // Check for Cashfree Payout transfer events
    const isTransferWebhook =
      eventType.startsWith("TRANSFER_") ||
      (typeof payload.event === "string" && payload.event.startsWith("TRANSFER_")) ||
      Boolean(transferData.transfer_id || transferData.transferId);

    if (isTransferWebhook) {
      if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
        try {
          const transferId = transferData.transfer_id || transferData.transferId || payload.transfer_id;
          const cfTransferId = transferData.cf_transfer_id || transferData.cfTransferId;
          const referenceId = transferData.reference_id || transferData.referenceId;
          const utr = transferData.utr || transferData.bank_reference;
          const rawStatus = (transferData.status || eventType.replace("TRANSFER_", "")).toUpperCase();
          const failureReason = transferData.status_description || transferData.reason || transferData.failure_reason;

          const payoutReq = await db.payoutRequest.findFirst({
            where: {
              OR: [
                ...(referenceId ? [{ id: referenceId }] : []),
                ...(transferId ? [{ cfTransferId: String(transferId) }] : []),
                ...(cfTransferId ? [{ cfTransferId: String(cfTransferId) }] : []),
              ],
            },
            include: { seller: { include: { user: true } } },
          });

          if (payoutReq) {
            if (rawStatus === "SUCCESS") {
              const currentHistory = Array.isArray(payoutReq.auditHistory) ? (payoutReq.auditHistory as any[]) : [];
              await db.payoutRequest.update({
                where: { id: payoutReq.id },
                data: {
                  status: "PAID",
                  cfStatus: "SUCCESS",
                  cfUtr: utr ? String(utr) : payoutReq.cfUtr,
                  paidAt: new Date(),
                  settledAt: new Date(),
                  auditHistory: [
                    ...currentHistory,
                    {
                      action: "TRANSFER_SUCCESS_WEBHOOK",
                      timestamp: new Date().toISOString(),
                      performedBy: "Cashfree Webhook",
                      notes: `Payout transferred successfully. UTR: ${utr || "N/A"}`,
                    },
                  ],
                },
              });
              if (payoutReq.seller?.userId) {
                await createNotification(
                  payoutReq.seller.userId,
                  "Payout Settled Successfully 🎉",
                  `Your payout of ₹${payoutReq.amount} has been successfully settled (UTR: ${utr || "N/A"}).`,
                  "/seller/dashboard"
                ).catch(() => {});
              }
            } else if (rawStatus === "FAILED" || rawStatus === "REVERSED") {
              const currentHistory = Array.isArray(payoutReq.auditHistory) ? (payoutReq.auditHistory as any[]) : [];
              await db.payoutRequest.update({
                where: { id: payoutReq.id },
                data: {
                  status: "FAILED",
                  cfStatus: rawStatus,
                  cfFailureReason: failureReason || `Transfer ${rawStatus.toLowerCase()} via Cashfree Payouts`,
                  auditHistory: [
                    ...currentHistory,
                    {
                      action: `TRANSFER_${rawStatus}_WEBHOOK`,
                      timestamp: new Date().toISOString(),
                      performedBy: "Cashfree Webhook",
                      notes: failureReason || `Transfer marked as ${rawStatus}`,
                    },
                  ],
                },
              });
              if (payoutReq.seller?.userId) {
                await createNotification(
                  payoutReq.seller.userId,
                  "Payout Transfer Failed ⚠️",
                  `Your payout request of ₹${payoutReq.amount} could not be completed (${failureReason || "Provider error"}). Your withdrawable balance has been restored.`,
                  "/seller/dashboard"
                ).catch(() => {});
              }
            }
          }
        } catch (err) {
          console.error("[Cashfree Webhook] Error processing transfer webhook:", err);
        }
      }
      return NextResponse.json({ status: "SUCCESS", message: "Payout transfer webhook processed." });
    }

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

    // Handle Seller Registration Fee payments
    if (cashfreeOrderId && cashfreeOrderId.startsWith("SELLER-FEE-")) {
      if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
        try {
          const regPayment = await db.sellerRegistrationPayment.findFirst({
            where: { cashfreeOrderId },
            include: { seller: { include: { user: true } } },
          });

          if (regPayment) {
            if (isSuccess) {
              await db.sellerRegistrationPayment.update({
                where: { id: regPayment.id },
                data: {
                  status: "COMPLETED",
                  cashfreePaymentId: String(cashfreePaymentId || ""),
                  paidAt: new Date(),
                },
              });
              await db.seller.update({
                where: { id: regPayment.sellerId },
                data: {
                  registrationFeePaid: true,
                  registrationFeePaidAt: new Date(),
                  registrationFeeOrderId: cashfreeOrderId,
                  registrationFeeTransactionId: String(cashfreePaymentId || ""),
                },
              });
              if (regPayment.seller?.userId) {
                await createNotification(
                  regPayment.seller.userId,
                  "Registration Fee Paid ✅",
                  "Your ₹1 seller registration fee has been successfully verified. Please proceed with your Bank/UPI payout details.",
                  "/seller/dashboard"
                ).catch(() => {});
              }
            } else if (paymentStatus === "FAILED" || eventType.includes("FAILED")) {
              await db.sellerRegistrationPayment.update({
                where: { id: regPayment.id },
                data: {
                  status: "FAILED",
                },
              });
            }
          }
        } catch (feeErr) {
          console.error("[Cashfree Webhook] Error updating seller registration fee:", feeErr);
        }
      }
      return NextResponse.json({ status: "SUCCESS", message: "Seller registration fee webhook processed." });
    }

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
                      images: { take: 1 },
                      seller: {
                        select: { companyName: true },
                      },
                    },
                  },
                },
              },
            },
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
              const buyerName = order.user.name || undefined;
              const orderAddress = order.address;
              await sendOrderConfirmationEmail(
                order.user.email,
                order.id,
                order.totalAmount,
                {
                  buyerName,
                  placedAt: order.createdAt,
                  items: (order.items || []).map((it) => ({
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
                }
              ).catch((e) => console.error("Webhook confirmation email error:", e));
            }
          }

          try {
            const { revalidatePath } = await import("next/cache");
            revalidatePath("/seller/dashboard");
            revalidatePath("/admin/dashboard");
            revalidatePath("/orders");
          } catch (_) {}
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
