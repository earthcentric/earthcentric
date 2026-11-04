"use client";

import React, { useState } from "react";
import { X, ShieldCheck, AlertCircle, Building2, Phone, CheckCircle2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui/shared";
import { validateGstAndPhone, validateGSTIN, validateIndianMobile } from "@/lib/gstin";
import { verifyBuyerGstAndPhoneAction } from "@/actions/gst";
import { toast } from "sonner";

interface GstVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (verifiedData: { gstin: string; phone: string; stateName?: string; pan?: string }) => void;
}

export function GstVerificationModal({
  isOpen,
  onClose,
  onSuccess,
}: GstVerificationModalProps) {
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setLoading(true);
    try {
      // Backend validation
      const res = await verifyBuyerGstAndPhoneAction({
        gstin: clientCheck.normalizedGstin!,
        phone: clientCheck.normalizedPhone!,
      });

      if (!res.success || !res.gstin || !res.phone) {
        setError(res.error || "GSTIN or mobile number verification failed. Bulk pricing remains locked.");
        return;
      }

      toast.success("GST & Mobile verified! Bulk pricing unlocked.");
      onSuccess({
        gstin: res.gstin,
        phone: res.phone,
        stateName: res.stateName,
        pan: res.pan,
      });
      onClose();
    } catch (err: any) {
      console.error("GST verification failed:", err);
      setError(err?.message || "Failed to verify details. Please try again.");
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
              B2B Commercial Verification
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              Unlock Bulk Box Pricing
            </h3>
          </div>
        </div>

        {/* Required Exact Explanatory Message */}
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed">
          <p className="font-semibold text-amber-950">
            GSTIN and registered mobile number are required to unlock bulk pricing. Please verify your details to view the price for additional boxes.
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
          {/* GSTIN Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700">
                Commercial GSTIN (15 Characters) *
              </Label>
              {gstinStatus && gstinStatus.isValid && (
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {gstinStatus.stateName}
                </span>
              )}
            </div>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
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
                className="pl-9 font-mono uppercase text-sm tracking-wide h-11"
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
                Registered Mobile Number (10 Digits) *
              </Label>
              {phoneStatus && phoneStatus.isValid && (
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Valid Indian Mobile
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                +91
              </span>
              <Input
                type="tel"
                required
                maxLength={10}
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
                className="pl-12 text-sm font-medium tracking-wider h-11"
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
            🔒 <strong>Strict Buyer Privacy:</strong> Your GSTIN and mobile number are securely verified by EarthCentric and are never exposed to third-party sellers.
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
              Keep 1 Box (Cancel)
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 bg-[#0c3c26] hover:bg-[#08281a] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              {loading ? "Verifying Details..." : "Verify & Unlock Bulk Pricing"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
