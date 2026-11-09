"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SSOCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/buyer-login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF9F4]">
      <div className="p-8 text-center space-y-4 max-w-sm mx-auto bg-white rounded-3xl shadow-sm border border-slate-200">
        <div className="animate-spin h-10 w-10 border-3 border-[#0F6E56] border-t-transparent rounded-full mx-auto" />
        <h3 className="font-extrabold text-slate-800 text-base">Continuing to EarthCentric</h3>
        <p className="text-xs text-slate-500">
          Redirecting to verification...
        </p>
      </div>
    </div>
  );
}
