import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, currency, receipt } = body;

    // Validate amount >= 100 paise
    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Validation Error: Amount must be at least 100 paise" },
        { status: 400 }
      );
    }

    const order = await createRazorpayOrder({
      amount: Math.round(amount),
      currency: currency || "INR",
      receipt: receipt || `rcpt_${Math.random().toString(36).substring(2, 9)}`,
    });

    if (!order) {
      return NextResponse.json(
        { error: "Razorpay API error: Failed to create order" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error("Failed to create Razorpay order:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create order" },
      { status: 500 }
    );
  }
}
