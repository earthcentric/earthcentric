"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Store,
  ShoppingCart,
  LogOut,
  Menu,
  X,
  Headphones,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";

const NAV_ITEMS = [
  {
    name: "Overview",
    href: "/worker/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "New Buyers",
    href: "/worker/buyers",
    icon: Users,
  },
  {
    name: "New Sellers",
    href: "/worker/sellers",
    icon: Store,
  },
  {
    name: "Abandoned Checkouts",
    href: "/worker/abandoned-checkouts",
    icon: ShoppingCart,
  },
];

export function WorkerSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-10" />
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role Badge */}
      <div className="px-5 py-3 bg-[#0F6E56]/5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="h-4 w-4 text-[#0F6E56]" />
          <span className="text-xs font-bold text-[#0F6E56]">Calling Executive Portal</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0F6E56] text-white">
          Active
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <p className="px-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
          Customer Management
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-[#0F6E56] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#0F6E56]/10 text-[#0F6E56] flex items-center justify-center font-bold text-xs">
            {user?.name ? user.name[0].toUpperCase() : "W"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">
              {user?.name || "Feedback Executive"}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {user?.email || "bluegamer355@gmail.com"}
            </p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors border border-red-100 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo className="h-8" />
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0F6E56]/10 text-[#0F6E56]">
          Feedback Portal
        </span>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/40 z-50 backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 w-64 z-50 transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
