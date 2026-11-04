import { getProductById } from "@/actions/products";
import ProductClientView from "@/components/ProductClientView";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailsPage({ params }: PageProps) {
  const { id } = await params;
  if (!id) {
    notFound();
  }

  const rawId = id.trim();
  let decodedId = rawId;
  try {
    decodedId = decodeURIComponent(rawId).trim();
  } catch {}

  let product = await getProductById(rawId);
  if (!product && decodedId !== rawId) {
    product = await getProductById(decodedId);
  }

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
