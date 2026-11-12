"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

function SSOCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect_url") || "/marketplace";
  const postAuthUrl = `/auth/buyer-login?redirect_url=${encodeURIComponent(redirectTarget)}`;

  useEffect(() => {
    // Safety watchdog: If Clerk SSO callback takes longer than 4 seconds,
    // redirect cleanly to the buyer onboarding / login page
    const timer = setTimeout(() => {
      router.replace(postAuthUrl);
    }, 4000);

    return () => clearTimeout(timer);
  }, [router, postAuthUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF9F4] px-4">
      <div className="p-8 text-center space-y-4 max-w-sm mx-auto bg-white rounded-3xl shadow-sm border border-slate-200">
        <AuthenticateWithRedirectCallback
          signInForceRedirectUrl={postAuthUrl}
          signUpForceRedirectUrl={postAuthUrl}
          continueSignUpUrl={postAuthUrl}
        />
        <div className="pt-4">
          <div className="animate-spin h-8 w-8 border-3 border-[#0F6E56] border-t-transparent rounded-full mx-auto" />
          <h3 className="font-extrabold text-slate-800 text-sm mt-3">Completing Google Authentication</h3>
          <p className="text-xs text-slate-500 mt-1">
            Setting up your secure EarthCentric session...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SSOCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FBF9F4]">
          <div className="animate-spin h-8 w-8 border-3 border-[#0F6E56] border-t-transparent rounded-full mx-auto" />
        </div>
      }
    >
      <SSOCallbackContent />
    </Suspense>
  );
}
