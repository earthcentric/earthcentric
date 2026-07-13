"use client";

import React, { useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { Button } from "@/components/ui/shared";
import { 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowLeft, 
  ShieldCheck,
  Code2,
  FileCode,
  DollarSign,
  AlertTriangle
} from "lucide-react";

export default function RazorpayDemoPage() {
  const [amount, setAmount] = useState<number>(500); // Amount in Rupees
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error" | "cancelled";
    message: string;
    details?: any;
  }>({
    type: "idle",
    message: "Ready to test checkout.",
  });

  const handleSelectAmount = (val: number) => {
    setAmount(val);
    setStatus({ type: "idle", message: `Amount set to ₹${val}.` });
  };

  const handleCheckout = async () => {
    setLoading(true);
    setStatus({ type: "loading", message: "Initializing checkout order..." });

    try {
      // 1. Call Backend /api/create-order
      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount * 100, // paise
          currency: "INR",
          receipt: `rcpt_demo_${Math.random().toString(36).substring(2, 9)}`,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || "Failed to initialize order");
      }

      const orderData = await orderResponse.json();
      const { order_id } = orderData;

      setStatus({ type: "loading", message: `Order ${order_id} created. Launching Razorpay payment...` });

      // Get key id
      const credentialsRes = await fetch("/api/create-order"); // Wait, let's make sure we can fetch it, or get key ID.
      // Wait, we can get key id directly from the server or standard Next.js env or client side action, or we can fetch a helper endpoint.
      // Actually, since getRazorpayKeyId is a Server Action in "@/actions/credentials", we can import it or write a simple route, 
      // or we can query it directly using our Server Action!
      // Importing Server Action is standard and supported in "use client" components!
      const { getRazorpayKeyId } = await import("@/actions/credentials");
      const razorpayKeyId = await getRazorpayKeyId();

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: razorpayKeyId || "rzp_test_TCr5Np12crt6EE",
        amount: amount * 100,
        currency: "INR",
        name: "EarthCentric",
        description: "Sustainable Portal Demo Checkout",
        order_id: order_id,
        handler: async function (response: any) {
          setLoading(true);
          setStatus({ type: "loading", message: "Verifying payment signature with backend..." });

          try {
            // 3. Send payment tokens to backend verify-payment route
            const verifyResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                order_id: order_id,
                payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyResponse.ok) {
              const verifyError = await verifyResponse.json();
              throw new Error(verifyError.error || "Signature verification failed");
            }

            setStatus({
              type: "success",
              message: "Payment successfully verified by backend!",
              details: {
                paymentId: response.razorpay_payment_id,
                orderId: order_id,
                signature: response.razorpay_signature,
              },
            });
          } catch (err: any) {
            setStatus({
              type: "error",
              message: err.message || "Payment signature verification failed.",
            });
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: "EarthCentric Tester",
          email: "tester@earthcentric.com",
          contact: "9999999999",
        },
        theme: {
          color: "#16a34a", // Vibrant Green theme matching earthcentric branding
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setStatus({
              type: "cancelled",
              message: "Checkout modal was closed by the user.",
            });
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      
      rzp.on("payment.failed", function (response: any) {
        setStatus({
          type: "error",
          message: `Payment failed: ${response.error.description}`,
          details: response.error,
        });
      });

      rzp.open();
    } catch (error: any) {
      console.error("Checkout process error:", error);
      setStatus({
        type: "error",
        message: error.message || "An unexpected error occurred during checkout.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-12 px-4 relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-950/20 via-slate-950 to-slate-950 pointer-events-none" />
      
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="w-full max-w-3xl z-10 space-y-8">
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center text-sm text-green-400 hover:text-green-300 transition-colors gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </Link>

        {/* Hero Section */}
        <div className="space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Razorpay Standard Integration Demo
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent">
            Razorpay Standard Web Checkout
          </h1>
          <p className="text-slate-400 text-base max-w-2xl leading-relaxed">
            Test the complete end-to-end integration: Backend order creation, Razorpay checkout script modal, and secure HMAC-SHA256 signature verification.
          </p>
        </div>

        {/* Demo Interface Card */}
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-400" /> Test Transaction Setup
            </h2>

            {/* Quick Amounts */}
            <div className="space-y-3">
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider block">
                Select Amount (INR)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSelectAmount(amt)}
                    disabled={loading}
                    className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                      amount === amt
                        ? "border-green-500 bg-green-500/15 text-green-400 shadow-md shadow-green-500/5"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider block">
                Or Enter Custom Amount
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min="2"
                  value={amount}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 0);
                    setAmount(val);
                    setStatus({ type: "idle", message: `Amount set to ₹${val}.` });
                  }}
                  disabled={loading}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                Minimum billing amount is 100 paise (₹1).
              </p>
            </div>

            {/* Checkout CTA */}
            <Button
              onClick={handleCheckout}
              disabled={loading || amount < 1}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 active:scale-[0.98] transition-transform cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5" /> Pay ₹{amount} with Razorpay
                </>
              )}
            </Button>

            {/* Payment Flow Visual Guide */}
            <div className="border-t border-slate-800/80 pt-4 space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                How it works
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  <div className="font-bold text-green-400 mb-1">Step 1</div>
                  POST /api/create-order
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  <div className="font-bold text-green-400 mb-1">Step 2</div>
                  Launch Standard SDK Modal
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  <div className="font-bold text-green-400 mb-1">Step 3</div>
                  POST /api/verify-payment
                </div>
              </div>
            </div>
          </div>

          {/* Status Display Panel */}
          <div className="md:col-span-2 flex flex-col justify-between bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider block">
                Verification logs
              </h2>

              {/* Status Box */}
              <div className={`p-4 rounded-xl border flex gap-3 ${
                status.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : status.type === "error"
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : status.type === "cancelled"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : status.type === "loading"
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  : "bg-slate-950 border-slate-800 text-slate-400"
              }`}>
                <div className="flex-shrink-0 mt-0.5">
                  {status.type === "success" && <CheckCircle2 className="w-5 h-5" />}
                  {status.type === "error" && <XCircle className="w-5 h-5" />}
                  {status.type === "cancelled" && <AlertTriangle className="w-5 h-5" />}
                  {status.type === "loading" && <Loader2 className="w-5 h-5 animate-spin" />}
                  {status.type === "idle" && <ShieldCheck className="w-5 h-5" />}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-200 capitalize">
                    {status.type}
                  </div>
                  <p className="text-xs leading-relaxed">{status.message}</p>
                </div>
              </div>

              {/* Success Parameters */}
              {status.type === "success" && status.details && (
                <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Signature Details
                  </div>
                  <div className="space-y-2 text-[11px] font-mono text-slate-400 break-all">
                    <div>
                      <span className="text-slate-500 block">Payment ID</span>
                      <span className="text-green-400 font-semibold">{status.details.paymentId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Order ID</span>
                      <span className="text-green-400 font-semibold">{status.details.orderId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">HMAC Signature Matches</span>
                      <span className="text-green-400 font-semibold truncate max-w-xs block">{status.details.signature}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 text-[11px] text-slate-500 border-t border-slate-800/60 pt-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                <span>Backend Route: <code className="text-slate-400">/api/create-order</code></span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5" />
                <span>Verify Route: <code className="text-slate-400">/api/verify-payment</code></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
