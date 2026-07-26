"use client";

import React from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui/shared";
import { ShieldCheck, MapPin, ShoppingBag, ArrowRight } from "lucide-react";

export interface SellerData {
  id: string;
  name: string;
  city: string;
  productCount: number;
  badge: "Premium Seller" | "Verified Business" | "Sustainable Mfr.";
}

export const TOP_SELLERS: SellerData[] = [
  {
    id: "s1",
    name: "GreenLeaf Organics",
    city: "Bangalore",
    productCount: 142,
    badge: "Premium Seller",
  },
  {
    id: "s2",
    name: "EcoWeave Textiles",
    city: "Ahmedabad",
    productCount: 88,
    badge: "Sustainable Mfr.",
  },
  {
    id: "s3",
    name: "SolarBright India",
    city: "Chennai",
    productCount: 56,
    badge: "Verified Business",
  },
  {
    id: "s4",
    name: "HempHarvest Co.",
    city: "Pune",
    productCount: 74,
    badge: "Sustainable Mfr.",
  },
  {
    id: "s5",
    name: "ZeroWaste Hub",
    city: "Mumbai",
    productCount: 105,
    badge: "Premium Seller",
  },
  {
    id: "s6",
    name: "TerraCraft Studio",
    city: "Jaipur",
    productCount: 63,
    badge: "Verified Business",
  },
];

export function SellerCard({ seller }: { seller: SellerData }) {
  // Extract initials
  const initials = seller.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-w-[280px] sm:min-w-[320px] bg-card border border-border/40 hover:border-emerald-600/30 rounded-2xl p-6 flex flex-col justify-between space-y-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
      <div className="space-y-4">
        {/* Header: Avatar + Info */}
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-full bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-600/20 shrink-0">
            {initials}
          </div>
          <div className="text-left min-w-0">
            <h4 className="font-extrabold text-sm text-primary truncate leading-tight group-hover:text-emerald-600 transition-colors">
              {seller.name}
            </h4>
            <div className="flex items-center text-[10px] text-muted-foreground mt-0.5 font-semibold">
              <MapPin className="h-3 w-3 text-[#8B5E3C] mr-0.5 shrink-0" />
              <span className="truncate">{seller.city}</span>
            </div>
          </div>
        </div>

        {/* Badges/Tags */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="bg-muted text-muted-foreground border-none py-0.5 px-2 text-[9px] font-semibold flex items-center">
            <ShoppingBag className="h-2.5 w-2.5 mr-0.5" />
            {seller.productCount} Products
          </Badge>
        </div>
      </div>

      <div className="border-t border-[#d0c6b8]/20 pt-4 mt-2 flex items-center justify-between">
        <div className="flex items-center space-x-1 text-[10px] text-emerald-700 font-bold">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="truncate">{seller.badge}</span>
        </div>
        <Link href={`/marketplace?search=${encodeURIComponent(seller.name)}`}>
          <Button variant="cool" size="sm" className="text-[10px] py-1 px-2.5 flex items-center space-x-1 font-bold">
            <span>View Storefront</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function TopSellersSection() {
  return (
    <div className="w-full py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1 text-left">
          <h2 className="text-xl sm:text-2xl font-black text-primary tracking-tight">Top Verified Sellers</h2>
          <p className="text-xs text-muted-foreground">Trade directly with verified sustainable creators and local brands.</p>
        </div>
        <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider hidden sm:block">
          Swipe to view all
        </div>
      </div>
      
      {/* Horizontal scrolling shelf */}
      <div className="flex gap-6 overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-secondary scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
        {TOP_SELLERS.map((seller) => (
          <SellerCard key={seller.id} seller={seller} />
        ))}
      </div>
    </div>
  );
}
