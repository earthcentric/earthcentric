"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ShoppingBag, Heart, ShieldCheck, Leaf } from "lucide-react";
import { Button, Badge } from "@/components/ui/shared";
import { ProductItem } from "@/actions/products";

interface QuickViewModalProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (p: ProductItem) => void;
  onToggleWishlist: (p: ProductItem) => void;
  isWishlisted: boolean;
}

export default function QuickViewModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
}: QuickViewModalProps) {
  // Lock scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  // Compute pricing
  const originalPrice = product.originalPrice || (product.price > 500 ? Math.round(product.price * 1.25) : Math.round(product.price * 1.5));
  const discountPercent = originalPrice && originalPrice > product.price ? Math.round(((originalPrice - product.price) / originalPrice) * 100) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" 
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl bg-card border border-border/40 rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh] transition-all duration-300 scale-100">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 h-8 w-8 rounded-full bg-background/85 border border-border/40 flex items-center justify-center text-primary hover:bg-emerald-600 hover:text-white transition-all focus:outline-none cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left Column: Image Panel */}
        <div className="w-full md:w-1/2 bg-muted/20 relative aspect-square md:aspect-auto flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-border/40 min-h-[250px] md:min-h-[400px]">
          <Image
            src={product.images[0] || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800"}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
          {/* Badge Overlays */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 items-start z-10">
            <Badge variant="primary" className="bg-primary/95 text-primary-foreground border-none text-[10px] uppercase font-bold py-1 px-2.5 shadow-md">
              {product.category}
            </Badge>
          </div>

          {discountPercent && (
            <div className="absolute top-4 right-14 bg-red-600 text-white text-[9px] font-black rounded-md py-1 px-2.5 uppercase tracking-wide shadow-md z-10">
              {discountPercent}% OFF
            </div>
          )}
        </div>

        {/* Right Column: Information Panel */}
        <div className="w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-5 text-left">
            {/* Brand/Seller Info */}
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground font-semibold">
              <span className="truncate">{product.seller.companyName}</span>
              {product.seller.badges?.includes("Verified Business") && (
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              )}
            </div>

            {/* Product Title & Specs */}
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-primary tracking-tight leading-tight">
                {product.name}
              </h2>
              <div className="flex items-center space-x-1 mt-1">
                <span className="text-emerald-700 text-xs font-bold bg-emerald-600/10 rounded px-1.5 py-0.5 uppercase tracking-wide flex items-center">
                  Verified Sustainable
                </span>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="flex items-baseline space-x-3 border-b border-[#d0c6b8]/20 pb-4">
              <span className="text-2xl font-black text-primary">₹{product.price.toLocaleString()}</span>
              {originalPrice && (
                <span className="text-sm font-semibold text-muted-foreground line-through">
                  ₹{originalPrice.toLocaleString()}
                </span>
              )}
            </div>



            {/* Key Specifications */}
            <div className="space-y-2 text-xs">
              <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Product Specifications</h5>
              <div className="grid grid-cols-2 gap-3 text-left bg-muted/10 border border-border/10 rounded-xl p-3">
                <div>
                  <span className="text-[9px] text-muted-foreground block uppercase font-bold">Material</span>
                  <span className="font-semibold text-primary">{product.certifications[0]?.includes("Cotton") ? "Organic Cotton" : "Circular Materials"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block uppercase font-bold">Origin</span>
                  <span className="font-semibold text-primary">Made in India</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[9px] text-muted-foreground block uppercase font-bold">Verified Certificates</span>
                  <span className="font-semibold text-primary text-[10px]">
                    {product.certifications.length > 0 ? product.certifications.join(" · ") : "None"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-6 border-t border-[#d0c6b8]/20 mt-6 space-y-3.5">
            <div className="flex gap-3">
              <Button
                onClick={() => onAddToCart(product)}
                className="flex-1 bg-primary text-primary-foreground hover:bg-emerald-700 text-xs py-2 flex items-center justify-center space-x-2 rounded-xl"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Add to Cart</span>
              </Button>
              <Button
                onClick={() => onToggleWishlist(product)}
                variant="outline"
                className={`w-11 h-11 p-0 rounded-xl border-border/60 hover:bg-muted/30 flex items-center justify-center transition-all ${
                  isWishlisted ? "text-red-500 border-red-200 bg-red-50/20" : ""
                }`}
              >
                <Heart className={`h-4.5 w-4.5 ${isWishlisted ? "fill-red-500" : ""}`} />
              </Button>
            </div>
            
            <div className="text-center">
              <Link
                href={`/products/${product.id}`}
                onClick={onClose}
                className="text-[10px] font-black uppercase text-emerald-700 hover:text-emerald-800 hover:underline tracking-wider"
              >
                View Full Product Details
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
