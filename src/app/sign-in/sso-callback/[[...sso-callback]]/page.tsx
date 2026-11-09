import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SignInSSOCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="p-8 text-center space-y-4 max-w-sm mx-auto bg-white rounded-2xl shadow-lg border border-slate-100">
        <div className="animate-spin h-10 w-10 border-4 border-[#0F6E56] border-t-transparent rounded-full mx-auto" />
        <h3 className="font-bold text-slate-800 text-base">Completing Google Authentication</h3>
        <p className="text-xs text-slate-500">
          Securely verifying your Google credentials with EarthCentric...
        </p>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl="/auth/buyer-login"
          signUpFallbackRedirectUrl="/auth/buyer-login"
          signInForceRedirectUrl="/auth/buyer-login"
          signUpForceRedirectUrl="/auth/buyer-login"
        />
      </div>
    </div>
  );
}

