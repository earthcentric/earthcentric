import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignIn 
        fallbackRedirectUrl="/auth/buyer-login"
        signUpFallbackRedirectUrl="/auth/buyer-login"
        forceRedirectUrl="/auth/buyer-login"
        signUpForceRedirectUrl="/auth/buyer-login"
      />
    </div>
  );
}
