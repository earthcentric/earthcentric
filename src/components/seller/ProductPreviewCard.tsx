"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Star, Leaf, Tag, Gift, Layers, CheckCircle2, AlertTriangle, XCircle, Info, X, ShieldCheck } from "lucide-react";
import { ProductItem, getProductById } from "@/actions/products";
import { getEffectiveUnitPrice, isIndividualDiscountActive, isBuyXGetYActive } from "@/lib/offers";

// In-memory global product cache to avoid redundant API fetches
const productCache = new Map<string, ProductItem>();

interface ProductPreviewCardProps {
  productId?: string;
  initialProduct?: ProductItem | null;
  triggerRect?: DOMRect | null;
  mousePos?: { x: number; y: number } | null;
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}

export default function ProductPreviewCard({
  productId,
  initialProduct,
  triggerRect,
  mousePos,
  isOpen,
  onClose,
  isMobile = false,
}: ProductPreviewCardProps) {
  const [product, setProduct] = useState<ProductItem | null>(initialProduct || null);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Fetch product data if not provided directly
  useEffect(() => {
    if (!isOpen) return;

    const id = productId || initialProduct?.id;
    if (!id) return;

    // Check cache first
    if (productCache.has(id)) {
      setProduct(productCache.get(id)!);
      setLoading(false);
      return;
    }

    if (initialProduct && initialProduct.id === id) {
      setProduct(initialProduct);
      productCache.set(id, initialProduct);
      setLoading(false);
      return;
    }

    // Fetch from server action once and store in cache
    let isMounted = true;
    setLoading(true);
    getProductById(id).then((p) => {
      if (isMounted && p) {
        setProduct(p);
        productCache.set(id, p);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [productId, initialProduct, isOpen]);

  // Position calculation with automatic edge-repositioning
  useEffect(() => {
    if (!isOpen) return;

    const cardWidth = 420;
    const cardHeight = 480;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let targetX = mousePos?.x ?? (triggerRect ? triggerRect.right + 10 : viewportWidth / 2 - cardWidth / 2);
    let targetY = mousePos?.y ?? (triggerRect ? triggerRect.top : viewportHeight / 2 - cardHeight / 2);

    // Adjust horizontal position if exceeding screen right edge
    if (targetX + cardWidth > viewportWidth - 20) {
      if (triggerRect) {
        targetX = Math.max(10, triggerRect.left - cardWidth - 10);
      } else if (mousePos) {
        targetX = Math.max(10, mousePos.x - cardWidth - 15);
      }
    }

    // Adjust vertical position if exceeding screen bottom edge
    if (targetY + cardHeight > viewportHeight - 20) {
      targetY = Math.max(10, viewportHeight - cardHeight - 20);
    }

    // Keep minimum padding from top/left edges
    targetX = Math.max(10, targetX);
    targetY = Math.max(10, targetY);

    setCoords({ top: targetY, left: targetX });
  }, [isOpen, triggerRect, mousePos]);

  if (!isOpen) return null;

  // Render Mobile Modal Overlay
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 z-10 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <CardContent product={product} loading={loading} />
        </div>
      </div>
    );
  }

  // Render Desktop Floating Hover Card
  return (
    <div
      ref={cardRef}
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      className="fixed z-50 w-[420px] bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_20px_40px_rgba(15,110,86,0.12)] transition-all duration-200 ease-out pointer-events-auto animate-in fade-in zoom-in-95"
    >
      <CardContent product={product} loading={loading} />
    </div>
  );
}

function CardContent({ product, loading }: { product: ProductItem | null; loading: boolean }) {
  if (loading || !product) {
    return (
      <div className="space-y-4 p-2">
        <div className="flex space-x-4 animate-pulse">
          <div className="h-28 w-28 bg-slate-200 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
            <div className="h-4 bg-slate-200 rounded w-1/3 mt-2" />
          </div>
        </div>
      </div>
    );
  }

  const effective = getEffectiveUnitPrice(product, 1);
  const isApprovedDisc = isIndividualDiscountActive(product.individualDiscount);
  const isBuyXGetY = isBuyXGetYActive(product.buyXGetYOffer);
  const hasTierDiscounts = Array.isArray(product.tierDiscounts) && product.tierDiscounts.length > 0;

  // Status Badge formatting
  let statusBadge = (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> Active
    </span>
  );

  if (!product.isApproved) {
    statusBadge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Info className="h-3 w-3 mr-1 text-amber-600" /> Pending Approval
      </span>
    );
  } else if (product.stock === 0) {
    statusBadge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="h-3 w-3 mr-1 text-rose-600" /> Out of Stock
      </span>
    );
  } else if (product.stock <= 15) {
    statusBadge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" /> Low Stock ({product.stock} left)
      </span>
    );
  }

  return (
    <div className="space-y-4 text-left">
      {/* Top Header: Image + Essential Meta */}
      <div className="flex items-start space-x-4">
        {/* Product Image */}
        <div className="relative h-28 w-28 bg-[#f4f7f5] rounded-2xl overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center p-2">
          <Image
            src={product.images[0] || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400"}
            alt={product.name}
            fill
            sizes="112px"
            className="object-contain p-1"
          />
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="text-[10px] font-extrabold text-[#0F6E56] uppercase tracking-wider truncate">
              {product.category}
            </span>
            {statusBadge}
          </div>

          <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-2">
            {product.name}
          </h3>

          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-medium">
            <span className="truncate">{product.seller?.companyName || "EarthCentric"}</span>
            {product.seller?.badges?.includes("Verified Business") && (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            )}
          </div>

          {/* Price & Rating */}
          <div className="flex items-baseline space-x-2 pt-1 flex-wrap">
            <span className="text-base font-black text-[#2d4a36]">
              ₹{effective.unitPrice.toLocaleString()}
            </span>
            {effective.appliedDiscountType !== "NONE" && (
              <span className="text-xs text-slate-400 font-semibold line-through">
                ₹{effective.originalPrice.toLocaleString()}
              </span>
            )}
            {effective.discountPercentage > 0 && (
              <span className="bg-[#FF5225] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                -{effective.discountPercentage}% OFF
              </span>
            )}
          </div>

          {/* Stock & Rating */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold pt-0.5">
            <span>Stock: <strong className="text-slate-800">{product.stock} units</strong></span>
            <div className="flex items-center space-x-0.5 text-amber-500">
              <Star className="h-3 w-3 fill-amber-400 stroke-none" />
              <span>{product.rating ? product.rating.toFixed(1) : "4.5"}</span>
              <span className="text-slate-400 font-normal">({product.reviewsCount || 0})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Short Description */}
      {product.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          {product.description}
        </p>
      )}

      {/* Approved Promotions Section */}
      {(isApprovedDisc || hasTierDiscounts || isBuyXGetY) && (
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Approved Active Promotions
          </span>

          {/* 1. Individual Product Discount */}
          {isApprovedDisc && product.individualDiscount && (
            <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-100 text-xs font-bold">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-emerald-600" />
                <span>Individual Discount</span>
              </span>
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md text-[10px]">
                {product.individualDiscount.discountType === "PERCENTAGE"
                  ? `${product.individualDiscount.discountValue}% OFF`
                  : `Save ₹${product.individualDiscount.discountValue}`}
              </span>
            </div>
          )}

          {/* 2. Tier Discounts */}
          {hasTierDiscounts && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 text-[11px]">
                <Layers className="h-3.5 w-3.5 text-[#2d4a36]" />
                <span>Tier Volume Pricing</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {product.tierDiscounts!.map((tier, idx) => (
                  <span key={idx} className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs">
                    Buy {tier.minQuantity}+ → {tier.discountType === "PERCENTAGE" ? `${tier.discountValue}% OFF` : `Save ₹${tier.discountValue}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. Buy X Get Y Offer */}
          {isBuyXGetY && product.buyXGetYOffer && (
            <div className="flex items-center justify-between bg-[#e8f3ec] text-[#2d4a36] px-3 py-1.5 rounded-xl border border-[#c3decb] text-xs font-bold">
              <span className="flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-[#2d4a36]" />
                <span>Buy {product.buyXGetYOffer.buyQuantity} Get {product.buyXGetYOffer.getQuantity} FREE</span>
              </span>
              <span className="bg-[#2d4a36] text-white px-2 py-0.5 rounded-md text-[10px]">
                Free Bonus
              </span>
            </div>
          )}
        </div>
      )}

      {/* Certifications / Product Tags */}
      {product.certifications && product.certifications.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {product.certifications.map((cert, idx) => (
            <span key={idx} className="bg-[#ebf5f0] text-[#0F6E56] text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-[#d2e8dd]">
              🌿 {cert}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
