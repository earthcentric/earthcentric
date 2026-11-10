"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  const router = useRouter();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Safety watchdog: If Clerk SSO callback takes longer than 3.5 seconds
    // or fails silently, redirect cleanly back to buyer-login so the user is never stranded
    const timer = setTimeout(() => {
      router.replace("/auth/buyer-login");
    }, 3500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF9F4] px-4">
      <div className="p-8 text-center space-y-4 max-w-sm mx-auto bg-white rounded-3xl shadow-sm border border-slate-200">
        {!hasError ? (
          <div>
            <AuthenticateWithRedirectCallback
              signInForceRedirectUrl="/auth/buyer-login"
              signUpForceRedirectUrl="/auth/buyer-login"
            />
            <div className="pt-4">
              <div className="animate-spin h-8 w-8 border-3 border-[#0F6E56] border-t-transparent rounded-full mx-auto" />
              <h3 className="font-extrabold text-slate-800 text-sm mt-3">Completing Google Authentication</h3>
              <p className="text-xs text-slate-500 mt-1">
                Redirecting to EarthCentric buyer verification...
              </p>
            </div>
          </div>
        ) : (
          <div className="pt-2">
            <h3 className="font-extrabold text-slate-800 text-sm">Redirecting to Verification</h3>
            <p className="text-xs text-slate-500 mt-1">
              Please enter your Gmail address to receive your verification code.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
