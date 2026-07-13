import { NextResponse } from "next/server";
import { verifyPaymentSignature } from "@/lib/razorpay";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { order_id, payment_id, razorpay_signature } = body;

    // Missing fields: return 400
    if (!order_id || !payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Validation Error: Missing required verification fields (order_id, payment_id, razorpay_signature)" },
        { status: 400 }
      );
    }

    const isValid = await verifyPaymentSignature(order_id, payment_id, razorpay_signature);

    // Signature mismatch: return 400
    if (!isValid) {
      return NextResponse.json(
        { error: "Payment signature verification failed. Mismatch detected." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to verify Razorpay payment:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during verification" },
      { status: 500 }
    );
  }
}
