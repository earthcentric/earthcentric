"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { BuyXGetYOffer, IndividualDiscount, TierDiscount } from "@/actions/products";
import { isBuyXGetYActive, getEffectiveUnitPrice } from "@/lib/offers";
import { Button } from "@/components/ui/shared";
import { X, Sparkles, Gift } from "lucide-react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
  sellerName: string;
  sellerId: string;
  moq?: number;
  buyXGetYOffer?: BuyXGetYOffer | null;
  individualDiscount?: IndividualDiscount | null;
  tierDiscounts?: TierDiscount[] | null;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

import { useAuth } from "./AuthContext";
import { getDbCart, addToDbCart, removeFromDbCart, updateDbCartQuantity, clearDbCart, syncLocalCartToDb, refreshCartItemOffers } from "@/actions/cart";

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeOfferPopup, setActiveOfferPopup] = useState<{
    productName: string;
    buyQuantity: number;
    getQuantity: number;
    maxFreeQuantity?: number | null;
  } | null>(null);

  // Load and sync cart when user session (authenticated user ID) changes
  useEffect(() => {
    const loadAndSyncCart = async () => {
      setIsLoaded(false);
      setCart([]); // Reset cart on user session change to prevent cross-account leak

      let initialCart: CartItem[] = [];
      if (user?.id) {
        // Logged in user: retrieve guest items from localStorage if any, and sync to DB
        const storedGuestCart = localStorage.getItem("earthcentric_guest_cart");
        let guestItems = [];
        if (storedGuestCart) {
          try {
            guestItems = JSON.parse(storedGuestCart);
          } catch (e) {
            console.error("Failed to parse guest cart data for sync", e);
          }
        }

        if (guestItems.length > 0) {
          // Sync/merge guest cart with database cart
          initialCart = await syncLocalCartToDb(user.id, guestItems.map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
          })));
          localStorage.removeItem("earthcentric_guest_cart");
        } else {
          // Load user's database cart
          const dbCart = await getDbCart(user.id);
          initialCart = dbCart || [];
        }
      } else {
        // Guest user: load guest cart from localStorage
        const storedGuestCart = localStorage.getItem("earthcentric_guest_cart");
        if (storedGuestCart) {
          try {
            initialCart = JSON.parse(storedGuestCart);
          } catch (e) {
            console.error("Failed to parse guest cart data", e);
            initialCart = [];
          }
        } else {
          initialCart = [];
        }
      }

      // Refresh product promotion offers for all cart items to ensure live status
      if (initialCart.length > 0) {
        const refreshedCart = await refreshCartItemOffers(initialCart);
        setCart(refreshedCart);
      } else {
        setCart([]);
      }

      setIsLoaded(true);
    };

    loadAndSyncCart();
  }, [user?.id]);

  // Save guest cart to localStorage when it changes
  useEffect(() => {
    if (isLoaded && !user?.id) {
      localStorage.setItem("earthcentric_guest_cart", JSON.stringify(cart));
    }
  }, [cart, isLoaded, user?.id]);

  const addToCart = (product: Omit<CartItem, "quantity">, quantity = 1) => {
    // Check one-time offer popup per session for active Buy X Get Y offers
    if (product.buyXGetYOffer && isBuyXGetYActive(product.buyXGetYOffer)) {
      const sessionKey = `buy_x_offer_shown_${product.id}`;
      if (typeof window !== "undefined" && !sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "true");
        setActiveOfferPopup({
          productName: product.name,
          buyQuantity: product.buyXGetYOffer.buyQuantity,
          getQuantity: product.buyXGetYOffer.getQuantity,
          maxFreeQuantity: product.buyXGetYOffer.maxFreeQuantity,
        });
      }
    }

    // Optimistic client state update
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity, buyXGetYOffer: product.buyXGetYOffer || item.buyXGetYOffer }
            : item
        );
      }
      return [...prevCart, { ...product, quantity }];
    });

    // Save changes to database in the background if authenticated
    if (user?.id) {
      addToDbCart(user.id, product.id, quantity).catch((err) =>
        console.error("Failed to sync addToCart to database:", err)
      );
    }
  };

  const removeFromCart = (id: string) => {
    // Optimistic client state update
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));

    // Save changes to database in the background if authenticated
    if (user?.id) {
      removeFromDbCart(user.id, id).catch((err) =>
        console.error("Failed to sync removeFromCart to database:", err)
      );
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    let finalQty = quantity;
    
    // Optimistic client state update
    setCart((prevCart) => {
      const item = prevCart.find(i => i.id === id);
      if (!item) return prevCart;
      
      const minQty = item.moq || 1;
      
      if (quantity <= 0) {
        return prevCart.filter((i) => i.id !== id);
      }
      
      // Enforce MOQ if quantity is being set below MOQ (unless it's 0 which means remove)
      finalQty = quantity < minQty ? minQty : quantity;
      
      return prevCart.map((i) => (i.id === id ? { ...i, quantity: finalQty } : i));
    });

    // Save changes to database in the background if authenticated
    if (user?.id) {
      updateDbCartQuantity(user.id, id, finalQty).catch((err) =>
        console.error("Failed to sync updateQuantity to database:", err)
      );
    }
  };

  const clearCart = () => {
    // Optimistic client state update
    setCart([]);

    // Save changes to database in the background if authenticated
    if (user?.id) {
      clearDbCart(user.id).catch((err) =>
        console.error("Failed to sync clearCart to database:", err)
      );
    }
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => {
    const effective = getEffectiveUnitPrice(item, item.quantity);
    return total + effective.unitPrice * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}

      {/* One-Time Session Buy X Get Y Offer Modal Popup */}
      {activeOfferPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-emerald-100 shadow-2xl space-y-4 text-center relative">
            <button 
              onClick={() => setActiveOfferPopup(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="h-14 w-14 bg-[#e8f3ec] text-[#2d4a36] rounded-2xl flex items-center justify-center mx-auto shadow-inner text-2xl">
              🎉
            </div>

            <div>
              <span className="bg-[#2d4a36] text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wider">
                Special Offer Available!
              </span>
              <h3 className="text-lg font-black text-[#1f3a2e] mt-2">
                Buy {activeOfferPopup.buyQuantity} & Get {activeOfferPopup.getQuantity} Free!
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Add <strong>{activeOfferPopup.buyQuantity}</strong> or more of <span className="font-bold text-[#1f3a2e]">{activeOfferPopup.productName}</span> to your cart and automatically receive <strong>{activeOfferPopup.getQuantity} free bonus item(s)</strong> with your order!
              </p>
            </div>

            <div className="p-3 bg-[#f4f5f3] rounded-xl text-[11px] text-[#2d4a36] font-semibold text-left border border-[#e2ece4]">
              ✨ Free bonus items are automatically calculated in your cart and included at checkout. No coupon codes required!
            </div>

            <Button
              onClick={() => setActiveOfferPopup(null)}
              className="w-full bg-[#2d4a36] hover:bg-[#1e3425] text-white rounded-xl py-3 font-bold text-xs shadow-md cursor-pointer"
            >
              Got it, Continue Shopping
            </Button>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
