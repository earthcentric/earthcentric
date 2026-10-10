"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncUserInDb, loginUser, signupUser, logoutUser, setSellerSessionCookie, setAdminSessionCookie } from "@/actions/auth";
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
  updateUser: (data: Partial<User>) => void;
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

  // Keep Clerk identity, the database profile, and the role session in sync.
  useEffect(() => {
    if (!clerkLoaded) return;

    let cancelled = false;

    const syncClerkSession = async () => {
      await Promise.resolve();
      if (cancelled) return;

      if (!isSignedIn || !clerkUser) {
        setUser(null);
        setIsLoading(false);
        localStorage.removeItem("earthcentric_user");
        logoutUser().catch(console.error);
        return;
      }

      const email = clerkUser.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
      if (!email) {
        setUser(null);
        setIsLoading(false);
        toast.error("Your Clerk account needs a verified primary email address.");
        return;
      }

      setIsLoading(true);
      try {
        const syncResult = await syncUserInDb({
          id: clerkUser.id,
          email,
        });
        if (cancelled) return;
        if (!syncResult.success) {
          setUser(null);
          setIsLoading(false);
          localStorage.removeItem("earthcentric_user");
          toast.error(syncResult.error);
          return;
        }

        const finalUser: User = syncResult.user;

        setUser(finalUser);
        localStorage.setItem("earthcentric_user", JSON.stringify(finalUser));
        setIsLoading(false);

        const currentPath = window.location.pathname;
        const isAuthLanding =
          currentPath === "/" ||
          currentPath.startsWith("/auth/") ||
          currentPath.startsWith("/sign-in") ||
          currentPath.startsWith("/sign-up");

        if (finalUser.role === "ADMIN" && isAuthLanding) {
          router.replace("/admin/dashboard");
        } else if (finalUser.role === "SELLER" && isAuthLanding) {
          router.replace(
            finalUser.sellerStatus === "APPROVED"
              ? "/seller/dashboard"
              : "/seller/verification"
          );
        } else if (
          finalUser.role === "BUYER" &&
          finalUser.isNewUser &&
          isAuthLanding
        ) {
          const isProfileDone =
            localStorage.getItem(`earthcentric_profile_done_${finalUser.id}`) === "true";
          if (!isProfileDone) {
            router.replace("/account?tab=profile&onboarding=true");
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Error syncing Clerk user:", err);
        setUser(null);
        setIsLoading(false);
        localStorage.removeItem("earthcentric_user");
        toast.error(
          err instanceof Error
            ? err.message
            : "We couldn't load your account. Please try again or contact support."
        );
      }
    };

    void syncClerkSession();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, clerkUser, clerkLoaded, router]);

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
    if (process.env.NODE_ENV === "production") {
      toast.error("Demo role switching is disabled in production.");
      return;
    }

    setIsLoading(true);
    const updated = { ...DEMO_USERS[role] };

    if (role === "ADMIN") {
      await setAdminSessionCookie(updated.id).catch(console.error);
    } else if (role === "SELLER") {
      await setSellerSessionCookie(updated.id, "SELLER", "APPROVED").catch(console.error);
    }

    // Sync with DB
    const syncResult = await syncUserInDb({
      id: updated.id,
      email: updated.email,
    });

    const finalUser = syncResult.success ? syncResult.user : updated;
    setUser(finalUser);
    localStorage.setItem("earthcentric_user", JSON.stringify(finalUser));
    setIsLoading(false);
    
    if (role === "ADMIN") {
      router.push("/admin/dashboard");
    } else if (role === "SELLER") {
      router.push("/seller/dashboard");
    } else {
      router.push("/marketplace");
    }
  };

  const updateSellerStatus = async (status: "PENDING" | "APPROVED" | "REJECTED", badges?: string[]) => {
    if (!user) return;
    
    const updatedUser: User = {
      ...user,
      role: (status === "APPROVED" || status === "PENDING") ? ("SELLER" as Role) : user.role,
      sellerStatus: status,
      badges: status === "APPROVED" ? (badges || ["Verified Business"]) : [],
    };
    setUser(updatedUser);
    localStorage.setItem("earthcentric_user", JSON.stringify(updatedUser));
    await setSellerSessionCookie(user.id, updatedUser.role, status).catch(console.error);
  };

  const updateUser = (data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      try {
        localStorage.setItem("earthcentric_user", JSON.stringify(updated));
      } catch {}
      return updated;
    });
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
        updateUser,
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
