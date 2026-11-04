import { getProductById } from "@/actions/products";
import ProductClientView from "@/components/ProductClientView";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  // A product is approved if either isApproved is true or status is APPROVED
  const isApproved = product.isApproved === true || product.status === "APPROVED";

  // If product is explicitly rejected or blocked, return 404
  if (!isApproved && (product.status === "REJECTED" || product.status === "BLOCKED")) {
    notFound();
  }

  return <ProductClientView product={product} />;
}
