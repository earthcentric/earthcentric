"use client";

import type React from "react";
import { useState, useRef } from "react";
import { requestPasswordReset, verifyPasswordResetOTP, resendPasswordResetOTP, resetPassword } from "@/actions/password-reset";

interface OTPVerificationProps {
  defaultEmail?: string;
}

export function OTPVerification({ defaultEmail }: OTPVerificationProps) {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(defaultEmail || "");
  const [step, setStep] = useState<"email" | "otp" | "reset" | "success">("email");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim().slice(0, 4);
    if (/^\d{1,4}$/.test(pastedData)) {
      const digits = pastedData.split("");
      const newOtp = ["", "", "", ""];
      digits.forEach((d, i) => { newOtp[i] = d; });
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 3);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  // Step 1: Submit email to request OTP
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError(null);

    const result = await requestPasswordReset(email);

    setIsLoading(false);
    if (result.success) {
      setStep("otp");
      startCountdown();
      if (result.isMock && result.otp) {
        setError(`[Dev Mode] Email delivery failed, but you can use OTP code: ${result.otp}`);
      }
    } else {
      setError(result.error || "Something went wrong. Please try again.");
    }
  };

  // Step 2: Verify OTP code
  const handleVerify = async () => {
    const otpCode = otp.join("");
    if (otpCode.length !== 4) return;

    setIsLoading(true);
    setError(null);

    const result = await verifyPasswordResetOTP(email, otpCode);

    setIsLoading(false);
    if (result.success) {
      setStep("reset");
    } else {
      setError(result.error || "Verification failed.");
      setOtp(["", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  // Step 3: Reset Password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await resetPassword(email, newPassword);

    setIsLoading(false);
    if (result.success) {
      setStep("success");
    } else {
      setError(result.error || "Failed to reset password. Please try again.");
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (countdown > 0) return;

    setIsLoading(true);
    setError(null);

    const result = await resendPasswordResetOTP(email);

    setIsLoading(false);
    if (result.success) {
      setOtp(["", "", "", ""]);
      startCountdown();
      inputRefs.current[0]?.focus();
      if (result.isMock && result.otp) {
        setError(`[Dev Mode] Email delivery failed, but you can use OTP code: ${result.otp}`);
      }
    } else {
      setError(result.error || "Failed to resend code.");
    }
  };

  const startCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Mask email for display
  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.max(b.length, 2)) + c)
    : "";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl">
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-gradient-to-b from-emerald-800 via-emerald-900 to-black" />
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-600/20 via-emerald-800/40 to-black/95" />
        </div>

        <div className="relative z-10 p-8 py-14">
          {/* Step: Enter email */}
          {step === "email" && (
            <>
              <div className="text-center mb-8">
                <div className="w-8 h-8 mx-auto mb-6 text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <path d="M13 0L4 14h6l-2 10 9-14h-6l2-10z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-semibold text-white mb-3">Reset your password</h1>
                <p className="text-white/70 text-sm leading-relaxed">
                  Enter your email and we'll send you
                  <br />a verification code.
                </p>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 focus:bg-white/15 focus:border-white/40 focus:outline-none transition-all duration-200 h-12 rounded-2xl px-4 text-sm"
                />

                {error && (
                  <p className={`text-xs text-center rounded-xl px-3 py-2 border ${
                    error.includes("[Dev Mode]")
                      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                      : "text-red-300 bg-red-500/10 border-red-500/20"
                  }`}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full bg-white text-emerald-900 font-bold py-3 rounded-2xl shadow-lg hover:bg-white/90 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all duration-200 cursor-pointer"
                >
                  {isLoading ? "Sending code..." : "Send Verification Code"}
                </button>
              </form>
            </>
          )}

          {/* Step: Enter OTP */}
          {step === "otp" && (
            <>
              <div className="text-center mb-8">
                <div className="w-8 h-8 mx-auto mb-6 text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <path d="M13 0L4 14h6l-2 10 9-14h-6l2-10z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-semibold text-white mb-3">Enter verification code</h1>
                <p className="text-white/70 text-sm leading-relaxed">
                  We emailed you a verification code to
                  <br />
                  <span className="text-white">{maskedEmail}</span>
                </p>
              </div>

              <div className="flex justify-center gap-4 mb-6" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <div key={index} className="relative">
                    <input
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-14 h-14 text-center text-xl font-medium bg-white/10 border-white/20 text-white placeholder-white/40 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-200 border shadow-lg opacity-100 rounded-2xl"
                      placeholder=""
                    />
                  </div>
                ))}
              </div>

              {error && (
                <p className={`text-xs text-center mb-4 rounded-xl px-3 py-2 border ${
                  error.includes("[Dev Mode]")
                    ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                    : "text-red-300 bg-red-500/10 border-red-500/20"
                }`}>
                  {error}
                </p>
              )}

              <div className="text-center mb-8">
                <span className="text-white/60 text-sm">Didn't get the code? </span>
                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || isLoading}
                  className="text-white/85 hover:text-white text-sm font-semibold transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend"}
                </button>
              </div>

              <div className="text-center mb-6">
                <button
                  onClick={handleVerify}
                  disabled={otp.join("").length !== 4 || isLoading}
                  className="w-full bg-white text-emerald-900 font-bold py-3 rounded-2xl shadow-lg hover:bg-white/90 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all duration-200 cursor-pointer"
                >
                  {isLoading ? "Verifying..." : "Verify Code"}
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => { setStep("email"); setError(null); setOtp(["", "", "", ""]); }}
                  className="text-white/50 text-xs hover:text-white/70 transition-colors cursor-pointer"
                >
                  ← Use a different email
                </button>
              </div>
            </>
          )}

          {/* Step: Enter new password */}
          {step === "reset" && (
            <>
              <div className="text-center mb-8">
                <div className="w-8 h-8 mx-auto mb-6 text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-semibold text-white mb-3">Set new password</h1>
                <p className="text-white/70 text-sm leading-relaxed">
                  Enter your new password below to reset.
                </p>
              </div>

              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div className="space-y-1">
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 focus:bg-white/15 focus:border-white/40 focus:outline-none transition-all duration-200 h-12 rounded-2xl px-4 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 focus:bg-white/15 focus:border-white/40 focus:outline-none transition-all duration-200 h-12 rounded-2xl px-4 text-sm"
                  />
                </div>

                {error && (
                  <p className="text-red-300 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="w-full bg-white text-emerald-900 font-bold py-3 rounded-2xl shadow-lg hover:bg-white/90 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all duration-200 cursor-pointer"
                >
                  {isLoading ? "Updating password..." : "Update Password"}
                </button>
              </form>
            </>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl">
                ✓
              </div>
              <h1 className="text-2xl font-semibold text-white">Verified Successfully!</h1>
              <p className="text-white/70 text-sm leading-relaxed">
                Your identity has been verified. You can now set a new password for your account.
              </p>
              <a
                href="/auth/login"
                className="inline-block bg-white text-emerald-900 font-bold py-3 px-8 rounded-2xl shadow-lg hover:bg-white/90 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                Back to Login
              </a>
            </div>
          )}

          <div className="text-center mt-6">
            <p className="text-white/50 text-[10px] leading-relaxed">
              By continuing, you agree to our{" "}
              <button className="text-white/70 hover:text-white underline transition-colors cursor-pointer">Terms of Service</button> &{" "}
              <button className="text-white/70 hover:text-white underline transition-colors cursor-pointer">Privacy Policy</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
