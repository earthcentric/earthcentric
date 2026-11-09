import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ redirect_url?: string }>;
}

export default async function SignUpPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const redirectUrl = searchParams?.redirect_url || "/marketplace";
  redirect(`/auth/buyer-login?redirect_url=${encodeURIComponent(redirectUrl)}`);
}
