"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getPendingSellers, approveSeller, rejectSeller, getPlatformStats, PlatformStats, getDisputes, resolveDispute, DisputeCase, getAllSellersRevenue, SellerRevenueInfo, getAdminAnalyticsTimeSeries, getPlatformUsers, UserManagementData, getPendingProducts, approveProduct, rejectProduct, getAdminTransactions, getBuyerProfileById, updateSellerVerificationStatus, updateSellerTrustScore, getPendingDiscounts, approveDiscount, rejectDiscount } from "@/actions/admin";
import { getAdminPayoutRequests, settlePayoutRequest, PayoutRequestInfo } from "@/actions/payouts";
import { getAllOrdersForAdmin, updateOrderStatus, trackOrderById } from "@/actions/orders";
import { SellerProfile } from "@/actions/sellers";
import { getAdminNotifications, markNotificationAsRead } from "@/actions/notifications";
import { getIntegrationCredentials, updateIntegrationCredential, CredentialItem } from "@/actions/credentials";
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableCell, TableHead, Input, LiquidButton, Label, Textarea } from "@/components/ui/shared";
import { FadeIn, ScaleHover } from "@/components/FramerComponents";
import { AdminAnalyticsCharts, AdminAnalyticsData } from "@/components/ui/admin-analytics-charts";
import { AdminSellerDetailModal } from "@/components/ui/admin-seller-detail-modal";
import { AdminBuyerDetailModal } from "@/components/ui/admin-buyer-detail-modal";
import { AdminProductDetailModal } from "@/components/ui/admin-product-detail-modal";
import { AdminMessagesView } from "@/components/admin/AdminMessagesView";
import { getUnreadMessageCount } from "@/actions/messages";
import { Logo } from "@/components/Logo";
import {
  ShieldAlert,
  FileCheck,
  Check,
  BarChart4,
  AlertCircle,
  Coins,
  CheckCircle2,
  LayoutDashboard,
  Users,
  PackageCheck,
  ShoppingBag,
  Wallet,
  Leaf,
  Award,
  Bell,
  Search,
  HelpCircle,
  TrendingUp,
  Activity,
  X,
  Eye,
  EyeOff,
  Key,
  Settings,
  LogOut,
  ChevronDown,
  DollarSign,
  Menu,
  Mail,
  Calendar,
  Phone,
} from "lucide-react";

// Mock User Data for User Management View
const MOCK_USERS = [
  { id: "seller-1", name: "Shiva Teja", email: "bluegamer355@gmail.com", phone: "8121143399", role: "Seller", joinedDate: "11 Jun 2026", orders: "No orders placed yet" },
  { id: "seller-2", name: "Shiva Teja Yadav", email: "imshivateja082@gmail.com", phone: "8639096121", role: "Seller", joinedDate: "10 Jun 2026", orders: "No orders placed yet" },
];

// Mock Product Data for Product Approval View
const MOCK_PRODUCTS = [
  { sku: "PROD-8321", name: "Biodegradable Bamboo Straws Pack", seller: "GreenLeaf Organics", category: "Disposables", price: 199, claims: "100% organic bamboo, zero-plastic packaging, chemical-free processing" },
  { sku: "PROD-7910", name: "Recycled Waste Paper Notebook Set", seller: "EcoKraft India", category: "Stationery", price: 249, claims: "Made from 100% post-consumer waste paper, organic soy-based inks" },
  { sku: "PROD-6812", name: "Organic Jute Wine Tote Bags", seller: "Bangalore Jute Crafts", category: "Bags", price: 399, claims: "Sustainable plant fiber, natural vegetable dyes, heavy-duty stitching" },
  { sku: "PROD-6815", name: "Handcrafted Coconut Shell Bowls", seller: "Kerala Naturals", category: "Home Goods", price: 499, claims: "Upcycled natural coconut shells, food-safe polish" },
];

