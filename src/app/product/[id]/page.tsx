import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductSingularRedirectPage({ params }: PageProps) {
  const { id } = await params;
  if (!id) {
    redirect("/marketplace");
  }
  redirect(`/products/${id}`);
}

