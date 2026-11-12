"use client";

import React, { useState, useEffect } from "react";
import { X, ShieldCheck, AlertCircle, Phone, CheckCircle2, ArrowRight } from "lucide-react";
import { Button, Input, Label } from "@/components/ui/shared";
import { validateGstAndPhone, validateGSTIN, validateIndianMobile, GST_STATE_CODES } from "@/lib/gstin";
import { saveBuyerGstAndPhoneAction, getBuyerGstStatusAction } from "@/actions/gst";
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
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill phone and load existing GST status
  useEffect(() => {
    if (user?.mobileNumber || user?.phone) {
      setPhone((user.mobileNumber || user.phone || "").replace(/\D/g, "").slice(-10));
    }

    async function checkStatus() {
      try {
        const res = await getBuyerGstStatusAction();
        if (res.gstin) setGstin(res.gstin);
        if (res.phone) setPhone(res.phone.replace(/\D/g, "").slice(-10));
      } catch (e) {
        // Ignore
      }
    }

    if (isOpen) {
      checkStatus();
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  // Real-time normalization and detection
  const cleanGstin = gstin.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
  const stateCodePrefix = cleanGstin.substring(0, 2);
  const detectedStateName = GST_STATE_CODES[stateCodePrefix] || null;

  const gstinStatus = cleanGstin.length > 0 ? validateGSTIN(cleanGstin) : null;
  const phoneStatus = phone.trim().length > 0 ? validateIndianMobile(phone) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const clientCheck = validateGstAndPhone(cleanGstin, phone);
    if (!clientCheck.isValid) {
      setError(clientCheck.error || "Please enter a valid 15-character GSTIN and 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await saveBuyerGstAndPhoneAction({
        gstin: clientCheck.normalizedGstin!,
        phone: clientCheck.normalizedPhone!,
      });

      if (!res.success) {
        setError(res.error || "Failed to save business details. Please check your GSTIN and phone number.");
        return;
      }

      toast.success("Business details saved. Bulk ordering unlocked!");

      if (onSuccess) {
        onSuccess({
          gstin: clientCheck.normalizedGstin!,
          phone: clientCheck.normalizedPhone!,
          stateName: clientCheck.stateName,
          pan: clientCheck.pan,
        });
      }

      onClose();
    } catch (err: any) {
      console.error("GST save failed:", err);
      setError(err?.message || "Failed to save details. Please try again.");
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
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-[#0F6E56] flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Business Details Required
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Please enter your GST registration number and phone number to continue with bulk ordering.
            </p>
          </div>
        </div>

        {/* Error Alert if any */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* GSTIN Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700">
                GSTIN (15 Characters) <span className="text-red-500">*</span>
              </Label>
              {detectedStateName && (
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> State: {detectedStateName}
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
                placeholder="e.g. 36AAACB9876P1ZT"
                value={gstin}
                onChange={(e) => {
                  setGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""));
                  setError(null);
                }}
                className="pl-8 font-mono uppercase text-xs tracking-wide h-11 font-bold"
              />
            </div>
            {gstinStatus && !gstinStatus.isValid && cleanGstin.length >= 2 && (
              <p className="text-[10px] text-amber-700 font-medium">
                {gstinStatus.error}
              </p>
            )}
          </div>

          {/* Registered Phone Number Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              {phoneStatus && phoneStatus.isValid && (
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Valid Indian Mobile (+91)
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
            🔒 <strong>Buyer Privacy:</strong> Your GSTIN and phone number are kept strictly confidential and never shared with sellers or other buyers.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-xs font-bold text-slate-600 border-slate-200 cursor-pointer"
            >
              Keep 1 Box
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 bg-[#0F6E56] hover:bg-[#0c5a46] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{loading ? "Saving..." : "Continue"}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
