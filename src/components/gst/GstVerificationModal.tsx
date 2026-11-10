"use client";

import React, { useState, useEffect } from "react";
import { X, ShieldCheck, AlertCircle, Building2, Phone, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { Button, Input, Label } from "@/components/ui/shared";
import { validateGstAndPhone, validateGSTIN, validateIndianMobile } from "@/lib/gstin";
import { submitBuyerGstVerificationAction, getBuyerGstStatusAction } from "@/actions/gst";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface GstVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (verifiedData: { gstin: string; phone: string; stateName?: string; pan?: string }) => void;
}

export function GstVerificationModal({
  isOpen,
  onClose,
  onSuccess,
}: GstVerificationModalProps) {
  const { user } = useAuth();
  const [gstin, setGstin] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState<"IDLE" | "PENDING_REVIEW">("IDLE");

  // Prefill phone and load existing GST status
  useEffect(() => {
    if (user?.mobileNumber || user?.phone) {
      setPhone((user.mobileNumber || user.phone || "").replace(/\D/g, "").slice(-10));
    }

    async function checkStatus() {
      try {
        const res = await getBuyerGstStatusAction();
        if (res.gstStatus === "PENDING") {
          setSubmittedStatus("PENDING_REVIEW");
          if (res.gstin) setGstin(res.gstin);
          if (res.gstBusinessName) setBusinessName(res.gstBusinessName);
        }
      } catch (e) {
        // Ignore
      }
    }

    if (isOpen) {
      checkStatus();
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  // Real-time validations
  const liveGstin = gstin.trim().toUpperCase();
  const gstinStatus = liveGstin.length > 0 ? validateGSTIN(liveGstin) : null;
  const phoneStatus = phone.trim().length > 0 ? validateIndianMobile(phone) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation first
    const clientCheck = validateGstAndPhone(gstin, phone);
    if (!clientCheck.isValid) {
      setError(clientCheck.error || "Please enter a valid 15-character GSTIN and 10-digit mobile number.");
      return;
    }

    if (!businessName.trim() || businessName.trim().length < 2) {
      setError("Please enter your registered Business / Company Name.");
      return;
    }

    setLoading(true);
    try {
      const res = await submitBuyerGstVerificationAction({
        gstin: clientCheck.normalizedGstin!,
        businessName: businessName.trim(),
        phone: clientCheck.normalizedPhone!,
      });

      if (!res.success) {
        setError(res.error || "GST verification submission failed. Please try again.");
        return;
      }

      toast.success("GST details submitted for Super Admin review!");
      setSubmittedStatus("PENDING_REVIEW");

      if (onSuccess) {
        onSuccess({
          gstin: clientCheck.normalizedGstin!,
          phone: clientCheck.normalizedPhone!,
          stateName: clientCheck.stateName,
          pan: clientCheck.pan,
        });
      }
    } catch (err: any) {
      console.error("GST verification failed:", err);
      setError(err?.message || "Failed to submit details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-emerald-100 shadow-2xl relative space-y-5 text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-[#0F6E56] flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#0F6E56] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              B2B Commercial Bulk Verification
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              Bulk Order Verification (2+ Boxes)
            </h3>
          </div>
        </div>

        {/* If pending review */}
        {submittedStatus === "PENDING_REVIEW" ? (
          <div className="space-y-5 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>GST Submission Under Review</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Your GSTIN <strong>{gstin}</strong> ({businessName || "Registered Business"}) has been received. Our Super Admin team verifies commercial accounts within 24–48 business hours.
              </p>
              <div className="bg-white/80 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 mt-2">
                🌱 <strong>Single-box orders are available now:</strong> You can continue ordering 1 box per product at standard pricing without waiting for GST review.
              </div>
            </div>

            <Button
              type="button"
              onClick={onClose}
              className="w-full h-11 bg-[#0F6E56] hover:bg-[#0c5a46] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Continue Ordering 1 Box
            </Button>
          </div>
        ) : (
          <>
            {/* Explanatory Message */}
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold text-amber-950">
                GSTIN and registered business details are required to unlock 2 or more boxes and commercial bulk pricing.
              </p>
              <p className="text-[11px] text-amber-800 mt-1.5">
                Single-box orders remain available at standard pricing. Verified businesses receive exclusive approved seller bulk rates on 2 or more boxes.
              </p>
            </div>

            {/* Error Alert if any */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Verification Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Business Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Registered Business / Company Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Green Earth Enterprises LLP"
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      setError(null);
                    }}
                    className="pl-9 text-xs font-semibold h-11"
                  />
                </div>
              </div>

              {/* GSTIN Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">
                    Commercial GSTIN (15 Characters) <span className="text-red-500">*</span>
                  </Label>
                  {gstinStatus && gstinStatus.isValid && (
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {gstinStatus.stateName}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-3 font-mono text-xs font-bold text-slate-400">
                    #
                  </span>
                  <Input
                    type="text"
                    required
                    maxLength={15}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    value={gstin}
                    onChange={(e) => {
                      setGstin(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    className="pl-8 font-mono uppercase text-xs tracking-wide h-11 font-bold"
                  />
                </div>
                {gstinStatus && !gstinStatus.isValid && liveGstin.length >= 2 && (
                  <p className="text-[10px] text-amber-700 font-medium">
                    {gstinStatus.error}
                  </p>
                )}
              </div>

              {/* Registered Mobile Number Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">
                    Confirmed Mobile Number (10 Digits) <span className="text-red-500">*</span>
                  </Label>
                  {phoneStatus && phoneStatus.isValid && (
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Valid Indian Mobile
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">
                    +91
                  </span>
                  <Input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, ""));
                      setError(null);
                    }}
                    className="pl-11 text-xs font-semibold tracking-wider h-11"
                  />
                </div>
                {phoneStatus && !phoneStatus.isValid && phone.length > 0 && (
                  <p className="text-[10px] text-amber-700 font-medium">
                    {phoneStatus.error}
                  </p>
                )}
              </div>

              {/* Privacy Note */}
              <p className="text-[11px] text-slate-500 leading-normal pt-1">
                🔒 <strong>Strict Buyer Privacy:</strong> Your GSTIN and business details are verified by EarthCentric Super Admin and never shared with competitor merchants.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl text-xs font-bold text-slate-600 border-slate-200"
                >
                  Keep 1 Box
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-11 bg-[#0F6E56] hover:bg-[#0c5a46] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  {loading ? "Submitting..." : "Submit for Verification"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
