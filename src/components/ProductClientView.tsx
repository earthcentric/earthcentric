"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { getWishlistIds, toggleWishlist } from "@/actions/wishlist";
import { Input, Textarea } from "@/components/ui/shared";
import { ProductItem, getProducts } from "@/actions/products";
import {
  Star,
  Heart,
  Share2,
  CheckCircle2,
  Truck,
  ShieldCheck,
  ShoppingCart,
  Minus,
  Plus,
  Leaf,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface ProductClientViewProps {
  product: ProductItem;
}

export default function ProductClientView({ product }: ProductClientViewProps) {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [activeImage, setActiveImage] = useState(product.images[0]);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<ProductItem[]>([]);
  const [addedNotify, setAddedNotify] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Review state
  const [reviews, setReviews] = useState([
    {
      id: "r1",
      userName: "Siddharth K.",
      rating: 5,
      comment:
        "Absolutely top notch quality. The cutlery is sturdy and well-finished. Packaging was completely plastic-free.",
      date: "2026-05-12",
    },
    {
      id: "r2",
      userName: "Maria D.",
      rating: 4,
      comment:
        "Excellent design. The sustainability details really show. Only docked one star because shipping took two days longer.",
      date: "2026-05-24",
    },
    {
      id: "r3",
      userName: "Priya M.",
      rating: 5,
      comment: "Perfect for our restaurant. We switched to these from plastic cutlery and our customers love the feel.",
      date: "2026-06-02",
    },
  ]);
  const [newReviewName, setNewReviewName] = useState("");
  const [newReviewComment, setNewReviewComment] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);

  // Pricing
  const originalPrice = product.price > 500 ? Math.round(product.price * 1.25) : Math.round(product.price * 1.5);
  const discountPercent = Math.round(((originalPrice - product.price) / originalPrice) * 100);

  // Badge type
  const ecoScore = product.sustainabilityScore;
  const badgeType = product.badgeType || (ecoScore >= 97 ? "verified" : ecoScore >= 94 ? "bestseller" : "eco");
  let badgeLabel = "Eco Friendly";
  if (badgeType === "verified") badgeLabel = "VERIFIED";
  else if (badgeType === "bestseller") badgeLabel = "BEST SELLER";

  // Highlights from description
  const highlights = [
    `Natural ${product.certifications[0] || "organic"} materials — 100% food-safe`,
    "Smooth splinter-free finish",
    product.description.split(".")[0],
  ];

  // Technical specs
  const specs = [
    { label: "Material", value: product.certifications[0] || "Natural Organic" },
    { label: "Pack Size", value: `${Math.floor(product.stock / 5)} sets` },
    { label: "Includes", value: product.name.split("–")[0]?.trim() || product.name },
    { label: "Length", value: "140mm" },
    { label: "Heat Resistant", value: "Yes (up to 80°C)" },
    { label: "Biodegradable", value: "Yes — 90 days" },
    { label: "Certifications", value: product.certifications.join(", ") || "BPI, USDA Biobased" },
  ];

  // Wishlist
  useEffect(() => {
    if (user?.userId) {
      getWishlistIds(user.userId).then((ids) => {
        setIsWishlisted(ids.includes(product.id));
      });
    }
  }, [user, product.id]);

  // Related products
  useEffect(() => {
    const loadRelated = async () => {
      const all = await getProducts({ category: product.category });
      setRelated(all.filter((p) => p.id !== product.id).slice(0, 4));
    };
    loadRelated();
  }, [product.category, product.id]);

  // Sticky bar scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyBar(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAddToCart = () => {
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images[0] || "",
        sustainabilityScore: product.sustainabilityScore,
        sellerName: product.seller.companyName,
        sellerId: product.sellerId,
      },
      quantity
    );
    setAddedNotify(true);
    setTimeout(() => setAddedNotify(false), 2500);
  };

  const handleToggleWishlist = async () => {
    if (!user?.userId) {
      toast.error("Please login to wishlist products");
      return;
    }
    
    // Optimistic update
    setIsWishlisted(!isWishlisted);
    
    const res = await toggleWishlist(user.userId, product.id);
    if (res.success) {
      if (res.isWishlisted) {
        toast.success("Added to wishlist");
      } else {
        toast.success("Removed from wishlist");
      }
      setIsWishlisted(res.isWishlisted);
    } else {
      setIsWishlisted(isWishlisted); // revert
      toast.error("Failed to update wishlist");
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewName || !newReviewComment) return;
    setReviews([
      {
        id: `r-${Date.now()}`,
        userName: newReviewName,
        rating: newReviewRating,
        comment: newReviewComment,
        date: new Date().toISOString().split("T")[0],
      },
      ...reviews,
    ]);
    setNewReviewName("");
    setNewReviewComment("");
    setNewReviewRating(5);
  };

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Toast */}
        {addedNotify && (
          <div className="fixed bottom-20 right-6 z-50 rounded-xl bg-[#0c3c26] text-white px-5 py-3 shadow-2xl flex items-center space-x-2 animate-bounce">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm font-bold">
              Added {quantity} item(s) to Cart!
            </span>
          </div>
        )}

        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-xs text-slate-400">
          <Link href="/marketplace" className="hover:text-[#0F6E56] transition-colors">
            Marketplace
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/marketplace?category=${encodeURIComponent(product.category)}`} className="hover:text-[#0F6E56] transition-colors">
            {product.category}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-700 font-semibold truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* ========== MAIN LAYOUT ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* ===== LEFT: Image Gallery ===== */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square bg-[#f5f5f5] rounded-2xl overflow-hidden flex items-center justify-center p-8 border border-slate-100">
              <div className="relative w-full h-full">
                <Image
                  src={activeImage || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                  className="object-contain"
                />
              </div>

              {/* Badge - Top Left */}
              <span className="absolute top-4 left-4 bg-[#0c3c26] text-white text-[11px] font-extrabold px-4 py-1.5 rounded-lg shadow-md uppercase tracking-wide z-10">
                {badgeLabel}
              </span>

              {/* Discount - Top Right */}
              {discountPercent > 0 && (
                <span className="absolute top-4 right-4 bg-[#FF6B35] text-white text-[11px] font-extrabold px-3 py-1.5 rounded-lg shadow-md z-10">
                  -{discountPercent}% OFF
                </span>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {product.images.length > 0 && (
              <div className="flex items-center justify-center space-x-3">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(img)}
                    className={`h-16 w-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                      activeImage === img
                        ? "border-[#0F6E56] shadow-md"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${product.name} thumbnail ${idx + 1}`}
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ===== RIGHT: Product Info ===== */}
          <div className="space-y-6">
            {/* Verified Badge + Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-[#0F6E56]">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-bold">Earth Centric Verified</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleToggleWishlist}
                  className="h-10 w-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
                  aria-label="Add to wishlist"
                >
                  <Heart
                    className={`h-5 w-5 transition-colors ${
                      isWishlisted ? "fill-red-500 text-red-500" : "text-slate-400"
                    }`}
                  />
                </button>
                <button
                  className="h-10 w-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
                  aria-label="Share product"
                >
                  <Share2 className="h-5 w-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight font-serif">
              {product.name}
            </h1>

            {/* Rating + Sustainably Sourced */}
            <div className="flex items-center flex-wrap gap-4">
              <div className="flex items-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.floor(product.rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-200"
                    }`}
                  />
                ))}
                <span className="text-sm font-bold text-slate-800 ml-1">{product.rating.toFixed(1)}</span>
                <span className="text-sm text-[#0F6E56] font-semibold">({product.reviewsCount} reviews)</span>
              </div>
              <div className="flex items-center space-x-1 text-sm text-slate-500">
                <Leaf className="h-4 w-4 text-[#0F6E56]" />
                <span className="font-medium">Sustainably Sourced</span>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-1">
              <div className="flex items-baseline space-x-3">
                <span className="text-4xl font-black text-slate-900">₹{product.price}</span>
                <span className="text-lg text-slate-400 line-through font-semibold">₹{originalPrice}</span>
              </div>
              <p className="text-sm text-slate-500 font-medium">
                Inclusive of all taxes • Free Shipping available
              </p>
            </div>

            {/* ===== Eco Score Card ===== */}
            <div className="bg-[#f0faf5] border border-[#d2e8dd] rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-[#0F6E56]" />
                <span className="font-bold text-slate-800 text-base">Eco Score</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-[#0F6E56]">{ecoScore}</span>
                  <span className="text-base text-slate-500 font-semibold">/100</span>
                </div>
                <div className="w-full h-2.5 bg-[#d2e8dd] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0F6E56] rounded-full transition-all duration-700"
                    style={{ width: `${ecoScore}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {product.sustainabilityDetail || "Made from 100% renewable resources. Fully biodegradable in 90 days."}
              </p>
            </div>

            {/* ===== Highlights ===== */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-[#0F6E56]" />
                <span className="font-bold text-slate-800 text-base">Highlights</span>
              </div>
              <ul className="space-y-2.5">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-start space-x-2.5 text-sm text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-[#0F6E56] shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ===== Fast Delivery + Buyer Protection ===== */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-2xl p-5 space-y-2">
                <Truck className="h-6 w-6 text-[#0F6E56]" />
                <h4 className="font-bold text-sm text-slate-800">Fast Delivery</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Order now, ships within 24 hours.
                </p>
              </div>
              <div className="border border-slate-100 rounded-2xl p-5 space-y-2">
                <ShieldCheck className="h-6 w-6 text-[#0F6E56]" />
                <h4 className="font-bold text-sm text-slate-800">Buyer Protection</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Secure payments & easy returns.
                </p>
              </div>
            </div>

            {/* ===== Quantity + Add to Cart ===== */}
            {product.stock > 0 && (
              <div className="flex items-center space-x-4 pt-2">
                {/* Quantity */}
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-12 w-12 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer border-r border-slate-200"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="h-12 w-12 flex items-center justify-center text-base font-bold text-slate-900 bg-slate-50">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="h-12 w-12 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer border-l border-slate-200"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Add to Cart */}
                <button
                  onClick={handleAddToCart}
                  className="flex-1 h-12 bg-[#0c3c26] hover:bg-[#0a3020] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer border-none shadow-md"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>Add to Cart — ₹{(product.price * quantity).toLocaleString()}</span>
                </button>
              </div>
            )}

            {product.stock === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <span className="text-red-600 font-bold text-sm">Currently Out of Stock</span>
              </div>
            )}
          </div>
        </div>

        {/* ========== TECHNICAL SPECIFICATIONS ========== */}
        <section className="space-y-6">
          <h2 className="text-xl font-black text-slate-900">Technical Specifications</h2>
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            {specs.map((spec, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between px-6 py-4 ${
                  idx < specs.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <span className="text-sm font-semibold text-[#0F6E56]">{spec.label}</span>
                <span className="text-sm font-medium text-slate-700">{spec.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ========== REVIEWS SECTION ========== */}
        <section className="space-y-8 border-t border-slate-100 pt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">
              Customer Reviews ({reviews.length})
            </h2>
            <div className="flex items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.floor(product.rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-200"
                  }`}
                />
              ))}
              <span className="text-sm font-bold text-slate-800 ml-1">{product.rating.toFixed(1)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Reviews List */}
            <div className="lg:col-span-7 space-y-6">
              {reviews.map((rev) => (
                <div key={rev.id} className="border-b border-slate-100 pb-5 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{rev.userName}</p>
                      <div className="flex space-x-0.5 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < rev.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{rev.date}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>

            {/* Review Form */}
            <div className="lg:col-span-5 bg-[#f9fafb] border border-slate-100 rounded-2xl p-6 space-y-4 h-fit">
              <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="h-4 w-4 text-[#0F6E56]" />
                <span>Leave a Review</span>
              </h4>
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Your Name</span>
                  <Input
                    placeholder="e.g. Priya Sharma"
                    value={newReviewName}
                    onChange={(e) => setNewReviewName(e.target.value)}
                    required
                    className="text-xs bg-white border-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Rating</span>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setNewReviewRating(val)}
                        className="focus:outline-none cursor-pointer"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            val <= newReviewRating
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-200"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Comment</span>
                  <Textarea
                    placeholder="Share your experience with this product..."
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    required
                    className="text-xs bg-white border-slate-200 min-h-[80px]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-10 bg-[#0F6E56] hover:bg-[#0c5a46] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer border-none"
                >
                  Submit Review
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ========== RELATED PRODUCTS ========== */}
        {related.length > 0 && (
          <section className="border-t border-slate-100 pt-10 space-y-6">
            <h2 className="text-xl font-black text-slate-900">You May Also Like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              {related.map((item) => (
                <Link href={`/products/${item.id}`} key={item.id} className="group">
                  <div className="bg-[#f5f5f5] rounded-2xl overflow-hidden aspect-square relative p-4 flex items-center justify-center border border-slate-100 group-hover:shadow-md transition-shadow">
                    <Image
                      src={item.images[0] || ""}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-contain p-4"
                    />
                  </div>
                  <div className="pt-3 space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-[#0F6E56] transition-colors">
                      {item.name}
                    </h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900">₹{item.price}</span>
                      <div className="flex items-center space-x-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-[11px] font-bold text-slate-600">{item.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ========== STICKY BOTTOM BAR ========== */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
          showStickyBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-4">
          {/* Product Info */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
              <Image
                src={product.images[0] || ""}
                alt={product.name}
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate max-w-[250px] sm:max-w-[400px]">
                {product.name}
              </p>
              <p className="text-sm font-black text-[#0F6E56]">₹{product.price}</p>
            </div>
          </div>

          {/* Quantity + Cart */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="hidden sm:flex items-center border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-9 w-9 flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer border-r border-slate-200"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="h-9 w-9 flex items-center justify-center text-sm font-bold text-slate-900 bg-slate-50">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="h-9 w-9 flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer border-l border-slate-200"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              className="h-10 bg-[#0c3c26] hover:bg-[#0a3020] text-white font-bold text-sm px-6 rounded-xl flex items-center space-x-2 transition-colors cursor-pointer border-none shadow-sm"
            >
              <span>Add to Cart — ₹{(product.price * quantity).toLocaleString()}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
