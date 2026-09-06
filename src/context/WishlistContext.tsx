"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  getWishlistIds,
  toggleWishlist as toggleWishlistAction,
  syncGuestWishlistToDb,
  clearUserWishlist,
} from "@/actions/wishlist";
import { toast } from "sonner";

interface WishlistContextType {
  wishlistIds: string[];
  wishlistCount: number;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<{ success: boolean; isWishlisted: boolean }>;
  removeFromWishlist: (productId: string) => Promise<void>;
  clearWishlist: () => Promise<void>;
  isLoading: boolean;
  isGuestWishlist: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const GUEST_WISHLIST_KEY = "earthcentric_guest_wishlist";

export const WishlistProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load and synchronize wishlist when user authentication state changes
  useEffect(() => {
    let isMounted = true;

    const initWishlist = async () => {
      setIsLoading(true);

      if (user?.id) {
        // Authenticated user: Check for guest wishlist in localStorage to merge
        let guestItems: string[] = [];
        try {
          const stored = localStorage.getItem(GUEST_WISHLIST_KEY);
          if (stored) {
            guestItems = JSON.parse(stored);
          }
        } catch (e) {
          console.error("Error reading guest wishlist for sync:", e);
        }

        try {
          if (guestItems.length > 0) {
            // Merge guest wishlist into user account in DB
            const mergedIds = await syncGuestWishlistToDb(user.id, guestItems);
            localStorage.removeItem(GUEST_WISHLIST_KEY);
            if (isMounted) setWishlistIds(mergedIds || []);
          } else {
            // Fetch user wishlist from DB
            const ids = await getWishlistIds(user.id);
            if (isMounted) setWishlistIds(ids || []);
          }
        } catch (error) {
          console.error("Error loading user wishlist:", error);
          if (isMounted) setWishlistIds([]);
        }
      } else {
        // Guest user: Load from localStorage
        try {
          const stored = localStorage.getItem(GUEST_WISHLIST_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && isMounted) {
              setWishlistIds(parsed);
            }
          } else if (isMounted) {
            setWishlistIds([]);
          }
        } catch (e) {
          console.error("Error reading guest wishlist:", e);
          if (isMounted) setWishlistIds([]);
        }
      }

      if (isMounted) setIsLoading(false);
    };

    initWishlist();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const isInWishlist = useCallback(
    (productId: string) => {
      return wishlistIds.includes(productId);
    },
    [wishlistIds]
  );

  const toggleWishlist = useCallback(
    async (productId: string): Promise<{ success: boolean; isWishlisted: boolean }> => {
      if (!productId) return { success: false, isWishlisted: false };

      const currentlyWishlisted = wishlistIds.includes(productId);
      const nextWishlisted = !currentlyWishlisted;

      // Optimistically update local state immediately
      const nextIds = nextWishlisted
        ? [...wishlistIds, productId]
        : wishlistIds.filter((id) => id !== productId);

      setWishlistIds(nextIds);

      if (user?.id) {
        // Authenticated user: Persist in Database
        try {
          const res = await toggleWishlistAction(user.id, productId);
          if (res.success) {
            if (res.isWishlisted) {
              toast.success("Added to wishlist");
            } else {
              toast.success("Removed from wishlist");
            }
            // Ensure state matches server response
            setWishlistIds((prev) => {
              if (res.isWishlisted) {
                return prev.includes(productId) ? prev : [...prev, productId];
              } else {
                return prev.filter((id) => id !== productId);
              }
            });
            return res;
          } else {
            // Revert state on failure
            setWishlistIds(wishlistIds);
            toast.error("Failed to update wishlist");
            return { success: false, isWishlisted: currentlyWishlisted };
          }
        } catch (error) {
          console.error("Wishlist toggle error:", error);
          setWishlistIds(wishlistIds);
          toast.error("Failed to update wishlist");
          return { success: false, isWishlisted: currentlyWishlisted };
        }
      } else {
        // Guest user: Persist in localStorage
        try {
          localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(nextIds));
          if (nextWishlisted) {
            toast.success("Added to wishlist");
          } else {
            toast.success("Removed from wishlist");
          }
          return { success: true, isWishlisted: nextWishlisted };
        } catch (e) {
          console.error("Error writing guest wishlist:", e);
          setWishlistIds(wishlistIds);
          toast.error("Could not save to local storage");
          return { success: false, isWishlisted: currentlyWishlisted };
        }
      }
    },
    [user?.id, wishlistIds]
  );

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      if (!productId) return;
      const prevIds = [...wishlistIds];
      const nextIds = wishlistIds.filter((id) => id !== productId);
      setWishlistIds(nextIds);

      if (user?.id) {
        try {
          const res = await toggleWishlistAction(user.id, productId);
          if (!res.success) {
            setWishlistIds(prevIds);
            toast.error("Failed to remove item");
          } else {
            toast.success("Removed from wishlist");
          }
        } catch (e) {
          console.error("Error removing item:", e);
          setWishlistIds(prevIds);
          toast.error("Failed to remove item");
        }
      } else {
        try {
          localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(nextIds));
          toast.success("Removed from wishlist");
        } catch (e) {
          console.error("Error updating guest wishlist:", e);
          setWishlistIds(prevIds);
        }
      }
    },
    [user?.id, wishlistIds]
  );

  const clearWishlist = useCallback(async () => {
    const prevIds = [...wishlistIds];
    setWishlistIds([]);

    if (user?.id) {
      try {
        const ok = await clearUserWishlist(user.id);
        if (!ok) {
          setWishlistIds(prevIds);
          toast.error("Failed to clear wishlist");
        } else {
          toast.success("Wishlist cleared");
        }
      } catch (e) {
        console.error("Error clearing wishlist:", e);
        setWishlistIds(prevIds);
        toast.error("Failed to clear wishlist");
      }
    } else {
      try {
        localStorage.removeItem(GUEST_WISHLIST_KEY);
        toast.success("Wishlist cleared");
      } catch (e) {
        console.error("Error clearing guest wishlist:", e);
        setWishlistIds(prevIds);
      }
    }
  }, [user?.id, wishlistIds]);

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistCount: wishlistIds.length,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist,
        isLoading,
        isGuestWishlist: !user?.id,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
