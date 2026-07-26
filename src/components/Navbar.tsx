"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, Role } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { UserButton } from "@clerk/nextjs";
import { Button, Badge, LiquidButton, MetalButton } from "@/components/ui/shared";
import { ScaleHover, AnimatePresence } from "@/components/FramerComponents";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import {
  ShoppingBag,
  User as UserIcon,
  ChevronDown,
  LogOut,
  Sliders,
  ShieldCheck,
  Building,
  Menu,
  X,
  Trash2,
  Settings,
  Leaf,
  Plus,
  Minus,
  Search,
  Heart,
  MapPin,
  Home,
  Bell,
  Package,
  Tag,
  Sparkles,
  CheckCheck,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications";

interface NavbarSearchProps {
  onSearchComplete?: () => void;
}

function NavbarSearch({ onSearchComplete }: NavbarSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [navSearch, setNavSearch] = useState("");

  useEffect(() => {
    setNavSearch(searchParams.get("search") || "");
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearch.trim()) {
      router.push(`/marketplace?search=${encodeURIComponent(navSearch.trim())}`);
    } else {
      router.push("/marketplace");
    }
    if (onSearchComplete) {
      onSearchComplete();
    }
  };

  return (
    <form onSubmit={handleSearchSubmit} className="w-full relative">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
      <input
        type="text"
        placeholder="Search products..."
        value={navSearch}
        onChange={(e) => setNavSearch(e.target.value)}
        className="w-full bg-muted/40 hover:bg-muted/65 focus:bg-card border border-border/40 rounded-full pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
      />
    </form>
  );
}

function formatTimeAgo(dateInput: Date | string) {
  try {
    const date = new Date(dateInput);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch (e) {
    return "Recent";
  }
}

function BuyerNotificationMenu({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "ORDERS" | "OFFERS">("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const loadNotifs = async () => {
    setIsLoading(true);
    try {
      const data = await getUserNotifications(userId);
      setNotifications(data || []);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (userId) {
      loadNotifs();
    }
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleItemClick = async (notif: any) => {
    if (!notif.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
      await markNotificationAsRead(notif.id).catch(() => {});
    }
    setIsOpen(false);
    if (notif.actionUrl) {
      router.push(notif.actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllNotificationsAsRead(userId).catch(() => {});
  };

  const filteredNotifs = notifications.filter((n) => {
    const isOrderType = n.type === "ORDER" || n.title.toLowerCase().includes("order");
    const isOfferType =
      n.type === "OFFER" ||
      n.type === "DEAL" ||
      n.title.toLowerCase().includes("deal") ||
      n.title.toLowerCase().includes("offer") ||
      n.title.toLowerCase().includes("welcome");

    if (filter === "ORDERS") return isOrderType;
    if (filter === "OFFERS") return isOfferType;
    return true;
  });

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifs();
        }}
        className="relative flex flex-col items-center justify-center text-slate-500 hover:text-[#0F6E56] transition-colors cursor-pointer select-none border-none bg-transparent"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white shadow-sm animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        <span className="text-[10px] font-bold mt-1">Updates</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:right-auto sm:-left-36 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl z-50 text-left">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2 px-1">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-[#0F6E56]/10 text-[#0F6E56] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-[#0F6E56] hover:underline font-semibold flex items-center space-x-1 border-none bg-transparent cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-1 border-b border-slate-100 pb-2 mb-2">
            {(["ALL", "ORDERS", "OFFERS"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all border-none cursor-pointer ${
                  filter === tab
                    ? "bg-[#0F6E56] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab === "ALL" ? "All" : tab === "ORDERS" ? "📦 Orders" : "🏷️ Offers & Deals"}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-0.5">
            {filteredNotifs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-1">
                <Bell className="h-8 w-8 mx-auto text-slate-200" />
                <p className="text-xs font-semibold">No notifications found</p>
                <p className="text-[10px]">Check back later for order updates & eco deals!</p>
              </div>
            ) : (
              filteredNotifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                    !n.isRead
                      ? "bg-emerald-50/60 border-emerald-100 hover:bg-emerald-50"
                      : "bg-white border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-slate-100">
                      {n.title.toLowerCase().includes("cancelled") ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : n.type === "ORDER" || n.title.toLowerCase().includes("order") ? (
                        <Package className="h-4 w-4 text-[#0F6E56]" />
                      ) : n.type === "OFFER" || n.type === "DEAL" || n.title.toLowerCase().includes("deal") || n.title.toLowerCase().includes("offer") ? (
                        <Tag className="h-4 w-4 text-[#D97706]" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-[#0F6E56]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between space-x-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{n.title}</p>
                        <span className="text-[9px] text-slate-400 shrink-0">{formatTimeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">{n.message}</p>
                    </div>
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-[#0F6E56] shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cart, removeFromCart, updateQuantity, cartTotal, cartCount } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [navCategories, setNavCategories] = useState<{id: string; name: string; slug: string; productCount: number}[]>([]);

  // Fetch categories for navbar dropdown
  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(data => setNavCategories(data.categories || []))
      .catch(() => {});
  }, []);

  // Keyboard shortcut Ctrl/Cmd+K or / to open Spotlight Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      }
      if (e.key === "/") {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
          return;
        }
        e.preventDefault();
        setIsSpotlightOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/marketplace?search=${encodeURIComponent(searchTerm.trim())}`);
      setIsSpotlightOpen(false);
    }
  };

  const handleSuggestionClick = (val: string) => {
    setSearchTerm(val);
    router.push(`/marketplace?search=${encodeURIComponent(val)}`);
    setIsSpotlightOpen(false);
  };

  if (pathname?.startsWith("/seller/dashboard") || pathname?.startsWith("/admin/dashboard")) return null;

  return (
    <>

      <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white transition-colors duration-300">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
          
          {/* Logo & Location Container */}
          <div className="flex items-center space-x-6 shrink-0">
            <Logo />

            {/* Location */}
            <div className="hidden lg:flex items-center space-x-1 select-none text-left">
              <MapPin className="h-4 w-4 text-[#0F6E56] shrink-0" />
              <div className="flex flex-col text-[10px] leading-tight">
                <span className="text-slate-400 font-semibold">Deliver to</span>
                <span className="text-slate-800 font-bold">India IN</span>
              </div>
            </div>
          </div>

          {/* Integrated Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl hidden md:flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 focus-within:ring-1 focus-within:ring-[#0F6E56] focus-within:border-[#0F6E56] focus-within:bg-white transition-all shadow-inner h-10">
            <div className="flex items-center px-4 py-2 border-r border-slate-200 text-xs font-bold text-slate-500 select-none cursor-pointer bg-slate-100 hover:bg-slate-150 transition-colors h-full">
              <span>All</span>
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </div>
            <input
              type="text"
              placeholder="Search eco-friendly products, brands, categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent px-4 py-2 text-xs text-slate-800 placeholder:text-slate-450 focus:outline-none h-full"
            />
            <button type="submit" className="bg-[#0F6E56] hover:bg-[#0c5a46] text-white px-5 flex items-center justify-center transition-colors cursor-pointer border-none h-full">
              <Search className="h-4 w-4" />
            </button>
          </form>

          {/* Right Action Items */}
          <div className="flex items-center space-x-6 shrink-0">
            
            {/* Seller Dashboard Button */}
            {user?.role === "SELLER" && (
              <Link 
                href={user.sellerStatus === "APPROVED" ? "/seller/dashboard" : "/seller/verification"} 
                className="hidden md:flex items-center space-x-2 bg-[#0F6E56] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#0c5a46] transition-colors shadow-sm"
              >
                <Building className="h-4 w-4" />
                <span>Seller Dashboard</span>
              </Link>
            )}

            {/* Notification Bell (for registered buyers/users - placed between Search Bar and Wishlist) */}
            {user && (
              <BuyerNotificationMenu userId={user.id} />
            )}

            {/* Wishlist Link */}
            <Link href="/wishlist" className="hidden sm:flex flex-col items-center justify-center text-slate-500 hover:text-[#0F6E56] transition-colors cursor-pointer select-none">
              <Heart className="h-5 w-5" />
              <span className="text-[10px] font-bold mt-1">Wishlist</span>
            </Link>

            {/* User Account Dropdown */}
            {user ? (
              <div className="flex items-center space-x-3">
                <UserButton />
                
                <div className="relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex flex-col items-center justify-center text-slate-500 hover:text-[#0F6E56] transition-colors cursor-pointer select-none border-none bg-transparent"
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span className="text-[10px] font-bold mt-1 max-w-[80px] truncate">
                      {user.name.split(" ")[0]}
                    </span>
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg z-50 text-left">
                      <div className="border-b border-slate-50 px-3 py-2.5 mb-1.5">
                        <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                      </div>

                    <Link
                      href="/orders"
                      className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <Settings className="h-4 w-4 text-slate-500" />
                      <span>My Orders & Tracking</span>
                    </Link>

                    {user.role === "BUYER" && (
                      <Link
                        href="/account"
                        className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <UserIcon className="h-4 w-4" />
                        <span>My Account</span>
                      </Link>
                    )}




                    {user.role === "SELLER" && (
                      <Link
                        href={user.sellerStatus === "APPROVED" ? "/seller/dashboard" : "/seller/verification"}
                        className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <Building className="h-4 w-4" />
                        <span>{user.sellerStatus === "APPROVED" ? "Go to Dashboard" : "Seller Area"}</span>
                      </Link>
                    )}

                    {user.role === "ADMIN" && (
                      <Link
                        href="/admin/dashboard"
                        className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}

                    <button
                      onClick={() => {
                        logout();
                        setIsProfileOpen(false);
                      }}
                      className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
              <div className="flex items-center space-x-2">
                <Link href="/sign-in" className="text-xs font-bold text-slate-500 hover:text-[#0F6E56] transition-colors px-2 py-1">
                  Sign In
                </Link>
                <Link href="/sign-up" className="text-xs font-bold bg-[#0F6E56] text-white px-3 py-1.5 rounded-full hover:bg-[#0c5a46] transition-colors">
                  Sign Up
                </Link>
              </div>
            )}

            {/* Shopping Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex flex-col items-center justify-center text-slate-500 hover:text-[#0F6E56] transition-colors cursor-pointer select-none border-none bg-transparent"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0F6E56] text-[10px] font-bold text-white animate-pulse">
                  {cartCount}
                </span>
              )}
              <span className="text-[10px] font-bold mt-1">Cart</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-500 hover:text-slate-800 md:hidden cursor-pointer border-none bg-transparent"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* 2. Sub-Navbar Section (Dark Forest Green) */}
        <div className={`w-full bg-[#0c3c26] text-slate-100 text-xs py-2.5 px-4 sm:px-6 lg:px-8 shadow-md flex items-center justify-between border-t border-emerald-950 select-none whitespace-nowrap scrollbar-none ${isCategoriesOpen ? "overflow-visible" : "overflow-x-auto"}`}>
          <div className="flex items-center space-x-6">
            {/* All Categories Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                className="flex items-center space-x-2 text-white font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-xs cursor-pointer border-none"
              >
                <Menu className="h-4 w-4" />
                <span>All Categories</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${isCategoriesOpen ? "rotate-180" : ""}`} />
              </button>

              {isCategoriesOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCategoriesOpen(false)} />
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sustainable Categories</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto py-1">
                      <Link
                        href="/marketplace"
                        onClick={() => setIsCategoriesOpen(false)}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-emerald-50 transition-colors group"
                      >
                        <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700">🌿 All Products</span>
                      </Link>
                      {navCategories.map(cat => (
                        <Link
                          key={cat.id}
                          href={`/marketplace?category=${cat.slug}`}
                          onClick={() => setIsCategoriesOpen(false)}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-emerald-50 transition-colors group"
                        >
                          <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700">{cat.name}</span>
                          {cat.productCount > 0 && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{cat.productCount}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Nav links */}
            <nav className="flex items-center space-x-6 text-xs font-semibold">
              <Link href="/marketplace" className="text-white hover:text-emerald-400 transition-colors">
                Marketplace
              </Link>
              <Link href="/#verified-sellers" className="text-slate-200 hover:text-emerald-400 transition-colors">
                Verified Sellers
              </Link>
              <Link href="/marketplace?deals=true" className="text-slate-200 hover:text-emerald-400 transition-colors">
                Deals
              </Link>
              <Link href="/marketplace?newArrivals=true" className="text-slate-200 hover:text-emerald-400 transition-colors">
                New Arrivals
              </Link>
              <Link href="/#sustainability-mission" className="text-slate-200 hover:text-emerald-400 transition-colors">
                About
              </Link>
            </nav>
          </div>



        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3 shadow-md z-30 relative">
            {/* Mobile Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative pb-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-full pl-9 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400/80 focus:outline-none focus:ring-1 focus:ring-[#0F6E56]"
              />
            </form>
            <Link
              href="/marketplace"
              className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Marketplace
            </Link>
            <Link
              href="/#categories"
              className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Categories
            </Link>
            <Link
              href="/#impact-tracker"
              className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Impact Tracker
            </Link>
            <Link
              href="/#verified-sellers"
              className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Verified Sellers
            </Link>
            <Link
              href="/blog"
              className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Blog
            </Link>
            <Link
              href="/#sustainability-mission"
              className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              About
            </Link>

            {/* Mobile Account Section */}
            {user ? (
              <div className="border-t border-slate-100 pt-3 mt-3 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">My Account ({user.name.split(" ")[0]})</p>
                {user.role === "SELLER" && (
                  <Link
                    href={user.sellerStatus === "APPROVED" ? "/seller/dashboard" : "/seller/verification"}
                    className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Seller Dashboard
                  </Link>
                )}
                {user.role === "ADMIN" && (
                  <Link
                    href="/admin/dashboard"
                    className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                )}
                {user.role === "BUYER" && (
                  <Link
                    href="/seller/verification"
                    className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Become a Seller
                  </Link>
                )}
                <Link
                  href="/wishlist"
                  className="block text-base font-medium py-2 border-b border-slate-50 text-slate-800 hover:text-[#0F6E56]"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  My Wishlist
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left text-base font-medium py-2 text-red-600 hover:text-red-800 cursor-pointer border-none bg-transparent"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-100 pt-3 mt-3 space-y-2">
                <Link
                  href="/sign-in"
                  className="block text-base font-bold py-1.5 text-[#0F6E56] hover:text-[#0c5a46]"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="block text-base font-bold py-1.5 text-slate-500 hover:text-slate-700"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Spotlight Search Overlay Modal */}
      {isSpotlightOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
          {/* Backdrop blur */}
          <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setIsSpotlightOpen(false)} />
          
          {/* Spotlight Card */}
          <div className="relative w-full max-w-xl glass-panel rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[60vh] border border-[#d0c6b8]/50 dark:border-[#243b2e]/50">
            {/* Input field */}
            <form onSubmit={handleSearchSubmit} className="flex items-center border-b border-[#d0c6b8]/20 dark:border-[#243b2e]/20 px-4 py-4">
              <Search className="h-5 w-5 text-primary mr-3" />
              <input
                autoFocus
                type="text"
                placeholder="Search sustainable products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/50 font-medium"
              />
              <button 
                type="button" 
                onClick={() => setIsSpotlightOpen(false)}
                className="text-[9px] bg-muted/40 hover:bg-muted text-muted-foreground font-bold px-2 py-1 rounded border border-border/30 cursor-pointer"
              >
                ESC
              </button>
            </form>
            
            {/* Recommendations / History */}
            <div className="overflow-y-auto p-4 space-y-5 text-xs text-left">
              {/* Recent Searches */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-[#6a7b6e] uppercase tracking-wider">Recent Searches</h4>
                <div className="flex flex-wrap gap-2">
                  {["Bamboo Toothbrush", "Organic Cotton Shirt", "Solar Power Bank", "Recycled Paper Notebook"].map((item) => (
                    <button
                      key={item}
                      onClick={() => handleSuggestionClick(item)}
                      className="px-3 py-1.5 bg-muted/30 hover:bg-muted/70 text-foreground rounded-full border border-border/30 transition-all text-[11px] font-medium cursor-pointer"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Popular Categories */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-[#6a7b6e] uppercase tracking-wider">Popular Categories</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: "Zero-Waste Living", slug: "zero-waste-living" },
                    { name: "Organic Apparel", slug: "organic-apparel" },
                    { name: "Eco Home Goods", slug: "eco-home-goods" },
                    { name: "Renewable Energy", slug: "renewable-energy" }
                  ].map((cat) => (
                    <button
                      key={cat.slug}
                      onClick={() => {
                        router.push(`/marketplace?category=${cat.slug}`);
                        setIsSpotlightOpen(false);
                      }}
                      className="flex items-center space-x-2 p-2 hover:bg-muted/40 rounded-xl transition-all border border-transparent hover:border-border/20 text-[11px] font-medium text-foreground text-left cursor-pointer"
                    >
                      <span className="text-emerald-500">🌱</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* AI Search Suggestions */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-[#6a7b6e] uppercase tracking-wider">AI Search Suggestions</h4>
                <div className="space-y-1">
                  {[
                    "Carbon Neutral Biodegradable packaging",
                    "GOTS organic cotton supplier India",
                    "Upcycled reclaimed wood dining tables",
                    "Plastic-free ocean compostable replacements"
                  ].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => handleSuggestionClick(sug)}
                      className="w-full flex items-center justify-between p-2 hover:bg-muted/30 rounded-xl transition-all text-[11px] text-muted-foreground hover:text-foreground text-left font-medium cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-emerald-500 font-bold">✨</span>
                        <span>{sug}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 italic">AI Sug</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer Slide-over */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            {/* Content panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl border-l border-border/60"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
                <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <span>Shopping Cart</span>
                  {cartCount > 0 && <span className="text-xs font-medium text-muted-foreground">({cartCount} items)</span>}
                </h2>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="rounded-full p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Cart items list */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center space-y-4 py-12">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
                      <ShoppingBag className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Your cart is empty</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
                        Add certified sustainable products to start supporting ethical brands.
                      </p>
                    </div>
                    <Link href="/marketplace" onClick={() => setIsCartOpen(false)}>
                      <LiquidButton variant="default" size="lg">Shop Sustainable Goods</LiquidButton>
                    </Link>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4 border-b border-border/30 pb-4 last:border-b-0">
                      <Link href={`/products/${item.id}`} onClick={() => setIsCartOpen(false)} className="shrink-0 hover:opacity-90 transition-opacity">
                        <img
                          src={item.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"}
                          alt={item.name}
                          className="h-16 w-16 rounded-md object-cover border border-border/40 cursor-pointer"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <Link href={`/products/${item.id}`} onClick={() => setIsCartOpen(false)} className="hover:text-[#0F6E56] transition-colors truncate">
                            <h4 className="text-sm font-semibold text-foreground truncate cursor-pointer">{item.name}</h4>
                          </Link>
                          <span className="text-sm font-bold ml-2 shrink-0">₹{item.price * item.quantity}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">by {item.sellerName}</p>
                        
                        <div className="flex items-center justify-between mt-2.5">
                          {/* Quantity selector */}
                          <div className="flex items-center space-x-1.5 border border-border/60 rounded px-1 py-0.5 bg-muted/20">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1 hover:bg-muted rounded text-muted-foreground cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-semibold px-1 min-w-[16px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1 hover:bg-muted rounded text-muted-foreground cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="flex items-center space-x-3">
                            <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                              🌱 Score: {item.sustainabilityScore}
                            </Badge>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-500/5 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Checkout details footer */}
              {cart.length > 0 && (
                <div className="border-t border-border/60 bg-muted/10 px-6 py-6 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>₹{cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Eco-Shipping (Carbon Neutral)</span>
                      <span className="text-emerald-600 font-medium">FREE</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-border/30 pt-2 text-foreground">
                      <span>Grand Total</span>
                      <span>₹{cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Link href="/cart" className="w-full" onClick={() => setIsCartOpen(false)}>
                      <Button variant="cool" className="w-full">
                        View Cart
                      </Button>
                    </Link>
                    <Link href="/checkout" className="w-full" onClick={() => setIsCartOpen(false)}>
                      <LiquidButton variant="default" size="lg" className="w-full text-center flex justify-center">
                        Checkout
                      </LiquidButton>
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
