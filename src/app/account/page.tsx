"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User, MapPin, Lock, Plus, Pencil, Trash2, Check, Star,
  Loader2, ChevronRight, Eye, EyeOff, ArrowLeft, ShieldCheck, Phone, Mail
} from "lucide-react";
import {
  getBuyerProfile, updateBuyerProfile,
  getUserAddresses, addUserAddress, updateUserAddress, deleteUserAddress, setDefaultAddress,
  sendChangePasswordOtp, verifyChangePasswordOtp, changePassword,
  AddressData, BuyerProfileData
} from "@/actions/profile";
import { updateUserProfilePicture } from "@/actions/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Tab = "profile" | "addresses" | "password";

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

function ProfileTab({ userId, initialData, onNameUpdate }: { userId: string; initialData: BuyerProfileData | null; onNameUpdate: (name: string) => void }) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialData?.image ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name cannot be empty."); return; }
    setIsSaving(true);
    const res = await updateBuyerProfile(userId, { name: name.trim(), phone: phone.trim() });
    setIsSaving(false);
    if (res.success) {
      toast.success("Profile updated successfully!");
      onNameUpdate(name.trim());
      // Update localStorage cache
      const cached = localStorage.getItem("earthcentric_user");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          localStorage.setItem("earthcentric_user", JSON.stringify({ ...parsed, name: name.trim() }));
        } catch {}
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
    <div className="space-y-6">
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
          <p className="font-semibold text-[#1F3A2E] text-sm">{name || "Your Name"}</p>
          <p className="text-xs text-[#7A9A7A]">{initialData?.email}</p>
          <p className="text-xs text-[#9AB89A] mt-0.5">Click the pencil to change your photo</p>
        </div>
      </div>

      {/* Fields */}
      <div className="grid gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2D5A40] mb-1.5">
            <User className="h-3.5 w-3.5" /> Full Name
          </label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2D5A40] mb-1.5">
            <Mail className="h-3.5 w-3.5" /> Email Address
          </label>
          <div className="relative">
            <input className={cn(inputClass, "pr-20 opacity-70 cursor-not-allowed")} value={initialData?.email ?? ""} readOnly />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold bg-[#E8F0E8] text-[#2D5A40] px-2 py-0.5 rounded-full">Verified</span>
          </div>
          <p className="text-[10px] text-[#9AB89A] mt-1">Email cannot be changed after verification.</p>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2D5A40] mb-1.5">
            <Phone className="h-3.5 w-3.5" /> Phone Number
          </label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#1F3A2E] to-[#2D5A40] text-white text-sm font-bold shadow hover:opacity-90 transition disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {isSaving ? "Saving…" : "Save Profile"}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<BuyerProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      getBuyerProfile(user.id).then((p) => { setProfile(p); setProfileLoading(false); });
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
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F7F0] via-[#F5F9F5] to-[#EAF3EA] py-10 px-4">
      <div className="max-w-3xl mx-auto">
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
                  initialData={profile}
                  onNameUpdate={(name) => setProfile((p) => p ? { ...p, name } : p)}
                />
              )
            )}
            {activeTab === "addresses" && <AddressesTab userId={user.id} />}
            {activeTab === "password" && <PasswordTab userId={user.id} email={user.email} />}
          </div>
        </div>
      </div>
    </div>
  );
}
