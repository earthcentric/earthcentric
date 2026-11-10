"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { BuyXGetYOffer, IndividualDiscount, TierDiscount } from "@/actions/products";
import { isBuyXGetYActive, getEffectiveUnitPrice } from "@/lib/offers";
import { getBoxPricingBreakdown, BoxPricingBreakdown } from "@/lib/box-pricing";
import { GstVerificationModal } from "@/components/gst/GstVerificationModal";
import { Button } from "@/components/ui/shared";
import { X, Sparkles, Gift } from "lucide-react";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number; // Number of bulk boxes
  boxes?: number;
  unitsPerBox?: number; // Predefined units per box
  totalUnits?: number;  // boxes * unitsPerBox
  pricePerBox?: number;
  twoBoxPrice?: number | null; // Approved price for 2 boxes
  threePlusBoxPrice?: number | null; // Approved price per box for 3+ boxes
  commissionRate?: number;
  sellerName: string;
  sellerId: string;
  moq?: number;
  buyXGetYOffer?: BuyXGetYOffer | null;
  individualDiscount?: IndividualDiscount | null;
  tierDiscounts?: TierDiscount[] | null;
  bulkPriceSlabs?: any | null;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
  isGstVerified: boolean;
  verifiedGstin: string | null;
  verifiedPhone: string | null;
  isGstModalOpen: boolean;
  openGstModal: (onSuccess?: (data: { gstin: string; phone: string }) => void) => void;
  closeGstModal: () => void;
  getItemPricing: (item: CartItem) => BoxPricingBreakdown;
}

