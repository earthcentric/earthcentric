"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  User, MapPin, Lock, Plus, Pencil, Trash2, Check, Star,
  Loader2, ChevronRight, Eye, EyeOff, ArrowLeft, ShieldCheck, Phone, Mail,
  Building, Upload, FileText, CheckCircle, AlertCircle, Package, XCircle, Image as ImageIcon, Sparkles, Clock, X, ArrowRight
} from "lucide-react";
import {
  getBuyerProfile, updateBuyerProfile,
  getUserAddresses, addUserAddress, updateUserAddress, deleteUserAddress, setDefaultAddress,
  sendChangePasswordOtp, verifyChangePasswordOtp, changePassword,
  AddressData, BuyerProfileData
} from "@/actions/profile";
import { updateUserProfilePicture } from "@/actions/auth";
import { submit3StepSellerVerification, getSellerProfile, SellerProfile } from "@/actions/sellers";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Tab = "profile" | "addresses" | "password" | "seller";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Address Form ─────────────────────────────────────────────────────────────

function AddressForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: AddressData;
  onSave: (data: Omit<AddressData, "id">) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [street, setStreet] = useState(initial?.street ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [country, setCountry] = useState(initial?.country ?? "India");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!street || !city || !state || !postalCode || !country) {
      toast.error("Please fill in all address fields.");
      return;
    }
    onSave({ street, city, state, postalCode, country });
  };

  const inputClass =
    "w-full rounded-xl border border-[#C8D8C0] bg-[#F5F9F5] px-4 py-2.5 text-sm text-[#1F3A2E] placeholder-[#8FA98E] focus:outline-none focus:border-[#2D5A40] focus:ring-1 focus:ring-[#2D5A40]/30 transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-4 p-4 bg-[#F0F7F0] rounded-2xl border border-[#C8D8C0]">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#2D5A40] mb-1">Street / House No.</label>
          <input className={inputClass} placeholder="e.g. 14 Green Ridge Lane, Apt 2" value={street} onChange={(e) => setStreet(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#2D5A40] mb-1">City</label>
            <input className={inputClass} placeholder="Bangalore" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2D5A40] mb-1">State</label>
            <input className={inputClass} placeholder="Karnataka" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#2D5A40] mb-1">Postal Code</label>
            <input className={inputClass} placeholder="560001" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2D5A40] mb-1">Country</label>
            <input className={inputClass} placeholder="India" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1F3A2E] text-white text-sm font-semibold hover:bg-[#2D5A40] transition disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {initial ? "Save Changes" : "Add Address"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-[#C8D8C0] text-sm text-[#5A7A5A] hover:bg-white transition">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Tab: Edit Profile ────────────────────────────────────────────────────────

function ProfileTab({
  userId,
  userEmail,
  userName,
  initialData,
  onNameUpdate,
  isOnboarding = false,
}: {
  userId: string;
  userEmail?: string;
  userName?: string;
  initialData: BuyerProfileData | null;
  onNameUpdate: (name: string) => void;
  isOnboarding?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || userName || "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialData?.image ?? "");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const displayEmail = initialData?.email || userEmail || "";

  useEffect(() => {
    if (initialData) {
      if (initialData.name) setName(initialData.name);
      if (initialData.phone) setPhone(initialData.phone);
      if (initialData.image) setAvatarUrl(initialData.image);
    }
  }, [initialData]);

  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal, router]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Full Name is mandatory."); return; }
    if (isOnboarding && !phone.trim()) {
      toast.error("Phone Number is mandatory to complete your profile registration.");
      return;
    }
    setIsSaving(true);
    const res = await updateBuyerProfile(userId, { name: name.trim(), phone: phone.trim(), email: displayEmail });
    setIsSaving(false);
    if (res.success) {
      toast.success("Profile updated successfully!");
      onNameUpdate(name.trim());
      localStorage.setItem("earthcentric_profile_done_" + userId, "true");
      // Update localStorage cache
      const cached = localStorage.getItem("earthcentric_user");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          localStorage.setItem("earthcentric_user", JSON.stringify({ ...parsed, name: name.trim(), phone: phone.trim(), isNewUser: false }));
        } catch {}
      }
      if (isOnboarding || !initialData?.phone) {
        setShowSuccessModal(true);
      }
    } else {
      toast.error(res.error || "Failed to update profile.");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB."); return; }

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const url = await updateUserProfilePicture(userId, base64);
        setAvatarUrl(url);
        toast.success("Profile picture updated!");
      } catch {
        toast.error("Failed to upload photo.");
      }
      setIsUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const inputClass =
    "w-full rounded-xl border border-[#C8D8C0] bg-[#F5F9F5] px-4 py-3 text-sm text-[#1F3A2E] placeholder-[#8FA98E] focus:outline-none focus:border-[#2D5A40] focus:ring-1 focus:ring-[#2D5A40]/30 transition";

  return (
    <div className="space-y-6 relative">
      {/* Onboarding Welcome Banner */}
      {isOnboarding && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-[#1F3A2E] to-emerald-900 text-white shadow-lg border border-emerald-500/30 flex items-start gap-4 animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="p-3 bg-amber-400/20 text-amber-300 rounded-2xl shadow-inner shrink-0 mt-0.5 border border-amber-300/30">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>Welcome to EarthCentric!</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 font-extrabold uppercase tracking-wider">Mandatory Setup</span>
            </h4>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              You have successfully authenticated! To complete your profile and unlock the marketplace, please enter your mandatory **Full Name** and **Phone Number** below.
            </p>
          </div>
        </div>
      )}

      {/* Celebration Modal Overlay on Profile Created */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 px-4">
          <div className="bg-gradient-to-b from-white to-[#F5F9F5] rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6 border-2 border-[#0F6E56]/20 transform animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-60" />
              <div className="relative bg-gradient-to-tr from-[#0F6E56] to-[#1F3A2E] rounded-full w-20 h-20 flex items-center justify-center shadow-xl text-white transform hover:scale-105 transition duration-300">
                <CheckCircle className="h-10 w-10 text-emerald-300 animate-bounce" />
              </div>
            </div>

            <div className="space-y-2 relative z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#0F6E56] text-[11px] font-extrabold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-amber-500" /> Profile Setup Complete
              </span>
              <h3 className="text-2xl font-black text-[#1F3A2E]">Profile Created!</h3>
              <p className="text-xs text-[#5A7A5A] leading-relaxed px-2">
                Your mandatory details have been saved! You are now all set to explore verified sustainable sellers and make conscious purchases.
              </p>
            </div>

            <div className="pt-2 relative z-10">
              <button
                onClick={() => router.push("/")}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#0F6E56] via-[#1F3A2E] to-[#0F6E56] text-white text-xs font-extrabold shadow-lg hover:opacity-95 hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                <span>Go to Landing Page Now</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-[10px] text-slate-400 mt-2 animate-pulse">Automatically redirecting to marketplace in 2 seconds...</p>
            </div>
          </div>
        </div>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-[#2D5A40]/20 overflow-hidden bg-[#E8F0E8] flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-[#2D5A40]">{name?.[0]?.toUpperCase() || "?"}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#1F3A2E] text-white flex items-center justify-center shadow hover:bg-[#2D5A40] transition"
          >
            {isUploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>
        <div>
          <p className="font-semibold text-[#1F3A2E] text-sm">{name || userName || "Your Name"}</p>
          <p className="text-xs text-[#7A9A7A]">{displayEmail}</p>
          <p className="text-xs text-[#9AB89A] mt-0.5">Click the pencil to change your photo</p>
        </div>
      </div>

      {/* Fields */}
      <div className="grid gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2D5A40] mb-1.5">
            <User className="h-3.5 w-3.5" /> Full Name <span className="text-red-500">*</span>
          </label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2D5A40] mb-1.5">
            <Mail className="h-3.5 w-3.5" /> Email Address
          </label>
          <div className="relative">
            <input className={cn(inputClass, "pr-20 opacity-70 cursor-not-allowed")} value={displayEmail} readOnly />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold bg-[#E8F0E8] text-[#2D5A40] px-2 py-0.5 rounded-full">Verified</span>
          </div>
          <p className="text-[10px] text-[#9AB89A] mt-1">Email cannot be changed after verification.</p>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2D5A40] mb-1.5">
            <Phone className="h-3.5 w-3.5" /> Phone Number {isOnboarding && <span className="text-red-500">* (Mandatory)</span>}
          </label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" />
          {isOnboarding && <p className="text-[10px] text-amber-700 mt-1 font-semibold">Please enter your valid phone number to complete onboarding.</p>}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#1F3A2E] via-[#0F6E56] to-[#2D5A40] text-white text-sm font-extrabold shadow-lg hover:opacity-95 hover:shadow-xl transition-all duration-300 disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-300" />}
        {isSaving ? "Saving Profile..." : isOnboarding ? "Save Profile & Enter Marketplace" : "Save Profile"}
      </button>
    </div>
  );
}

// ─── Tab: My Addresses ────────────────────────────────────────────────────────

function AddressesTab({ userId }: { userId: string }) {
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getUserAddresses(userId).then((data) => { setAddresses(data); setIsLoading(false); });
  }, [userId]);

  const handleAdd = async (data: Omit<AddressData, "id">) => {
    setIsSaving(true);
    const res = await addUserAddress(userId, data);
    setIsSaving(false);
    if (res.success && res.address) {
      setAddresses((prev) => {
        const withoutDefault = prev.map((a) => ({ ...a, isDefault: false }));
        return res.address!.isDefault ? [res.address!, ...withoutDefault] : [...prev, res.address!];
      });
      setShowAddForm(false);
      toast.success("Address added!");
    } else {
      toast.error(res.error || "Failed to add address.");
    }
  };

  const handleUpdate = async (id: string, data: Omit<AddressData, "id">) => {
    setIsSaving(true);
    const res = await updateUserAddress(id, userId, data);
    setIsSaving(false);
    if (res.success) {
      setAddresses((prev) => prev.map((a) => a.id === id ? { ...a, ...data } : a));
      setEditId(null);
      toast.success("Address updated!");
    } else {
      toast.error(res.error || "Failed to update.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    const res = await deleteUserAddress(id, userId);
    if (res.success) {
      setAddresses((prev) => {
        const remaining = prev.filter((a) => a.id !== id);
        if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
          remaining[0] = { ...remaining[0], isDefault: true };
        }
        return remaining;
      });
      toast.success("Address deleted.");
    } else {
      toast.error(res.error || "Failed to delete.");
    }
  };

  const handleSetDefault = async (id: string) => {
    const res = await setDefaultAddress(id, userId);
    if (res.success) {
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
      toast.success("Default address updated!");
    } else {
      toast.error(res.error || "Failed.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#2D5A40]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#5A7A5A]">{addresses.length} saved address{addresses.length !== 1 ? "es" : ""}</p>
        {!showAddForm && (
          <button
            onClick={() => { setShowAddForm(true); setEditId(null); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F3A2E] text-white text-xs font-semibold hover:bg-[#2D5A40] transition"
          >
            <Plus className="h-3.5 w-3.5" /> Add Address
          </button>
        )}
      </div>

      {showAddForm && (
        <AddressForm
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isSaving={isSaving}
        />
      )}

      {addresses.length === 0 && !showAddForm && (
        <div className="text-center py-12 rounded-2xl border border-dashed border-[#C8D8C0] bg-[#F5F9F5]">
          <MapPin className="h-10 w-10 text-[#C8D8C0] mx-auto mb-3" />
          <p className="text-sm text-[#7A9A7A] font-medium">No saved addresses yet</p>
          <p className="text-xs text-[#9AB89A] mt-1">Add an address to speed up checkout</p>
        </div>
      )}

      {addresses.map((addr) => (
        <div
          key={addr.id}
          className={cn(
            "rounded-2xl border p-4 transition",
            addr.isDefault ? "border-[#2D5A40] bg-[#F0F9F0] shadow-sm" : "border-[#D8E8D0] bg-white"
          )}
        >
          {editId === addr.id ? (
            <AddressForm
              initial={addr}
              onSave={(data) => handleUpdate(addr.id!, data)}
              onCancel={() => setEditId(null)}
              isSaving={isSaving}
            />
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <MapPin className={cn("h-4 w-4 mt-0.5 flex-shrink-0", addr.isDefault ? "text-[#2D5A40]" : "text-[#9AB89A]")} />
                <div>
                  {addr.isDefault && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2D5A40] bg-[#D0EDD0] px-2 py-0.5 rounded-full mb-1">
                      <Star className="h-2.5 w-2.5 fill-[#2D5A40]" /> Default
                    </span>
                  )}
                  <p className="text-sm font-medium text-[#1F3A2E]">{addr.street}</p>
                  <p className="text-xs text-[#5A7A5A]">{addr.city}, {addr.state} — {addr.postalCode}</p>
                  <p className="text-xs text-[#9AB89A]">{addr.country}</p>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!addr.isDefault && (
                  <button
                    onClick={() => handleSetDefault(addr.id!)}
                    title="Set as default"
                    className="p-1.5 rounded-lg text-[#2D5A40] hover:bg-[#E0F0E0] transition"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { setEditId(addr.id!); setShowAddForm(false); }}
                  title="Edit"
                  className="p-1.5 rounded-lg text-[#5A7A5A] hover:bg-[#E8F0E8] transition"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(addr.id!)}
                  title="Delete"
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Change Password ─────────────────────────────────────────────────────

function PasswordTab({ userId, email }: { userId: string; email: string }) {
  const [step, setStep] = useState<"send" | "verify" | "reset" | "done">("send");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(60);
    const id = setInterval(() => {
      setCountdown((s) => { if (s <= 1) { clearInterval(id); return 0; } return s - 1; });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setIsLoading(true);
    setError(null);
    const res = await sendChangePasswordOtp(email);
    setIsLoading(false);
    if (!res.success) { setError(res.error || "Failed to send OTP."); return; }
    if (res.isMock && res.otp) {
      setDevOtp(res.otp);
      setError(`[Dev Mode] Email delivery failed. Your OTP code is: ${res.otp}`);
    } else {
      toast.success("OTP sent to your email!");
    }
    startCountdown();
    setStep("verify");
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError("Please enter the 6-digit OTP."); return; }
    setIsLoading(true);
    setError(null);
    const res = await verifyChangePasswordOtp(email, otp);
    setIsLoading(false);
    if (!res.success) { setError(res.error || "Invalid OTP."); return; }
    setStep("reset");
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) { setError("Please fill in both password fields."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setIsLoading(true);
    setError(null);
    const res = await changePassword(userId, newPassword);
    setIsLoading(false);
    if (!res.success) { setError(res.error || "Failed to change password."); return; }
    setStep("done");
    toast.success("Password changed successfully!");
  };

  const inputClass =
    "w-full rounded-xl border border-[#C8D8C0] bg-[#F5F9F5] px-4 py-3 text-sm text-[#1F3A2E] placeholder-[#8FA98E] focus:outline-none focus:border-[#2D5A40] focus:ring-1 focus:ring-[#2D5A40]/30 transition";

  return (
    <div className="space-y-5 max-w-sm">
      {step === "send" && (
        <>
          <div className="p-4 rounded-2xl bg-[#F0F9F0] border border-[#C8D8C0]">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-[#2D5A40]" />
              <p className="text-sm font-semibold text-[#1F3A2E]">Secure Password Change</p>
            </div>
            <p className="text-xs text-[#5A7A5A] leading-relaxed">
              We'll send a 6-digit verification code to <span className="font-medium text-[#2D5A40]">{email}</span> to confirm it's you.
            </p>
          </div>
          {error && <p className={`text-xs p-3 rounded-xl border ${error.includes("[Dev Mode]") ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-600 bg-red-50 border-red-200"}`}>{error}</p>}
          <button
            onClick={handleSendOtp}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#1F3A2E] to-[#2D5A40] text-white text-sm font-bold shadow hover:opacity-90 transition disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Send Verification Code
          </button>
        </>
      )}

      {step === "verify" && (
        <>
          <p className="text-sm text-[#5A7A5A]">
            A 6-digit code was sent to <span className="font-medium text-[#2D5A40]">{email}</span>
          </p>
          {error && <p className={`text-xs p-3 rounded-xl border ${error.includes("[Dev Mode]") ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-600 bg-red-50 border-red-200"}`}>{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Enter OTP</label>
            <input
              className={inputClass}
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleVerifyOtp}
              disabled={isLoading || otp.length !== 6}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#1F3A2E] to-[#2D5A40] text-white text-sm font-bold shadow hover:opacity-90 transition disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Verify Code
            </button>
            <button
              onClick={() => { setStep("send"); setOtp(""); setError(null); setDevOtp(null); }}
              className="px-4 py-3 rounded-xl border border-[#C8D8C0] text-sm text-[#5A7A5A] hover:bg-[#F5F9F5] transition"
            >
              Back
            </button>
          </div>
          <button
            onClick={handleSendOtp}
            disabled={countdown > 0 || isLoading}
            className="text-xs text-[#7A9A7A] hover:text-[#2D5A40] transition disabled:opacity-40"
          >
            {countdown > 0 ? `Resend OTP in ${countdown}s` : "Resend OTP"}
          </button>
        </>
      )}

      {step === "reset" && (
        <>
          <p className="text-sm text-[#5A7A5A]">OTP verified ✓ Set your new password below.</p>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">New Password</label>
              <div className="relative">
                <input
                  className={cn(inputClass, "pr-10")}
                  type={showNew ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AB89A]">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  className={cn(inputClass, "pr-10")}
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AB89A]">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={handleChangePassword}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#1F3A2E] to-[#2D5A40] text-white text-sm font-bold shadow hover:opacity-90 transition disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Update Password
          </button>
        </>
      )}

      {step === "done" && (
        <div className="text-center py-8 space-y-3">
          <div className="h-14 w-14 rounded-full bg-[#D0EDD0] flex items-center justify-center mx-auto">
            <Check className="h-7 w-7 text-[#2D5A40]" />
          </div>
          <p className="text-base font-bold text-[#1F3A2E]">Password Updated!</p>
          <p className="text-xs text-[#7A9A7A]">Your password has been changed successfully.</p>
          <button
            onClick={() => { setStep("send"); setOtp(""); setNewPassword(""); setConfirmPassword(""); setError(null); }}
            className="text-xs text-[#2D5A40] hover:underline"
          >
            Change password again
          </button>
        </div>
      )}
    </div>
  );
}

// Helper: compress image data URLs on client side so Server Action JSON payloads remain small and ultra fast
function compressImageBase64(base64Str: string, maxWidth = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    if (!base64Str.startsWith("data:image/")) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
}

// ─── Tab: Become a Seller ─────────────────────────────────────────────────────

function BecomeSellerTab({ userId }: { userId: string }) {
  const router = useRouter();
  const { user, updateSellerStatus } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Company Identity
  const [companyName, setCompanyName] = useState("");
  const [founderName, setFounderName] = useState("");
  const [businessType, setBusinessType] = useState("Manufacturer");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Step 2: Legal Documents
  const [gstNumber, setGstNumber] = useState("");
  const [gstFile, setGstFile] = useState<{ name: string; base64: string } | null>(null);
  const [panNumber, setPanNumber] = useState("");
  const [panFile, setPanFile] = useState<{ name: string; base64: string } | null>(null);
  const [aadharNumber, setAadharNumber] = useState("");
  const [aadharFile, setAadharFile] = useState<{ name: string; base64: string } | null>(null);
  const [certFiles, setCertFiles] = useState<{ name: string; base64: string }[]>([]);

  // Address & Bank Details
  const [companyAddress, setCompanyAddress] = useState("");
  const [factoryAddress, setFactoryAddress] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  // Step 3: Product Launch
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("Eco Packaging");
  const [prodUnit, setProdUnit] = useState("Piece");
  const [prodWholesalePrice, setProdWholesalePrice] = useState("");
  const [prodOriginalPrice, setProdOriginalPrice] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodStock, setProdStock] = useState("");
  const [prodScore, setProdScore] = useState(90);
  const [prodDetail, setProdDetail] = useState("100% biodegradable and eco-friendly material.");
  const [prodMaterial, setProdMaterial] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodImages, setProdImages] = useState<string[]>([
    "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?w=600&auto=format&fit=crop&q=80"
  ]);
  const [newImageUrl, setNewImageUrl] = useState("");

  useEffect(() => {
    let mounted = true;
    getSellerProfile(userId).then((p) => {
      if (mounted) {
        setSellerProfile(p);
        if (p) {
          setCompanyName(p.companyName || "");
          setFounderName(p.userName || p.user?.name || p.founderName || p.ownerName || "");
          setBusinessType(p.businessType || "Manufacturer");
          setPhone(p.phone || "");
          setWebsite(p.website || "");
          setDescription(p.description || "");
          setGstNumber(p.gstNumber || "");
          setPanNumber(p.panNumber || "");
          setAadharNumber(p.aadharNumber || "");
          if (p.verificationStatus === "APPROVED" && updateSellerStatus) {
            updateSellerStatus("APPROVED", p.badges);
          }
        }
        setLoading(false);
      }
    }).catch((err) => {
      console.error("Error loading seller profile:", err);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [userId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: { name: string; base64: string } | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("File must be under 15MB"); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      let base64 = ev.target?.result as string;
      if (file.type.startsWith("image/")) {
        base64 = await compressImageBase64(base64);
      }
      setter({ name: file.name, base64 });
      toast.success(`Attached ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleAddImage = (url: string) => {
    if (!url.trim()) return;
    setProdImages((prev) => [...prev, url.trim()]);
    setNewImageUrl("");
  };

  const handleSubmitWizard = async () => {
    if (prodImages.length < 5) {
      toast.error("Please add at least 5 images for your initial product.");
      return;
    }
    if (!prodName || !prodPrice || !prodStock || !prodDescription) {
      toast.error("Please fill in all required product fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      const docs: any[] = [];
      if (gstFile) docs.push({ type: "GST", fileName: gstFile.name, fileBase64: gstFile.base64 });
      else docs.push({ type: "GST", fileName: "gst_cert.pdf", fileBase64: "https://example.com/gst.pdf" });
      
      if (panFile) docs.push({ type: "PAN", fileName: panFile.name, fileBase64: panFile.base64 });
      else docs.push({ type: "PAN", fileName: "pan_card.pdf", fileBase64: "https://example.com/pan.pdf" });
      
      if (aadharFile) docs.push({ type: "AADHAR", fileName: aadharFile.name, fileBase64: aadharFile.base64 });
      else docs.push({ type: "AADHAR", fileName: "aadhar_card.pdf", fileBase64: "https://example.com/aadhar.pdf" });

      certFiles.forEach((cf) => {
        docs.push({ type: "SUSTAINABILITY_CERTIFICATE", fileName: cf.name, fileBase64: cf.base64 });
      });

      const res = await submit3StepSellerVerification({
        userId,
        companyName,
        founderName,
        businessType,
        description,
        website,
        phone,
        gstNumber,
        panNumber,
        aadharNumber,
        logoUrl,
        companyAddress,
        factoryAddress,
        pickupAddress,
        bankName,
        bankAccountNo,
        bankIfsc,
        documents: docs,
        product: {
          name: prodName,
          description: prodDescription,
          categoryName: prodCategory,
          price: Number(prodPrice),
          wholesalePrice: prodWholesalePrice ? Number(prodWholesalePrice) : undefined,
          originalPrice: prodOriginalPrice ? Number(prodOriginalPrice) : undefined,
          stock: Number(prodStock),
          unit: prodUnit,
          materialUsed: prodMaterial,
          imageUrls: prodImages,
          sustainabilityScore: 85,
          sustainabilityDetail: "",
        }
      });

      setSellerProfile(res);
      toast.success("Seller verification and initial product submitted successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit verification. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-[#C8D8C0] bg-[#F5F9F5] px-4 py-3 text-sm text-[#1F3A2E] placeholder-[#8FA98E] focus:outline-none focus:border-[#2D5A40] focus:ring-1 focus:ring-[#2D5A40]/30 transition";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#2D5A40]" />
      </div>
    );
  }

  if (sellerProfile && (sellerProfile.verificationStatus === "PENDING" || sellerProfile.verificationStatus === "UNDER_REVIEW")) {
    return (
      <div className="p-8 rounded-3xl bg-[#F8FAF8] border-2 border-[#D8E8D0] text-center space-y-5 max-w-lg mx-auto my-6 shadow-sm">
        <div className="h-16 w-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <Clock className="h-8 w-8 animate-pulse" />
        </div>
        <div>
          <h3 className="text-xl font-extrabold text-[#1F3A2E]">Application Under Review</h3>
          <p className="text-xs text-[#5A7A5A] mt-1">Super Admin Audit in Progress</p>
        </div>
        <p className="text-xs text-[#5A7A5A] leading-relaxed">
          Thank you, <span className="font-semibold text-[#2D5A40]">{sellerProfile.companyName}</span>! Your 3-step verification details, legal documents (GST, PAN, Aadhar), and your initial product launch candidate have been submitted to our audit team.
        </p>
        <div className="p-4 rounded-2xl bg-white border border-[#E8F0E8] text-left text-xs space-y-2.5 shadow-inner">
          <div className="flex justify-between border-b border-[#F0F7F0] pb-1.5">
            <span className="text-[#7A9A7A]">Verification Status:</span>
            <span className="font-bold text-amber-600 uppercase tracking-wider">Pending Audit Approval</span>
          </div>
          <div className="flex justify-between border-b border-[#F0F7F0] pb-1.5">
            <span className="text-[#7A9A7A]">Founder Name:</span>
            <span className="font-semibold text-[#1F3A2E]">{sellerProfile.userName || sellerProfile.user?.name || sellerProfile.founderName || sellerProfile.ownerName || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A9A7A]">Initial Product:</span>
            <span className="font-semibold text-[#2D5A40]">Submitted & Waiting Launch</span>
          </div>
        </div>
        <p className="text-[11px] text-[#8FA98E]">Once approved by Super Admin, you will receive a notification, your seller portal will be unlocked, and your first product will automatically go live!</p>
      </div>
    );
  }

  const isApproved = (sellerProfile && sellerProfile.verificationStatus === "APPROVED") || user?.role === "SELLER" || user?.sellerStatus === "APPROVED";

  if (isApproved) {
    const compName = sellerProfile?.companyName || user?.name || "Eco Brand";
    const partnerId = sellerProfile?.id || "seller-1-profile";

    return (
      <div className="p-8 rounded-3xl bg-[#F0F9F0] border-2 border-[#2D5A40] text-center space-y-5 max-w-lg mx-auto my-6 shadow-md">
        <div className="h-16 w-16 bg-[#2D5A40] text-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-xl font-extrabold text-[#1F3A2E]">You Are a Verified Seller! 🎉</h3>
          <p className="text-xs text-[#5A7A5A] mt-1">Welcome to the EarthCentric Partner Network</p>
        </div>
        <p className="text-xs text-[#5A7A5A] leading-relaxed">
          Your business <span className="font-bold text-[#1F3A2E]">{compName}</span> is verified and approved. Your initial product is now live in the EarthCentric marketplace!
        </p>
        <div className="p-4 rounded-2xl bg-white border border-[#E8F0E8] text-left text-xs space-y-2.5 shadow-inner">
          <div className="flex justify-between border-b border-[#F0F7F0] pb-1.5">
            <span className="text-[#7A9A7A]">Verification Status:</span>
            <span className="font-bold text-[#2D5A40] uppercase tracking-wider">Approved & Active</span>
          </div>
          <div className="flex justify-between border-b border-[#F0F7F0] pb-1.5">
            <span className="text-[#7A9A7A]">Partner ID:</span>
            <span className="font-mono text-[#1F3A2E]">{partnerId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A9A7A]">Seller Dashboard:</span>
            <span className="font-semibold text-[#2D5A40]">Unlocked & Ready</span>
          </div>
        </div>
        <button
          onClick={async () => {
            if (updateSellerStatus) {
              await updateSellerStatus("APPROVED", sellerProfile?.badges);
            }
            router.push("/seller/dashboard");
          }}
          className="w-full py-3.5 rounded-2xl bg-[#2D5A40] text-white text-xs font-bold hover:bg-[#1F3A2E] transition shadow-md flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>Go to Seller Dashboard</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      {sellerProfile?.verificationStatus === "NEED_MORE_DOCS" && (
        <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-400 text-left space-y-3 mb-6 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3 text-amber-900 font-bold text-base">
            <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
            <span>Action Required: Super Admin Requested More Documents ⚠️</span>
          </div>
          <p className="text-xs text-amber-950 leading-relaxed bg-amber-100/70 p-3.5 rounded-xl border border-amber-300 font-medium">
            <strong>Super Admin Note:</strong> {sellerProfile.rejectionReason || "Please upload clearer copies of your legal documents (GST, PAN, or Aadhar card) for verification."}
          </p>
          <p className="text-[11px] text-amber-800 font-semibold">Please review and re-upload your documents below to proceed with your audit.</p>
        </div>
      )}
      {sellerProfile?.verificationStatus === "REJECTED" && (
        <div className="p-6 rounded-2xl bg-rose-50 border-2 border-rose-400 text-left space-y-3 mb-6 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3 text-rose-900 font-bold text-base">
            <X className="h-6 w-6 text-rose-600 shrink-0" />
            <span>Application Update: Action Required ❌</span>
          </div>
          <p className="text-xs text-rose-950 leading-relaxed bg-rose-100/70 p-3.5 rounded-xl border border-rose-300 font-medium">
            <strong>Super Admin Reason:</strong> {sellerProfile.rejectionReason || "Your application did not meet our verification criteria at this time."}
          </p>
          <p className="text-[11px] text-rose-800 font-semibold">You may update your details and re-submit your application below.</p>
        </div>
      )}

      {/* Wizard Progress Bar */}
      <div className="bg-[#F8FAF8] p-4 rounded-2xl border border-[#E8F0E8] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold", step === 1 ? "bg-[#2D5A40] text-white" : step > 1 ? "bg-[#D0EDD0] text-[#2D5A40]" : "bg-[#E8F0E8] text-[#7A9A7A]")}>1</div>
          <span className={cn("text-xs font-bold", step === 1 ? "text-[#1F3A2E]" : "text-[#7A9A7A]")}>Company Identity</span>
        </div>
        <ChevronRight className="h-4 w-4 text-[#C8D8C0] hidden sm:block" />
        <div className="flex items-center space-x-2">
          <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold", step === 2 ? "bg-[#2D5A40] text-white" : step > 2 ? "bg-[#D0EDD0] text-[#2D5A40]" : "bg-[#E8F0E8] text-[#7A9A7A]")}>2</div>
          <span className={cn("text-xs font-bold", step === 2 ? "text-[#1F3A2E]" : "text-[#7A9A7A]")}>Legal Documents</span>
        </div>
        <ChevronRight className="h-4 w-4 text-[#C8D8C0] hidden sm:block" />
        <div className="flex items-center space-x-2">
          <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold", step === 3 ? "bg-[#2D5A40] text-white" : "bg-[#E8F0E8] text-[#7A9A7A]")}>3</div>
          <span className={cn("text-xs font-bold", step === 3 ? "text-[#1F3A2E]" : "text-[#7A9A7A]")}>Product Launch (5+ Images)</span>
        </div>
      </div>

      {/* STEP 1: COMPANY IDENTITY */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="border-b border-[#E8F0E8] pb-3">
            <h3 className="text-base font-bold text-[#1F3A2E]">Step 1: Company & Founder Identity</h3>
            <p className="text-xs text-[#7A9A7A]">Tell us about your sustainable enterprise and founder details.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Company Name *</label>
              <input className={inputClass} placeholder="e.g. GreenEarth Packaging Co." value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Founder / Owner Name *</label>
              <input className={inputClass} placeholder="e.g. Aarav Sharma" value={founderName} onChange={(e) => setFounderName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Business Type *</label>
              <select className={inputClass} value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                <option value="Manufacturer">Manufacturer</option>
                <option value="Brand">Brand</option>
                <option value="Artisan">Artisan Collective</option>
                <option value="Supplier">Sustainable Wholesaler / Supplier</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Company Phone *</label>
              <input className={inputClass} placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Company Website (Optional)</label>
              <input className={inputClass} placeholder="https://yourgreenbrand.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Company Description & Mission *</label>
              <textarea className={cn(inputClass, "h-24 resize-none")} placeholder="Describe your eco-friendly products and sustainability practices..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {/* Addresses Section */}
          <div className="mt-4 pt-4 border-t border-[#E8F0E8]">
            <h4 className="text-sm font-bold text-[#1F3A2E] mb-1">Business Addresses</h4>
            <p className="text-[11px] text-[#7A9A7A] mb-3">Provide your business locations so our team can verify and contact you.</p>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Company / Registered Office Address</label>
                <textarea className={cn(inputClass, "h-16 resize-none")} placeholder="e.g. 42, MG Road, Koramangala, Bangalore 560034" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Factory / Manufacturing Address (if different)</label>
                <textarea className={cn(inputClass, "h-16 resize-none")} placeholder="e.g. Plot 12, Industrial Area Phase 2, Hosur 635109" value={factoryAddress} onChange={(e) => setFactoryAddress(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Pickup / Dispatch Address</label>
                <textarea className={cn(inputClass, "h-16 resize-none")} placeholder="e.g. Warehouse 5, Sector 18, Noida 201301" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!companyName.trim() || !founderName.trim() || !phone.trim() || !description.trim()) {
                  toast.error("Please fill in all required company fields.");
                  return;
                }
                setStep(2);
              }}
              className="px-6 py-3 rounded-xl bg-[#1F3A2E] text-white text-xs font-bold hover:bg-[#2D5A40] transition flex items-center gap-2"
            >
              Next: Legal Documents <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: LEGAL DOCUMENTS */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="border-b border-[#E8F0E8] pb-3">
            <h3 className="text-base font-bold text-[#1F3A2E]">Step 2: Legal Verification Documents</h3>
            <p className="text-xs text-[#7A9A7A]">Upload government IDs and certifications for Super Admin verification.</p>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-2">
              <label className="block text-xs font-bold text-[#1F3A2E]">1. GST Registration Number & Document *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputClass} placeholder="29AAACB1234A1Z1" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
                <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#2D5A40] bg-white cursor-pointer hover:bg-[#F0F7F0] transition text-xs text-[#2D5A40] font-semibold">
                  <Upload className="h-4 w-4" />
                  {gstFile ? `Uploaded: ${gstFile.name}` : "Upload GST Certificate (PDF/JPG)"}
                  <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleFileUpload(e, setGstFile)} />
                </label>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-2">
              <label className="block text-xs font-bold text-[#1F3A2E]">2. PAN Card Number & Photo *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputClass} placeholder="AAACB1234A" value={panNumber} onChange={(e) => setPanNumber(e.target.value)} />
                <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#2D5A40] bg-white cursor-pointer hover:bg-[#F0F7F0] transition text-xs text-[#2D5A40] font-semibold">
                  <Upload className="h-4 w-4" />
                  {panFile ? `Uploaded: ${panFile.name}` : "Upload PAN Card Photo"}
                  <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleFileUpload(e, setPanFile)} />
                </label>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-2">
              <label className="block text-xs font-bold text-[#1F3A2E]">3. Aadhar Card Number & Photo *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputClass} placeholder="1234 5678 9012" value={aadharNumber} onChange={(e) => setAadharNumber(e.target.value)} />
                <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#2D5A40] bg-white cursor-pointer hover:bg-[#F0F7F0] transition text-xs text-[#2D5A40] font-semibold">
                  <Upload className="h-4 w-4" />
                  {aadharFile ? `Uploaded: ${aadharFile.name}` : "Upload Aadhar Card Photo"}
                  <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleFileUpload(e, setAadharFile)} />
                </label>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-2">
              <label className="block text-xs font-bold text-[#1F3A2E]">4. Optional Eco Certifications (GOTS, FSC, USDA, etc.)</label>
              <p className="text-[11px] text-[#7A9A7A]">Adding certifications boosts your trust score and highlights your sustainability credentials.</p>
              <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#8FA98E] bg-white cursor-pointer hover:bg-[#F0F7F0] transition text-xs text-[#5A7A5A] font-semibold">
                <Upload className="h-4 w-4" />
                Upload Additional Certificates
                <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    let base64 = ev.target?.result as string;
                    if (file.type.startsWith("image/")) {
                      base64 = await compressImageBase64(base64);
                    }
                    setCertFiles((prev) => [...prev, { name: file.name, base64 }]);
                    toast.success(`Added ${file.name}`);
                  };
                  reader.readAsDataURL(file);
                }} />
              </label>
              {certFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {certFiles.map((cf, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#D0EDD0] text-[#1F3A2E] text-xs font-medium">
                      {cf.name}
                      <button onClick={() => setCertFiles(certFiles.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bank Details Section */}
          <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-3">
            <label className="block text-xs font-bold text-[#1F3A2E]">5. Bank Account Details (for payouts)</label>
            <p className="text-[11px] text-[#7A9A7A]">Required for receiving payments. Your details are encrypted and visible only to the Super Admin.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#2D5A40] mb-1">Bank Name</label>
                <input className={inputClass} placeholder="e.g. State Bank of India" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#2D5A40] mb-1">Account Number</label>
                <input className={inputClass} placeholder="e.g. 1234567890" value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#2D5A40] mb-1">IFSC Code</label>
                <input className={inputClass} placeholder="e.g. SBIN0001234" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="pt-2 flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border border-[#C8D8C0] text-xs font-semibold text-[#5A7A5A] hover:bg-[#F5F9F5] transition">
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (!gstNumber.trim() || !panNumber.trim() || !aadharNumber.trim()) {
                  toast.error("Please provide GST, PAN, and Aadhar numbers.");
                  return;
                }
                setStep(3);
              }}
              className="px-6 py-3 rounded-xl bg-[#1F3A2E] text-white text-xs font-bold hover:bg-[#2D5A40] transition flex items-center gap-2"
            >
              Next: Initial Product <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: INITIAL PRODUCT LAUNCH */}
      {step === 3 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="border-b border-[#E8F0E8] pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1F3A2E]">Step 3: Initial Product Launch Candidate</h3>
                <p className="text-xs text-[#7A9A7A]">When admin approves you as a seller, this product will automatically launch!</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Auto-Launch Ready</span>
            </div>
          </div>

          {/* Image Gallery Uploader (Min 5 Required) */}
          <div className="p-4 rounded-2xl bg-[#F0F7F0] border-2 border-dashed border-[#2D5A40] space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-[#1F3A2E]">Product Images (Minimum 5 Required) *</label>
              <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold", prodImages.length >= 5 ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900")}>
                {prodImages.length >= 5 ? `✓ ${prodImages.length} Images Added` : `⚠️ Need ${5 - prodImages.length} more image${5 - prodImages.length > 1 ? "s" : ""}`}
              </span>
            </div>
            <p className="text-[11px] text-[#5A7A5A]">High-quality photos from multiple angles increase buyers' confidence. We have loaded 5 sample eco images by default.</p>
            
            {/* Thumbnail Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {prodImages.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[#C8D8C0] group bg-white shadow-sm">
                  <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setProdImages(prodImages.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                    title="Remove Image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {idx === 0 && <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center py-0.5 font-bold">Cover</span>}
                </div>
              ))}
            </div>

            {/* Add Image Input */}
            <div className="flex gap-2 pt-1">
              <input
                className={cn(inputClass, "py-2 text-xs bg-white")}
                placeholder="Paste Image URL (or use Upload button)..."
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddImage(newImageUrl); } }}
              />
              <button
                type="button"
                onClick={() => handleAddImage(newImageUrl)}
                className="px-4 py-2 rounded-xl bg-[#2D5A40] text-white text-xs font-bold hover:bg-[#1F3A2E] transition whitespace-nowrap"
              >
                Add URL
              </button>
              <label className="px-4 py-2 rounded-xl border border-[#2D5A40] bg-white text-[#2D5A40] text-xs font-bold hover:bg-[#EAF3EA] transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
                <Upload className="h-3.5 w-3.5" /> Upload File
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    let base64 = ev.target?.result as string;
                    base64 = await compressImageBase64(base64, 1000, 0.75);
                    setProdImages((prev) => [...prev, base64]);
                    toast.success("Image added to product gallery");
                  };
                  reader.readAsDataURL(file);
                }} />
              </label>
            </div>
          </div>

          {/* Product Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Product Title / Name *</label>
              <input className={inputClass} placeholder="e.g. 100% Biodegradable Cornstarch Mailer Bags (Pack of 50)" value={prodName} onChange={(e) => setProdName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Category *</label>
              <select className={inputClass} value={prodCategory} onChange={(e) => setProdCategory(e.target.value)}>
                <option value="Eco Packaging">Eco Packaging</option>
                <option value="Sustainable Fabrics">Sustainable Fabrics</option>
                <option value="Disposables">Biodegradable Disposables</option>
                <option value="Organic Foods">Organic & Farm Fresh</option>
                <option value="Home & Living">Eco Home & Living</option>
                <option value="Recycled Stationery">Recycled Stationery</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Unit / Packaging Type *</label>
              <select className={inputClass} value={prodUnit} onChange={(e) => setProdUnit(e.target.value)}>
                <option value="Piece">Piece / Unit</option>
                <option value="Pack of 50">Pack of 50</option>
                <option value="Pack of 100">Pack of 100</option>
                <option value="Kg">Kilogram (Kg)</option>
                <option value="Set">Complete Set</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Selling Price (₹) *</label>
              <input type="number" className={inputClass} placeholder="e.g. 499" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Wholesale Price (₹) (Optional)</label>
              <input type="number" className={inputClass} placeholder="e.g. 399 for bulk orders" value={prodWholesalePrice} onChange={(e) => setProdWholesalePrice(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Original / MRP Price (₹) (Optional)</label>
              <input type="number" className={inputClass} placeholder="e.g. 699" value={prodOriginalPrice} onChange={(e) => setProdOriginalPrice(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Initial Stock / Inventory (Units) *</label>
              <input type="number" className={inputClass} placeholder="e.g. 500" value={prodStock} onChange={(e) => setProdStock(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Sustainability Score (1 to 100) *</label>
              <div className="flex items-center gap-3">
                <input type="range" min="50" max="100" value={prodScore} onChange={(e) => setProdScore(Number(e.target.value))} className="w-full accent-[#2D5A40]" />
                <span className="px-2.5 py-1 rounded-lg bg-[#D0EDD0] text-[#1F3A2E] font-bold text-xs">{prodScore}/100</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Primary Materials Used</label>
              <input className={inputClass} placeholder="e.g. Organic Cornstarch, Plant Cellulose" value={prodMaterial} onChange={(e) => setProdMaterial(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#2D5A40] mb-1.5">Complete Product Description *</label>
              <textarea className={cn(inputClass, "h-24 resize-none")} placeholder="Describe features, eco benefits, dimensions, and usage..." value={prodDescription} onChange={(e) => setProdDescription(e.target.value)} />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E8F0E8] flex items-center justify-between">
            <button type="button" onClick={() => setStep(2)} className="px-5 py-3 rounded-xl border border-[#C8D8C0] text-xs font-semibold text-[#5A7A5A] hover:bg-[#F5F9F5] transition">
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmitWizard}
              disabled={isSubmitting || prodImages.length < 5}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#1F3A2E] to-[#2D5A40] text-white text-xs font-extrabold shadow-lg hover:opacity-95 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Submit Application & Launch Product
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AccountPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<BuyerProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (tabParam && ["profile", "addresses", "password", "seller"].includes(tabParam)) {
      setActiveTab(tabParam as Tab);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      getBuyerProfile(user.id, user.email)
        .then((p) => { setProfile(p); setProfileLoading(false); })
        .catch((err) => { console.error("Error loading buyer profile:", err); setProfileLoading(false); });
    }
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2D5A40]" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Edit Profile", icon: <User className="h-4 w-4" /> },
    { id: "addresses", label: "My Addresses", icon: <MapPin className="h-4 w-4" /> },
    { id: "password", label: "Change Password", icon: <Lock className="h-4 w-4" /> },
    { id: "seller", label: "Become a Seller", icon: <Building className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F7F0] via-[#F5F9F5] to-[#EAF3EA] py-10 px-4">
      <div className={cn("mx-auto transition-all duration-300", activeTab === "seller" ? "max-w-4xl" : "max-w-3xl")}>
        {/* Admin Banner */}
        {user.role === "ADMIN" && (
          <div className="mb-6 p-5 rounded-3xl bg-gradient-to-r from-[#1F3A2E] to-emerald-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg border border-emerald-500/30">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-white/10 text-emerald-300 shrink-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Super Admin Account</h3>
                <p className="text-xs text-emerald-200/90 mt-0.5">You have administrative access to monitor and manage the marketplace.</p>
              </div>
            </div>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-400 text-[#1F3A2E] font-extrabold text-xs rounded-2xl hover:bg-emerald-300 transition shadow-sm shrink-0 flex items-center justify-center space-x-1.5"
            >
              <span>Open Admin Portal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/60 transition text-[#5A7A5A]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-[#1F3A2E]">My Account</h1>
            <p className="text-xs text-[#7A9A7A]">Manage your profile, addresses and security</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-[#D8E8D0] overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-[#E8F0E8]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold transition border-b-2",
                  activeTab === tab.id
                    ? "border-[#2D5A40] text-[#1F3A2E] bg-[#F5F9F5]"
                    : "border-transparent text-[#7A9A7A] hover:text-[#2D5A40] hover:bg-[#F8FAF8]"
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "profile" && (
              profileLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#2D5A40]" />
                </div>
              ) : (
                <ProfileTab
                  userId={user.id}
                  userEmail={user.email}
                  userName={user.name}
                  initialData={profile}
                  onNameUpdate={(name) => setProfile((p) => p ? { ...p, name } : p)}
                  isOnboarding={searchParams?.get("onboarding") === "true"}
                />
              )
            )}
            {activeTab === "addresses" && <AddressesTab userId={user.id} />}
            {activeTab === "password" && <PasswordTab userId={user.id} email={user.email} />}
            {activeTab === "seller" && <BecomeSellerTab userId={user.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-[#2D5A40]" /></div>}>
      <AccountPageContent />
    </React.Suspense>
  );
}

