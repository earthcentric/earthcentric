"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { getWishlist, getWishlistProductsByIds, WishlistItemData } from "@/actions/wishlist";
import { Heart, ShoppingBag, Trash2, ArrowRight, Sparkles, AlertCircle, ShoppingCart } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/shared";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

export default function WishlistPage() {
  const { user } = useAuth();
  const { wishlistIds, removeFromWishlist, clearWishlist, isGuestWishlist, isLoading: wishlistLoading } = useWishlist();
  const { addToCart } = useCart();
  const [items, setItems] = useState<WishlistItemData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWishlistItems = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const data = await getWishlist(user.id);
        setItems(data);
      } else if (wishlistIds.length > 0) {
        const guestData = await getWishlistProductsByIds(wishlistIds);
        setItems(guestData);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error("Error loading wishlist items:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, wishlistIds]);

  useEffect(() => {
    if (!wishlistLoading) {
      loadWishlistItems();
    }
  }, [wishlistLoading, loadWishlistItems]);

  const handleRemove = async (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    await removeFromWishlist(productId);
  };

  const handleAddToCart = (item: WishlistItemData) => {
    const p = item.product;
    addToCart({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      image: p.images?.[0] || "",
      sellerName: p.seller?.companyName || "EarthCentric Partner",
      sellerId: p.sellerId,
      moq: p.moq || 1,
      buyXGetYOffer: p.buyXGetYOffer || null,
      individualDiscount: p.individualDiscount || null,
      tierDiscounts: p.tierDiscounts || null,
    });
    toast.success(`${p.name} added to cart!`);
  };

  const handleMoveAllToCart = () => {
    if (items.length === 0) return;
    items.forEach((item) => {
      const p = item.product;
      addToCart({
        id: p.id,
        name: p.name,
        price: p.price,
        originalPrice: p.originalPrice,
        image: p.images?.[0] || "",
        sellerName: p.seller?.companyName || "EarthCentric Partner",
        sellerId: p.sellerId,
        moq: p.moq || 1,
        buyXGetYOffer: p.buyXGetYOffer || null,
        individualDiscount: p.individualDiscount || null,
        tierDiscounts: p.tierDiscounts || null,
      });
    });
    toast.success(`All ${items.length} items added to your cart!`);
  };

  const handleClearWishlist = async () => {
    if (items.length === 0) return;
    setItems([]);
    await clearWishlist();
  };

  if (loading || wishlistLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#f4f5f3] space-y-3">
        <div className="h-10 w-10 border-4 border-[#0F6E56] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading your saved items...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f3] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Guest Wishlist Banner */}
        {isGuestWishlist && (
          <div className="mb-8 bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start sm:items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">Guest Wishlist Active</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Items you save are stored on this device. Sign in to sync your wishlist across all devices.
                </p>
              </div>
            </div>
            <Link href="/sign-in" className="flex-shrink-0">
              <Button variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100/60 text-xs font-bold px-4 py-2">
                Sign In to Save Permanently
              </Button>
            </Link>
          </div>
        )}

        {/* Page Header with Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200/60">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-100">
              <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Your Wishlist</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {items.length} {items.length === 1 ? "sustainable item" : "sustainable items"} saved
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                className="text-xs font-bold border-slate-200 hover:bg-slate-100/60 text-slate-600 flex items-center gap-1.5"
                onClick={handleClearWishlist}
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                <span>Clear All</span>
              </Button>
              <Button
                variant="primary"
                className="text-xs font-bold flex items-center gap-1.5 bg-[#0F6E56] hover:bg-[#0b5442] text-white"
                onClick={handleMoveAllToCart}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Add All to Cart</span>
              </Button>
            </div>
          )}
        </div>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 sm:p-16 text-center shadow-sm border border-slate-100 flex flex-col items-center justify-center max-w-2xl mx-auto">
            <div className="h-20 w-20 rounded-full bg-rose-50 flex items-center justify-center mb-6">
              <Heart className="h-10 w-10 text-rose-300" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800">Your wishlist is currently empty</h3>
            <p className="text-slate-500 text-sm mt-2 mb-8 max-w-md leading-relaxed">
              Explore our curated marketplace of verified eco-friendly, circular, and carbon-neutral products and save your favorites here.
            </p>
            <Link href="/marketplace">
              <Button variant="primary" className="flex items-center space-x-2 px-6 py-3 bg-[#0F6E56] hover:bg-[#0b5442] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all">
                <ShoppingBag className="h-4 w-4" />
                <span>Explore Marketplace</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          /* Products Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => {
              const p = item.product;
              const originalPrice = p.originalPrice || (p.price > 500 ? Math.round(p.price * 1.25) : Math.round(p.price * 1.5));
              const sellerName = p.seller?.companyName || "EarthCentric Partner";
              const category = p.category || "Eco Product";
              const primaryImage = p.images?.[0] || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400";
              
              return (
                <div 
                  key={item.id} 
                  className="bg-white border border-slate-100 rounded-3xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 group"
                >
                  <div className="space-y-4">
                    {/* Image Box */}
                    <div className="aspect-square relative overflow-hidden bg-[#ebf3ef] rounded-2xl p-4 flex items-center justify-center">
                      <Link href={`/products/${p.id}`} className="block w-full h-full cursor-pointer relative">
                        <Image 
                          src={primaryImage}
                          alt={p.name}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                          className="object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      </Link>
                      
                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemove(item.productId)}
                        className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm text-slate-400 hover:text-rose-500 hover:bg-white transition-all z-10 cursor-pointer"
                        title="Remove from wishlist"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      {/* Stock badge */}
                      {p.stock !== undefined && p.stock <= 5 && (
                        <span className="absolute bottom-2.5 left-2.5 bg-amber-500/90 text-white text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-xs">
                          {p.stock === 0 ? "Out of Stock" : `Only ${p.stock} left`}
                        </span>
                      )}
                    </div>

                    {/* Meta Details */}
                    <div>
                      <p className="text-[10px] font-extrabold text-[#0F6E56] uppercase tracking-wider mb-1 truncate">
                        {category} • {sellerName}
                      </p>
                      <Link href={`/products/${p.id}`}>
                        <h4 className="text-sm font-black text-slate-800 line-clamp-2 hover:text-[#0F6E56] transition-colors h-[40px]">
                          {p.name}
                        </h4>
                      </Link>
                      
                      <div className="flex items-center space-x-2 mt-3">
                        <span className="text-base font-black text-slate-900">
                          ₹{p.price.toLocaleString()}
                        </span>
                        {originalPrice > p.price && (
                          <span className="text-xs text-slate-400 font-semibold line-through">
                            ₹{originalPrice.toLocaleString()}
                          </span>
                        )}
                        {originalPrice > p.price && (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {Math.round(((originalPrice - p.price) / originalPrice) * 100)}% OFF
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <Button 
                    variant="primary"
                    className="w-full mt-4 flex justify-center items-center gap-2 bg-[#0F6E56] hover:bg-[#0b5442] text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-sm hover:shadow"
                    onClick={() => handleAddToCart(item)}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Add to Cart</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