import { useAuth } from "./AuthContext";
import { getDbCart, addToDbCart, removeFromDbCart, updateDbCartQuantity, clearDbCart, syncLocalCartToDb, refreshCartItemOffers } from "@/actions/cart";

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCartOpen, setIsCartOpenInternal] = useState(false);

  const isVerifiedBuyer = Boolean(user && (user.role !== "BUYER" || user.buyerOnboardingCompleted));

  const setIsCartOpen = (open: boolean) => {
    if (open && !isVerifiedBuyer) {
      toast.error("Please sign in with Google to access your cart.");
      if (typeof window !== "undefined") {
        window.location.href = `/auth/buyer-login?redirect_url=${encodeURIComponent(window.location.pathname || "/cart")}`;
      }
      return;
    }
    setIsCartOpenInternal(open);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpenInternal(false);

  // GST Verification state (Requirement 2 & 3: unlocked upon valid GSTIN and Mobile)
  const [isGstVerified, setIsGstVerified] = useState(false);
  const [verifiedGstin, setVerifiedGstin] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [isGstModalOpen, setIsGstModalOpen] = useState(false);
  const pendingActionRef = useRef<((data: { gstin: string; phone: string }) => void) | null>(null);

  const openGstModal = (onSuccess?: (data: { gstin: string; phone: string }) => void) => {
    if (onSuccess) {
      pendingActionRef.current = onSuccess;
    } else {
      pendingActionRef.current = null;
    }
    setIsGstModalOpen(true);
  };

  const closeGstModal = () => {
    setIsGstModalOpen(false);
    pendingActionRef.current = null;
  };

  // Restore GST verification session across page refreshes and user profile
  useEffect(() => {
    if (user?.role === "ADMIN" || user?.gstStatus === "APPROVED") {
      setIsGstVerified(true);
      if (user.gstin) setVerifiedGstin(user.gstin || null);
      if (user.mobileNumber || user.phone) setVerifiedPhone(user.mobileNumber || user.phone || null);
      return;
    }

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("earthcentric_gst_verification");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.gstin && parsed?.phone) {
            setIsGstVerified(true);
            setVerifiedGstin(parsed.gstin);
            setVerifiedPhone(parsed.phone);
          }
        }
      } catch (e) {
        console.warn("Failed to restore GST verification state:", e);
      }
    }
  }, [user]);

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

  const applyAddToCart = (product: Omit<CartItem, "quantity">, boxQty: number) => {
    const unitsPerBox = (product as any).unitsPerBox || (product as any).bulkOrderQuantity || 100;

    // Check one-time offer popup per session for active Buy X Get Y offers
    if (product.buyXGetYOffer && isBuyXGetYActive(product.buyXGetYOffer)) {
      const sessionKey = `buy_x_offer_shown_${product.id}`;
      if (typeof window !== "undefined" && !sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "true");
        setActiveOfferPopup({
          productName: product.name,
          buyQuantity: Number(product.buyXGetYOffer.buyQuantity || 2),
          getQuantity: Number(product.buyXGetYOffer.getQuantity || 1),
          maxFreeQuantity: product.buyXGetYOffer.maxFreeQuantity,
        });
      }
    }

    // Optimistic client state update (box-based only)
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        const newBoxes = existingItem.quantity + boxQty;
        return prevCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: newBoxes,
                boxes: newBoxes,
                unitsPerBox,
                totalUnits: newBoxes * unitsPerBox,
                pricePerBox: product.price,
                twoBoxPrice: (product as any).twoBoxPrice ?? item.twoBoxPrice,
                threePlusBoxPrice: (product as any).threePlusBoxPrice ?? item.threePlusBoxPrice,
                buyXGetYOffer: product.buyXGetYOffer !== undefined ? product.buyXGetYOffer : item.buyXGetYOffer,
                individualDiscount: product.individualDiscount !== undefined ? product.individualDiscount : item.individualDiscount,
                tierDiscounts: product.tierDiscounts !== undefined ? product.tierDiscounts : item.tierDiscounts,
                bulkPriceSlabs: product.bulkPriceSlabs !== undefined ? product.bulkPriceSlabs : item.bulkPriceSlabs,
              }
            : item
        );
      }
      return [...prevCart, {
        ...product,
        quantity: boxQty,
        boxes: boxQty,
        unitsPerBox,
        totalUnits: boxQty * unitsPerBox,
        pricePerBox: product.price,
        twoBoxPrice: (product as any).twoBoxPrice,
        threePlusBoxPrice: (product as any).threePlusBoxPrice,
      }];
    });

    // Save changes to database in the background if authenticated
    if (user?.id) {
      addToDbCart(user.id, product.id, boxQty).catch((err) =>
        console.error("Failed to sync addToCart to database:", err)
      );
    }
  };

  const addToCart = (product: Omit<CartItem, "quantity">, quantity = 1) => {
    if (!isVerifiedBuyer) {
      toast.error("Please sign in with Google to add products to your cart.");
      if (typeof window !== "undefined") {
        window.location.href = `/auth/buyer-login?redirect_url=${encodeURIComponent(window.location.pathname || "/marketplace")}`;
      }
      return;
    }

    const boxQty = Math.max(1, Math.round(quantity));
    const existing = cart.find((item) => item.id === product.id);
    const existingQty = existing ? existing.quantity : 0;
    const targetQty = existingQty + boxQty;

    // Requirement 2: Second Box — Hide Price & Disallow >1 box Until GST Verification
    if (targetQty > 1 && !isGstVerified) {
      if (existingQty === 0) {
        // Add only 1 box to cart first
        applyAddToCart(product, 1);
      }
      openGstModal(() => {
        applyQuantityUpdate(product.id, targetQty);
      });
      return;
    }

    applyAddToCart(product, boxQty);
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

  const applyQuantityUpdate = (id: string, finalQty: number) => {
    // Optimistic client state update
    setCart((prevCart) => {
      const item = prevCart.find(i => i.id === id);
      if (!item) return prevCart;
      
      if (finalQty <= 0) {
        return prevCart.filter((i) => i.id !== id);
      }
      
      const unitsPerBox = item.unitsPerBox || 100;
      return prevCart.map((i) => (i.id === id ? {
        ...i,
        quantity: finalQty,
        boxes: finalQty,
        totalUnits: finalQty * unitsPerBox,
      } : i));
    });

    // Save changes to database in the background if authenticated
    if (user?.id) {
      if (finalQty <= 0) {
        removeFromDbCart(user.id, id).catch((err) =>
          console.error("Failed to sync removeFromCart to database:", err)
        );
      } else {
        updateDbCartQuantity(user.id, id, finalQty).catch((err) =>
          console.error("Failed to sync updateQuantity to database:", err)
        );
      }
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      applyQuantityUpdate(id, 0);
      return;
    }

    const targetQty = Math.max(1, Math.round(quantity));

    // Requirement 2: Increasing quantity from 1 box to 2 or more boxes requires GST verification
    if (targetQty > 1 && !isGstVerified) {
      openGstModal(() => {
        applyQuantityUpdate(id, targetQty);
      });
      return;
    }

    applyQuantityUpdate(id, targetQty);
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

  const getItemPricing = (item: CartItem): BoxPricingBreakdown => {
    return getBoxPricingBreakdown(
      {
        price: item.price,
        twoBoxPrice: item.twoBoxPrice,
        threePlusBoxPrice: item.threePlusBoxPrice,
      },
      item.quantity,
      isGstVerified
    );
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  // Requirement 3 & 5: Calculate total using approved box pricing rules
  const cartTotal = cart.reduce((total, item) => {
    const pricing = getItemPricing(item);
    return total + pricing.totalPrice;
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
        isCartOpen,
        setIsCartOpen,
        openCart,
        closeCart,
        isGstVerified,
        verifiedGstin,
        verifiedPhone,
        isGstModalOpen,
        openGstModal,
        closeGstModal,
        getItemPricing,
      }}
    >
      {children}

      {/* Global GST Verification Modal (Opens when buyer clicks '+' to 2+ boxes without verification) */}
      <GstVerificationModal
        isOpen={isGstModalOpen}
        onClose={closeGstModal}
        onSuccess={(verifiedData) => {
          setIsGstVerified(true);
          setVerifiedGstin(verifiedData.gstin);
          setVerifiedPhone(verifiedData.phone);
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "earthcentric_gst_verification",
              JSON.stringify({
                gstin: verifiedData.gstin,
                phone: verifiedData.phone,
                stateName: verifiedData.stateName,
                pan: verifiedData.pan,
                verifiedAt: new Date().toISOString(),
              })
            );
          }
          if (pendingActionRef.current) {
            pendingActionRef.current(verifiedData);
            pendingActionRef.current = null;
          }
        }}
      />

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
