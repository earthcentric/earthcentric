"use client";

import React, { useState } from "react";
import { Button, Card, Badge } from "@/components/ui/shared";
import { toast } from "sonner";
import { ShieldCheck, CreditCard, CheckCircle2, AlertCircle, RefreshCw, Lock } from "lucide-react";
import { createRegistrationFeeOrder, verifyRegistrationFeePayment } from "@/actions/payouts";

interface SellerRegistrationFeeCardProps {
  sellerId: string;
  sellerName?: string;
  isPaid?: boolean;
  transactionId?: string | null;
  paidAt?: string | Date | null;
  onSuccess?: () => void | Promise<void>;
  title?: string;
  description?: string;
  compact?: boolean;
}

export function SellerRegistrationFeeCard({
  sellerId,
  sellerName,
  isPaid = false,
  transactionId,
  paidAt,
  onSuccess,
  title = "One-Time ₹1 Seller Registration Verification",
  description = "Complete mandatory ₹1 merchant onboarding verification via Cashfree Payment Gateway to qualify for Super Admin approval and live marketplace listing.",
  compact = false,
}: SellerRegistrationFeeCardProps) {
  const [payingFee, setPayingFee] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const handlePayFee = async () => {
    if (payingFee || isPaid) return;
    setPayingFee(true);
    setErrorNotice(null);

    try {
      const res = await createRegistrationFeeOrder(sellerId);
      if (!res.success) {
        const errMsg = res.error || "Failed to initialize registration payment session.";
        setErrorNotice(errMsg);
        toast.error(errMsg);
        setPayingFee(false);
        return;
      }

      if (res.alreadyPaid) {
        toast.success("Registration fee already paid! Proceeding...");
        if (onSuccess) await onSuccess();
        setPayingFee(false);
        return;
      }

      if (!res.paymentSessionId || typeof res.paymentSessionId !== "string" || !res.paymentSessionId.trim() || res.paymentSessionId.startsWith("mock_session_")) {
        const errMsg = "Cashfree did not return a valid payment session ID. Please verify Cashfree API credentials.";
        setErrorNotice(errMsg);
        toast.error(errMsg);
        setPayingFee(false);
        return;
      }

      if (!res.orderId) {
        const errMsg = "Order reference missing from gateway response.";
        setErrorNotice(errMsg);
        toast.error(errMsg);
        setPayingFee(false);
        return;
      }

      setLastOrderId(res.orderId);

      try {
        const { load } = await import("@cashfreepayments/cashfree-js");
        const envMode = (res.environment || process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT || "sandbox").toLowerCase() as "sandbox" | "production";
        console.log(`[Seller Fee Checkout] Initializing Cashfree SDK: env=${envMode}, sessionPrefix=${res.paymentSessionId.slice(0, 10)}...`);
        
        const cashfree = await load({ mode: envMode });
        const checkoutResult = await cashfree.checkout({
          paymentSessionId: res.paymentSessionId,
          redirectTarget: "_modal",
        });

        if (checkoutResult?.error) {
          console.warn("Cashfree checkout closed or errored:", checkoutResult.error);
          setErrorNotice(checkoutResult.error.message || "Payment modal was closed or interrupted.");
        }

        // Always verify with backend after modal interaction
        const verification = await verifyRegistrationFeePayment(res.orderId, sellerId);
        if (verification.success && verification.paid) {
          toast.success("₹1 Registration Fee verified successfully! Welcome aboard.");
          if (onSuccess) await onSuccess();
        } else {
          toast.info("If payment was completed, click 'Check Payment Status' below to refresh.");
        }
      } catch (sdkErr: any) {
        console.warn("Cashfree JS dropin fallback:", sdkErr);
        const verification = await verifyRegistrationFeePayment(res.orderId, sellerId);
        if (verification.success && verification.paid) {
          toast.success("Registration fee verified successfully!");
          if (onSuccess) await onSuccess();
        } else {
          setErrorNotice("Payment session initialized. If popup was blocked, complete payment and click Check Status.");
        }
      }
    } catch (err: any) {
      setErrorNotice(err?.message || "Failed to start Cashfree checkout.");
      toast.error(err?.message || "Payment initiation failed.");
    } finally {
      setPayingFee(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!lastOrderId && !sellerId) return;
    setCheckingStatus(true);
    try {
      const verification = await verifyRegistrationFeePayment(lastOrderId || sellerId, sellerId);
      if (verification.success && verification.paid) {
        toast.success("Registration fee confirmed! Record updated.");
        if (onSuccess) await onSuccess();
      } else {
        toast.error(verification.error || "Cashfree has not confirmed this payment yet. Please ensure checkout was completed.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to query Cashfree payment status.");
    } finally {
      setCheckingStatus(false);
    }
  };

  if (isPaid) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-50/50 p-6 rounded-2xl space-y-4">
        <div className="flex items-center space-x-3 text-emerald-800">
          <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-emerald-900">₹1 Registration Payment Confirmed</h3>
              <Badge className="bg-emerald-600 text-white text-[10px] font-bold">PAID</Badge>
            </div>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your merchant registration fee has been securely verified via Cashfree.
            </p>
          </div>
        </div>
        {transactionId && (
          <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-800 font-mono">
            <span>Transaction Ref: <strong>{transactionId}</strong></span>
            {paidAt && (
              <span className="text-emerald-700 font-sans">
                Paid: {new Date(paidAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="border-[#2D5A40]/30 bg-white p-6 sm:p-8 rounded-2xl shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-[#2D5A40] shrink-0">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold mb-1">
              Required Step
            </Badge>
            <h3 className="text-base sm:text-lg font-bold text-[#1a3321]">{title}</h3>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl font-black text-[#2D5A40]">₹1.00</span>
          <span className="block text-[10px] text-muted-foreground font-semibold uppercase">One-Time Fee</span>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
        {description}
      </p>

      {errorNotice && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <span className="flex-1">{errorNotice}</span>
        </div>
      )}

      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Button
          onClick={handlePayFee}
          disabled={payingFee || checkingStatus}
          className="bg-[#2D5A40] hover:bg-[#234732] text-white font-bold px-6 py-2.5 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-2"
        >
          {payingFee ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Opening Cashfree...</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              <span>Pay ₹1 via Cashfree</span>
            </>
          )}
        </Button>

        {lastOrderId && (
          <Button
            variant="outline"
            onClick={handleCheckStatus}
            disabled={checkingStatus || payingFee}
            className="text-xs border-slate-300 gap-1.5 cursor-pointer"
          >
            {checkingStatus ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <span>Check Payment Status</span>
            )}
          </Button>
        )}
      </div>

      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-medium">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 256-Bit SSL Secured
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Powered by Cashfree Payment Gateway
        </span>
        <span className="flex items-center gap-1">
          <Lock className="h-3.5 w-3.5 text-emerald-600" /> Backend Verified & Idempotent
        </span>
      </div>
    </Card>
  );
}
