"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getWishlist, toggleWishlist, WishlistItemData } from "@/actions/wishlist";
import { Heart, ShieldAlert, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/shared";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

export default function WishlistPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [items, setItems] = useState<WishlistItemData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.userId) {
      loadWishlist();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadWishlist = async () => {
    setLoading(true);
    if (user?.userId) {
      const data = await getWishlist(user.userId);
      setItems(data);
    }
    setLoading(false);
  };

  const handleRemove = async (productId: string) => {
    if (user?.userId) {
      // Optimistic update
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      await toggleWishlist(user.userId, productId);
      toast.success("Removed from wishlist");
    }
  };

  const handleAddToCart = (item: WishlistItemData) => {
    addToCart(item.product);
    toast.success("Added to cart");
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#f4f5f3]">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#f4f5f3] space-y-4 px-4 text-center">
        <ShieldAlert className="h-12 w-12 text-slate-400" />
        <h2 className="text-2xl font-bold text-slate-800">Sign in to view your wishlist</h2>
        <p className="text-slate-500 max-w-sm">
          You need to be logged in to save and view your favorite products.
        </p>
        <Link href="/auth/login">
          <Button variant="primary">Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f3] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-3 mb-8">
          <Heart className="h-8 w-8 text-rose-500 fill-rose-500" />
          <h1 className="text-3xl font-black text-slate-900">Your Wishlist</h1>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100 flex flex-col items-center justify-center">
            <Heart className="h-16 w-16 text-slate-200 mb-4" />
            <h3 className="text-xl font-bold text-slate-700">Your wishlist is empty</h3>
            <p className="text-slate-500 mt-2 mb-6 max-w-md">
              Discover amazing sustainable products and save them here for later.
            </p>
            <Link href="/marketplace">
              <Button variant="primary" className="flex items-center space-x-2">
                <ShoppingBag className="h-4 w-4" />
                <span>Explore Marketplace</span>
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => {
              const p = item.product;
              const originalPrice = p.price > 500 ? Math.round(p.price * 1.25) : Math.round(p.price * 1.5);
              
              return (
                <div key={item.id} className="bg-white border border-slate-100 rounded-3xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="space-y-4">
                    <div className="aspect-square relative overflow-hidden bg-[#ebf3ef] rounded-2xl p-4">
                      <Image 
                        src={p.images[0] || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400"}
                        alt={p.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 30vw"
                        className="object-contain"
                      />
                      <button
                        onClick={() => handleRemove(item.productId)}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold text-[#0F6E56] uppercase tracking-wider mb-1">
                        {p.category} • {p.seller.companyName}
                      </p>
                      <Link href={`/products/${p.id}`}>
                        <h4 className="text-sm font-black text-slate-800 line-clamp-2 hover:text-[#0F6E56] transition-colors h-[40px]">
                          {p.name}
                        </h4>
                      </Link>
                      
                      <div className="flex items-center space-x-1.5 mt-3">
                        <span className="text-base font-black text-slate-900">₹{p.price.toLocaleString()}</span>
                        {originalPrice && (
                          <span className="text-xs text-slate-400 font-semibold line-through">
                            ₹{originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="primary"
                    className="w-full mt-4 flex justify-center items-center gap-2"
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
