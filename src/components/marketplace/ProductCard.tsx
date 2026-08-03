"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, ShoppingBag, Star, Leaf } from "lucide-react";
import { ProductItem } from "@/actions/products";
import { useAuth } from "@/context/AuthContext";
import { toggleWishlist } from "@/actions/wishlist";
import { toast } from "sonner";
import { isBuyXGetYActive, getEffectiveUnitPrice } from "@/lib/offers";

interface ProductCardProps {
  product: ProductItem;
  onAddToCart: (e: React.MouseEvent, p: ProductItem) => void;
  onQuickView?: (p: ProductItem) => void;
  initialWishlisted?: boolean;
}

export default function ProductCard({ product, onAddToCart, onQuickView, initialWishlisted = false }: ProductCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);

  useEffect(() => {
    setIsWishlisted(initialWishlisted);
  }, [initialWishlisted]);

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user?.id) {
      toast.error("Please login to wishlist products");
      return;
    }

    // Optimistic update
    setIsWishlisted(!isWishlisted);

    const res = await toggleWishlist(user.id, product.id);
    if (res.success) {
      if (res.isWishlisted) toast.success("Added to wishlist");
      else toast.success("Removed from wishlist");
      setIsWishlisted(res.isWishlisted);
    } else {
      setIsWishlisted(isWishlisted); // revert on failure
      toast.error("Failed to update wishlist");
    }
  };

  // Compute pricing details
  const effective = getEffectiveUnitPrice(product, 1);
  const discountPercent = effective.discountPercentage;
  const hasBulkDeal = product.bulkPriceSlabs && (product.bulkPriceSlabs as any[]).length > 0;

  // Determine status badge class and label
  const badgeType = product.badgeType || (product.rating >= 4.7 ? "verified" : product.reviewsCount > 20 ? "bestseller" : "eco");

  let badgeLabel = "Eco-Friendly";
  let badgeStyle = "bg-[#ebf5f0] text-[#0F6E56] border border-[#d2e8dd]";
  let badgeIcon = <Leaf className="h-3 w-3 fill-[#0F6E56] stroke-none" />;

  if (badgeType === "verified") {
    badgeLabel = "Verified";
    badgeStyle = "bg-[#0ea5e9] text-white border border-[#0284c7]";
    badgeIcon = <span className="text-[10px] font-bold">✓</span>;
  } else if (badgeType === "bestseller") {
    badgeLabel = "Best Seller";
    badgeStyle = "bg-[#0F6E56] text-white border border-[#0b5442]";
    badgeIcon = <Star className="h-3 w-3 fill-white stroke-none" />;
  }

  return (
    <div 
      onClick={() => router.push(`/products/${product.id}`)}
      className="group bg-white border border-slate-100 rounded-3xl p-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_24px_rgba(15,110,86,0.08)] flex flex-col justify-between h-full cursor-pointer select-none"
    >
      <div className="space-y-4">
        {/* Image Container with overlays */}
        <div className="aspect-square relative overflow-hidden bg-[#ebf3ef] rounded-2xl flex items-center justify-center p-6">
          <div className="relative w-full h-full">
            <Image 
              src={product.images[0] || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400"} 
              alt={product.name} 
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
              priority={false}
              className="object-contain transition-transform duration-500 group-hover:scale-105"
            />
          </div>

          {/* Discount Pill Tag (Top-Left) matching orange-red pill design */}
          {discountPercent && discountPercent > 0 && (
            <span className="absolute top-3 left-3 bg-[#FF5225] text-white text-[11px] font-black px-3.5 py-1 rounded-full shadow-md z-10 uppercase tracking-wide">
              -{discountPercent}% OFF
            </span>
          )}

          {/* Bulk Deal Tag */}
          {hasBulkDeal && (
            <span className={`absolute top-3 bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-lg shadow-sm z-10 flex items-center gap-0.5 ${discountPercent ? "left-24" : "left-3"}`}>
              🏷️ Bulk Deal
            </span>
          )}

          {/* Status Badge (Top-Right) */}
          <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm z-10 ${badgeStyle}`}>
            {badgeIcon}
            <span>{badgeLabel}</span>
          </span>

          {/* Wishlist Heart Overlay (Bottom-Right of image container) */}
          <button
            onClick={handleToggleWishlist}
            className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-md border border-slate-50 hover:scale-105 active:scale-95 transition-all cursor-pointer z-10"
            aria-label="Add to wishlist"
          >
            <Heart className={`h-4.5 w-4.5 transition-colors ${isWishlisted ? "fill-red-500 text-red-500" : "text-slate-400 hover:text-red-500"}`} />
          </button>
        </div>

        {/* Details Section */}
        <div className="space-y-2 text-left">
          {/* Category • Seller Label */}
          <div className="flex items-center space-x-1.5 flex-wrap">
            <p className="text-[10px] font-extrabold text-[#0F6E56] uppercase tracking-wider">
              {product.category} • {product.seller.companyName}
            </p>
            {product.seller.trustScore && product.seller.trustScore > 4 ? (
              <span className="bg-amber-100 text-amber-800 text-[8px] px-1 py-0.5 rounded uppercase font-bold flex items-center">
                <Star className="h-2 w-2 mr-0.5 fill-amber-500 text-amber-500" /> Trusted
              </span>
            ) : null}
          </div>

          {/* Product Title */}
          <Link href={`/products/${product.id}`} className="block" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-black text-slate-800 leading-snug line-clamp-2 hover:text-[#0F6E56] transition-colors min-h-[40px]">
              {product.name}
            </h4>
          </Link>

          {/* Buy X Get Y Offer Promo Badge */}
          {isBuyXGetYActive(product.buyXGetYOffer) && (
            <div className="bg-[#e8f3ec] text-[#2d4a36] text-[10px] font-black rounded-lg px-2.5 py-1.5 border border-[#c3decb] flex items-center justify-between shadow-xs select-none">
              <span className="flex items-center gap-1 font-extrabold">
                <span>🎁</span>
                <span>Buy {product.buyXGetYOffer?.buyQuantity} Get {product.buyXGetYOffer?.getQuantity} Free</span>
              </span>
              <span className="bg-[#2d4a36] text-white text-[8px] px-1.5 py-0.5 rounded font-extrabold tracking-wider uppercase">
                Free Offer
              </span>
            </div>
          )}

          {/* Bundle Deal Promo */}
          {product.bulkPriceSlabs && (product.bulkPriceSlabs as any[]).length > 0 && (() => {
            const slabs = product.bulkPriceSlabs as any[];
            const bundleDeal = slabs.find(s => s.min > 1);
            if (bundleDeal) {
              const qty = bundleDeal.min;
              const bundleTotal = bundleDeal.total || (bundleDeal.price * qty);
              const regularTotal = product.price * qty;
              const savings = regularTotal - bundleTotal;
              if (savings > 0) {
                return (
                  <div className="bg-emerald-50 text-emerald-800 text-[10px] font-black rounded-lg px-2 py-1.5 border border-emerald-100 flex items-center gap-1 select-none">
                    <span>🎁 Buy {qty} for ₹{bundleTotal.toLocaleString()}</span>
                    <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[8px] font-extrabold font-mono shrink-0">
                      Save ₹{savings.toLocaleString()}!
                    </span>
                  </div>
                );
              }
            }
            return null;
          })()}

          {/* Description */}
          <p className="text-[11px] text-slate-400 font-medium line-clamp-1">
            {product.description}
          </p>

          {/* Stars & Reviews */}
          <div className="flex items-center space-x-1 text-xs font-semibold text-slate-800">
            <Star className="h-3.5 w-3.5 fill-[#EAB308] stroke-none" />
            <span>{product.rating.toFixed(1)}</span>
            <span className="text-slate-400 font-medium">({product.reviewsCount} reviews)</span>
          </div>
        </div>
      </div>

      {/* Footer / Pricing & Cart */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4 text-left">
        {(() => {
          return (
            <div className="flex items-baseline space-x-1.5 flex-wrap gap-y-1">
              <span className="text-base font-black text-slate-900">
                ₹{effective.unitPrice.toLocaleString()}
              </span>
              {(effective.appliedDiscountType !== "NONE" || effective.originalPrice > effective.unitPrice) && (
                <span className="text-xs text-slate-400 font-semibold line-through">
                  ₹{effective.originalPrice.toLocaleString()}
                </span>
              )}
            </div>
          );
        })()}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddToCart(e, product);
          }}
          className="h-8 w-8 rounded-full bg-[#0F6E56] hover:bg-[#0c5a46] text-white flex items-center justify-center transition-colors cursor-pointer border-none shadow-sm shrink-0"
          title="Add to Cart"
        >
          <ShoppingBag className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
