import { SignUp } from "@clerk/nextjs";

interface PageProps {
  searchParams: Promise<{ redirect_url?: string }>;
}

export default async function SignUpPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const redirectUrl = searchParams?.redirect_url || "/marketplace";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF9F4] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md flex flex-col items-center">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
        />
      </div>
    </div>
  );
}
