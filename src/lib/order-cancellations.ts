import crypto from "crypto";
import db from "@/lib/db";
import { createCashfreeRefund, fetchCashfreeRefund, CashfreeRefundResult } from "@/lib/cashfree";
import { createNotification, createAdminNotification } from "@/actions/notifications";
import { sendRefundCompletedEmail, sendRefundFailedEmail } from "@/lib/email";

export type RefundState = "NOT_REQUIRED" | "PENDING_PAYMENT" | "PENDING" | "SUCCESS" | "FAILED";

function mapRefundStatus(status?: string): RefundState {
  const normalized = (status || "").toUpperCase();
  if (normalized === "SUCCESS") return "SUCCESS";
  if (normalized === "FAILED" || normalized === "CANCELLED") return "FAILED";
  return "PENDING";
}

function makeRefundId(cancellationId: string, attempt: number): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${cancellationId}:${attempt}`)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
  return `EC${digest}`;
}

function makeIdempotencyKey(cancellationId: string, attempt: number): string {
  return crypto
    .createHash("sha256")
    .update(`earthcentric-refund:${cancellationId}:${attempt}`)
    .digest("hex")
    .slice(0, 32);
}

async function saveProviderRefund(
  cancellationId: string,
  result: CashfreeRefundResult
): Promise<RefundState> {
  const cancellation = await db.orderCancellation.findUnique({
    where: { id: cancellationId },
    include: { order: true },
  });
  if (!cancellation) throw new Error("Cancellation request not found.");

  const nextStatus = mapRefundStatus(result.refund_status);
  const providerRefundReference =
    result.cf_refund_id == null ? undefined : String(result.cf_refund_id);
  const transition = await db.$transaction(async (tx) => {
    const changedCancellation = await tx.orderCancellation.updateMany({
      where: {
        id: cancellationId,
        AND: [
          { refundStatus: { not: nextStatus } },
          { refundStatus: { notIn: ["SUCCESS", "FAILED"] } },
        ],
      },
      data: {
        refundStatus: nextStatus,
        cashfreeRefundReference: providerRefundReference,
        refundArn: result.refund_arn || undefined,
        refundError: nextStatus === "FAILED" ? (result.status_description || "Cashfree marked the refund as failed.") : null,
        refundUpdatedAt: new Date(),
      },
    });
    let effectiveStatus = nextStatus;
    if (changedCancellation.count === 0) {
      const current = await tx.orderCancellation.findUnique({
        where: { id: cancellationId },
        select: { refundStatus: true },
      });
      if (!current) throw new Error("Cancellation request not found.");
      effectiveStatus = current.refundStatus as RefundState;
      await tx.orderCancellation.update({
        where: { id: cancellationId },
        data: {
          cashfreeRefundReference: providerRefundReference,
          refundArn: result.refund_arn || undefined,
          refundError:
            effectiveStatus === "FAILED"
              ? result.status_description || "Cashfree marked the refund as failed."
              : null,
          refundUpdatedAt: new Date(),
        },
      });
    }

    if (effectiveStatus === "SUCCESS") {
      const changed = await tx.order.updateMany({
        where: { id: cancellation.orderId, status: { in: ["CANCELLED", "RETURNED", "DELIVERED"] } },
        data: { status: "REFUNDED" },
      });
      if (changed.count > 0) {
        await tx.orderTimeline.create({
          data: {
            orderId: cancellation.orderId,
            status: "REFUNDED",
            description: `Cashfree refund of ₹${(result.refund_amount ?? cancellation.refundAmount ?? 0).toLocaleString("en-IN")} completed. Refund reference: ${providerRefundReference || cancellation.cashfreeRefundId || "available in Cashfree"}.`,
          },
        });
      }
      return { status: effectiveStatus, orderRefunded: changed.count > 0 };
    } else if (effectiveStatus === "FAILED") {
      if (changedCancellation.count > 0) {
        await tx.orderTimeline.create({
          data: {
            orderId: cancellation.orderId,
            status: "CANCELLED",
            description: `Cashfree could not complete the refund: ${result.status_description || "Check the refund status in the admin dashboard."}`,
          },
        });
      }
    }
    return { status: effectiveStatus, orderRefunded: false };
  });

  const orderWithUser = await db.order.findUnique({
    where: { id: cancellation.orderId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const finalRefundAmount = result.refund_amount ?? cancellation.refundAmount ?? cancellation.order.totalAmount ?? 0;
  const customerEmail = orderWithUser?.user?.email || cancellation.requestedByEmail;
  const customerName = orderWithUser?.user?.name || undefined;

  if (transition.orderRefunded && customerEmail) {
    if (orderWithUser?.userId) {
      await createNotification(
        orderWithUser.userId,
        "Refund completed ✅",
        `Refund of ₹${finalRefundAmount.toLocaleString("en-IN")} for order ${cancellation.orderId} completed. Reference: ${providerRefundReference || cancellation.cashfreeRefundId || "see order details"}.`,
        `/orders/${cancellation.orderId}`
      ).catch((e) => console.error("Refund completed notification error:", e));
    }

    await sendRefundCompletedEmail(customerEmail, {
      orderId: cancellation.orderId,
      customerName,
      amount: finalRefundAmount,
      refundReference: providerRefundReference || cancellation.cashfreeRefundId || "CF-REFUND-VERIFIED",
      completedDate: new Date(),
    }).catch((e) => console.error("Refund completed email error:", e));
  } else if (transition.status === "FAILED" && customerEmail) {
    if (orderWithUser?.userId) {
      await createNotification(
        orderWithUser.userId,
        "Refund Processing Update ⚠️",
        `Your refund of ₹${finalRefundAmount.toLocaleString("en-IN")} for order ${cancellation.orderId} requires manual processing. Our finance desk is assisting.`,
        `/orders/${cancellation.orderId}`
      ).catch((e) => console.error("Refund failed notification error:", e));
    }

    await createAdminNotification(
      "Refund requires attention",
      `Refund for order ${cancellation.orderId} failed: ${result.status_description || "Gateway declined or timed out"}. Retry required.`,
      "cancellations"
    ).catch((e) => console.error("Admin refund failed alert error:", e));

    await sendRefundFailedEmail(customerEmail, {
      orderId: cancellation.orderId,
      customerName,
      amount: finalRefundAmount,
      errorDetail: result.status_description || "Banking network delayed confirmation.",
    }).catch((e) => console.error("Refund failed email error:", e));
  }
  return transition.status;
}

export async function startCancellationRefund(cancellationId: string): Promise<{
  status: RefundState;
  error?: string;
}> {
  const cancellation = await db.orderCancellation.findUnique({
    where: { id: cancellationId },
    include: { order: { include: { payment: true } } },
  });
  if (!cancellation || cancellation.status !== "APPROVED") {
    throw new Error("Only an approved cancellation can be refunded.");
  }
  if (cancellation.refundStatus === "SUCCESS") return { status: "SUCCESS" };

  const payment = cancellation.order.payment;
  if (payment?.status !== "COMPLETED") {
    const status: RefundState = payment?.status === "PENDING" ? "PENDING_PAYMENT" : "NOT_REQUIRED";
    await db.orderCancellation.update({
      where: { id: cancellationId },
      data: { refundStatus: status, refundUpdatedAt: new Date() },
    });
    return { status };
  }
  if (!payment.cashfreeOrderId) {
    await db.orderCancellation.update({
      where: { id: cancellationId },
      data: {
        refundStatus: "FAILED",
        refundError: "The paid order has no Cashfree order ID. Review this payment manually.",
        refundUpdatedAt: new Date(),
      },
    });
    return { status: "FAILED", error: "Missing Cashfree order ID." };
  }

  const amount = Math.round((cancellation.refundAmount ?? cancellation.order.totalAmount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > payment.amount) {
    await db.orderCancellation.update({
      where: { id: cancellationId },
      data: {
        refundStatus: "FAILED",
        refundError: "The order refund amount does not match the captured payment amount.",
        refundUpdatedAt: new Date(),
      },
    });
    return { status: "FAILED", error: "Refund amount could not be safely validated." };
  }

  let attempt = cancellation.refundAttempt;
  let refundId = cancellation.cashfreeRefundId;
  if (!refundId) {
    attempt += 1;
    refundId = makeRefundId(cancellationId, attempt);
    const claimed = await db.orderCancellation.updateMany({
      where: {
        id: cancellationId,
        status: "APPROVED",
        cashfreeRefundId: null,
        refundStatus: { in: ["PENDING", "PENDING_PAYMENT"] },
      },
      data: {
        refundStatus: "PENDING",
        refundAmount: amount,
        cashfreeOrderId: payment.cashfreeOrderId,
        cashfreeRefundId: refundId,
        refundAttempt: attempt,
        refundError: null,
        refundUpdatedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      const latest = await db.orderCancellation.findUnique({ where: { id: cancellationId } });
      if (!latest?.cashfreeRefundId) {
        return { status: (latest?.refundStatus as RefundState) || "FAILED", error: latest?.refundError || "Refund could not be claimed." };
      }
      refundId = latest.cashfreeRefundId;
      attempt = latest.refundAttempt;
    }
  }

  try {
    const result = await createCashfreeRefund({
      orderId: payment.cashfreeOrderId,
      refundId,
      idempotencyKey: makeIdempotencyKey(cancellationId, attempt),
      amount,
      note: `Order cancellation ${cancellationId}`,
    });
    const status = await saveProviderRefund(cancellationId, result);
    return { status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cashfree refund status is unknown.";
    await db.orderCancellation.update({
      where: { id: cancellationId },
      data: {
        refundStatus: "PENDING",
        refundError: `${message} Retrying uses the same idempotency key to avoid duplicate refunds.`,
        refundUpdatedAt: new Date(),
      },
    });
    return { status: "PENDING", error: message };
  }
}

export async function refreshCancellationRefund(cancellationId: string): Promise<RefundState> {
  const cancellation = await db.orderCancellation.findUnique({ where: { id: cancellationId } });
  if (!cancellation?.cashfreeOrderId || !cancellation.cashfreeRefundId) {
    throw new Error("No Cashfree refund has been initiated for this cancellation.");
  }
  const result = await fetchCashfreeRefund(cancellation.cashfreeOrderId, cancellation.cashfreeRefundId);
  return saveProviderRefund(cancellationId, result);
}

export async function retryFailedCancellationRefund(cancellationId: string): Promise<{
  status: RefundState;
  error?: string;
}> {
  const current = await db.orderCancellation.findUnique({ where: { id: cancellationId } });
  if (!current || current.status !== "APPROVED" || current.refundStatus !== "FAILED") {
    throw new Error("Only a confirmed failed refund can be retried.");
  }
  const reset = await db.orderCancellation.updateMany({
    where: { id: cancellationId, status: "APPROVED", refundStatus: "FAILED" },
    data: {
      refundStatus: "PENDING",
      cashfreeRefundId: null,
      cashfreeRefundReference: null,
      refundArn: null,
      refundError: null,
      refundUpdatedAt: new Date(),
    },
  });
  if (reset.count === 0) {
    const latest = await db.orderCancellation.findUnique({ where: { id: cancellationId } });
    return { status: (latest?.refundStatus as RefundState) || "FAILED", error: "Refund state changed; refresh and try again." };
  }
  return startCancellationRefund(cancellationId);
}

export async function applyCashfreeRefundWebhook(data: {
  orderId: string;
  refundId: string;
  status: string;
  refundReference?: string;
  refundArn?: string;
  amount?: number;
  description?: string;
}): Promise<void> {
  const cancellation = await db.orderCancellation.findFirst({
    where: { cashfreeOrderId: data.orderId, cashfreeRefundId: data.refundId },
    select: { id: true },
  });
  if (!cancellation) return;

  await saveProviderRefund(cancellation.id, {
    order_id: data.orderId,
    refund_id: data.refundId,
    cf_refund_id: data.refundReference,
    refund_status: data.status,
    refund_arn: data.refundArn,
    refund_amount: data.amount,
    status_description: data.description,
  });
}