// Mock Order Transactions
const MOCK_TRANSACTIONS = [
  { id: "TXN-93284", orderId: "EC-ORD-4729", amount: 598, method: "UPI / Cashfree", commission: 59.8, status: "Success", date: "12/06/2026" },
  { id: "TXN-93212", orderId: "EC-ORD-4610", amount: 599, method: "NetBanking", commission: 59.9, status: "Success", date: "11/06/2026" },
  { id: "TXN-93041", orderId: "EC-ORD-4521", amount: 1347, method: "Credit Card", commission: 134.7, status: "Success", date: "10/06/2026" },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AdminAnalyticsData | null>(null);
  const [pendingSellers, setPendingSellers] = useState<SellerProfile[]>([]);
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);
  const [sellerRevenues, setSellerRevenues] = useState<SellerRevenueInfo[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestInfo[]>([]);
  const [usersData, setUsersData] = useState<UserManagementData | null>(null);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [pendingDiscounts, setPendingDiscounts] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [globalSearch, setGlobalSearch] = useState("");
  // Date filter state
  const [filterType, setFilterType] = useState<"overall" | "daily" | "monthly" | "yearly">("overall");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [messagesUnreadCount, setMessagesUnreadCount] = useState<number>(0);

  const loadAdminData = async () => {
    setLoading(true);
    const s = await getPlatformStats(filterType, selectedDate, selectedMonth, selectedYear);
    setStats(s);

    const aData = await getAdminAnalyticsTimeSeries();
    setAnalyticsData(aData as AdminAnalyticsData);

    const sellers = await getPendingSellers();
    setPendingSellers(sellers);

    const cases = await getDisputes();
    setDisputes(cases);

    const revs = await getAllSellersRevenue();
    setSellerRevenues(revs);

    const reqs = await getAdminPayoutRequests();
    setPayoutRequests(reqs);

    const uData = await getPlatformUsers();
    setUsersData(uData);

    const pProds = await getPendingProducts();
    setPendingProducts(pProds);

    const pDisc = await getPendingDiscounts();
    setPendingDiscounts(pDisc);

    const orders = await getAllOrdersForAdmin();
    setAllOrders(orders);

    const txns = await getAdminTransactions();
    console.log("AdminDashboard got txns:", txns);
    setTransactions(txns);

    const notifs = await getAdminNotifications();
    setNotifications(notifs);

    const creds = await getIntegrationCredentials();
    setCredentials(creds);

    const unreadMsgs = await getUnreadMessageCount("admin-1");
    setMessagesUnreadCount(unreadMsgs);

    setLoading(false);
  };

  useEffect(() => {
    loadAdminData();
  }, [filterType, selectedDate, selectedMonth, selectedYear]);

  // Poll unread messages count every 3 seconds for dynamic badge updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const unreadMsgs = await getUnreadMessageCount("admin-1");
        setMessagesUnreadCount(unreadMsgs);
      } catch (e) {
        console.error("Error polling admin unread count:", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5f3]">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 border-4 border-[#1e3425] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-[#1e3425]">Loading Administrator Console...</p>
        </div>
      </div>
    );
  }

  // If role is not admin, show warning
  if (user?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md py-24 text-center space-y-4 bg-[#f4f5f3] min-h-screen">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">
          You must have the role of **ADMIN** to view the supervisor console. Please sign in with an Administrator account.
        </p>
      </div>
    );
  }

  // Helper for Sidebar links
  const SidebarLink = ({ icon: Icon, label, value, badge }: any) => {
    const isActive = activeTab === value;
    return (
      <button
        onClick={() => {
          setActiveTab(value);
          setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center justify-between px-6 py-2.5 text-xs font-semibold transition-colors duration-200 ${
          isActive
            ? "bg-[#2d4a36] text-white border-l-4 border-emerald-400"
            : "text-[#8ca193] hover:bg-[#25422d] hover:text-white border-l-4 border-transparent"
        }`}
      >
        <div className="flex items-center space-x-3">
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#f1f4f2] text-foreground overflow-hidden font-sans">
      {/* Mobile Sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-25 md:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
      
      {/* --------------------------------------------------------------------------
          LEFT SIDEBAR
          -------------------------------------------------------------------------- */}
      <aside className={`fixed inset-y-0 left-0 w-[260px] bg-[#1a3321] text-white flex flex-col h-full shrink-0 z-30 shadow-xl overflow-y-auto transition-transform duration-300 md:translate-x-0 md:static ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-white/5 shrink-0">
          <Logo light />
        </div>

        {/* Profile Card */}
        <div className="px-6 py-6 border-b border-white/5">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-inner">
              SA
            </div>
            <div>
              <p className="text-sm font-bold text-white">Super Admin</p>
              <p className="text-[9px] text-[#8ca193] uppercase tracking-wider font-semibold">Administrator</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-6 space-y-8">
          
          <div className="space-y-1">
            <p className="px-6 text-[10px] font-bold text-[#627d6a] uppercase tracking-wider mb-2">Overview</p>
            <SidebarLink icon={LayoutDashboard} label="Dashboard" value="dashboard" />
            <SidebarLink icon={BarChart4} label="Analytics" value="analytics" />
          </div>

          <div className="space-y-1">
            <p className="px-6 text-[10px] font-bold text-[#627d6a] uppercase tracking-wider mb-2">Management</p>
            <SidebarLink icon={ShieldAlert} label="Seller Verification" value="sellers" />
            <SidebarLink icon={Users} label="User Management" value="users" />
            <SidebarLink icon={PackageCheck} label="Product Approval" value="products" />
            <SidebarLink icon={Coins} label="Discount Approval" value="discounts" badge={pendingDiscounts.filter((d: any) => d.discount?.status === "PENDING").length} />
            <SidebarLink icon={Mail} label="Messages" value="messages" badge={messagesUnreadCount} />
            <SidebarLink icon={ShoppingBag} label="Order Management" value="orders" />
            <SidebarLink icon={Wallet} label="Payments" value="payments" />
            <SidebarLink icon={AlertCircle} label="Disputes" value="disputes" />
          </div>

          <div className="space-y-1">
            <p className="px-6 text-[10px] font-bold text-[#627d6a] uppercase tracking-wider mb-2">System Config</p>
            <SidebarLink icon={Key} label="Credentials Manager" value="credentials" />
          </div>

        </div>
        
        {/* Footer Area */}
        <div className="p-4 border-t border-white/5">
          <button onClick={() => { setIsSidebarOpen(false); logout(); }} className="flex items-center space-x-2 text-xs font-semibold text-[#8ca193] hover:text-red-400 transition-colors w-full px-2 py-2 cursor-pointer border-none bg-transparent">
            <LogOut className="h-4 w-4" />
            <span>Logout System</span>
          </button>
        </div>
      </aside>

      {/* --------------------------------------------------------------------------
          MAIN CONTENT AREA
          -------------------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Sticky Top Header */}
        <header className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-8 bg-white shadow-sm z-10">
          <div className="flex items-center flex-1 mr-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 text-slate-500 hover:text-slate-800 md:hidden border-none bg-transparent cursor-pointer mr-3 flex items-center justify-center"
              aria-label="Toggle Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1 max-w-md relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full bg-[#f4f5f3] hover:bg-[#e9ece6] focus:bg-[#e9ece6] border-none rounded-full pl-10 pr-4 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Notifications Popover */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="text-muted-foreground hover:text-foreground relative h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>

              {showNotifDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifDropdown(false)} />
                  <Card className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-card border border-border/60 rounded-xl shadow-2xl z-50 p-4 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-border/60">
                      <h4 className="font-bold text-xs text-[#1a3321]">Recent Notifications ({notifications.filter(n => !n.isRead).length})</h4>
                      {notifications.filter(n => !n.isRead).length > 0 && (
                        <button 
                          className="text-[10px] text-primary font-semibold hover:underline"
                          onClick={async () => {
                            for (const n of notifications) {
                              if (!n.isRead) await markNotificationAsRead(n.id);
                            }
                            loadAdminData();
                          }}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {notifications.length === 0 ? (
                        <p className="text-[10px] text-center text-muted-foreground py-6">No new updates found.</p>
                      ) : (
                        notifications.map((n) => (
                          <div 
                            key={n.id} 
                            onClick={async () => {
                              if (!n.isRead) {
                                await markNotificationAsRead(n.id);
                              }
                              setShowNotifDropdown(false);
                              if (n.redirectSection && n.redirectSection.includes("tab=")) {
                                const tab = n.redirectSection.split("tab=")[1];
                                setActiveTab(tab);
                              } else {
                                setActiveTab(n.redirectSection);
                              }
                              loadAdminData();
                            }}
                            className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                              n.isRead 
                                ? "bg-slate-50/50 border-slate-100 hover:bg-slate-50" 
                                : "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/50 font-medium"
                            }`}
                          >
                            <p className="text-[11px] font-bold text-[#1a3321]">{n.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                            <p className="text-[9px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </>
              )}
            </div>
            <button className="text-muted-foreground hover:text-foreground">
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="h-6 w-px bg-border mx-2"></div>
            <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80">
              <div className="h-7 w-7 rounded-full bg-[#1a3321] text-white font-bold flex items-center justify-center text-[10px]">SA</div>
              <span className="text-xs font-semibold hidden sm:inline">Super Admin</span>
            </div>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          <FadeIn key={activeTab}>
            {activeTab === "dashboard" && <DashboardView 
                stats={stats} 
                analyticsData={analyticsData} 
                pendingSellers={pendingSellers}
                filterType={filterType}
                setFilterType={setFilterType}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
              />}
            {activeTab === "sellers" && <SellerApprovalsView pendingSellers={pendingSellers} reload={loadAdminData} onInspectSeller={setSelectedSellerId} globalSearch={globalSearch} />}
            {activeTab === "users" && <UserManagementView usersData={usersData} onInspectSeller={setSelectedSellerId} onInspectBuyer={setSelectedBuyerId} globalSearch={globalSearch} />}
            {activeTab === "products" && <ProductApprovalView pendingProducts={pendingProducts} approvedToday={stats?.approvedToday} rejectedToday={stats?.rejectedToday} reload={loadAdminData} adminEmail={user?.email} globalSearch={globalSearch} />}
            {activeTab === "discounts" && <DiscountApprovalView pendingDiscounts={pendingDiscounts} reload={loadAdminData} globalSearch={globalSearch} />}
            {activeTab === "messages" && <AdminMessagesView onViewSellerProfile={(sId) => setSelectedSellerId(sId)} />}
            {activeTab === "payments" && <PaymentsView payoutRequests={payoutRequests} transactions={transactions} onActionComplete={loadAdminData} adminEmail={user?.email} globalSearch={globalSearch} />}
            {activeTab === "disputes" && <DisputesView disputes={disputes} onResolve={loadAdminData} adminEmail={user?.email} />}
            {activeTab === "analytics" && <AdminAnalyticsCharts data={analyticsData!} />}
            {activeTab === "orders" && <OrderManagementView orders={allOrders} onUpdateStatus={loadAdminData} globalSearch={globalSearch} />}
            {activeTab === "credentials" && <CredentialsManagerView credentials={credentials} reload={loadAdminData} globalSearch={globalSearch} />}
          </FadeIn>
        </main>
      </div>

      {selectedSellerId && (
        <AdminSellerDetailModal 
          sellerId={selectedSellerId} 
          onClose={() => setSelectedSellerId(null)} 
          adminEmail={user?.email}
          onActionComplete={loadAdminData}
        />
      )}

      {selectedBuyerId && (
        <AdminBuyerDetailModal 
          buyerId={selectedBuyerId} 
          onClose={() => setSelectedBuyerId(null)} 
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// DASHBOARD VIEW
// --------------------------------------------------------------------------
function DashboardView({ 
  stats, 
  analyticsData, 
  pendingSellers,
  filterType, setFilterType,
  selectedDate, setSelectedDate,
  selectedMonth, setSelectedMonth,
  selectedYear, setSelectedYear
}: any) {
  const [revenuePeriod, setRevenuePeriod] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [showRevenueDropdown, setShowRevenueDropdown] = useState(false);

  let chartData = [];
  if (revenuePeriod === "daily") {
    chartData = analyticsData?.daily?.income?.slice(0, 7).reverse() || [];
  } else if (revenuePeriod === "yearly") {
    chartData = analyticsData?.yearly?.income?.slice(0, 5).reverse() || [];
  } else {
    chartData = analyticsData?.monthly?.income?.slice(0, 6).reverse() || [];
  }
  
  return (
    <div className="space-y-6">
      {/* Title & Global Date Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a3321] flex items-center space-x-2">
            <span>Admin Dashboard</span>
            <span className="text-xl">📊</span>
          </h1>
          <p className="text-[10px] text-muted-foreground font-semibold mt-1 flex items-center space-x-1 uppercase tracking-wider">
            <span>EarthCentric</span> <span className="mx-1">{">"}</span> <span>Super Admin</span> <span className="mx-1">{">"}</span> <span className="text-[#1a3321]">Dashboard</span>
          </p>
        </div>

        {/* Global Date Analytics & Inventory Filter Control */}
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-[#e9ece6] flex items-center justify-between gap-3 shrink-0">
          <div className="hidden sm:flex items-center space-x-2 mr-2">
            <div className="h-7 w-7 bg-[#e8f3ec] text-[#2d4a36] rounded-lg flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-[#1a3321] leading-tight">Analytics & Inventory Date Filter</h4>
              <p className="text-[9px] text-muted-foreground leading-tight">Filter statistics, revenue, and product inventory by date range</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#f4f5f3] text-[11px] font-bold text-[#1a3321] px-2.5 py-1.5 rounded-xl border border-[#d8dcd3] outline-none cursor-pointer focus:ring-2 focus:ring-emerald-700"
            >
              <option value="overall">Overall (Lifetime)</option>
              <option value="daily">Daily View</option>
              <option value="monthly">Monthly View</option>
              <option value="yearly">Yearly View</option>
            </select>

            {filterType === "daily" && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white text-[11px] font-semibold text-[#1a3321] px-2 py-1.5 rounded-lg border border-[#d8dcd3] outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer"
              />
            )}
            {filterType === "monthly" && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white text-[11px] font-semibold text-[#1a3321] px-2 py-1.5 rounded-lg border border-[#d8dcd3] outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer"
              />
            )}
            {filterType === "yearly" && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-white text-[11px] font-semibold text-[#1a3321] px-2 py-1.5 rounded-lg border border-[#d8dcd3] outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer"
              >
                {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Top KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-[#e8f3ec] text-emerald-600 rounded-md flex items-center justify-center"><DollarSign className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold">Total Revenue</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1a3321]">₹{(stats?.totalRevenue ?? 0).toLocaleString()}</h3>
            <Badge className="bg-[#e8f3ec] text-emerald-700 hover:bg-[#e8f3ec] border-none text-[9px] px-1.5 py-0 mt-1">↑ {stats?.totalRevenue ? "18.4%" : "0%"}</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-[#e8f0f4] text-blue-600 rounded-md flex items-center justify-center"><Users className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold">Total Orders</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1a3321]">{stats?.totalOrders ?? 0}</h3>
            <Badge className="bg-[#e8f3ec] text-emerald-700 hover:bg-[#e8f3ec] border-none text-[9px] px-1.5 py-0 mt-1">↑ {stats?.totalOrders ? "12.1%" : "0%"}</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-amber-50 text-amber-600 rounded-md flex items-center justify-center"><Users className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold">Total Sellers</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1a3321]">{stats?.totalSellers ?? 0}</h3>
            <Badge className="bg-[#e8f3ec] text-emerald-700 hover:bg-[#e8f3ec] border-none text-[9px] px-1.5 py-0 mt-1">↑ {stats?.totalSellers ? "8.3%" : "0%"}</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-purple-50 text-purple-600 rounded-md flex items-center justify-center"><ShoppingBag className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold">Total Products</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1a3321]">{stats?.totalProducts ?? 0}</h3>
            <Badge className="bg-[#e8f3ec] text-emerald-700 hover:bg-[#e8f3ec] border-none text-[9px] px-1.5 py-0 mt-1">↑ {stats?.totalProducts ? "22%" : "0%"}</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center"><Users className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold">Total Buyers</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1a3321]">{stats?.totalBuyers ?? 0}</h3>
          </div>
        </Card>

        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-rose-50 text-rose-600 rounded-md flex items-center justify-center"><AlertCircle className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold whitespace-nowrap">Pending Approvals</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-rose-600">{stats?.pendingApprovals ?? pendingSellers.length}</h3>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-[9px] px-1.5 py-0 mt-1">NEEDS REVIEW</Badge>
          </div>
        </Card>

      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Revenue Overview Chart */}
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-[#1a3321]">Revenue Overview</h3>
              <p className="text-[10px] text-muted-foreground">Revenue in ₹ Lakhs</p>
            </div>
            <div className="relative">
              <div 
                onClick={() => setShowRevenueDropdown(!showRevenueDropdown)}
                className="bg-[#f4f5f3] px-3 py-1.5 rounded-full flex items-center space-x-2 cursor-pointer hover:bg-[#e9ece6] transition-colors"
              >
                <span className="text-[10px] font-bold text-[#1a3321]">
                  {revenuePeriod === "daily" ? "This Week" : revenuePeriod === "monthly" ? "This Year" : "All Time"}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </div>
              
              {showRevenueDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRevenueDropdown(false)} />
                  <Card className="absolute right-0 mt-2 w-32 bg-card border border-border/60 rounded-xl shadow-xl z-50 overflow-hidden">
                    <button 
                      onClick={() => { setRevenuePeriod("daily"); setShowRevenueDropdown(false); }}
                      className={`w-full text-left px-4 py-2 text-[10px] font-medium transition-colors ${revenuePeriod === "daily" ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-50 text-muted-foreground"}`}
                    >This Week</button>
                    <button 
                      onClick={() => { setRevenuePeriod("monthly"); setShowRevenueDropdown(false); }}
                      className={`w-full text-left px-4 py-2 text-[10px] font-medium transition-colors ${revenuePeriod === "monthly" ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-50 text-muted-foreground"}`}
                    >This Year</button>
                    <button 
                      onClick={() => { setRevenuePeriod("yearly"); setShowRevenueDropdown(false); }}
                      className={`w-full text-left px-4 py-2 text-[10px] font-medium transition-colors ${revenuePeriod === "yearly" ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-50 text-muted-foreground"}`}
                    >All Time</button>
                  </Card>
                </>
              )}
            </div>
          </div>
          
          {/* Custom Bar Chart to match screenshot precisely */}
          <div className="h-64 w-full flex items-end justify-between px-4 pb-6 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full h-px border-b border-dashed border-[#e9ece6]"></div>
              ))}
            </div>
            
            {/* Bars */}
            {(() => {
              let monthsData = [];
              if (analyticsData) {
                if (revenuePeriod === "daily") {
                  monthsData = analyticsData.daily.income.slice(-5);
                } else if (revenuePeriod === "monthly") {
                  monthsData = analyticsData.monthly.income.slice(-5);
                } else {
                  monthsData = analyticsData.yearly.income.slice(-5);
                }
              } else {
                monthsData = [
                  { name: 'Jan', income: 0 },
                  { name: 'Feb', income: 0 },
                  { name: 'Mar', income: 0 },
                  { name: 'Apr', income: 0 },
                  { name: 'May', income: 0 },
                ];
              }

              const maxAmount = Math.max(...monthsData.map((m: any) => m.income), 1);
              return monthsData.map((bar: any, i: number) => {
                const heightPercent = bar.income > 0 ? `${(bar.income / maxAmount) * 100}%` : '0%';
                const displayVal = bar.income > 0 ? `₹${bar.income >= 100000 ? (bar.income / 100000).toFixed(1) + 'L' : bar.income.toLocaleString()}` : '₹0';
                return (
                  <div key={i} className="flex flex-col items-center z-10 w-[12%]">
                    <span className="text-[10px] font-bold text-muted-foreground mb-2">{displayVal}</span>
                    <div 
                      className="w-full rounded-t-sm transition-all duration-500"
                      style={{ 
                        height: `calc(${heightPercent} * 2.2)`, 
                        background: 'linear-gradient(to bottom, #1a3321, #0ea5e9)'
                      }}
                    />
                    <span className="text-[9px] font-semibold text-muted-foreground mt-3">{bar.name}</span>
                  </div>
                );
              });
            })()}
          </div>
        </Card>

        {/* Platform Health */}
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl lg:col-span-1 flex flex-col">
          <h3 className="text-sm font-bold text-[#1a3321] mb-6">Platform Health</h3>
          <div className="space-y-6 flex-1">
            
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Order Success Rate</span>
                <span className="text-[#1a3321]">{stats?.orderSuccessRate ?? 0}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats?.orderSuccessRate ?? 0}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Seller Approval Rate</span>
                <span className="text-[#1a3321]">{stats?.sellerApprovalRate ?? 0}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${stats?.sellerApprovalRate ?? 0}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Customer Satisfaction</span>
                <span className="text-[#1a3321]">{stats?.customerSatisfaction ?? 0} / 5</span>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${((stats?.customerSatisfaction ?? 0) / 5) * 100}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Eco Certified Products</span>
                <span className="text-[#1a3321]">{stats?.ecoCertifiedRate ?? 0}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats?.ecoCertifiedRate ?? 0}%` }} />
              </div>
            </div>

          </div>
        </Card>
      </div>

    </div>
  );
}

// --------------------------------------------------------------------------
// SELLER APPROVALS VIEW
// --------------------------------------------------------------------------
function SellerApprovalsView({ pendingSellers, reload, onInspectSeller, globalSearch }: any) {
  const displaySellers = globalSearch 
    ? pendingSellers.filter((s: any) => 
        s.companyName?.toLowerCase().includes(globalSearch.toLowerCase()) || 
        s.user?.email?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        s.id?.toLowerCase().includes(globalSearch.toLowerCase())
      ) 
    : pendingSellers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Seller Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and manage seller verification records.</p>
      </div>

      <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Business / Applicant</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Contact</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Applied On</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Status</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displaySellers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground">
                  No seller verification records found.
                </TableCell>
              </TableRow>
            ) : (
              displaySellers.map((seller: any, i: number) => (
                <TableRow key={i} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                  <TableCell className="py-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-[#f4f5f3] rounded border border-[#e9ece6] flex items-center justify-center text-[#8ca193]">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1a3321]">{seller.companyName}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center"><Users className="h-2.5 w-2.5 mr-1" /> {seller.userName || seller.user?.name || seller.founderName || seller.ownerName || "Applicant"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="space-y-1 text-xs">
                      <p className="text-muted-foreground flex items-center">
                        <Mail className="h-3 w-3 mr-1.5 text-[#8ca193]" />
                        {seller.user?.email || seller.email || "N/A"}
                      </p>
                      <p className="text-muted-foreground flex items-center">
                        <Phone className="h-3 w-3 mr-1.5 text-[#8ca193]" />
                        {seller.phone || seller.user?.phone || seller.contact || "N/A"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="space-y-1 text-xs">
                      <p className="text-muted-foreground flex items-center" title="Request Submitted Date">
                        <Calendar className="h-3 w-3 mr-1.5 text-[#8ca193]" />
                        <span className="font-semibold text-[#1a3321]">Applied:</span>&nbsp;
                        {seller.appliedOn || (seller.createdAt ? new Date(seller.createdAt).toLocaleDateString("en-US") : new Date().toLocaleDateString("en-US"))}
                      </p>
                      <p className="text-muted-foreground flex items-center" title="Approved Date">
                        <CheckCircle2 className="h-3 w-3 mr-1.5 text-emerald-600" />
                        <span className="font-semibold text-[#1a3321]">Approved:</span>&nbsp;
                        {seller.verifiedAt
                          ? new Date(seller.verifiedAt).toLocaleDateString("en-US")
                          : seller.verificationStatus === "APPROVED" || seller.status === "VERIFIED"
                          ? (seller.createdAt ? new Date(seller.createdAt).toLocaleDateString("en-US") : new Date().toLocaleDateString("en-US"))
                          : "Pending"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    {seller.verificationStatus === "APPROVED" || seller.status === "VERIFIED" ? (
                      <Badge className="bg-[#e8f3ec] text-emerald-700 border-none text-[9px] hover:bg-[#e8f3ec]"><CheckCircle2 className="h-3 w-3 mr-1 inline-block" /> VERIFIED</Badge>
                    ) : seller.verificationStatus === "REJECTED" || seller.status === "REJECTED" ? (
                      <Badge className="bg-rose-50 text-rose-700 border-none text-[9px] hover:bg-rose-50"><X className="h-3 w-3 mr-1 inline-block" /> REJECTED</Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-700 border-none text-[9px] hover:bg-amber-50"><AlertCircle className="h-3 w-3 mr-1 inline-block" /> PENDING</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    {seller.verificationStatus === "PENDING" || seller.status === "PENDING" ? (
                      <Button variant="outline" className="text-xs text-[#1a3321] border-[#1a3321]/30 hover:bg-[#f4f5f3] px-3 h-8" onClick={() => onInspectSeller(seller.id || seller.userId)}><Eye className="h-3 w-3 mr-1.5" /> Review</Button>
                    ) : (
                      <Button variant="ghost" className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 h-8 font-semibold" onClick={() => onInspectSeller(seller.id || seller.userId)}>View Record</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------
// USER MANAGEMENT VIEW
// --------------------------------------------------------------------------
function UserManagementView({ usersData, onInspectSeller, onInspectBuyer, globalSearch }: any) {
  let displayData = usersData || {
    totalUsers: 4,
    totalOrdersBooked: 3,
    totalRevenue: 6097,
    users: MOCK_USERS
  };

  if (globalSearch && displayData.users) {
    displayData = {
      ...displayData,
      users: displayData.users.filter((u: any) => 
        u.name?.toLowerCase().includes(globalSearch.toLowerCase()) || 
        u.email?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        u.role?.toLowerCase().includes(globalSearch.toLowerCase())
      )
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321] flex items-center space-x-2">
          <Users className="h-6 w-6 text-blue-500" />
          <span>User Management</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">View and manage all registered users and their recent order history.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider mb-2">Total Users</p>
          <h3 className="text-3xl font-black text-[#1a3321]">{displayData.totalUsers}</h3>
        </Card>
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider mb-2">Total Buyers</p>
          <h3 className="text-3xl font-black text-[#1a3321]">{displayData.users.filter((u: any) => u.role === "BUYER").length}</h3>
        </Card>
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider mb-2">Total Sellers</p>
          <h3 className="text-3xl font-black text-[#1a3321]">{displayData.users.filter((u: any) => u.role === "SELLER").length}</h3>
        </Card>
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider mb-2">Orders Booked</p>
          <h3 className="text-3xl font-black text-[#1a3321]">{displayData.totalOrdersBooked}</h3>
        </Card>
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider mb-2">Total Revenue</p>
          <h3 className="text-3xl font-black text-[#1a3321]">₹{displayData.totalRevenue.toLocaleString()}</h3>
        </Card>
      </div>

      <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden mt-8">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">User Details</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Role</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Order History</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Joined Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.users.map((u: any) => (
              <TableRow key={u.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                <TableCell className="py-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-blue-50 text-blue-600 font-bold rounded-full flex items-center justify-center text-xs uppercase">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1a3321]">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                      <p className="text-[10px] text-muted-foreground">{u.phone}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[9px] hover:bg-amber-50 px-2 py-0.5 shadow-none font-semibold"><ShoppingBag className="h-2.5 w-2.5 mr-1" /> {u.role}</Badge>
                </TableCell>
                <TableCell className="py-4">
                  <p className="text-xs text-muted-foreground">{u.orders}</p>
                </TableCell>
                <TableCell className="py-4 text-right pr-6 text-xs text-muted-foreground space-x-4">
                  <span><LayoutDashboard className="h-3 w-3 mr-1.5 opacity-50 inline" /> {u.joinedDate}</span>
                  {u.role === "SELLER" ? (
                    <Button variant="ghost" className="text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 h-7" onClick={() => onInspectSeller(u.id)}>Inspect Seller</Button>
                  ) : (
                    <Button variant="ghost" className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 h-7" onClick={() => onInspectBuyer(u.id)}>Inspect Buyer</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRODUCT APPROVALS VIEW
// --------------------------------------------------------------------------
function ProductApprovalView({ pendingProducts, approvedToday = 0, rejectedToday = 0, reload, adminEmail, globalSearch }: { pendingProducts: any[], approvedToday?: number, rejectedToday?: number, reload: () => void, adminEmail?: string, globalSearch?: string }) {
  const displayProducts = globalSearch
    ? pendingProducts.filter((p: any) => 
        p.name?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        p.seller?.companyName?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        p.category?.name?.toLowerCase().includes(globalSearch.toLowerCase())
      )
    : pendingProducts;

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [allCategories, setAllCategories] = useState<{id: string; name: string; slug: string}[]>([]);
  const [inspectProductId, setInspectProductId] = useState<string | null>(null);

  // Fetch categories when component mounts
  React.useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(data => setAllCategories(data.categories || []))
      .catch(() => setAllCategories([]));
  }, []);

  const handleApproveClick = (p: any) => {
    setApproveId(p.id);
    setSelectedCategoryId(p.categoryId || "");
  };

  const handleApproveConfirm = async () => {
    if (!approveId) return;
    await approveProduct(approveId, adminEmail || "admin@earthcentric.com", selectedCategoryId || undefined);
    setApproveId(null);
    setSelectedCategoryId("");
    reload();
  };

  const handleReject = async () => {
    if (!rejectId) return;
    await rejectProduct(rejectId, rejectReason || "Product claims do not meet sustainable standards.", adminEmail || "admin@earthcentric.com");
    setRejectId(null);
    setRejectReason("");
    reload();
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Product Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Review newly submitted catalog items for sustainable verification compliance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-4 bg-white border border-amber-100 shadow-sm rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider mb-1">Pending Review</p>
            <h3 className="text-xl font-bold text-amber-600">{displayProducts.length} items</h3>
          </div>
          <div className="h-10 w-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center"><AlertCircle className="h-5 w-5" /></div>
        </Card>
        <Card className="p-4 bg-white border border-emerald-100 shadow-sm rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider mb-1">Approved Today</p>
            <h3 className="text-xl font-bold text-emerald-600">{approvedToday} items</h3>
          </div>
          <div className="h-10 w-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center"><CheckCircle2 className="h-5 w-5" /></div>
        </Card>
        <Card className="p-4 bg-white border border-rose-100 shadow-sm rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider mb-1">Rejected Today</p>
            <h3 className="text-xl font-bold text-rose-600">{rejectedToday} items</h3>
          </div>
          <div className="h-10 w-10 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center"><X className="h-5 w-5" /></div>
        </Card>
      </div>

      <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden mt-8">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Product Details</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Seller / Brand</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Category</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Retail Price</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Wholesale Price</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">MOQ</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 w-48">Sustainability Claims</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Compliance Status</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                  No products pending sustainable verification review.
                </TableCell>
              </TableRow>
            ) : (
              displayProducts.map((p: any) => (
                <TableRow key={p.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                  <TableCell className="py-4">
                    <div className="flex items-center space-x-3">
                      <img src={p.images[0] || "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=100"} className="h-8 w-8 rounded object-cover" />
                      <div>
                        <p className="text-xs font-bold text-[#1a3321]">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">ID: {p.id.substring(0, 8)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs text-[#1a3321] font-semibold">{p.seller.companyName}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs text-[#8ca193] font-semibold">{p.category}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs font-black text-[#1a3321]">₹{p.price}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs font-bold text-amber-700">{p.wholesalePrice ? `₹${p.wholesalePrice}` : "N/A"}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs font-semibold text-muted-foreground">{p.moq ? `${p.moq} units` : "1 unit"}</p>
                  </TableCell>
                  <TableCell className="py-4">
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge className="bg-amber-100 text-amber-800 border-none text-[9px]"><AlertCircle className="h-2.5 w-2.5 mr-1" /> Pending review</Badge>
                  </TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    <div className="flex items-center justify-end space-x-2">
                      <Button size="sm" variant="outline" className="text-[10px] h-7 px-3 rounded-full border-[#e9ece6] hover:bg-[#f4f5f3]" onClick={() => setInspectProductId(p.id)}>View</Button>
                      <Button size="sm" className="bg-[#1a3321] hover:bg-[#25422d] text-white text-[10px] h-7 px-3 rounded-full" onClick={() => handleApproveClick(p)}>Approve</Button>
                      <Button size="sm" variant="ghost" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 text-[10px] h-7 px-3 rounded-full" onClick={() => setRejectId(p.id)}>Reject</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Category Assignment + Approve Modal ── */}
      {approveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setApproveId(null)} />
          <Card className="relative w-full max-w-sm p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm text-[#1a3321]">✅ Approve Product</h3>
            <p className="text-xs text-muted-foreground">Assign a category to this product before approving. This determines where it appears in the marketplace.</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#1a3321]"
              >
                <option value="">-- Select a Category --</option>
                {allCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setApproveId(null)}>Cancel</Button>
              <Button className="bg-[#1a3321] hover:bg-[#25422d] text-white" onClick={handleApproveConfirm}>Confirm Approve</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setRejectId(null)} />
          <Card className="relative w-full max-w-sm p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm">Reject Product Listing</h3>
            <div className="space-y-1.5">
              <Label>Rejection Reason</Label>
              <Input
                placeholder="Describe reason for non-compliance..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setRejectId(null)}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleReject}>Confirm Reject</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Product Detail Inspection Modal ── */}
      {inspectProductId && (
        <AdminProductDetailModal 
          productId={inspectProductId} 
          onClose={() => setInspectProductId(null)} 
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// DISPUTES VIEW
// --------------------------------------------------------------------------
function DisputesView({ disputes, onResolve, adminEmail }: { disputes: DisputeCase[], onResolve: () => void, adminEmail?: string }) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleResolve = async () => {
    if (!resolvingId) return;
    const ticket = disputes.find((x) => x.id === resolvingId);
    if (!ticket) return;

    setSubmitting(true);
    const success = await resolveDispute(
      resolvingId,
      ticket.orderId || "N/A",
      adminEmail || "admin@earthcentric.com"
    );
    setSubmitting(false);
    if (success) {
      toast.success("Dispute resolved successfully.");
      setResolvingId(null);
      setResolutionRemarks("");
      onResolve();
    } else {
      toast.error("Failed to resolve dispute.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Platform Disputes & Complaints</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review, mediate, and resolve customer complaints, returns, and dispute logs.
        </p>
      </div>

      <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden mt-6">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4 pl-6">Ticket ID</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Order ID</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Buyer</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Issue Details</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Priority</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Status</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {disputes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                  No active disputes or complaints.
                </TableCell>
              </TableRow>
            ) : (
              disputes.map((d) => (
                <TableRow key={d.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                  <TableCell className="py-4 pl-6 font-mono text-xs font-bold text-[#1a3321]">
                    {d.id.substring(0, 10).toUpperCase()}
                  </TableCell>
                  <TableCell className="py-4 font-mono text-xs text-slate-500">
                    {d.orderId.substring(0, 12)}
                  </TableCell>
                  <TableCell className="py-4 text-xs font-semibold">
                    {d.buyerName}
                  </TableCell>
                  <TableCell className="py-4 text-xs font-medium max-w-[200px] truncate" title={d.issue}>
                    {d.issue}
                  </TableCell>
                  <TableCell className="py-4 text-xs">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      d.priority === "HIGH" ? "bg-red-100 text-red-700" :
                      d.priority === "MEDIUM" ? "bg-amber-100 text-amber-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {d.priority}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 text-xs">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      d.status === "PENDING" ? "bg-amber-100 text-amber-800" :
                      d.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800" :
                      "bg-rose-100 text-rose-800"
                    }`}>
                      {d.status}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    {d.status !== "RESOLVED" ? (
                      <Button size="sm" className="bg-[#1a3321] text-white text-[10px] h-7" onClick={() => setResolvingId(d.id)}>
                        Resolve Dispute
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-semibold">Resolved</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {resolvingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setResolvingId(null)} />
          <Card className="relative w-full max-w-sm p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm text-[#1a3321]">Resolve Dispute Ticket</h3>
            
            {/* Show ticket details */}
            {(() => {
              const ticket = disputes.find(x => x.id === resolvingId);
              if (!ticket) return null;
              return (
                <div className="text-xs bg-slate-50 p-3 rounded-lg border space-y-1 text-slate-600">
                  <p><strong>Issue Detail:</strong></p>
                  <p className="italic">"{ticket.issue}"</p>
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <Label>Resolution Notes / Actions Taken</Label>
              <Textarea
                placeholder="Detail the dispute resolution (e.g. Refund issued, warning issued to seller...)"
                value={resolutionRemarks}
                onChange={(e) => setResolutionRemarks(e.target.value)}
                required
                className="text-xs min-h-[80px]"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setResolvingId(null)}>Cancel</Button>
              <Button className="bg-[#1a3321] text-white cursor-pointer border-none" disabled={submitting} onClick={handleResolve}>
                {submitting ? "Resolving..." : "Confirm Resolve"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// PAYMENTS VIEW
// --------------------------------------------------------------------------
function PaymentsView({ payoutRequests, transactions = [], onActionComplete, adminEmail, globalSearch }: { payoutRequests: any[], transactions?: any[], onActionComplete: () => void, adminEmail?: string, globalSearch?: string }) {
  const [localSearch, setLocalSearch] = useState("");
  const displayTransactions = (globalSearch || localSearch)
    ? transactions.filter((t: any) => {
        const term = localSearch || globalSearch || "";
        const words = term.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return true;
        
        const targetStr = `
          ${t.id || ""}
          ${t.orderId || ""}
          ${t.cashfreePaymentId || ""}
          ${t.buyerName || ""}
          ${t.buyerEmail || ""}
          ${t.buyerPhone || ""}
          ${t.sellerCompany || ""}
          ${t.sellerName || ""}
          ${(t.products || []).map((p: any) => `${p.name} ${p.sellerCompany}`).join(" ")}
        `.toLowerCase();
        
        return words.every(word => targetStr.includes(word));
      })
    : transactions;
  
  const [localPayoutSearch, setLocalPayoutSearch] = useState("");
  const displayPayoutRequests = (globalSearch || localPayoutSearch)
    ? payoutRequests.filter((r: any) => {
        const term = localPayoutSearch || globalSearch || "";
        const words = term.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return true;
        
        const targetStr = `
          ${r.id || ""}
          ${r.transactionId || ""}
          ${r.companyName || ""}
          ${r.sellerName || ""}
          ${r.sellerEmail || ""}
          ${r.paymentMethod || ""}
        `.toLowerCase();
        
        return words.every(word => targetStr.includes(word));
      })
    : payoutRequests;

  const [subTab, setSubTab] = useState("transactions");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "PAY" | null>(null);
  
  // Fields for processing dialogs
  const [transactionId, setTransactionId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [amountToSettle, setAmountToSettle] = useState("");
  const [settlementError, setSettlementError] = useState("");

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    setProcessing(true);
    
    let status: any = "PAID";
    if (actionType === "APPROVE") status = "APPROVED";
    if (actionType === "REJECT") status = "REJECTED";

    const success = await settlePayoutRequest(
      selectedRequest.id,
      adminEmail || "admin@earthcentric.com",
      adminNotes || (status === "PAID" ? "Settle payout via supervisor dashboard" : `Status updated to ${status}`),
      transactionId || undefined,
      status,
      rejectReason || undefined
    );

    setProcessing(false);
    if (success) {
      toast.success(`Payout request successfully ${status.toLowerCase()}!`);
      setSelectedRequest(null);
      setActionType(null);
      setTransactionId("");
      setRejectReason("");
      setAdminNotes("");
      onActionComplete();
    } else {
      toast.error("Failed to update payout request.");
    }
  };

  const handleSettle = async (full = false) => {
    if (!selectedRequest) return;
    const remaining = selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null ? selectedRequest.remainingAmount : selectedRequest.amount;
    const amt = full ? remaining : Number(amountToSettle);
    
    if (isNaN(amt) || amt <= 0) {
      setSettlementError("Amount must be greater than ₹0.");
      return;
    }
    if (amt > remaining) {
      setSettlementError("Amount cannot exceed the remaining pending amount.");
      return;
    }

    setSettlementError("");
    setProcessing(true);

    const success = await settlePayoutRequest(
      selectedRequest.id,
      adminEmail || "admin@earthcentric.com",
      adminNotes || `Payout settlement of ₹${amt.toLocaleString()}`,
      transactionId || undefined,
      "PAID",
      undefined,
      amt
    );

    setProcessing(false);
    if (success) {
      toast.success(`Successfully settled ₹${amt.toLocaleString()}!`);
      setSelectedRequest(null);
      setAmountToSettle("");
      setTransactionId("");
      setAdminNotes("");
      onActionComplete();
    } else {
      toast.error("Failed to process payout settlement.");
    }
  };

  const pendingRequests = payoutRequests.filter(r => r.status === "PENDING");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Payments & Payouts</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor platform revenue collections, commission cuts, and seller payout schedules.</p>
      </div>

      <div className="border-b border-[#e9ece6] flex space-x-6 mt-8">
        <button 
          className={`text-xs font-bold pb-3 px-1 ${subTab === "transactions" ? "text-[#1a3321] border-b-2 border-[#1a3321]" : "text-[#8ca193] hover:text-[#1a3321]"}`}
          onClick={() => setSubTab("transactions")}
        >
          Order Transactions
        </button>
        <button 
          className={`text-xs font-bold pb-3 px-1 flex items-center ${subTab === "payouts" ? "text-[#1a3321] border-b-2 border-[#1a3321]" : "text-[#8ca193] hover:text-[#1a3321]"}`}
          onClick={() => setSubTab("payouts")}
        >
          Seller Payout Requests 
          {pendingRequests.length > 0 && (
            <span className="bg-rose-500 text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center ml-2">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {subTab === "transactions" ? (
        <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden mt-6">
          <div className="px-6 pt-6 pb-2">
            <Input 
              type="text" 
              placeholder="Search by Transaction ID, Order ID, Buyer, Seller, Product..." 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="max-w-md h-9 text-xs border-slate-200"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 pl-6 w-[20%]">Transaction / Order ID</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 w-[15%]">Buyer Info</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 w-[15%]">Seller Info</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 w-[20%]">Products (Qty x Price)</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 w-[10%]">Total Amount</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 w-[10%]">Status</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6 w-[10%]">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                displayTransactions.map((t: any) => (
                  <TableRow key={t.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                    <TableCell className="py-4 pl-6 align-top">
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono font-bold text-[#1a3321]" title="Transaction ID">Txn: {t.id}</p>
                        <p className="text-[10px] font-mono text-muted-foreground" title="Order ID">Ord: {t.orderId}</p>
                        {t.cashfreePaymentId && <p className="text-[10px] font-mono text-blue-600/80" title="Cashfree ID">CF: {t.cashfreePaymentId}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <p className="text-xs font-bold text-[#1a3321]">{t.buyerName}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.buyerEmail}</p>
                      {t.buyerPhone && <p className="text-[10px] text-muted-foreground mt-0.5">{t.buyerPhone}</p>}
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <p className="text-xs font-bold text-[#1a3321]">{t.sellerCompany}</p>
                      {t.sellerName && <p className="text-[10px] text-muted-foreground mt-0.5">{t.sellerName}</p>}
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      {t.products && t.products.length > 0 ? (
                        <div className="space-y-1">
                          {t.products.map((p: any, idx: number) => (
                            <div key={idx} className="flex flex-col text-[10px] border-b border-[#e9ece6]/50 last:border-0 pb-2 last:pb-0">
                              <span className="font-medium text-slate-700">{p.name}</span>
                              <div className="flex justify-between mt-1">
                                <span className="text-slate-500">{p.quantity} × ₹{p.price}</span>
                                {p.sellerCompany !== t.sellerCompany && (
                                  <span className="text-[9px] text-emerald-600 truncate ml-2">({p.sellerCompany})</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No products recorded.</p>
                      )}
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <p className="text-sm font-black text-[#1a3321]">₹{t.amount}</p>
                      <p className="text-[9px] text-emerald-600 font-bold mt-1">Platform Fee: ₹{(t.amount * 0.1).toFixed(0)}</p>
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <Badge className="bg-[#e8f3ec] text-emerald-700 border-none text-[9px] hover:bg-[#e8f3ec]"><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> {t.status}</Badge>
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6 align-top">
                      <p className="text-[10px] font-medium text-muted-foreground">{new Date(t.date).toLocaleDateString()}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden mt-6">
          <div className="px-6 pt-6 pb-2">
            <Input 
              type="text" 
              placeholder="Search by ID, Transaction ID, Seller Name, Company, Email, Method..." 
              value={localPayoutSearch}
              onChange={(e) => setLocalPayoutSearch(e.target.value)}
              className="max-w-md h-9 text-xs border-slate-200"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 pl-6">Seller Company</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Amount</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Method</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Requested Date</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Status</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayPayoutRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No payout requests submitted.
                  </TableCell>
                </TableRow>
              ) : (
                displayPayoutRequests.map((r: any) => (
                  <TableRow key={r.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                    <TableCell className="py-4 pl-6 align-top">
                      <p className="text-xs font-bold text-[#1a3321]">{r.companyName}</p>
                      {r.sellerName && <p className="text-[10px] text-muted-foreground mt-0.5">{r.sellerName}</p>}
                      {r.sellerEmail && <p className="text-[10px] text-muted-foreground mt-0.5">{r.sellerEmail}</p>}
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] text-muted-foreground font-mono" title="Request ID">ID: {r.id}</p>
                        {r.transactionId && <p className="text-[10px] text-blue-600/80 font-mono" title="Transaction ID">Txn: {r.transactionId}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-xs font-black text-[#1a3321]">
                      ₹{r.amount.toLocaleString()}
                      {r.status === "PARTIALLY_PAID" && (
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                          Rem: ₹{(r.remainingAmount !== undefined && r.remainingAmount !== null ? r.remainingAmount : r.amount).toLocaleString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-xs font-bold uppercase text-[#2d4a36]">
                      {r.paymentMethod}
                    </TableCell>
                    <TableCell className="py-4 text-xs text-muted-foreground">
                      {new Date(r.requestedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge className={`border-none text-[9px] font-bold uppercase ${
                        r.status === "PAID" || r.status === "SETTLED" ? "bg-emerald-50 text-emerald-700" : 
                        r.status === "PARTIALLY_PAID" ? "bg-cyan-50 text-cyan-700" :
                        r.status === "APPROVED" ? "bg-blue-50 text-blue-700" :
                        r.status === "REJECTED" ? "bg-red-50 text-red-700" : 
                        "bg-amber-50 text-amber-700"
                      }`}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6 space-x-1.5">
                      <Button size="sm" variant="cool" className="text-[10px] h-7 px-2.5" onClick={() => setSelectedRequest(r)}>
                        View Details
                      </Button>
                      {r.status === "PENDING" && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-7 px-2.5 border-none" onClick={() => { setSelectedRequest(r); setActionType("APPROVE"); }}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="text-[10px] h-7 px-2.5" onClick={() => { setSelectedRequest(r); setActionType("REJECT"); }}>
                            Reject
                          </Button>
                        </>
                      )}
                      {r.status === "APPROVED" && (
                        <>
                          <Button size="sm" className="bg-[#1a3321] hover:bg-[#122417] text-white text-[10px] h-7 px-2.5 border-none" onClick={() => { setSelectedRequest(r); setActionType("PAY"); }}>
                            Mark as Paid
                          </Button>
                          <Button size="sm" variant="destructive" className="text-[10px] h-7 px-2.5" onClick={() => { setSelectedRequest(r); setActionType("REJECT"); }}>
                            Reject
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedRequest && !actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="absolute inset-0" onClick={() => setSelectedRequest(null)} />
          <Card className="relative w-full max-w-lg p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-sm text-[#1a3321]">Payout Request Details</h3>
              <button onClick={() => setSelectedRequest(null)} className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            
            <div className="text-xs space-y-2.5 pt-2 max-h-[80vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <p><strong>Seller Name:</strong> {selectedRequest.sellerName || "N/A"}</p>
                <p><strong>Seller Company:</strong> {selectedRequest.companyName}</p>
                <p><strong>Requested Amount:</strong> ₹{selectedRequest.amount.toLocaleString()}</p>
                <p><strong>Payment Method:</strong> <span className="font-bold uppercase">{selectedRequest.paymentMethod}</span></p>
                <p><strong>Request Date:</strong> {new Date(selectedRequest.requestedAt).toLocaleString()}</p>
                <p>
                  <strong>Current Status:</strong>{" "}
                  <Badge className={`border-none text-[9px] font-bold uppercase ml-1 ${
                    selectedRequest.status === "PAID" || selectedRequest.status === "SETTLED" ? "bg-emerald-50 text-emerald-700" : 
                    selectedRequest.status === "PARTIALLY_PAID" ? "bg-cyan-50 text-cyan-700" :
                    selectedRequest.status === "APPROVED" ? "bg-blue-50 text-blue-700" :
                    selectedRequest.status === "REJECTED" ? "bg-red-50 text-red-700" : 
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {selectedRequest.status}
                  </Badge>
                </p>
                <p>
                  <strong>Remaining Pending Amount:</strong>{" "}
                  <span className="font-black text-[#1a3321]">
                    ₹{(selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null ? selectedRequest.remainingAmount : selectedRequest.amount).toLocaleString()}
                  </span>
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border mt-2">
                <p className="font-bold text-[#1a3321] mb-1">Payment Credentials:</p>
                {selectedRequest.paymentMethod === "BANK" ? (
                  <div className="space-y-1 text-slate-600">
                    <p><strong>Holder Name:</strong> {selectedRequest.bankDetails?.accountHolderName || "N/A"}</p>
                    <p><strong>Bank Name:</strong> {selectedRequest.bankDetails?.bankName || "N/A"}</p>
                    <p><strong>Account Number:</strong> {selectedRequest.bankDetails?.accountNumber || "N/A"}</p>
                    <p><strong>IFSC Code:</strong> {selectedRequest.bankDetails?.ifscCode || "N/A"}</p>
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-600">
                    <p><strong>Holder Name:</strong> {selectedRequest.upiDetails?.accountHolderName || "N/A"}</p>
                    <p><strong>UPI ID (VPA):</strong> {selectedRequest.upiDetails?.upiId || "N/A"}</p>
                  </div>
                )}
              </div>

              {selectedRequest.isUrgent && (
                <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-700">
                  <p className="font-bold">⚠️ Urgent Request Reason:</p>
                  <p className="mt-0.5">{selectedRequest.reason || "No reason provided."}</p>
                </div>
              )}

              {/* Settlement History Section */}
              <div className="pt-3 border-t">
                <h4 className="font-bold text-xs text-[#1a3321] mb-2">Settlement History</h4>
                {selectedRequest.settlementHistory && Array.isArray(selectedRequest.settlementHistory) && selectedRequest.settlementHistory.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {selectedRequest.settlementHistory.map((hist: any, index: number) => (
                      <div key={index} className="p-2 bg-slate-50/70 border rounded-lg flex flex-col space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>{new Date(hist.date).toLocaleString()}</span>
                          <span className="bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded">₹{hist.amountSettled.toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-600">
                          <p><strong>Tx ID:</strong> <span className="font-mono">{hist.transactionId}</span></p>
                          <p><strong>Method:</strong> {hist.paymentMethod || selectedRequest.paymentMethod}</p>
                          <p><strong>Admin:</strong> {hist.adminName}</p>
                          <p><strong>Notes:</strong> {hist.adminNotes}</p>
                          <p className="col-span-2"><strong>Remaining Bal:</strong> ₹{hist.remainingBalance.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No settlements recorded yet.</p>
                )}
              </div>

              {/* Settle Payout Payout Form */}
              {selectedRequest.status !== "REJECTED" && (selectedRequest.remainingAmount !== 0) && (
                <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-3 mt-4 text-left">
                  <h4 className="font-bold text-xs text-[#1a3321]">Process Settlement Transaction</h4>
                  
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Amount to Settle (₹) *</Label>
                    <div className="flex space-x-2">
                      <Input
                        type="number"
                        placeholder="e.g. 5000"
                        value={amountToSettle}
                        onChange={(e) => setAmountToSettle(e.target.value)}
                        className="bg-white border-slate-200 text-xs h-9 flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs h-9 text-[#1a3321]"
                        onClick={() => {
                          const remaining = selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null ? selectedRequest.remainingAmount : selectedRequest.amount;
                          setAmountToSettle(remaining.toString());
                        }}
                      >
                        Max
                      </Button>
                    </div>
                    {settlementError && <p className="text-red-600 text-[10px] font-semibold">{settlementError}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Transaction ID</Label>
                      <Input
                        placeholder="TXN..."
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="bg-white border-slate-200 text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Admin Notes</Label>
                      <Input
                        placeholder="Transfer details..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="bg-white border-slate-200 text-xs h-9"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 border-none text-xs"
                      onClick={() => handleSettle(false)}
                      disabled={processing}
                    >
                      {processing ? "Processing..." : "Settle Amount"}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#1a3321] hover:bg-[#122417] text-white flex-1 border-none text-xs"
                      onClick={() => handleSettle(true)}
                      disabled={processing}
                    >
                      {processing ? "Processing..." : "Settle Full Amount"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="ghost" onClick={() => setSelectedRequest(null)}>Close</Button>
              {selectedRequest.status === "PENDING" && (
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs border-none" onClick={() => setActionType("APPROVE")}>Approve Request</Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="absolute inset-0" onClick={() => setActionType(null)} />
          <Card className="relative w-full max-w-sm p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm">
              {actionType === "APPROVE" ? "Approve Payout Request" :
               actionType === "REJECT" ? "Reject Payout Request" : "Mark Payout as Paid"}
            </h3>

            {actionType === "REJECT" && (
              <div className="space-y-1.5">
                <Label>Rejection Reason *</Label>
                <Textarea
                  placeholder="Detail the reason for rejecting this payout..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                  className="text-xs min-h-[60px]"
                />
              </div>
            )}

            {actionType === "PAY" && (
              <div className="space-y-1.5">
                <Label>Transaction Reference ID *</Label>
                <Input
                  placeholder="e.g. TXN92834823"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Internal Admin Notes (Optional)</Label>
              <Input
                placeholder="e.g. Audited and confirmed..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setActionType(null)}>Back</Button>
              <Button 
                className={actionType === "REJECT" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"} 
                disabled={processing || (actionType === "REJECT" && !rejectReason) || (actionType === "PAY" && !transactionId)}
                onClick={handleAction}
              >
                {processing ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// ORDER MANAGEMENT VIEW
// --------------------------------------------------------------------------

function OrderManagementView({ orders, onUpdateStatus, globalSearch }: { orders: any[], onUpdateStatus: () => void, globalSearch?: string }) {
  const [trackInput, setTrackInput] = useState("");
  
  const displayOrders = (globalSearch || trackInput)
    ? orders.filter((o: any) => {
        const term = trackInput || globalSearch || "";
        const words = term.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return true;
        
        const targetStr = `
          ${o.id || ""}
          ec-ord-${(o.id || "").substring(4, 10).toLowerCase()}
          ${o.user?.name || ""}
          ${o.user?.email || ""}
        `.toLowerCase();
        
        return words.every(word => targetStr.includes(word));
      })
    : orders;

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isSearchingTrack, setIsSearchingTrack] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [inspectProductId, setInspectProductId] = useState<string | null>(null);

  const handleTrackSearch = async () => {
    if (!trackInput.trim()) return;
    setIsSearchingTrack(true);
    setTrackError(null);

    const res = await trackOrderById(trackInput);
    if (res.success && res.order) {
      setSelectedOrder(res.order);
      toast.success(`Found Order #${res.order.id}`);
    } else {
      setTrackError(res.error || "No order details found.");
      toast.error(res.error || "Order not found");
    }
    setIsSearchingTrack(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Order Tracking & Management System</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide overview of all customer order stages, payment status, and carbon offsets.</p>
      </div>

      {/* Admin Order Track Search Bar */}
      <Card className="p-4 bg-white border border-[#e9ece6] shadow-sm rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID (e.g. EC-ORD-4729), Buyer Name, or Email..."
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3321]"
              onKeyDown={(e) => { if (e.key === "Enter") handleTrackSearch(); }}
            />
          </div>
          <Button
            onClick={handleTrackSearch}
            disabled={isSearchingTrack || !trackInput.trim()}
            className="bg-[#1a3321] hover:bg-[#122417] text-white text-xs px-6 py-2 rounded-xl flex items-center justify-center space-x-2 shrink-0 border-none cursor-pointer"
          >
            <Search className="h-4 w-4" />
            <span>Track Order</span>
          </Button>
        </div>

        {trackError && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{trackError}</span>
          </div>
        )}
      </Card>

      <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4 pl-6">Order ID</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Buyer</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Date</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Items Count</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Total Amount</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Order Status</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Payment</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                  No orders recorded on the platform yet.
                </TableCell>
              </TableRow>
            ) : (
              displayOrders.map((o: any) => (
                <TableRow key={o.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                  <TableCell className="py-4 pl-6 font-mono text-xs font-bold text-[#1a3321]">
                    EC-ORD-{o.id.substring(4, 10).toUpperCase()}
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs font-bold text-[#1a3321]">{o.user?.name || "Anonymous"}</p>
                    <p className="text-[9px] text-muted-foreground">{o.user?.email}</p>
                  </TableCell>
                  <TableCell className="py-4 text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="py-4 text-xs text-muted-foreground">
                    {o.items.length} units
                  </TableCell>
                  <TableCell className="py-4 text-xs font-black text-[#1a3321]">
                    ₹{o.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px]">{o.status}</Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant={o.paymentStatus === "COMPLETED" ? "success" : "danger"} className="text-[9px] border-none">
                      {o.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedOrder(o)}>
                      View Timeline
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <Card className="relative w-full max-w-2xl p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-6">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <h3 className="font-bold text-base text-[#1a3321]">Order Details: EC-ORD-{selectedOrder.id.substring(4, 10).toUpperCase()}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Order Items & Summary */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Order Items</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {selectedOrder.items.map((it: any, idx: number) => (
                      <div key={idx} className="flex items-center space-x-3 text-xs bg-slate-50 p-2.5 rounded-lg border">
                        <img src={it.image || "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=100"} className="h-10 w-10 object-cover rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#1a3321] truncate">{it.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Qty: {it.quantity} × ₹{it.price}</p>
                          {it.seller && (
                            <p className="text-[9px] text-emerald-700 font-semibold mt-0.5">Seller: {it.seller.companyName} ({it.seller.email})</p>
                          )}
                          <Button variant="ghost" className="h-5 px-2 mt-1 text-[9px] bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-sm p-0" onClick={() => setInspectProductId(it.productId || it.product?.id || it.id)}>Inspect Full Product</Button>
                        </div>
                        <p className="font-bold text-[#1a3321] shrink-0">₹{it.quantity * it.price}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-800">₹{selectedOrder.totalAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Status</span>
                    <Badge className={selectedOrder.paymentStatus === "COMPLETED" ? "bg-emerald-50 text-emerald-800 border-none text-[9px]" : "bg-amber-50 text-amber-800 border-none text-[9px]"}>
                      {selectedOrder.paymentStatus}
                    </Badge>
                  </div>
                  <div className="flex justify-between pt-1 border-t font-bold text-slate-800 text-sm">
                    <span>Total</span>
                    <span>₹{selectedOrder.totalAmount}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Buyer Info & Timeline */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Buyer Information</h4>
                  <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-lg border">
                    <p className="font-bold text-[#1a3321]">{selectedOrder.user?.name || "Anonymous"}</p>
                    <p className="text-slate-600">{selectedOrder.user?.email}</p>
                    {selectedOrder.address && (
                      <p className="text-slate-500 mt-1 pt-1 border-t text-[10px] leading-relaxed">
                        <strong>Shipping Address:</strong><br />
                        {selectedOrder.address.street}, {selectedOrder.address.city}, {selectedOrder.address.state} - {selectedOrder.address.postalCode}, {selectedOrder.address.country}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Order Timeline</h4>
                  <div className="space-y-3.5 max-h-40 overflow-y-auto pr-1">
                    {selectedOrder.timeline && selectedOrder.timeline.length > 0 ? (
                      selectedOrder.timeline.map((step: any, idx: number) => (
                        <div key={idx} className="flex space-x-2 text-xs">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1" />
                            {idx < selectedOrder.timeline.length - 1 && <div className="w-px h-6 bg-border" />}
                          </div>
                          <div>
                            <p className="font-bold text-[#1a3321] text-[11px]">{step.status}</p>
                            <p className="text-muted-foreground text-[9px]">{step.description}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No timeline events recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between space-x-2 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-200"
                onClick={async () => {
                  await updateOrderStatus(selectedOrder.id, "CANCELLED", "Order cancelled by platform supervisor.");
                  onUpdateStatus();
                  setSelectedOrder(null);
                }}
              >
                Cancel Order
              </Button>
              <Button 
                size="sm" 
                className="w-full bg-[#1a3321] text-white"
                onClick={async () => {
                  await updateOrderStatus(selectedOrder.id, "DELIVERED", "Platform admin marked as delivered and verified.");
                  onUpdateStatus();
                  setSelectedOrder(null);
                }}
              >
                Force Deliver
              </Button>
            </div>
          </Card>
        </div>
      )}

      {inspectProductId && (
        <AdminProductDetailModal 
          productId={inspectProductId} 
          onClose={() => setInspectProductId(null)} 
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// CREDENTIALS MANAGER VIEW
// --------------------------------------------------------------------------
function CredentialsManagerView({ credentials, reload, globalSearch }: { credentials: CredentialItem[], reload: () => void, globalSearch?: string }) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initialValues: Record<string, string> = {};
    credentials.forEach((c) => {
      initialValues[c.key] = c.value;
    });
    setFormValues(initialValues);
  }, [credentials]);

  const handleValueChange = (key: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveCredential = async (key: string) => {
    const value = formValues[key] ?? "";
    setSavingKeys((prev) => ({ ...prev, [key]: true }));

    const res = await updateIntegrationCredential(key, value);
    setSavingKeys((prev) => ({ ...prev, [key]: false }));

    if (res.success) {
      toast.success(`${key} updated successfully!`);
      reload();
    } else {
      toast.error(res.error || `Failed to update ${key}`);
    }
  };

  const isSecretKey = (key: string) => {
    const k = key.toUpperCase();
    return k.includes("PASS") || k.includes("SECRET") || k.includes("KEY");
  };

  const emailCreds = credentials.filter((c) => c.key.startsWith("SMTP_"));
  const cloudinaryCreds = credentials.filter((c) => c.key.startsWith("CLOUDINARY_"));
  const cashfreeCreds = credentials.filter((c) => c.key.startsWith("CASHFREE_"));
  const otherCreds = credentials.filter(
    (c) => !c.key.startsWith("SMTP_") && !c.key.startsWith("CLOUDINARY_") && !c.key.startsWith("CASHFREE_")
  );

  const renderCredentialRow = (c: CredentialItem) => {
    const isSecret = isSecretKey(c.key);
    const isVisible = visibleKeys[c.key] || !isSecret;
    const isSaving = savingKeys[c.key];
    const currentValue = formValues[c.key] ?? "";

    return (
      <div key={c.key} className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-slate-100 last:border-0">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-bold text-[#1a3321] block font-mono">{c.key}</label>
          <span className="text-[11px] text-[#8ca193] block leading-tight">{c.description}</span>
        </div>
        <div className="flex items-center gap-2 md:w-2/3 max-w-lg w-full">
          <div className="relative flex-1">
            <Input
              type={isVisible ? "text" : "password"}
              value={currentValue}
              onChange={(e) => handleValueChange(c.key, e.target.value)}
              className="pr-10 text-xs py-1.5 font-medium w-full bg-[#f8f9f8] border-slate-200 focus:border-[#2d4a36] focus:ring-1 focus:ring-[#2d4a36]"
              placeholder={`Enter ${c.key}...`}
            />
            {isSecret && (
              <button
                type="button"
                onClick={() => toggleVisibility(c.key)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => handleSaveCredential(c.key)}
            disabled={isSaving || currentValue === c.value}
            className={`text-[10px] font-bold h-8 px-3 rounded-lg flex items-center transition-all ${
              currentValue === c.value
                ? "bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-not-allowed border-none shadow-none"
                : "bg-[#2d4a36] text-white hover:bg-[#203627] shadow-sm"
            }`}
          >
            {isSaving ? "Saving..." : currentValue === c.value ? "Saved" : "Update"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321] flex items-center space-x-2">
          <span>Credentials & Portals Manager</span>
          <span className="text-xl">🔑</span>
        </h1>
        <p className="text-[10px] text-muted-foreground font-semibold mt-1 flex items-center space-x-1 uppercase tracking-wider">
          <span>EarthCentric</span> <span className="mx-1">{">"}</span> <span>Super Admin</span> <span className="mx-1">{">"}</span> <span className="text-[#1a3321]">Credentials</span>
        </p>
      </div>

      <Card className="p-4 bg-amber-50/50 border border-amber-200/50 rounded-2xl flex items-start space-x-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-amber-800">Security Warning</h4>
          <p className="text-[10px] text-amber-700/90 leading-relaxed">
            These configurations govern SMTP mail delivery, Cloudinary media hosting, and Cashfree payment operations. Modifications to these keys will immediately update live portal connections and operations. Please verify credentials before updating.
          </p>
        </div>
      </Card>

      <div className="space-y-6">
        {emailCreds.length > 0 && (
          <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-2">
              <span className="text-lg">📧</span>
              <div>
                <h3 className="text-xs font-bold text-[#1a3321]">Gmail SMTP Config</h3>
                <p className="text-[9px] text-[#8ca193] uppercase font-semibold">Nodemailer service login details</p>
              </div>
            </div>
            <div>{emailCreds.map(renderCredentialRow)}</div>
          </Card>
        )}

        {cloudinaryCreds.length > 0 && (
          <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-2">
              <span className="text-lg">☁️</span>
              <div>
                <h3 className="text-xs font-bold text-[#1a3321]">Cloudinary Integration</h3>
                <p className="text-[9px] text-[#8ca193] uppercase font-semibold">Image & Document storage API keys</p>
              </div>
            </div>
            <div>{cloudinaryCreds.map(renderCredentialRow)}</div>
          </Card>
        )}

        {cashfreeCreds.length > 0 && (
          <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-2">
              <span className="text-lg">💳</span>
              <div>
                <h3 className="text-xs font-bold text-[#1a3321]">Cashfree Gateway</h3>
                <p className="text-[9px] text-[#8ca193] uppercase font-semibold">Merchant account API keys & secrets</p>
              </div>
            </div>
            <div>{cashfreeCreds.map(renderCredentialRow)}</div>
          </Card>
        )}

        {otherCreds.length > 0 && (
          <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-2">
              <span className="text-lg">🔧</span>
              <div>
                <h3 className="text-xs font-bold text-[#1a3321]">Other Integrations</h3>
                <p className="text-[9px] text-[#8ca193] uppercase font-semibold">Generic configuration parameters</p>
              </div>
            </div>
            <div>{otherCreds.map(renderCredentialRow)}</div>
          </Card>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// DISCOUNT APPROVAL VIEW
// --------------------------------------------------------------------------
function DiscountApprovalView({ pendingDiscounts, reload, globalSearch }: { pendingDiscounts: any[]; reload: () => void; globalSearch?: string }) {
  const displayDiscounts = globalSearch
    ? pendingDiscounts.filter((d: any) => 
        d.name?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        d.seller?.companyName?.toLowerCase().includes(globalSearch.toLowerCase())
      )
    : pendingDiscounts;

  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (productId: string) => {
    setProcessingId(productId);
    const ok = await approveDiscount(productId);
    setProcessingId(null);
    if (ok) toast.success("Discount approved successfully!");
    else toast.error("Failed to approve discount.");
    reload();
  };

  const handleReject = async (productId: string) => {
    setProcessingId(productId);
    const ok = await rejectDiscount(productId);
    setProcessingId(null);
    if (ok) toast.success("Discount rejected.");
    else toast.error("Failed to reject discount.");
    reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321] flex items-center space-x-2">
          <Coins className="h-6 w-6 text-primary" />
          <span>Discount Approval Management</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Review and approve individual product discount requests created by sellers before they become active.
        </p>
      </div>

      <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9ece6] bg-[#fdfdfc]">
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Product & Seller</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Original Price</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Discount Offered</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Final Selling Price</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Status</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayDiscounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-xs text-muted-foreground">
                  No discount requests found.
                </TableCell>
              </TableRow>
            ) : (
              displayDiscounts.map((item: any) => {
                const disc = item.discount;
                const origPrice = Number(item.originalPrice || item.price);
                let finalPrice = origPrice;
                if (disc.discountType === "PERCENTAGE") {
                  finalPrice = Math.max(0, origPrice - (origPrice * Number(disc.discountValue)) / 100);
                } else if (disc.discountType === "FIXED") {
                  finalPrice = Math.max(0, origPrice - Number(disc.discountValue));
                }

                return (
                  <TableRow key={item.productId} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50">
                    <TableCell className="py-4">
                      <div>
                        <p className="text-xs font-bold text-[#1a3321]">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground">by {item.sellerName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-xs font-semibold text-muted-foreground">
                      ₹{origPrice}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="text-xs font-bold bg-amber-50 text-amber-700 border-amber-200">
                        {disc.discountType === "PERCENTAGE" ? `${disc.discountValue}% OFF` : `₹${disc.discountValue} OFF`}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-xs font-bold text-emerald-700">
                      ₹{finalPrice}
                    </TableCell>
                    <TableCell className="py-4">
                      {disc.status === "APPROVED" ? (
                        <Badge className="bg-[#e8f3ec] text-emerald-700 border-none text-[10px] font-bold">APPROVED</Badge>
                      ) : disc.status === "REJECTED" ? (
                        <Badge className="bg-rose-50 text-rose-700 border-none text-[10px] font-bold">REJECTED</Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700 border-none text-[10px] font-bold">PENDING APPROVAL</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6 space-x-2">
                      {disc.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 h-8 rounded-lg cursor-pointer"
                            disabled={processingId === item.productId}
                            onClick={() => handleApprove(item.productId)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs px-3 h-8 rounded-lg cursor-pointer"
                            disabled={processingId === item.productId}
                            onClick={() => handleReject(item.productId)}
                          >
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Reviewed</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}



