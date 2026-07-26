"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  sustainabilityScore: number;
  sellerName: string;
  sellerId: string;
  moq?: number;
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
import { getDbCart, addToDbCart, removeFromDbCart, updateDbCartQuantity, clearDbCart, syncLocalCartToDb } from "@/actions/cart";

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load and sync cart when user session (authenticated user ID) changes
  useEffect(() => {
    const loadAndSyncCart = async () => {
      setIsLoaded(false);
      setCart([]); // Reset cart on user session change to prevent cross-account leak

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
          const syncedCart = await syncLocalCartToDb(user.id, guestItems.map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
          })));
          setCart(syncedCart);
          localStorage.removeItem("earthcentric_guest_cart");
        } else {
          // Load user's database cart
          const dbCart = await getDbCart(user.id);
          setCart(dbCart || []);
        }
      } else {
        // Guest user: load guest cart from localStorage
        const storedGuestCart = localStorage.getItem("earthcentric_guest_cart");
        if (storedGuestCart) {
          try {
            setCart(JSON.parse(storedGuestCart));
          } catch (e) {
            console.error("Failed to parse guest cart data", e);
            setCart([]);
          }
        } else {
          setCart([]);
        }
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
    // Optimistic client state update
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
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
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

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
