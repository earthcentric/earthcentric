import { getProductById } from "@/actions/products";
import ProductClientView from "@/components/ProductClientView";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product || !product.isApproved) {
    notFound();
  }

  return <ProductClientView product={product} />;
}
