"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth as useClerkAuth, useSignIn, useSignUp, useUser, useClerk } from "@clerk/nextjs";
import { useAuth } from "@/context/AuthContext";
import {
  getBuyerAuthState,
  submitBuyerMobileNumber,
  verifyBuyerOtpAction,
  resendBuyerOtpAction,
  completeBuyerProfileAction,
} from "@/actions/buyer-auth";
import {
  ShieldCheck,
  CheckCircle2,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
  LogOut,
  AlertCircle,
  Lock,
  ChevronLeft,
  MapPin,
  User,
  Home,
  Building,
} from "lucide-react";
import { toast } from "sonner";

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)", flag: "🇮🇳" },
  { code: "+1", label: "United States / Canada (+1)", flag: "🇺🇸" },
  { code: "+44", label: "United Kingdom (+44)", flag: "🇬🇧" },
  { code: "+971", label: "United Arab Emirates (+971)", flag: "🇦🇪" },
  { code: "+65", label: "Singapore (+65)", flag: "🇸🇬" },
  { code: "+61", label: "Australia (+61)", flag: "🇦🇺" },
  { code: "+49", label: "Germany (+49)", flag: "🇩🇪" },
  { code: "+33", label: "France (+33)", flag: "🇫🇷" },
  { code: "+81", label: "Japan (+81)", flag: "🇯🇵" },
];

function BuyerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect_url") || "/marketplace";

  const { isSignedIn, isLoaded: clerkLoaded } = useClerkAuth();
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { user: appUser, logout } = useAuth();

  // Wizard state: 1: GOOGLE_LOGIN, 2: MOBILE_NUMBER, 3: OTP_VERIFICATION, 4: PROFILE_COMPLETION, 5: SUCCESS
  const [step, setStep] = useState<
    "GOOGLE_LOGIN" | "MOBILE_NUMBER" | "OTP_VERIFICATION" | "PROFILE_COMPLETION" | "SUCCESS"
  >("GOOGLE_LOGIN");
  const [loadingState, setLoadingState] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otpInput, setOtpInput] = useState(["", "", "", "", "", ""]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile completion address fields
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryBuilding, setDeliveryBuilding] = useState("");
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [deliveryCountry, setDeliveryCountry] = useState("India");

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState(0);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Sync state from server whenever auth status changes
  useEffect(() => {
    let active = true;

    async function checkState() {
      try {
        // Fast-path: If user is signed in with Clerk, detect identity immediately
        if (isSignedIn && clerkUser) {
          const clerkEmail = clerkUser.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
          const clerkName =
            clerkUser.fullName ||
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
            clerkUser.username ||
            "";

          if (clerkEmail) {
            setBuyerEmail(clerkEmail);
            if (clerkName) {
              setBuyerName(clerkName);
              setDeliveryName((prev) => prev || clerkName);
            }

            const state = await getBuyerAuthState();
            if (!active) return;

            if (state.role === "WORKER") {
              setStep("SUCCESS");
              setTimeout(() => {
                router.replace("/worker/dashboard");
              }, 400);
              return;
            }

            if (state.role === "ADMIN") {
              setStep("SUCCESS");
              setTimeout(() => {
                router.replace("/admin/dashboard");
              }, 400);
              return;
            }

            if (state.authenticated && state.step === "COMPLETED") {
              setStep("SUCCESS");
              setTimeout(() => {
                if (state.role === "WORKER") {
                  router.replace("/worker/dashboard");
                } else if (state.role === "SELLER") {
                  router.replace("/seller/dashboard");
                } else {
                  router.replace(redirectTarget);
                }
              }, 400);
              return;
            }

            if (state.mobileNumber) setMobileNumber(state.mobileNumber);
            if (state.countryCode) setCountryCode(state.countryCode);

            if (state.step === "PROFILE_COMPLETION") {
              setStep("PROFILE_COMPLETION");
            } else if (state.step === "OTP_VERIFICATION") {
              setStep("OTP_VERIFICATION");
            } else {
              setStep("MOBILE_NUMBER");
            }
            setLoadingState(false);
            return;
          }
        }

        const state = await getBuyerAuthState();
        if (!active) return;

        if (!state.authenticated) {
          setStep("GOOGLE_LOGIN");
          setLoadingState(false);
          return;
        }

        // Worker and Super Admin are exempt
        if (state.role === "WORKER") {
          router.replace("/worker/dashboard");
          return;
        }

        if (state.role === "ADMIN") {
          router.replace("/admin/dashboard");
          return;
        }

        if (state.email) {
          setBuyerEmail(state.email);
        }
        if (state.name) {
          setBuyerName(state.name);
          setDeliveryName((prev) => prev || state.name || "");
        } else if (clerkUser?.fullName) {
          setDeliveryName((prev) => prev || clerkUser.fullName || "");
        }
        if (state.mobileNumber) setMobileNumber(state.mobileNumber);
        if (state.countryCode) setCountryCode(state.countryCode);

        const stepParam = searchParams.get("step");
        if (stepParam === "otp" && (state.email || state.step === "OTP_VERIFICATION")) {
          setStep("OTP_VERIFICATION");
        } else if (state.step === "COMPLETED") {
          setStep("SUCCESS");
          setTimeout(() => {
            if (state.role === "WORKER") {
              router.replace("/worker/dashboard");
            } else if (state.role === "SELLER") {
              router.replace("/seller/dashboard");
            } else {
              router.replace(redirectTarget);
            }
          }, 400);
        } else if (state.step === "PROFILE_COMPLETION") {
          setStep("PROFILE_COMPLETION");
        } else if (state.step === "OTP_VERIFICATION") {
          setStep("OTP_VERIFICATION");
        } else if (state.step === "MOBILE_NUMBER") {
          setStep("MOBILE_NUMBER");
        } else {
          setStep("GOOGLE_LOGIN");
        }
      } catch (e) {
        console.error("Failed to check buyer auth state:", e);
      } finally {
        if (active) setLoadingState(false);
      }
    }

    checkState();

    return () => {
      active = false;
    };
  }, [isSignedIn, clerkLoaded, userLoaded, clerkUser, redirectTarget, router]);

  // Helper to resolve an active signIn resource
  const getActiveSignIn = (): any => {
    if (signIn && typeof (signIn as any).authenticateWithRedirect === "function") {
      return signIn;
    }
    const client = clerk?.client || (typeof window !== "undefined" ? (window as any).Clerk?.client : null);
    if (client?.signIn && typeof client.signIn.authenticateWithRedirect === "function") {
      return client.signIn;
    }
    return null;
  };

  // Helper to resolve an active signUp resource
  const getActiveSignUp = (): any => {
    if (signUp && typeof (signUp as any).authenticateWithRedirect === "function") {
      return signUp;
    }
    const client = clerk?.client || (typeof window !== "undefined" ? (window as any).Clerk?.client : null);
    if (client?.signUp && typeof client.signUp.authenticateWithRedirect === "function") {
      return client.signUp;
    }
    return null;
  };

  // Step 1: Handle Google OAuth Authentication via Clerk
  const handleGoogleOAuth = async () => {
    try {
      setActionLoading(true);
      setErrorMessage(null);

      // Wait up to 3 seconds for Clerk client to finish loading if clicked early
      let activeClerk: any = clerk;
      if (typeof window !== "undefined" && (window as any).Clerk) {
        activeClerk = (window as any).Clerk;
      }

      let activeSignIn = getActiveSignIn();
      let activeSignUp = getActiveSignUp();

      if (!activeSignIn && !activeSignUp) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 100));
          activeSignIn = getActiveSignIn();
          activeSignUp = getActiveSignUp();
          if (activeSignIn || activeSignUp) break;
        }
      }

      const ssoCallbackUrl = "/sso-callback";
      const redirectCompleteUrl = `/auth/buyer-login?redirect_url=${encodeURIComponent(redirectTarget)}`;

      // 1. Primary: Try signIn.authenticateWithRedirect
      if (activeSignIn && typeof activeSignIn.authenticateWithRedirect === "function") {
        try {
          console.log("[EarthCentric] Initiating Google OAuth via Clerk signIn.authenticateWithRedirect...");
          await activeSignIn.authenticateWithRedirect({
            strategy: "oauth_google",
            redirectUrl: ssoCallbackUrl,
            redirectUrlComplete: redirectCompleteUrl,
          });
          return;
        } catch (signInErr: any) {
          console.warn("[EarthCentric] signIn.authenticateWithRedirect notice, falling back to signUp:", signInErr);
          // Fall through to signUp
        }
      }

      // 2. Secondary: Try signUp.authenticateWithRedirect
      if (activeSignUp && typeof activeSignUp.authenticateWithRedirect === "function") {
        try {
          console.log("[EarthCentric] Initiating Google OAuth via Clerk signUp.authenticateWithRedirect...");
          await activeSignUp.authenticateWithRedirect({
            strategy: "oauth_google",
            redirectUrl: ssoCallbackUrl,
            redirectUrlComplete: redirectCompleteUrl,
          });
          return;
        } catch (signUpErr: any) {
          console.warn("[EarthCentric] signUp.authenticateWithRedirect notice:", signUpErr);
          // Fall through to redirectToSignIn
        }
      }

      // 3. Fallback: Clerk redirectToSignIn
      if (activeClerk && typeof activeClerk.redirectToSignIn === "function") {
        console.log("[EarthCentric] Redirecting via activeClerk.redirectToSignIn...");
        await activeClerk.redirectToSignIn({
          fallbackRedirectUrl: redirectCompleteUrl,
          forceRedirectUrl: redirectCompleteUrl,
          signUpFallbackRedirectUrl: redirectCompleteUrl,
          signUpForceRedirectUrl: redirectCompleteUrl,
        });
        return;
      }

      // 4. Last-resort fallback: Direct navigation to Clerk sign-in URL
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      window.location.href = `${origin}/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`;

    } catch (err: any) {
      console.error("[EarthCentric] Google OAuth error:", err);
      setErrorMessage(
        err?.message ||
        "Could not initiate Google authentication. Please try again or check your browser connection."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Step 2: Handle Mobile Number Submit
  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const digits = mobileNumber.replace(/\D/g, "");
    if (!digits) {
      setErrorMessage("Please enter your mobile number.");
      return;
    }

    if (countryCode === "+91" && digits.length !== 10) {
      setErrorMessage("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (countryCode === "+91" && !/^[6-9]/.test(digits)) {
      setErrorMessage("Indian mobile numbers must begin with 6, 7, 8, or 9.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await submitBuyerMobileNumber({
        mobileNumber: digits,
        countryCode,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to submit mobile number.");
        if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
        setActionLoading(false);
        return;
      }

      toast.success("Verification code sent to your Google email!");
      setCooldown(res.cooldownSeconds || 60);
      setStep("OTP_VERIFICATION");
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Step 3: Handle OTP Input change
  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, "").slice(-1);
    const updated = [...otpInput];
    updated[index] = clean;
    setOtpInput(updated);

    if (clean && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpInput[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const updated = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) {
      updated[i] = pasted[i];
    }
    setOtpInput(updated);

    const focusIndex = Math.min(pasted.length, 5);
    const input = document.getElementById(`otp-input-${focusIndex}`);
    input?.focus();
  };

  // Step 3: Submit OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = otpInput.join("");
    if (otp.length !== 6) {
      setErrorMessage("Please enter all 6 digits of your verification code.");
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await verifyBuyerOtpAction(otp);

      if (!res.success) {
        setErrorMessage(res.error || "Verification failed. Please try again.");
        setActionLoading(false);
        return;
      }

      toast.success("Email verified successfully! Please enter your delivery details to complete onboarding.");
      setStep("PROFILE_COMPLETION");
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during verification.");
    } finally {
      setActionLoading(false);
    }
  };

  // Step 4: Submit Mandatory Profile & Delivery Address Completion
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!deliveryName.trim() || deliveryName.trim().length < 2) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!deliveryBuilding.trim()) {
      setErrorMessage("Please enter your House / Flat / Building No.");
      return;
    }
    if (!deliveryStreet.trim() || deliveryStreet.trim().length < 2) {
      setErrorMessage("Please enter your Street / Road / Area.");
      return;
    }
    if (!deliveryCity.trim() || deliveryCity.trim().length < 2) {
      setErrorMessage("Please enter your City.");
      return;
    }
    if (!deliveryState.trim() || deliveryState.trim().length < 2) {
      setErrorMessage("Please enter your State.");
      return;
    }
    if (!/^\d{6}$/.test(deliveryPostalCode.trim())) {
      setErrorMessage("Please enter a valid 6-digit Indian PIN code.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await completeBuyerProfileAction({
        name: deliveryName.trim(),
        building: deliveryBuilding.trim(),
        street: deliveryStreet.trim(),
        city: deliveryCity.trim(),
        state: deliveryState.trim(),
        postalCode: deliveryPostalCode.trim(),
        country: deliveryCountry.trim() || "India",
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to complete profile.");
        setActionLoading(false);
        return;
      }

      toast.success("Profile saved! Welcome to EarthCentric Marketplace.");
      setStep("SUCCESS");

      setTimeout(() => {
        if (res.role === "SELLER") {
          router.replace("/seller/dashboard");
        } else if (res.role === "ADMIN") {
          router.replace("/admin/dashboard");
        } else {
          router.replace(redirectTarget);
        }
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred while saving profile.");
    } finally {
      setActionLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || actionLoading) return;

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await resendBuyerOtpAction();
      if (!res.success) {
        setErrorMessage(res.error || "Failed to resend code.");
        if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
        setActionLoading(false);
        return;
      }

      toast.success("New verification code sent to your Google email!");
      setCooldown(res.cooldownSeconds || 60);
      setOtpInput(["", "", "", "", "", ""]);
      const firstInput = document.getElementById("otp-input-0");
      firstInput?.focus();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to resend verification code.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Logout
  const handleSignOut = async () => {
    setActionLoading(true);
    try {
      await logout();
      setStep("GOOGLE_LOGIN");
      setBuyerEmail("");
      setBuyerName("");
      setMobileNumber("");
      setOtpInput(["", "", "", "", "", ""]);
      setErrorMessage(null);
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loadingState) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="h-10 w-10 border-3 border-[#0F6E56] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500 animate-pulse">
          Securing marketplace session...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-8">
          <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
            <span className="text-2xl sm:text-3xl font-black text-[#1F3A2E] tracking-tight flex items-center justify-center gap-2">
              🌿 EarthCentric
            </span>
          </Link>
          <div className="inline-flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-[#0F6E56] text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Verified Buyer Access</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight pt-1">
            {step === "GOOGLE_LOGIN" && "Marketplace Buyer Sign In"}
            {step === "MOBILE_NUMBER" && "Buyer Mobile Verification"}
            {step === "OTP_VERIFICATION" && "Confirm Your Identity"}
            {step === "PROFILE_COMPLETION" && "Complete Delivery Profile"}
            {step === "SUCCESS" && "Verification Complete"}
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {step === "GOOGLE_LOGIN" && "Authenticating with Google ensures authentic buyer identities across EarthCentric."}
            {step === "MOBILE_NUMBER" && "Enter your active mobile number for order delivery coordination."}
            {step === "OTP_VERIFICATION" && "Enter the 6-digit OTP code sent to your verified Gmail account."}
            {step === "PROFILE_COMPLETION" && "Provide your delivery address to activate full marketplace access and wholesale pricing."}
            {step === "SUCCESS" && "Granting full marketplace access with verified pricing and carbon-neutral checkout."}
          </p>
        </div>

        {/* Progress Stepper (4 Steps) */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-8">
          <div className={`flex items-center space-x-1 text-xs font-bold ${step === "GOOGLE_LOGIN" ? "text-[#0F6E56]" : "text-emerald-700"}`}>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${step === "GOOGLE_LOGIN" ? "bg-[#0F6E56] text-white" : "bg-emerald-100 text-[#0F6E56]"}`}>
              {step !== "GOOGLE_LOGIN" ? "✓" : "1"}
            </span>
            <span className="hidden sm:inline">Google</span>
          </div>
          <div className="h-0.5 w-4 sm:w-6 bg-slate-200" />
          <div className={`flex items-center space-x-1 text-xs font-bold ${step === "MOBILE_NUMBER" ? "text-[#0F6E56]" : ["OTP_VERIFICATION", "PROFILE_COMPLETION", "SUCCESS"].includes(step) ? "text-emerald-700" : "text-slate-400"}`}>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${step === "MOBILE_NUMBER" ? "bg-[#0F6E56] text-white" : ["OTP_VERIFICATION", "PROFILE_COMPLETION", "SUCCESS"].includes(step) ? "bg-emerald-100 text-[#0F6E56]" : "bg-slate-200 text-slate-600"}`}>
              {["OTP_VERIFICATION", "PROFILE_COMPLETION", "SUCCESS"].includes(step) ? "✓" : "2"}
            </span>
            <span className="hidden sm:inline">Mobile</span>
          </div>
          <div className="h-0.5 w-4 sm:w-6 bg-slate-200" />
          <div className={`flex items-center space-x-1 text-xs font-bold ${step === "OTP_VERIFICATION" ? "text-[#0F6E56]" : ["PROFILE_COMPLETION", "SUCCESS"].includes(step) ? "text-emerald-700" : "text-slate-400"}`}>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${step === "OTP_VERIFICATION" ? "bg-[#0F6E56] text-white" : ["PROFILE_COMPLETION", "SUCCESS"].includes(step) ? "bg-emerald-100 text-[#0F6E56]" : "bg-slate-200 text-slate-600"}`}>
              {["PROFILE_COMPLETION", "SUCCESS"].includes(step) ? "✓" : "3"}
            </span>
            <span className="hidden sm:inline">OTP</span>
          </div>
          <div className="h-0.5 w-4 sm:w-6 bg-slate-200" />
          <div className={`flex items-center space-x-1 text-xs font-bold ${step === "PROFILE_COMPLETION" ? "text-[#0F6E56]" : step === "SUCCESS" ? "text-emerald-700" : "text-slate-400"}`}>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${step === "PROFILE_COMPLETION" ? "bg-[#0F6E56] text-white" : step === "SUCCESS" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>
              {step === "SUCCESS" ? "✓" : "4"}
            </span>
            <span className="hidden sm:inline">Profile</span>
          </div>
        </div>

        {/* Card Box */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 1: GOOGLE SIGN IN
             ══════════════════════════════════════════════════════════════ */}
          {step === "GOOGLE_LOGIN" && (
            <div className="space-y-6">
              <div className="bg-[#F5F1EA] rounded-2xl p-4 border border-[#E8E2D9] text-left space-y-1.5">
                <p className="text-xs font-bold text-[#1F3A2E] flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[#0F6E56]" />
                  <span>Mandatory Authentication Before Marketplace Access</span>
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  To view verified product pricing and access the EarthCentric marketplace, please authenticate using your Google/Gmail account.
                </p>
              </div>

              {/* Continue with Google (OAuth Primary) */}
              <button
                type="button"
                onClick={handleGoogleOAuth}
                disabled={actionLoading}
                className="w-full flex items-center justify-center space-x-3 py-3.5 px-4 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 hover:shadow"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{actionLoading ? "Connecting with Google..." : "Continue with Google"}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>

              <div className="pt-2 text-center">
                <Link
                  href="/"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline transition-colors"
                >
                  ← Return to Public Homepage
                </Link>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 2: ENTER MOBILE NUMBER
             ══════════════════════════════════════════════════════════════ */}
          {step === "MOBILE_NUMBER" && (
            <form onSubmit={handleMobileSubmit} className="space-y-5 text-left">
              
              {/* Authenticated Google Account Badge */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-[#0F6E56] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {buyerName ? buyerName.charAt(0).toUpperCase() : "G"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Google Account</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{buyerEmail}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-[11px] font-semibold text-slate-500 hover:text-red-600 transition-colors border-none bg-transparent cursor-pointer ml-2 shrink-0"
                  title="Switch Account"
                >
                  Sign Out
                </button>
              </div>

              {/* Mobile Number Entry Field */}
              <div className="space-y-1.5">
                <label htmlFor="buyer-mobile-input" className="block text-xs font-bold text-slate-700">
                  Enter Your Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="flex rounded-xl border border-slate-200 shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-[#0F6E56] focus-within:border-[#0F6E56]">
                  <label htmlFor="buyer-country-code" className="sr-only">Country Code</label>
                  <select
                    id="buyer-country-code"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="bg-slate-50 border-r border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>

                  <input
                    id="buyer-mobile-input"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="98765 43210"
                    maxLength={15}
                    autoFocus
                    required
                    className="flex-1 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Default is India (+91). We will send a 6-digit verification code to your verified Gmail account.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-[#0F6E56] hover:bg-[#0c5a46] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Sending Code via SendGrid...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
                >
                  Use a different Google account
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 3: OTP VERIFICATION SCREEN
             ══════════════════════════════════════════════════════════════ */}
          {step === "OTP_VERIFICATION" && (
            <form onSubmit={handleVerifyOtp} className="space-y-6 text-left">
              
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-1">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-[#0F6E56]">
                  <Mail className="h-4 w-4" />
                  <span>Check Your Gmail Inbox</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  We sent a 6-digit OTP code to:
                  <strong className="block text-slate-800 font-bold">{buyerEmail}</strong>
                </p>
                <p className="text-[10px] text-slate-400 font-medium pt-1">
                  ⏱️ Code is valid for <strong>5 minutes</strong>. Maximum 5 attempts allowed.
                </p>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 text-center">
                  Enter 6-Digit Code
                </label>
                <div className="flex justify-center gap-2 sm:gap-3">
                  {otpInput.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-input-${idx}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="w-10 sm:w-12 h-12 sm:h-14 text-center text-lg sm:text-xl font-black bg-white border border-slate-300 rounded-xl focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20 focus:outline-none transition-all shadow-sm"
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={actionLoading || otpInput.join("").length !== 6}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-[#0F6E56] hover:bg-[#0c5a46] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code & Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Resend & Back controls */}
              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setStep("MOBILE_NUMBER");
                  }}
                  className="text-slate-500 hover:text-slate-800 font-semibold border-none bg-transparent cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Edit Mobile</span>
                </button>

                {cooldown > 0 ? (
                  <span className="text-slate-400 font-semibold text-[11px]">
                    Resend in {cooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={actionLoading}
                    className="text-[#0F6E56] hover:underline font-bold border-none bg-transparent cursor-pointer"
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3 text-center">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-[11px] font-semibold text-slate-400 hover:text-red-600 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center gap-1 mx-auto"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log Out & Cancel</span>
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 4: MANDATORY PROFILE & DELIVERY ADDRESS COMPLETION CARD
             ══════════════════════════════════════════════════════════════ */}
          {step === "PROFILE_COMPLETION" && (
            <form onSubmit={handleProfileSubmit} className="space-y-4 text-left">
              
              <div className="bg-[#F5F1EA] rounded-2xl p-4 border border-[#E8E2D9] space-y-1.5">
                <p className="text-xs font-bold text-[#1F3A2E] flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#0F6E56]" />
                  <span>Mandatory Delivery Details Before Marketplace Access</span>
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Please complete your full name and delivery address to enable verified buyer shipping and wholesale pricing.
                </p>
              </div>

              {/* Verified Account Badges (Read-Only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-[10px] uppercase font-bold text-slate-500">Verified Email</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{buyerEmail}</p>
                </div>
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-[10px] uppercase font-bold text-slate-500">Verified Mobile</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                    {countryCode} {mobileNumber}
                  </p>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={deliveryName}
                    onChange={(e) => setDeliveryName(e.target.value)}
                    placeholder="Enter your full legal or business name"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
                  />
                </div>
              </div>

              {/* Building & Street */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    House / Building No. <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Home className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={deliveryBuilding}
                      onChange={(e) => setDeliveryBuilding(e.target.value)}
                      placeholder="Flat 402, Lotus Tower"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Street / Road / Area <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={deliveryStreet}
                      onChange={(e) => setDeliveryStreet(e.target.value)}
                      placeholder="MG Road, Sector 14"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* City & State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryCity}
                    onChange={(e) => setDeliveryCity(e.target.value)}
                    placeholder="e.g. Hyderabad"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryState}
                    onChange={(e) => setDeliveryState(e.target.value)}
                    placeholder="e.g. Telangana"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
                  />
                </div>
              </div>

              {/* PIN Code & Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PIN Code (6 digits) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={deliveryPostalCode}
                    onChange={(e) => setDeliveryPostalCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="e.g. 500081"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryCountry}
                    onChange={(e) => setDeliveryCountry(e.target.value)}
                    placeholder="India"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
                  />
                </div>
              </div>

              {/* Save & Complete Button */}
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 bg-[#0F6E56] hover:bg-[#0c5a46] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving Profile & Activating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Continue to Marketplace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 5: SUCCESS STATE
             ══════════════════════════════════════════════════════════════ */}
          {step === "SUCCESS" && (
            <div className="text-center py-4 space-y-4">
              <div className="h-16 w-16 bg-emerald-100 text-[#0F6E56] rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 animate-bounce" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-800">
                  Verification Complete! 🎉
                </h3>
                <p className="text-xs text-slate-500">
                  Your buyer account is now fully verified. Redirecting to EarthCentric Marketplace...
                </p>
              </div>

              <div className="pt-2">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0F6E56] animate-pulse rounded-full w-full" />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-[11px] text-slate-400">
          Protected by EarthCentric Multi-Step Buyer Verification & SendGrid Delivery.
        </p>

      </div>
    </div>
  );
}

export default function BuyerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Loading Buyer Authentication...</div>}>
      <BuyerLoginContent />
    </Suspense>
  );
}
