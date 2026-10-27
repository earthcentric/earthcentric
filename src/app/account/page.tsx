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
import { SellerRegistrationWizard } from "@/components/seller/SellerRegistrationWizard";

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
  userPhone,
  initialData,
  onProfileUpdate,
  isOnboarding = false,
}: {
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string | null;
  initialData: BuyerProfileData | null;
  onProfileUpdate?: (data: { name: string; phone: string }) => void;
  isOnboarding?: boolean;
}) {
  const router = useRouter();
  const { updateUser } = useAuth();
  const [name, setName] = useState(initialData?.name || userName || "");
  const [phone, setPhone] = useState(initialData?.phone || userPhone || "");
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
    } else if (userPhone && !phone) {
      setPhone(userPhone);
    }
  }, [initialData, userPhone]);

  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal, router]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strictly allow only numeric digits (0-9) and restrict to maximum 10 digits
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(digitsOnly);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Full Name is mandatory."); return; }
    const cleanPhone = phone.replace(/\D/g, "").slice(0, 10);
    if (isOnboarding && !cleanPhone) {
      toast.error("Phone Number is mandatory to complete your profile registration.");
      return;
    }
    if (cleanPhone && cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    setIsSaving(true);
    const res = await updateBuyerProfile(userId, { name: name.trim(), phone: cleanPhone, email: displayEmail });
    setIsSaving(false);
    if (res.success) {
      toast.success("Profile updated successfully!");
      onProfileUpdate?.({ name: name.trim(), phone: cleanPhone });
      updateUser({ name: name.trim(), phone: cleanPhone });
      localStorage.setItem("earthcentric_profile_done_" + userId, "true");
      // Update localStorage cache
      const cached = localStorage.getItem("earthcentric_user");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          localStorage.setItem("earthcentric_user", JSON.stringify({ ...parsed, name: name.trim(), phone: cleanPhone, isNewUser: false }));
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2D5A40]">
              <Phone className="h-3.5 w-3.5" /> Phone Number {isOnboarding && <span className="text-red-500">* (Mandatory)</span>}
            </label>
            <span className="text-[11px] font-mono font-bold text-[#5A7A5A]">
              {phone.length}/10 digits
            </span>
          </div>
          <div className="relative flex items-center">
            <div className="absolute left-3 flex items-center gap-1.5 text-xs font-bold text-[#1F3A2E] bg-emerald-100/80 border border-emerald-300/50 px-2.5 py-1.5 rounded-lg pointer-events-none select-none z-10 shadow-xs">
              <span className="text-sm">🇮🇳</span>
              <span className="tracking-tight">+91</span>
            </div>
            <input
              className={cn(inputClass, "pl-20 font-mono tracking-widest text-sm font-semibold text-[#1F3A2E]")}
              value={phone}
              onChange={handlePhoneChange}
              placeholder="9876543210"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
            />
          </div>
          {phone.length > 0 && phone.length < 10 && (
            <p className="text-[11px] text-amber-700 mt-1 font-semibold flex items-center gap-1">
              <span>⚠️</span> Enter a valid 10-digit number ({10 - phone.length} more digit{10 - phone.length === 1 ? "" : "s"} required).
            </p>
          )}
          {phone.length === 10 && (
            <p className="text-[11px] text-emerald-700 mt-1 font-semibold flex items-center gap-1">
              <span>✅</span> Valid 10-digit mobile number ready to save.
            </p>
          )}
          {isOnboarding && (
            <p className="text-[10px] text-amber-700 mt-1 font-semibold">Please enter your valid phone number to complete onboarding.</p>
          )}
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
    if (res.success) {
      // Re-fetch full list from DB to ensure UI is always in sync
      const refreshed = await getUserAddresses(userId);
      setAddresses(refreshed);
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
      const refreshed = await getUserAddresses(userId);
      setAddresses(refreshed);
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
      const refreshed = await getUserAddresses(userId);
      setAddresses(refreshed);
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
  return <SellerRegistrationWizard userId={userId} />;
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
                  userPhone={user.phone}
                  initialData={profile}
                  onProfileUpdate={(updated) => {
                    setProfile((p) => p ? { ...p, ...updated } : p);
                  }}
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

