"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncUserInDb } from "@/actions/auth";

export type Role = "BUYER" | "SELLER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  sellerStatus?: "PENDING" | "APPROVED" | "REJECTED";
  sellerId?: string;
  badges?: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (name: string, email: string, role: Role, password?: string) => Promise<boolean>;
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

  useEffect(() => {
    const cachedUser = localStorage.getItem("earthcentric_user");
    let current: User = DEMO_USERS.BUYER;
    if (cachedUser) {
      try {
        current = JSON.parse(cachedUser);
      } catch (e) {
        current = DEMO_USERS.BUYER;
      }
    } else {
      localStorage.setItem("earthcentric_user", JSON.stringify(DEMO_USERS.BUYER));
    }
    setUser(current);
    setIsLoading(false);

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
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 600));
    
    let matchedUser: User;
    if (email.toLowerCase().includes("admin")) {
      matchedUser = { ...DEMO_USERS.ADMIN, email };
    } else if (email.toLowerCase().includes("seller")) {
      matchedUser = { ...DEMO_USERS.SELLER, email };
    } else {
      matchedUser = { ...DEMO_USERS.BUYER, email };
    }

    // Sync with DB
    const synced = await syncUserInDb({
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
    });

    const finalUser = synced || matchedUser;
    
    setUser(finalUser);
    localStorage.setItem("earthcentric_user", JSON.stringify(finalUser));
    setIsLoading(false);
    
    // Redirect based on role
    if (finalUser.role === "ADMIN") {
      router.push("/admin/dashboard");
    } else if (finalUser.role === "SELLER") {
      router.push("/");
    } else {
      router.push("/marketplace");
    }
    
    return true;
  };

  const signup = async (name: string, email: string, role: Role, password?: string) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const newUser: User = {
      id: `u-${Math.random().toString(36).substring(2, 10)}`,
      name,
      email,
      role,
      sellerStatus: role === "SELLER" ? "PENDING" : undefined,
    };

    // Sync with DB
    const synced = await syncUserInDb({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });

    const finalUser = synced || newUser;
    
    setUser(finalUser);
    localStorage.setItem("earthcentric_user", JSON.stringify(finalUser));
    setIsLoading(false);
    
    if (finalUser.role === "SELLER") {
      router.push("/seller/verification");
    } else {
      router.push("/marketplace");
    }
    
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("earthcentric_user");
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
