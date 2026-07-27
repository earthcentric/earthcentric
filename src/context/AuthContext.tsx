"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncUserInDb, loginUser, signupUser, logoutUser } from "@/actions/auth";
import { toast } from "sonner";
import { useUser, useAuth as useClerkAuth } from "@clerk/nextjs";

export type Role = "BUYER" | "SELLER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  sellerStatus?: "PENDING" | "APPROVED" | "REJECTED";
  sellerId?: string;
  badges?: string[];
  phone?: string | null;
  isNewUser?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (name: string, email: string, role: Role, password?: string, phone?: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: Role) => void | Promise<void>;
  updateSellerStatus: (status: "PENDING" | "APPROVED" | "REJECTED", badges?: string[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial demo user is a Buyer
const DEMO_USERS: Record<Role, User> = {
  BUYER: {
    id: "buyer-1",
    name: "Alex conscious",
    email: "buyer@earthcentric.com",
    role: "BUYER",
  },
  SELLER: {
    id: "seller-1",
    name: "EcoThreads Inc",
    email: "contact@ecothreads.com",
    role: "SELLER",
    sellerStatus: "APPROVED",
    sellerId: "seller-1-profile",
    badges: ["Verified Business", "Verified Sustainable Manufacturer"],
  },
  ADMIN: {
    id: "admin-1",
    name: "EarthCentric Admin",
    email: "admin@earthcentric.com",
    role: "ADMIN",
  },
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut } = useClerkAuth();

  // 1. Sync Clerk session state to AuthContext and database/cookies
  useEffect(() => {
    if (!clerkLoaded) return;

    if (isSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress;
      if (email && (!user || user.email !== email)) {
        const isAdminEmail = email.toLowerCase().includes("admin") || email.toLowerCase() === "rkearthcentric@gmail.com";
        syncUserInDb({
          id: clerkUser.id,
          name: clerkUser.fullName || clerkUser.username || "Conscious Buyer",
          email: email,
          role: isAdminEmail ? "ADMIN" : "BUYER",
        }).then((synced) => {
          const finalUser: User = synced || {
            id: clerkUser.id,
            name: clerkUser.fullName || clerkUser.username || "Conscious Buyer",
            email: email,
            role: isAdminEmail ? "ADMIN" : "BUYER",
            phone: null,
            isNewUser: true,
          };
          setUser(finalUser);
          localStorage.setItem("earthcentric_user", JSON.stringify(finalUser));
          setIsLoading(false);

          const isProfileDone = localStorage.getItem("earthcentric_profile_done_" + finalUser.id) === "true";
          if (finalUser.isNewUser && !isProfileDone) {
            if (window.location.pathname !== "/account") {
              router.push("/account?tab=profile&onboarding=true");
            }
          }
        }).catch((err) => {
          console.error("Error syncing Clerk user:", err);
          setIsLoading(false);
        });
      }
    } else if (!isSignedIn && user) {
      // If user is not logged in via Clerk but local user exists, clean up
      setUser(null);
      localStorage.removeItem("earthcentric_user");
      logoutUser().catch(console.error);
    }
  }, [isSignedIn, clerkUser, clerkLoaded]);

  // 2. Initial background sync when already logged in
  useEffect(() => {
    const cachedUser = localStorage.getItem("earthcentric_user");
    let current: User | null = null;
    if (cachedUser) {
      try {
        current = JSON.parse(cachedUser);
      } catch (e) {
        current = null;
      }
    }

    // Only use cached user if it matches the current Clerk email (if signed in)
    if (isSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress;
      if (current && current.email !== email) {
        current = null;
      }
    } else if (!isSignedIn) {
      current = null;
    }

    setUser(current);
    setIsLoading(false);

    if (current) {
      // Sync in background to update status/badges from database
      syncUserInDb({
        id: current.id,
        name: current.name,
        email: current.email,
        role: current.role,
      }).then((synced) => {
        if (synced) {
          setUser(synced);
          localStorage.setItem("earthcentric_user", JSON.stringify(synced));
        }
      }).catch((err) => console.error("Error background syncing user:", err));
    } else {
      // Ensure server session is cleared if local state is empty
      logoutUser().catch(console.error);
    }
  }, [isSignedIn, clerkUser]);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    const res = await loginUser(email, password);
    
    if (!res.success) {
      toast.error(res.error || "Login failed");
      setIsLoading(false);
      return false;
    }

    const finalUser = res.user;
    setUser(finalUser);
    localStorage.setItem("earthcentric_user", JSON.stringify(finalUser));
    setIsLoading(false);
    
    toast.success("Successfully logged in!");

    // Redirect based on role
    if (finalUser.role === "ADMIN") {
      router.push("/admin/dashboard");
    } else if (finalUser.role === "SELLER") {
      if (finalUser.sellerStatus === "APPROVED") {
        router.push("/seller/dashboard");
      } else {
        router.push("/seller/verification");
      }
    } else {
      router.push("/");
    }
    
    return true;
  };

  const signup = async (name: string, email: string, role: Role, password?: string, phone?: string) => {
    setIsLoading(true);
    const res = await signupUser(name, email, role, password, phone);

    if (!res.success) {
      toast.error(res.error || "Registration failed");
      setIsLoading(false);
      return false;
    }

    const finalUser = res.user;
    setUser(finalUser);
    localStorage.setItem("earthcentric_user", JSON.stringify(finalUser));
    setIsLoading(false);
    
    toast.success("Successfully registered!");

    if (finalUser.role === "SELLER") {
      router.push("/seller/verification");
    } else {
      router.push("/account?tab=profile&onboarding=true");
    }
    
    return true;
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("earthcentric_user");
    await logoutUser();
    await signOut();
    router.push("/");
  };

  const switchRole = async (role: Role) => {
    setIsLoading(true);
    const updated = { ...DEMO_USERS[role] };

    // Sync with DB
    const synced = await syncUserInDb({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    });

    const finalUser = synced || updated;
    setUser(finalUser);
    localStorage.setItem("earthcentric_user", JSON.stringify(finalUser));
    setIsLoading(false);
    
    if (role === "ADMIN") {
      router.push("/admin/dashboard");
    } else if (role === "SELLER") {
      router.push("/");
    } else {
      router.push("/marketplace");
    }
  };

  const updateSellerStatus = (status: "PENDING" | "APPROVED" | "REJECTED", badges?: string[]) => {
    if (!user) return;
    
    const updatedUser = {
      ...user,
      role: "SELLER" as Role,
      sellerStatus: status,
      badges: status === "APPROVED" ? (badges || ["Verified Business"]) : [],
    };
    setUser(updatedUser);
    localStorage.setItem("earthcentric_user", JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
        switchRole,
        updateSellerStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
