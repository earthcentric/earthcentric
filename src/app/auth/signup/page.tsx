"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth, Role } from "@/context/AuthContext";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  Mail, Lock, Eye, EyeClosed, ArrowRight, User, Leaf,
  ShoppingBag, Store, Phone, Shield, CheckCircle2, RotateCcw, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/ios-spinner";
import { sendBuyerOtp, verifyBuyerOtp } from "@/actions/otp";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

type BuyerStep = 1 | 2 | 3 | 4;

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: BuyerStep }) {
  const steps = [
    { label: "Identity", icon: User },
    { label: "Verify", icon: Shield },
    { label: "Password", icon: Lock },
    { label: "Phone", icon: Phone },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-5">
      {steps.map((s, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center">
              <motion.div
                animate={{
                  background: done
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : active
                    ? "linear-gradient(135deg, #34d399, #10b981)"
                    : "rgba(255,255,255,0.08)",
                  borderColor: done || active ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.12)",
                  scale: active ? 1.1 : 1,
                }}
                transition={{ duration: 0.3 }}
                className="w-7 h-7 rounded-full border flex items-center justify-center relative"
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <s.icon className={cn("w-3.5 h-3.5", active ? "text-white" : "text-white/30")} />
                )}
              </motion.div>
              <span
                className={cn(
                  "text-[9px] mt-0.5 font-medium transition-colors duration-300",
                  active ? "text-emerald-400" : done ? "text-emerald-500/70" : "text-white/25"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <motion.div
                animate={{ background: done ? "rgba(16,185,129,0.6)" : "rgba(255,255,255,0.08)" }}
                transition={{ duration: 0.4 }}
                className="h-[1px] w-8 mb-3.5 mx-0.5"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Styled input wrapper ─────────────────────────────────────────────────────

function InputRow({
  icon: Icon,
  focused,
  focusKey,
  children,
}: {
  icon: React.ElementType;
  focused: string | null;
  focusKey: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={cn("relative", focused === focusKey && "z-10")}
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="relative flex items-center overflow-hidden rounded-lg">
        <Icon
          className={cn(
            "absolute left-3 w-4 h-4 transition-all duration-300 pointer-events-none",
            focused === focusKey ? "text-white" : "text-white/40"
          )}
        />
        {children}
      </div>
    </motion.div>
  );
}

const inputCls =
  "w-full bg-white/5 border border-transparent focus:border-white/20 text-white placeholder:text-white/30 h-10 rounded-lg transition-all duration-300 pl-10 pr-3 text-sm outline-none focus:bg-white/10 focus:ring-0";

// ─── OTP 6-digit box input ────────────────────────────────────────────────────
// Uses a single hidden input overlaid on visual display boxes.
// One real <input> captures all keystrokes — no per-box focus management needed.

function OtpBoxInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // When user clicks anywhere on the container, focus the hidden input
  const focusHidden = () => hiddenInputRef.current?.focus();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6);
    onChange(cleaned);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow only numeric keys, backspace, delete, arrows, tab
    const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const digits = value.padEnd(6, " ").split("").slice(0, 6);
  const filledCount = value.length;

  return (
    <div
      className="relative flex gap-2 justify-center cursor-text select-none"
      onClick={focusHidden}
    >
      {/* Hidden real input — captures all keyboard input */}
      <input
        ref={hiddenInputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        aria-label="OTP input"
      />

      {/* Visual boxes — just display the digits */}
      {digits.map((char, i) => {
        const filled = char.trim() !== "";
        const isActive = i === filledCount && filledCount < 6;
        return (
          <div
            key={i}
            onClick={focusHidden}
            className={cn(
              "w-10 h-12 flex items-center justify-center text-lg font-bold rounded-xl border transition-all duration-200",
              filled
                ? "bg-emerald-500/15 border-emerald-400/50 text-white"
                : isActive
                ? "bg-white/8 border-emerald-400/40 text-white animate-pulse"
                : "bg-white/5 border-white/10 text-transparent"
            )}
          >
            {filled ? char : ""}
          </div>
        );
      })}
    </div>
  );
}

// ─── Resend countdown ─────────────────────────────────────────────────────────

function ResendTimer({
  onResend,
  isLoading,
}: {
  onResend: () => void;
  isLoading: boolean;
}) {
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    setSeconds(30);
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const canResend = seconds === 0 && !isLoading;

  return (
    <button
      type="button"
      onClick={canResend ? onResend : undefined}
      disabled={!canResend}
      className={cn(
        "w-full flex items-center justify-center gap-2 text-xs font-medium transition-all duration-300 mt-3 rounded-xl",
        canResend
          ? "py-2.5 px-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/50 text-emerald-300 font-bold hover:from-emerald-500/30 hover:to-teal-500/30 hover:text-white hover:border-emerald-400 shadow-lg shadow-emerald-900/20 scale-100 active:scale-95 cursor-pointer animate-pulse"
          : "py-1.5 text-white/30 cursor-not-allowed border border-transparent"
      )}
    >
      <RotateCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
      {isLoading
        ? "Sending Resend OTP…"
        : seconds > 0
        ? <span>Resend OTP in <span className="text-emerald-400 font-semibold tabular-nums">{seconds}s</span></span>
        : <span>✨ Resend OTP Now</span>
      }
    </button>
  );
}

// ─── Password strength ────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-emerald-500"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];

  if (!password) return null;

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            className={cn("h-[3px] flex-1 rounded-full transition-all duration-500", i < score ? colors[score] : "bg-white/10")}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          />
        ))}
      </div>
      <p className={cn("text-[10px] font-medium", score >= 4 ? "text-emerald-400" : score >= 3 ? "text-yellow-400" : "text-orange-400")}>
        {labels[score]}
      </p>
    </div>
  );
}

