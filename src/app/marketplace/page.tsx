import { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import MarketplaceClient from "@/components/marketplace/MarketplaceClient";
import { verifyBuyerAuth } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Sustainable Marketplace India | Verified Eco Products | EarthCentric",
  description:
    "Shop 500+ verified sustainable products from ethical Indian manufacturers. Carbon-neutral delivery. GOTS, FSC & Fair Trade certified. Free shipping above ₹499.",
  openGraph: {
    title: "Sustainable Marketplace India | Verified Eco Products | EarthCentric",
    description:
      "Shop 500+ verified sustainable products from ethical Indian manufacturers. Carbon-neutral delivery. GOTS, FSC & Fair Trade certified. Free shipping above ₹499.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200",
        width: 1200,
        height: 630,
        alt: "Sustainable Marketplace India | EarthCentric",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sustainable Marketplace India | Verified Eco Products | EarthCentric",
    description:
      "Shop 500+ verified sustainable products from ethical Indian manufacturers. Carbon-neutral delivery. GOTS, FSC & Fair Trade certified. Free shipping above ₹499.",
    images: ["https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200"],
  },
};

export default async function MarketplacePage() {
  const auth = await verifyBuyerAuth();
  if (!auth.isVerified) {
    redirect("/auth/buyer-login?redirect_url=/marketplace");
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-xl py-32 text-center text-xs text-muted-foreground animate-pulse">Loading Marketplace...</div>}>
      <MarketplaceClient />
    </Suspense>
  );
}
