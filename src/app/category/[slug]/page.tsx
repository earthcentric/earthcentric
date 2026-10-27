import { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getCategoryBySlug } from "@/actions/categories";
import MarketplaceClient from "@/components/marketplace/MarketplaceClient";
import { ChevronRight } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  const name = category?.name || slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const description = category?.description || `Explore verified sustainable ${name} on EarthCentric. Ethically sourced from Indian eco-manufacturers with carbon-neutral delivery.`;

  return {
    title: `Buy ${name} Online | Sustainable & Eco-Friendly | EarthCentric`,
    description,
    alternates: {
      canonical: `https://earthcentric.in/category/${slug}`,
    },
    openGraph: {
      title: `${name} | Sustainable Marketplace India | EarthCentric`,
      description,
      url: `https://earthcentric.in/category/${slug}`,
      siteName: "EarthCentric",
      images: [
        {
          url: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200",
          width: 1200,
          height: 630,
          alt: `${name} - EarthCentric Sustainable Marketplace`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | EarthCentric`,
      description,
      images: ["https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200"],
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  const displayName = category?.name || slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  // JSON-LD structured data for SEO (CollectionPage & Breadcrumbs)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://earthcentric.in",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Marketplace",
            "item": "https://earthcentric.in/marketplace",
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": displayName,
            "item": `https://earthcentric.in/category/${slug}`,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        "name": displayName,
        "description": category?.description || `Sustainable and eco-friendly ${displayName}`,
        "url": `https://earthcentric.in/category/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="bg-[#FAF8F5] min-h-screen">
        {/* SEO Breadcrumbs bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
          <nav className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
            <Link href="/" className="hover:text-emerald-700 transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <Link href="/marketplace" className="hover:text-emerald-700 transition-colors">Marketplace</Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-[#0F6E56] font-bold">{displayName}</span>
          </nav>
        </div>

        {/* Marketplace client pre-filtered to this category */}
        <Suspense fallback={<div className="mx-auto max-w-xl py-32 text-center text-xs text-muted-foreground animate-pulse">Loading {displayName}...</div>}>
          <MarketplaceClient initialCategoryProp={slug} />
        </Suspense>
      </div>
    </>
  );
}