// ─── Card shell (shared animated background) ─────────────────────────────────

function CardShell({ children }: { children: React.ReactNode }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="w-full max-w-sm relative z-10"
      style={{ perspective: 1500 }}
    >
      <motion.div
        style={{ rotateX, rotateY }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          mouseX.set(e.clientX - rect.left - rect.width / 2);
          mouseY.set(e.clientY - rect.top - rect.height / 2);
        }}
        onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
        whileHover={{ z: 10 }}
        className="relative group"
      >
        {/* Border beam */}
        <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
          {["top", "right", "bottom", "left"].map((side, di) => (
            <motion.div
              key={side}
              className={cn(
                "absolute bg-gradient-to-r from-transparent via-white to-transparent opacity-70",
                side === "top" || side === "bottom" ? "h-[3px] w-[50%]" : "h-[50%] w-[3px]",
                side === "top" && "top-0 left-0",
                side === "right" && "top-0 right-0 bg-gradient-to-b",
                side === "bottom" && "bottom-0 right-0",
                side === "left" && "bottom-0 left-0 bg-gradient-to-b"
              )}
              animate={
                side === "top" ? { left: ["-50%", "100%"] } :
                side === "right" ? { top: ["-50%", "100%"] } :
                side === "bottom" ? { right: ["-50%", "100%"] } :
                { bottom: ["-50%", "100%"] }
              }
              transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: di * 0.6 }}
            />
          ))}
        </div>

        {/* Glass card */}
        <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/[0.05] shadow-2xl overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`,
              backgroundSize: "30px 30px",
            }}
          />
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SignupPage() {
  const { signup } = useAuth();

  // Shared state
  const [role, setRole] = useState<Role>("BUYER");

  // Buyer multi-step state
  const [step, setStep] = useState<BuyerStep>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Loading & error
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [resendCount, setResendCount] = useState(0);

  // Seller — old single-form (password only, no OTP)
  const [sellerPassword, setSellerPassword] = useState("");
  const [showSellerPassword, setShowSellerPassword] = useState(false);
  const [isSellerSubmitting, setIsSellerSubmitting] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────

  const clearError = () => setFieldError(null);

  // ── Step 1 → Send OTP ─────────────────────────────────────────────

  const handleSendOtp = async () => {
    if (!name.trim() || !email.trim()) {
      setFieldError("Please fill in your name and email.");
      return;
    }
    clearError();
    setIsSendingOtp(true);
    try {
      const res = await sendBuyerOtp(email.trim(), name.trim());
      if (!res.success) {
        setFieldError(res.error || "Failed to send OTP.");
        return;
      }
      if (res.emailFailed) {
        if (res.otp) {
          toast.success(`[Dev Mode] OTP generated: ${res.otp}`);
          setFieldError(`✉️ [Dev Mode] Email delivery failed, but you can use OTP code: ${res.otp}`);
        } else {
          toast.warning("Email delivery failed. Check your inbox or use Resend OTP.");
          setFieldError("⚠️ Email delivery issue — click \"Resend OTP\" below once the timer ends, or check if your email is correct.");
        }
      } else {
        toast.success("OTP sent! Check your inbox.");
      }
      setResendCount(0);
      setStep(2);
    } catch (err) {
      setFieldError("An unexpected error occurred.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ── Step 2 → Verify OTP ───────────────────────────────────────────

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setFieldError("Please enter the complete 6-digit OTP.");
      return;
    }
    clearError();
    setIsVerifyingOtp(true);
    try {
      const res = await verifyBuyerOtp(email.trim(), otp.trim());
      if (!res.success) {
        setFieldError(res.error || "OTP verification failed.");
        return;
      }
      toast.success("Email verified!");
      setStep(3);
    } catch (err) {
      setFieldError("An unexpected error occurred.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    clearError();
    setOtp("");
    setIsSendingOtp(true);
    try {
      const res = await sendBuyerOtp(email.trim(), name.trim());
      if (!res.success) {
        setFieldError(res.error || "Failed to resend OTP.");
        return;
      }
      setResendCount((prev) => prev + 1);
      if (res.emailFailed) {
        if (res.otp) {
          toast.success(`[Dev Mode] Resend OTP generated: ${res.otp}`);
          setFieldError(`✉️ [Dev Mode] Email delivery failed. Resend OTP code is: ${res.otp}`);
        } else {
          toast.success("Resend OTP sent! (Check Terminal or Email)");
          setFieldError("📧 Resend OTP sent! (If email is delayed due to SMTP settings, check terminal console)");
        }
      } else {
        toast.success("Resend OTP sent to your email!");
        clearError();
      }
    } catch (err) {
      setFieldError("An unexpected error occurred.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ── Step 3 → Validate password ────────────────────────────────────

  const handlePasswordStep = () => {
    if (!password) {
      setFieldError("Please enter a password.");
      return;
    }
    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }
    clearError();
    setStep(4);
  };

  // ── Step 4 → Create account ───────────────────────────────────────

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setFieldError("Please enter your phone number.");
      return;
    }
    clearError();
    setIsSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), "BUYER", password, phone.trim());
    } catch (err) {
      setFieldError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Seller single-form submit ─────────────────────────────────────

  const handleSellerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !sellerPassword) return;
    setIsSellerSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), "SELLER", sellerPassword);
    } catch (err) {
      // toast shown in context
    } finally {
      setIsSellerSubmitting(false);
    }
  };

  // ── Shared background layout ──────────────────────────────────────

  return (
    <div className="min-h-screen w-full bg-black relative overflow-hidden flex items-center justify-center py-10 px-4">
      {/* Gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-600/30 via-emerald-800/40 to-black" />
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[120vh] h-[60vh] rounded-b-[50%] bg-emerald-400/15 blur-[80px]" />
      <motion.div
        className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[100vh] h-[60vh] rounded-b-full bg-emerald-300/15 blur-[60px]"
        animate={{ opacity: [0.15, 0.3, 0.15], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-[90vh] h-[90vh] rounded-t-full bg-emerald-400/15 blur-[60px]"
        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, repeatType: "mirror", delay: 1 }}
      />
      <div className="absolute left-1/4 top-1/4 w-96 h-96 bg-white/5 rounded-full blur-[100px] animate-pulse opacity-40" />
      <div className="absolute right-1/4 bottom-1/4 w-96 h-96 bg-white/5 rounded-full blur-[100px] animate-pulse delay-1000 opacity-40" />

      <CardShell>
        {/* Logo */}
        <div className="text-center space-y-1 mb-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="mx-auto w-10 h-10 rounded-full border border-white/10 flex items-center justify-center relative overflow-hidden"
          >
            <Leaf className="h-5 w-5 text-emerald-400" />
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-transparent opacity-50" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80"
          >
            Create Your Account
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/60 text-xs"
          >
            Join EarthCentric's carbon-neutral marketplace
          </motion.p>
        </div>

        {/* ── Role selector (always visible) ── */}
        <div className="mb-4">
          <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider block mb-2">
            Account type
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            {(["BUYER", "SELLER"] as Role[]).map((r) => (
              <motion.button
                key={r}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setRole(r);
                  setStep(1);
                  setFieldError(null);
                  setName("");
                  setEmail("");
                  setOtp("");
                  setPassword("");
                  setConfirmPassword("");
                  setPhone("");
                  setSellerPassword("");
                }}
                className={cn(
                  "relative py-3 px-3 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-300 border overflow-hidden",
                  role === r
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70 bg-white/[0.03]"
                )}
              >
                {role === r && (
                  <motion.div
                    layoutId="role-glow"
                    className="absolute inset-0 bg-emerald-500/5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
                {r === "BUYER" ? (
                  <ShoppingBag className="h-4 w-4 relative z-10" />
                ) : (
                  <Store className="h-4 w-4 relative z-10" />
                )}
                <span className="relative z-10">
                  {r === "BUYER" ? "Conscious Buyer" : "Ethical Supplier"}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            BUYER — 4-step OTP flow
            ═══════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {role === "BUYER" && (
            <motion.div
              key="buyer-flow"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <StepIndicator step={step} />

              {/* Error banner */}
              <AnimatePresence>
                {fieldError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                  >
                    {fieldError}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {/* ── Step 1: Name + Email ── */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    <InputRow icon={User} focused={focusedInput} focusKey="name">
                      <input
                        id="buyer-name"
                        type="text"
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => { setName(e.target.value); clearError(); }}
                        onFocus={() => setFocusedInput("name")}
                        onBlur={() => setFocusedInput(null)}
                        required
                        className={inputCls}
                      />
                    </InputRow>

                    <InputRow icon={Mail} focused={focusedInput} focusKey="email">
                      <input
                        id="buyer-email"
                        type="email"
                        placeholder="Gmail address"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); clearError(); }}
                        onFocus={() => setFocusedInput("email")}
                        onBlur={() => setFocusedInput(null)}
                        required
                        className={inputCls}
                      />
                    </InputRow>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      disabled={isSendingOtp}
                      onClick={handleSendOtp}
                      className="w-full relative group/button mt-2"
                    >
                      <div className="absolute inset-0 bg-white/10 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />
                      <div className="relative overflow-hidden bg-white text-black font-medium h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm">
                        <AnimatePresence mode="wait">
                          {isSendingOtp ? (
                            <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <Spinner size="md" className="text-black/70" />
                            </motion.span>
                          ) : (
                            <motion.span key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                              Send OTP to Gmail
                              <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.button>
                  </motion.div>
                )}

                {/* ── Step 2: OTP entry ── */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                    onAnimationComplete={() => {
                      // Auto-focus the hidden OTP input after the step animates in
                      const hiddenInput = document.querySelector<HTMLInputElement>('[aria-label="OTP input"]');
                      hiddenInput?.focus();
                    }}
                  >
                    <div className="text-center mb-1">
                      <p className="text-white/70 text-xs leading-relaxed">
                        We sent a 6-digit code to{" "}
                        <span className="text-emerald-400 font-semibold">{email}</span>
                      </p>
                    </div>

                    <OtpBoxInput value={otp} onChange={(v) => { setOtp(v); clearError(); }} />

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      disabled={isVerifyingOtp || otp.length !== 6}
                      onClick={handleVerifyOtp}
                      className="w-full relative group/button mt-2"
                    >
                      <div className="absolute inset-0 bg-white/10 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />
                      <div className={cn(
                        "relative overflow-hidden font-medium h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm transition-all duration-300",
                        otp.length === 6 ? "bg-white text-black" : "bg-white/10 text-white/40"
                      )}>
                        <AnimatePresence mode="wait">
                          {isVerifyingOtp ? (
                            <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <Spinner size="md" className="text-black/70" />
                            </motion.span>
                          ) : (
                            <motion.span key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5" />
                              Verify Email
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.button>

                    <ResendTimer key={resendCount} onResend={handleResendOtp} isLoading={isSendingOtp} />

                    <button
                      type="button"
                      onClick={() => { setStep(1); setOtp(""); clearError(); }}
                      className="w-full flex items-center justify-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors duration-300 mt-1"
                    >
                      <ArrowLeft className="w-3 h-3" /> Change email
                    </button>
                  </motion.div>
                )}

                {/* ── Step 3: Password ── */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <p className="text-emerald-400/80 text-xs">
                        Email verified — now set a secure password
                      </p>
                    </div>

                    <div>
                      <InputRow icon={Lock} focused={focusedInput} focusKey="password">
                        <input
                          id="buyer-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Password (min. 8 chars)"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); clearError(); }}
                          onFocus={() => setFocusedInput("password")}
                          onBlur={() => setFocusedInput(null)}
                          required
                          className={cn(inputCls, "pr-10")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3"
                        >
                          {showPassword
                            ? <Eye className="w-4 h-4 text-white/40 hover:text-white transition-colors" />
                            : <EyeClosed className="w-4 h-4 text-white/40 hover:text-white transition-colors" />
                          }
                        </button>
                      </InputRow>
                      <PasswordStrength password={password} />
                    </div>

                    <InputRow icon={Lock} focused={focusedInput} focusKey="confirm">
                      <input
                        id="buyer-confirm-password"
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
                        onFocus={() => setFocusedInput("confirm")}
                        onBlur={() => setFocusedInput(null)}
                        required
                        className={cn(inputCls, "pr-10",
                          confirmPassword && confirmPassword !== password
                            ? "border-red-500/40"
                            : confirmPassword && confirmPassword === password
                            ? "border-emerald-500/40"
                            : ""
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3"
                      >
                        {showConfirm
                          ? <Eye className="w-4 h-4 text-white/40 hover:text-white transition-colors" />
                          : <EyeClosed className="w-4 h-4 text-white/40 hover:text-white transition-colors" />
                        }
                      </button>
                    </InputRow>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="text-red-400 text-[10px] -mt-1">Passwords don't match</p>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handlePasswordStep}
                      className="w-full relative group/button mt-2"
                    >
                      <div className="absolute inset-0 bg-white/10 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />
                      <div className="relative bg-white text-black font-medium h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm">
                        Continue
                        <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                      </div>
                    </motion.button>
                  </motion.div>
                )}

                {/* ── Step 4: Phone ── */}
                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <form onSubmit={handleFinalSubmit} className="space-y-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <p className="text-emerald-400/80 text-xs">
                          Almost there — add your phone number
                        </p>
                      </div>

                      <InputRow icon={Phone} focused={focusedInput} focusKey="phone">
                        <input
                          id="buyer-phone"
                          type="tel"
                          placeholder="Phone number"
                          value={phone}
                          onChange={(e) => { setPhone(e.target.value); clearError(); }}
                          onFocus={() => setFocusedInput("phone")}
                          onBlur={() => setFocusedInput(null)}
                          required
                          className={inputCls}
                        />
                      </InputRow>

                      <p className="text-white/30 text-[10px]">
                        Used only for order updates. Not shared with third parties.
      </p>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full relative group/button mt-2"
                      >
                        <div className="absolute inset-0 bg-white/10 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />
                        <div className="relative overflow-hidden bg-white text-black font-medium h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm">
                          <AnimatePresence mode="wait">
                            {isSubmitting ? (
                              <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <Spinner size="md" className="text-black/70" />
                              </motion.span>
                            ) : (
                              <motion.span key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                                Create Account
                                <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════
              SELLER — simple form (OTP flow defined separately)
              ═════════════════════════════════════════════════════════ */}
          {role === "SELLER" && (
            <motion.div
              key="seller-flow"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleSellerSubmit} className="space-y-3.5">
                <InputRow icon={User} focused={focusedInput} focusKey="s-name">
                  <input
                    id="seller-name"
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setFocusedInput("s-name")}
                    onBlur={() => setFocusedInput(null)}
                    required
                    className={inputCls}
                  />
                </InputRow>

                <InputRow icon={Mail} focused={focusedInput} focusKey="s-email">
                  <input
                    id="seller-email"
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedInput("s-email")}
                    onBlur={() => setFocusedInput(null)}
                    required
                    className={inputCls}
                  />
                </InputRow>

                <InputRow icon={Lock} focused={focusedInput} focusKey="s-pass">
                  <input
                    id="seller-password"
                    type={showSellerPassword ? "text" : "password"}
                    placeholder="Password"
                    value={sellerPassword}
                    onChange={(e) => setSellerPassword(e.target.value)}
                    onFocus={() => setFocusedInput("s-pass")}
                    onBlur={() => setFocusedInput(null)}
                    required
                    className={cn(inputCls, "pr-10")}
                  />
                  <button type="button" onClick={() => setShowSellerPassword(!showSellerPassword)} className="absolute right-3">
                    {showSellerPassword
                      ? <Eye className="w-4 h-4 text-white/40 hover:text-white transition-colors" />
                      : <EyeClosed className="w-4 h-4 text-white/40 hover:text-white transition-colors" />
                    }
                  </button>
                </InputRow>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSellerSubmitting}
                  className="w-full relative group/button mt-4"
                >
                  <div className="absolute inset-0 bg-white/10 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />
                  <div className="relative overflow-hidden bg-white text-black font-medium h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm">
                    <AnimatePresence mode="wait">
                      {isSellerSubmitting ? (
                        <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Spinner size="md" className="text-black/70" />
                        </motion.span>
                      ) : (
                        <motion.span key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                          Create Account
                          <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign in link */}
        <motion.p
          className="text-center text-xs text-white/60 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Already have an account?{" "}
          <Link href="/auth/login" className="relative inline-block group/signin">
            <span className="relative z-10 text-white group-hover/signin:text-white/70 transition-colors duration-300 font-medium">
              Sign in
            </span>
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-white group-hover/signin:w-full transition-all duration-300" />
          </Link>
        </motion.p>
      </CardShell>
    </div>
  );
}
