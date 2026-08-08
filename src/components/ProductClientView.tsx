"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { getWishlistIds, toggleWishlist } from "@/actions/wishlist";
import { Input, Textarea, Button } from "@/components/ui/shared";
import { ProductItem, getProducts, addProductReview, checkReviewEligibility } from "@/actions/products";
import { createEnquiry } from "@/actions/enquiries";
import { SellerLogo } from "@/components/SellerLogo";
import { isBuyXGetYActive, calculateBuyXGetYFreeItems, getEffectiveUnitPrice, isIndividualDiscountActive } from "@/lib/offers";
import { getUserAddresses, addUserAddress, AddressData } from "@/actions/profile";
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
  MessageSquare,
  Loader2,
  Bell,
} from "lucide-react";

interface ProductClientViewProps {
  product: ProductItem;
}

export default function ProductClientView({ product }: ProductClientViewProps) {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [activeImage, setActiveImage] = useState(product.images[0]);
  const [quantity, setQuantity] = useState(product.moq || 1);
  const [related, setRelated] = useState<ProductItem[]>([]);
  const [addedNotify, setAddedNotify] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [isEligibleToReview, setIsEligibleToReview] = useState(false);

  // Bulk Enquiry form state
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [enquiryQty, setEnquiryQty] = useState(100);
  const [enquiryPrice, setEnquiryPrice] = useState("");
  const [enquiryLocation, setEnquiryLocation] = useState("");
  const [enquiryDate, setEnquiryDate] = useState("");
  const [enquiryName, setEnquiryName] = useState("");
  const [enquiryEmail, setEnquiryEmail] = useState("");
  const [enquiryPhone, setEnquiryPhone] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [enquiryPending, setEnquiryPending] = useState(false);
  const [enquirySubmitted, setEnquirySubmitted] = useState(false);

  // Sync user for enquiry
  useEffect(() => {
    if (user) {
      setEnquiryName(user.name || "");
      setEnquiryEmail(user.email || "");
    }
  }, [user]);

  // Address Selection & Inline Add State for Bulk Quote Modal
  const [userAddresses, setUserAddresses] = useState<AddressData[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("custom");
  const [showAddNewAddressForm, setShowAddNewAddressForm] = useState(false);
  const [newStreet, setNewStreet] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [newCountry, setNewCountry] = useState("India");
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Fetch user addresses when bulk quote modal opens
  useEffect(() => {
    if (showEnquiryModal && user?.id) {
      getUserAddresses(user.id).then((addresses) => {
        setUserAddresses(addresses || []);
        if (addresses && addresses.length > 0) {
          const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
          setSelectedAddressId(defaultAddr.id || "custom");
          const formattedLoc = `${defaultAddr.street}, ${defaultAddr.city}, ${defaultAddr.state} - ${defaultAddr.postalCode}, ${defaultAddr.country}`;
          setEnquiryLocation(formattedLoc);
        }
      });
    }
  }, [showEnquiryModal, user?.id]);

  const handleSaveNewAddressInline = async () => {
    if (!user?.id || !newStreet || !newCity || !newState || !newPostalCode) {
      toast.error("Please fill in all required address fields.");
      return;
    }
    setIsSavingAddress(true);
    const res = await addUserAddress(user.id, {
      street: newStreet,
      city: newCity,
      state: newState,
      postalCode: newPostalCode,
      country: newCountry || "India",
    });
    setIsSavingAddress(false);
    if (res.success && res.address) {
      toast.success("Address added and saved to your profile!");
      const newAddr = res.address;
      setUserAddresses((prev) => [newAddr, ...prev]);
      setSelectedAddressId(newAddr.id || "custom");
      const formattedLoc = `${newAddr.street}, ${newAddr.city}, ${newAddr.state} - ${newAddr.postalCode}, ${newAddr.country}`;
      setEnquiryLocation(formattedLoc);
      setShowAddNewAddressForm(false);
      setNewStreet("");
      setNewCity("");
      setNewState("");
      setNewPostalCode("");
    } else {
      toast.error(res.error || "Failed to save address.");
    }
  };

  // Check review eligibility
  useEffect(() => {
    if (user?.id) {
      checkReviewEligibility(user.id, product.id).then((res) => {
        setIsEligibleToReview(res);
      });
    } else {
      setIsEligibleToReview(false);
    }
  }, [user, product.id]);

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
  const originalPrice = product.originalPrice || (product.price > 500 ? Math.round(product.price * 1.25) : Math.round(product.price * 1.5));
  const discountPercent = originalPrice && originalPrice > product.price ? Math.round(((originalPrice - product.price) / originalPrice) * 100) : 0;

  // Badge type
  const badgeType = product.badgeType || (product.rating >= 4.7 ? "verified" : product.reviewsCount > 20 ? "bestseller" : "eco");
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
    if (user?.id) {
      getWishlistIds(user.id).then((ids) => {
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

  // Find matching bulk price slab if the selected quantity meets or exceeds it
  const getActiveUnitPrice = () => {
    if (!product.bulkPriceSlabs || !(product.bulkPriceSlabs as any[]).length) {
      return product.price;
    }
    const slabs = [...(product.bulkPriceSlabs as any[])].sort((a, b) => b.min - a.min);
    const matchingSlab = slabs.find(s => quantity >= s.min);
    return matchingSlab ? matchingSlab.price : product.price;
  };

  const handleAddToCart = () => {
    const activePrice = getActiveUnitPrice();
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: activePrice,
        image: product.images[0] || "",
        sellerName: product.seller?.companyName || "EarthCentric",
        sellerId: product.sellerId,
        moq: product.moq,
      },
      quantity
    );
    setAddedNotify(true);
    setTimeout(() => setAddedNotify(false), 2500);
  };

  const handleToggleWishlist = async () => {
    if (!user?.id) {
      toast.error("Please login to wishlist products");
      return;
    }
    
    // Optimistic update
    setIsWishlisted(!isWishlisted);
    
    const res = await toggleWishlist(user.id, product.id);
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

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newReviewName || !newReviewComment) return;

    const res = await addProductReview({
      userId: user.id,
      productId: product.id,
      rating: newReviewRating,
      comment: newReviewComment,
    });

    if (res.success) {
      toast.success("Review submitted successfully!");
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
    } else {
      toast.error(res.error || "Failed to submit review.");
    }
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

              {/* Discount - Top Right Overlay Pill Badge */}
              {(() => {
                const eff = getEffectiveUnitPrice(product, 1);
                if (!eff.discountPercentage || eff.discountPercentage <= 0) return null;
                return (
                  <span className="absolute top-4 right-4 bg-[#FF5225] text-white text-[11px] font-black px-3.5 py-1 rounded-full shadow-md z-10 uppercase tracking-wide">
                    -{eff.discountPercentage}% OFF
                  </span>
                );
              })()}
            </div>

            {/* Thumbnail Gallery */}
            {product.images.length > 0 && (
              <div className="flex items-center justify-center space-x-3">
                {product.images.map((img, idx) => (
                  <button suppressHydrationWarning
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
                <button suppressHydrationWarning
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
                <button suppressHydrationWarning
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

            {/* Seller Info Widget */}
            <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-100 rounded-2xl p-3 w-fit select-none">
              <Link
                href={`/marketplace?search=${encodeURIComponent(product.seller?.companyName || "")}`}
                className="flex items-center space-x-2 hover:underline group"
              >
                <SellerLogo
                  logoUrl={product.seller?.logoUrl}
                  companyLogo={product.seller?.companyLogo}
                  companyName={product.seller?.companyName}
                  size="sm"
                />
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Sold by</p>
                  <h4 className="text-xs font-black text-slate-800 group-hover:text-[#0F6E56] transition-colors">
                    {product.seller?.companyName || "Verified Partner"}
                  </h4>
                </div>
              </Link>
            </div>

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
              {product.seller?.trustScore && product.seller.trustScore > 4 ? (
                <div className="flex items-center space-x-1 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  <span>Trusted Seller</span>
                </div>
              ) : null}
            </div>

            {/* Price */}
            <div className="space-y-4">
              {(() => {
                const effective = getEffectiveUnitPrice(product, quantity);
                const isDiscountActive = effective.appliedDiscountType !== "NONE" || effective.discountPercentage > 0;
                const amountSaved = (effective.originalPrice - effective.unitPrice) * quantity;
                const discountPercentage = effective.discountPercentage;

                return (
                  <div>
                    <div className="flex items-baseline space-x-3 flex-wrap gap-y-1">
                      <span className="text-4xl font-black text-slate-900">
                        ₹{effective.unitPrice.toLocaleString()}
                      </span>
                      {isDiscountActive && (
                        <span className="text-lg text-slate-400 line-through font-semibold">
                          ₹{effective.originalPrice.toLocaleString()}
                        </span>
                      )}
                      {effective.badgeText && (
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                          {effective.badgeText}
                        </span>
                      )}
                    </div>

                    {isDiscountActive && (
                      <div className="mt-2.5 flex items-center gap-3 text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200/60 w-fit">
                        <span>🎉 You save ₹{amountSaved.toLocaleString()} ({discountPercentage}% OFF)</span>
                      </div>
                    )}

                    <p className="text-sm text-slate-500 font-medium mt-1">
                      Inclusive of all taxes • Free Shipping available
                    </p>
                  </div>
                );
              })()}

              {/* Active Individual Product Discount Banner */}
              {isIndividualDiscountActive(product.individualDiscount) && (
                <div className="bg-[#f0f7f2] border-2 border-[#2d4a36]/30 rounded-2xl p-4 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#1f3a2e] uppercase tracking-wider flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>Product Discount Offer Active!</span>
                    </span>
                    <span className="bg-[#2d4a36] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {product.individualDiscount?.discountType === "PERCENTAGE" ? `${product.individualDiscount?.discountValue}% OFF` : `Save ₹${product.individualDiscount?.discountValue}`}
                    </span>
                  </div>
                  <p className="text-xs text-[#2d4a36] font-semibold">
                    Enjoy {product.individualDiscount?.discountType === "PERCENTAGE" ? `${product.individualDiscount?.discountValue}% OFF` : `₹${product.individualDiscount?.discountValue} OFF`} on every unit of this product!
                  </p>
                </div>
              )}

              {/* Active Buy X Get Y Offer Banner */}
              {isBuyXGetYActive(product.buyXGetYOffer) && (
                <div className="bg-[#f0f7f2] border-2 border-[#2d4a36]/30 rounded-2xl p-4 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">🎁</span>
                      <div>
                        <h4 className="text-xs font-black text-[#1f3a2e] uppercase tracking-wider">
                          Special Buy X Get Y Offer!
                        </h4>
                        <p className="text-[10px] text-muted-foreground font-medium">Automatic free items applied at checkout</p>
                      </div>
                    </div>
                    <span className="bg-[#2d4a36] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Buy {product.buyXGetYOffer?.buyQuantity} Get {product.buyXGetYOffer?.getQuantity} Free
                    </span>
                  </div>

                  <p className="text-xs text-[#2d4a36] font-semibold leading-relaxed bg-white p-2.5 rounded-xl border border-[#c3decb]">
                    Purchase <strong>{product.buyXGetYOffer?.buyQuantity}</strong> item(s) of {product.name} and receive <strong>{product.buyXGetYOffer?.getQuantity} bonus item(s)</strong> absolutely free with your order!
                  </p>

                  {quantity >= (product.buyXGetYOffer?.buyQuantity || 1) && (
                    <div className="flex justify-between items-center bg-[#2d4a36] text-white p-2.5 rounded-xl text-xs font-bold">
                      <span>🎉 Your Order Earns: +{calculateBuyXGetYFreeItems(quantity, product.buyXGetYOffer)} Free Item(s)!</span>
                      <span>Save ₹{calculateBuyXGetYFreeItems(quantity, product.buyXGetYOffer) * product.price}</span>
                    </div>
                  )}

                  {product.buyXGetYOffer?.maxFreeQuantity ? (
                    <p className="text-[10px] text-muted-foreground font-medium">
                      * Maximum limit of {product.buyXGetYOffer.maxFreeQuantity} free item(s) per order.
                    </p>
                  ) : null}
                </div>
              )}

              {/* Volume Discount Deals Slabs */}
              {product.bulkPriceSlabs && (product.bulkPriceSlabs as any[]).length > 0 && (
                <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 space-y-2.5 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Volume Discount Deals</span>
                    <span className="text-[10px] text-slate-400 font-bold font-sans">Click to select package</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(product.bulkPriceSlabs as any[]).map((slab: any, i: number) => {
                      const qty = slab.min;
                      const slabTotal = slab.total || (slab.price * qty);
                      const regularTotal = product.price * qty;
                      const savings = regularTotal - slabTotal;
                      const savingsPercent = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;
                      const isSelected = quantity === qty;

                      return (
                        <div
                          key={i}
                          onClick={() => setQuantity(qty)}
                          className={`bg-white border rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md select-none ${
                            isSelected
                              ? "border-[#0F6E56] ring-2 ring-[#0F6E56]/15 bg-emerald-50/10"
                              : "border-slate-100"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Buy {qty} {qty === 1 ? "unit" : "units"}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">₹{slab.price.toLocaleString()} each</span>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-black text-[#0F6E56] block">₹{slabTotal.toLocaleString()}</span>
                              <span className="text-[9px] text-slate-400 block font-medium">total package</span>
                            </div>
                          </div>
                          {savings > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[9px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                                Save ₹{savings.toLocaleString()}!
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold">
                                {savingsPercent}% Off
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* B2B Pricing */}
              {(product.wholesalePrice || product.moq) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col space-y-1">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Wholesale / B2B Pricing</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-amber-900">₹{product.wholesalePrice || Math.round(product.price * 0.8)}</span>
                    <span className="text-sm text-amber-700 font-semibold">/ unit</span>
                  </div>
                  <span className="text-sm text-amber-700 font-medium">
                    Minimum Order Quantity (MOQ): <strong>{product.moq || 100} units</strong>
                  </span>
                </div>
              )}
            </div>

            {/* ===== Sustainability Profile Card ===== */}
            <div className="bg-[#f0faf5] border border-[#d2e8dd] rounded-2xl p-5 space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-[#0F6E56]" />
                <span className="font-bold text-slate-800 text-base">Sustainability Profile</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
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
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-4">
                  {/* Quantity */}
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                    <button suppressHydrationWarning
                      onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                      className="h-12 w-12 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer border-r border-slate-200"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="h-12 w-12 flex items-center justify-center text-base font-bold text-slate-900 bg-slate-50">
                      {quantity}
                    </span>
                    <button suppressHydrationWarning
                      onClick={() => setQuantity(quantity + 1)}
                      className="h-12 w-12 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer border-l border-slate-200"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Add to Cart */}
                  <button suppressHydrationWarning
                    onClick={handleAddToCart}
                    className="flex-1 h-12 bg-[#0c3c26] hover:bg-[#0a3020] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer border-none shadow-md"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <span>Add to Cart — ₹{(getActiveUnitPrice() * quantity).toLocaleString()}</span>
                  </button>
                </div>

                {/* Bulk Quote Request Button */}
                <button suppressHydrationWarning
                  type="button"
                  onClick={() => setShowEnquiryModal(true)}
                  className="w-full h-12 bg-white hover:bg-slate-50 text-[#0c3c26] font-bold text-sm rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer border-2 border-[#0c3c26] shadow-sm"
                >
                  <MessageSquare className="h-5 w-5" />
                  <span>Request Wholesale Bulk Quote</span>
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
              {!user ? (
                <p className="text-xs text-slate-500 text-center py-6">Please log in to submit a review.</p>
              ) : !isEligibleToReview ? (
                <div className="bg-amber-50/50 border border-amber-200/40 rounded-xl p-4 text-center space-y-2">
                  <ShieldCheck className="h-5 w-5 text-amber-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Verified Purchase Required</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Only customers who have purchased and received this product can write a review.
                  </p>
                </div>
              ) : (
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
                        <button suppressHydrationWarning
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
                  <button suppressHydrationWarning
                    type="submit"
                    className="w-full h-10 bg-[#0F6E56] hover:bg-[#0c5a46] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer border-none"
                  >
                    Submit Review
                  </button>
                </form>
              )}
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
                      src={item.images[0] || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"}
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
                src={product.images[0] || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"}
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
              <button suppressHydrationWarning
                onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                className="h-9 w-9 flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer border-r border-slate-200"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="h-9 w-9 flex items-center justify-center text-sm font-bold text-slate-900 bg-slate-50">
                {quantity}
              </span>
              <button suppressHydrationWarning
                onClick={() => setQuantity(quantity + 1)}
                className="h-9 w-9 flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer border-l border-slate-200"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button suppressHydrationWarning
              onClick={handleAddToCart}
              className="h-10 bg-[#0c3c26] hover:bg-[#0a3020] text-white font-bold text-sm px-6 rounded-xl flex items-center space-x-2 transition-colors cursor-pointer border-none shadow-sm"
            >
              <span>Add to Cart — ₹{(getActiveUnitPrice() * quantity).toLocaleString()}</span>
            </button>
          </div>
        </div>
      </div>

      {/* BULK ENQUIRY MODAL */}
      {showEnquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative space-y-4 border border-slate-100">
            {/* Close Button */}
            <button suppressHydrationWarning
              onClick={() => {
                setShowEnquiryModal(false);
                setEnquirySubmitted(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer border-none bg-transparent text-lg font-bold z-10"
            >
              ✕
            </button>

            {enquirySubmitted ? (
              <div className="py-6 px-2 text-center space-y-5 animate-in zoom-in-95 duration-300">
                {/* Animated Green Pulse & Checkmark Icon */}
                <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                  <div className="absolute inset-1.5 rounded-full bg-emerald-500/30 animate-pulse" />
                  <div className="relative h-16 w-16 rounded-full bg-gradient-to-tr from-[#0c3c26] to-[#0F6E56] text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                    <CheckCircle2 className="h-9 w-9 animate-bounce" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-100">
                    ✓ Quote Request Transmitted
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 font-serif">
                    Custom Quote Sent! 🎉
                  </h3>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                    Your wholesale bulk quote request for <strong>{enquiryQty} units</strong> of <strong>{product.name}</strong> has been transmitted directly to the seller.
                  </p>
                </div>

                {/* Live Notification Banner */}
                <div className="bg-emerald-50/70 border border-emerald-100 p-3.5 rounded-2xl text-left text-xs space-y-1.5">
                  <div className="flex items-center space-x-2 font-bold text-[#0F6E56]">
                    <Bell className="h-4 w-4 animate-bounce" />
                    <span>Live Buyer Notification Active</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    You will receive an instant notification in your top header bell menu as soon as the manufacturer approves your quote, declines, or requests a delivery date extension.
                  </p>
                </div>

                <div className="pt-2">
                  <button suppressHydrationWarning
                    onClick={() => {
                      setShowEnquiryModal(false);
                      setEnquirySubmitted(false);
                      setEnquiryQty(100);
                      setEnquiryPrice("");
                      setEnquiryLocation("");
                      setEnquiryDate("");
                      setEnquiryPhone("");
                      setEnquiryMessage("");
                    }}
                    className="w-full bg-[#0c3c26] hover:bg-[#082b1b] text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all cursor-pointer border-none"
                  >
                    Done & Continue Shopping
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5 pr-6">
                  <span className="bg-[#f0faf5] text-[#0F6E56] text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">
                    Wholesale Enquiry
                  </span>
                  <h3 className="font-extrabold text-xl text-slate-900 font-serif leading-snug">
                    Request Custom Quote
                  </h3>
                  <p className="text-xs text-slate-500">
                    Submit bulk requirements for <strong>{product.name}</strong> to the manufacturer.
                  </p>
                </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!enquiryQty || !enquiryLocation || !enquiryName || !enquiryEmail || !enquiryPhone) {
                toast.error("Please fill in all required fields.");
                return;
              }

              setEnquiryPending(true);
              const res = await createEnquiry({
                productId: product.id,
                buyerId: user?.id,
                quantity: enquiryQty,
                targetPrice: enquiryPrice ? Number(enquiryPrice) : undefined,
                location: enquiryLocation,
                expectedDate: enquiryDate ? new Date(enquiryDate) : undefined,
                name: enquiryName,
                email: enquiryEmail,
                phone: enquiryPhone,
                message: enquiryMessage,
              });

              setEnquiryPending(false);
              if (res.success) {
                toast.success("Bulk quote enquiry sent successfully!");
                setEnquirySubmitted(true);
              } else {
                toast.error(res.error || "Failed to submit bulk quote enquiry.");
              }
            }} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Quantity Required (Units) *</span>
                  <Input
                    type="number"
                    min="10"
                    placeholder="e.g. 500"
                    value={enquiryQty}
                    onChange={(e) => setEnquiryQty(Number(e.target.value))}
                    required
                    className="text-xs bg-slate-50 border-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Target Price (Per Unit ₹)</span>
                  <Input
                    type="number"
                    placeholder="e.g. 150"
                    value={enquiryPrice}
                    onChange={(e) => setEnquiryPrice(e.target.value)}
                    className="text-xs bg-slate-50 border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-3 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Delivery Location / Address *</span>
                  {user?.id && (
                    <button suppressHydrationWarning
                      type="button"
                      onClick={() => setShowAddNewAddressForm(!showAddNewAddressForm)}
                      className="text-[10px] font-bold text-[#0F6E56] hover:underline border-none bg-transparent cursor-pointer"
                    >
                      {showAddNewAddressForm ? "← Select Saved Address" : "+ Add New Address"}
                    </button>
                  )}
                </div>

                {/* Saved Profile Addresses Dropdown */}
                {user?.id && userAddresses.length > 0 && !showAddNewAddressForm && (
                  <div className="space-y-2">
                    <select
                      value={selectedAddressId}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "new") {
                          setShowAddNewAddressForm(true);
                        } else {
                          setSelectedAddressId(val);
                          const addr = userAddresses.find((a) => a.id === val);
                          if (addr) {
                            setEnquiryLocation(`${addr.street}, ${addr.city}, ${addr.state} - ${addr.postalCode}, ${addr.country}`);
                          }
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] cursor-pointer"
                    >
                      {userAddresses.map((addr) => (
                        <option key={addr.id} value={addr.id}>
                          {addr.isDefault ? "📍 [Default] " : "📍 "}
                          {addr.street}, {addr.city}, {addr.state} - {addr.postalCode}
                        </option>
                      ))}
                      <option value="new">+ Add New Address to Profile</option>
                    </select>

                    <p className="text-[10px] text-slate-600 bg-emerald-50/60 border border-emerald-100 p-2 rounded-xl leading-snug">
                      <strong>Selected Delivery Address:</strong> {enquiryLocation}
                    </p>
                  </div>
                )}

                {/* Inline Add New Address Form */}
                {showAddNewAddressForm && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3 text-left">
                    <span className="text-[10px] font-extrabold text-[#0F6E56] uppercase tracking-wider block">
                      Add New Address to Your Profile
                    </span>
                    <div className="space-y-2 text-xs">
                      <Input
                        placeholder="Street Address / Building / Area *"
                        value={newStreet}
                        onChange={(e) => setNewStreet(e.target.value)}
                        className="text-xs bg-white border-slate-200"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="City *"
                          value={newCity}
                          onChange={(e) => setNewCity(e.target.value)}
                          className="text-xs bg-white border-slate-200"
                        />
                        <Input
                          placeholder="State *"
                          value={newState}
                          onChange={(e) => setNewState(e.target.value)}
                          className="text-xs bg-white border-slate-200"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Pincode / Postal Code *"
                          value={newPostalCode}
                          onChange={(e) => setNewPostalCode(e.target.value)}
                          className="text-xs bg-white border-slate-200"
                        />
                        <Input
                          placeholder="Country *"
                          value={newCountry}
                          onChange={(e) => setNewCountry(e.target.value)}
                          className="text-xs bg-white border-slate-200"
                        />
                      </div>
                      <div className="flex justify-end space-x-2 pt-1">
                        {userAddresses.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddNewAddressForm(false)}
                            className="text-[11px] h-7"
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveNewAddressInline}
                          disabled={isSavingAddress}
                          className="bg-[#0F6E56] text-white hover:bg-[#0c5a46] text-[11px] h-7 border-none"
                        >
                          {isSavingAddress ? "Saving..." : "Save Address & Select"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom input fallback when user is not logged in or has no saved addresses and form isn't active */}
                {(!user?.id || (userAddresses.length === 0 && !showAddNewAddressForm)) && (
                  <Input
                    placeholder="e.g. Street, City, State - Pincode"
                    value={enquiryLocation}
                    onChange={(e) => setEnquiryLocation(e.target.value)}
                    required
                    className="text-xs bg-slate-50 border-slate-200"
                  />
                )}
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Expected By Date</span>
                <Input
                  type="date"
                  value={enquiryDate}
                  onChange={(e) => setEnquiryDate(e.target.value)}
                  className="text-xs bg-slate-50 border-slate-200 cursor-pointer"
                />
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase">Contact Information</h4>
                
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Full Name *</span>
                  <Input
                    placeholder="e.g. Priyesh Shah"
                    value={enquiryName}
                    onChange={(e) => setEnquiryName(e.target.value)}
                    required
                    className="text-xs bg-slate-50 border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Email Address *</span>
                    <Input
                      type="email"
                      placeholder="e.g. buyer@company.com"
                      value={enquiryEmail}
                      onChange={(e) => setEnquiryEmail(e.target.value)}
                      required
                      className="text-xs bg-slate-50 border-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Mobile Number *</span>
                    <Input
                      placeholder="e.g. +91 98230 45678"
                      value={enquiryPhone}
                      onChange={(e) => setEnquiryPhone(e.target.value)}
                      required
                      className="text-xs bg-slate-50 border-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Product Specifications / Message</span>
                <Textarea
                  placeholder="Share detail specifications (size, thickness, certification needs, etc.)"
                  value={enquiryMessage}
                  onChange={(e) => setEnquiryMessage(e.target.value)}
                  className="text-xs bg-slate-50 border-slate-200 min-h-[60px]"
                />
              </div>

              <button suppressHydrationWarning
                type="submit"
                disabled={enquiryPending}
                className="w-full h-11 bg-[#0F6E56] hover:bg-[#0c5a46] disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-none flex items-center justify-center space-x-2 shadow-md"
              >
                {enquiryPending ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    <span>Submitting Enquiry...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4.5 w-4.5" />
                    <span>Submit Quote Request</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )}
  </>
  );
}
