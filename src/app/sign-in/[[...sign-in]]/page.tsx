import { SignIn } from "@clerk/nextjs";

interface PageProps {
  searchParams: Promise<{ redirect_url?: string }>;
}

export default async function SignInPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const redirectUrl = searchParams?.redirect_url || "/marketplace";
  const postAuthUrl = `/auth/buyer-login?redirect_url=${encodeURIComponent(redirectUrl)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF9F4] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md flex flex-col items-center">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl={postAuthUrl}
          forceRedirectUrl={postAuthUrl}
          signUpFallbackRedirectUrl={postAuthUrl}
          signUpForceRedirectUrl={postAuthUrl}
        />
      </div>
    </div>
  );
}
