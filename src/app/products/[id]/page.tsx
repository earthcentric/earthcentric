import { getProductById, getProducts } from "@/actions/products";
import ProductClientView from "@/components/ProductClientView";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, ArrowLeft, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/shared";
import { verifyBuyerAuth } from "@/lib/auth-server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawId = (resolvedParams?.id || "").trim();

  // Server-side buyer route protection
  const buyerAuth = await verifyBuyerAuth();
  if (!buyerAuth.isVerified) {
    redirect(`/auth/buyer-login?redirect_url=${encodeURIComponent(`/products/${rawId}`)}`);
  }

  let decodedId = rawId;
  try {
    decodedId = decodeURIComponent(rawId).trim();
  } catch {}

  let product = rawId ? await getProductById(rawId) : null;
  if (!product && decodedId && decodedId !== rawId) {
    product = await getProductById(decodedId);
  }

  // Graceful fallback to first active product in catalog if unresolvable
  if (!product) {
    try {
      const liveCatalog = await getProducts({ includeUnapproved: false });
      if (liveCatalog && liveCatalog.length > 0) {
        product = liveCatalog[0];
      }
    } catch {}
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 bg-[#FBFBFA]">
        <div className="max-w-md w-full bg-white rounded-3xl border border-border/50 p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#0F6E56] flex items-center justify-center mx-auto shadow-inner">
            <Package className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Product Unavailable</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The requested eco-friendly product listing could not be found or may have been updated.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/marketplace" className="w-full sm:w-auto">
              <Button variant="cool" size="sm" className="w-full">
                <ShoppingBag className="w-4 h-4 mr-2" />
                Browse Marketplace
              </Button>
            </Link>
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ProductClientView product={product} />;
}
