"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getPendingSellers, approveSeller, rejectSeller, removeSellerAsSeller, getPlatformStats, PlatformStats, getDisputes, resolveDispute, DisputeCase, getAllSellersRevenue, SellerRevenueInfo, getAdminAnalyticsTimeSeries, getPlatformUsers, UserManagementData, getPendingProducts, approveProduct, rejectProduct, getAdminTransactions, getBuyerProfileById, updateSellerVerificationStatus, updateSellerTrustScore, getPendingDiscounts, approveDiscount, rejectDiscount, getAllProductsForAdminPromotions, updateProductPromotionsByAdmin } from "@/actions/admin";
import { 
  getAdminPayoutRequests, 
  settlePayoutRequest, 
  executeCashfreePayout,
  retryFailedPayout,
  reconcileCashfreePayout,
  adminReviewPayoutProfile,
  getAdminSellerOnboardingProfiles,
  getAdminRegistrationFeeConfig,
  updateAdminRegistrationFeeConfig,
  PayoutRequestInfo,
  SellerOnboardingProfile
} from "@/actions/payouts";
import {
  cancelOrderAsAdmin,
  getAllOrdersForAdmin,
  getOrderCancellationsForAdmin,
  refreshOrderCancellationRefund,
  resumePendingOrderCancellationRefund,
  retryOrderCancellationRefund,
  reviewOrderCancellation,
  updateOrderStatus,
  trackOrderById,
} from "@/actions/orders";
import { SellerProfile } from "@/actions/sellers";
import { getAdminNotifications, markNotificationAsRead } from "@/actions/notifications";
import { getIntegrationCredentials, updateIntegrationCredential, CredentialItem } from "@/actions/credentials";
import { adminCreateCategory, normalizeCategorySlug } from "@/actions/categories";
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableCell, TableHead, Input, LiquidButton, Label, Textarea } from "@/components/ui/shared";
import { FadeIn, ScaleHover } from "@/components/FramerComponents";
import { AdminAnalyticsCharts, AdminAnalyticsData } from "@/components/ui/admin-analytics-charts";
import { AdminSellerDetailModal } from "@/components/ui/admin-seller-detail-modal";
import { AdminBuyerDetailModal } from "@/components/ui/admin-buyer-detail-modal";
import { AdminProductDetailModal } from "@/components/ui/admin-product-detail-modal";
import { AdminMessagesView } from "@/components/admin/AdminMessagesView";
import { CategoryManagementView } from "@/components/admin/CategoryManagementView";
import { OrderCancellationsAdminView } from "@/components/admin/OrderCancellationsAdminView";
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
  Store,
  Building2,
  Filter,
  SlidersHorizontal,
  Layers,
  ArrowUpDown,
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
  Tag,
  Percent,
  Gift,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  UserX,
  History,
  AlertOctagon,
  Loader2,
  RotateCcw,
  RefreshCw,
} from "lucide-react";

// Mock User Data for User Management View Fallback
const MOCK_USERS = [
  { id: "user_3KopVGVdy94cAVqZ4lzQjtWRCMK", name: "AR ECO INDIA", email: "ar.eco.india2026@gmail.com", phone: "+91 8868882388", role: "Seller", joinedDate: "17 Oct 2026", orders: "Active Designated Seller" },
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
  const [selectedSellerFilterForOrders, setSelectedSellerFilterForOrders] = useState<string | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [messagesUnreadCount, setMessagesUnreadCount] = useState<number>(0);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [
        sRes,
        aDataRes,
        sellersRes,
        casesRes,
        revsRes,
        reqsRes,
        uDataRes,
        pProdsRes,
        pDiscRes,
        ordersRes,
        txnsRes,
        notifsRes,
        credsRes,
        unreadRes,
      ] = await Promise.allSettled([
        getPlatformStats(filterType, selectedDate, selectedMonth, selectedYear),
        getAdminAnalyticsTimeSeries(),
        getPendingSellers(),
        getDisputes(),
        getAllSellersRevenue(),
        getAdminPayoutRequests(),
        getPlatformUsers(),
        getPendingProducts(),
        getPendingDiscounts(),
        getAllOrdersForAdmin(),
        getAdminTransactions(),
        getAdminNotifications(),
        getIntegrationCredentials(),
        getUnreadMessageCount("admin-1"),
      ]);

      if (sRes.status === "fulfilled") setStats(sRes.value);
      if (aDataRes.status === "fulfilled") setAnalyticsData(aDataRes.value as AdminAnalyticsData);
      if (sellersRes.status === "fulfilled") setPendingSellers(sellersRes.value);
      if (casesRes.status === "fulfilled") setDisputes(casesRes.value);
      if (revsRes.status === "fulfilled") setSellerRevenues(revsRes.value);
      if (reqsRes.status === "fulfilled") setPayoutRequests(reqsRes.value);
      if (uDataRes.status === "fulfilled") setUsersData(uDataRes.value);
      if (pProdsRes.status === "fulfilled") setPendingProducts(pProdsRes.value);
      if (pDiscRes.status === "fulfilled") setPendingDiscounts(pDiscRes.value);
      if (ordersRes.status === "fulfilled") setAllOrders(ordersRes.value);
      if (txnsRes.status === "fulfilled") setTransactions(txnsRes.value);
      if (notifsRes.status === "fulfilled") setNotifications(notifsRes.value);
      if (credsRes.status === "fulfilled") setCredentials(credsRes.value);
      if (unreadRes.status === "fulfilled") setMessagesUnreadCount(unreadRes.value);
    } catch (err) {
      console.error("loadAdminData caught an unexpected error:", err);
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab) {
        setActiveTab(tab === "promotions" ? "discounts" : tab);
      }
    }
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
          void loadAdminData();
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
            <SidebarLink icon={Tag} label="Promotions & Discounts" value="discounts" badge={pendingDiscounts.filter((d: any) => (d.status || d.discount?.status) === "PENDING").length} />
            <SidebarLink icon={Mail} label="Messages" value="messages" badge={messagesUnreadCount} />
            <SidebarLink icon={ShoppingBag} label="Order Management" value="orders" />
            <SidebarLink icon={RotateCcw} label="Cancellation Requests" value="cancellations" badge={stats?.cancellationStats?.pending || 0} />
            <SidebarLink icon={Wallet} label="Payments" value="payments" />
            <SidebarLink icon={AlertCircle} label="Disputes" value="disputes" />
            <SidebarLink icon={Layers} label="Category Manager" value="categories" />
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
                                let tab = n.redirectSection.split("tab=")[1];
                                if (tab.includes("&")) tab = tab.split("&")[0];
                                if (tab === "promotions") tab = "discounts";
                                setActiveTab(tab);
                              } else {
                                let target = n.redirectSection;
                                if (target === "promotions") target = "discounts";
                                setActiveTab(target);
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
            {activeTab === "sellers" && <SellerApprovalsView pendingSellers={pendingSellers} reload={loadAdminData} onInspectSeller={setSelectedSellerId} globalSearch={globalSearch} adminEmail={user?.email} />}
            {activeTab === "users" && <UserManagementView usersData={usersData} onInspectSeller={setSelectedSellerId} onInspectBuyer={setSelectedBuyerId} globalSearch={globalSearch} />}
            {activeTab === "products" && <ProductApprovalView pendingProducts={pendingProducts} approvedToday={stats?.approvedToday} rejectedToday={stats?.rejectedToday} reload={loadAdminData} adminEmail={user?.email} globalSearch={globalSearch} />}
            {activeTab === "discounts" && <DiscountApprovalView pendingDiscounts={pendingDiscounts} reload={loadAdminData} adminEmail={user?.email} globalSearch={globalSearch} />}
            {activeTab === "messages" && <AdminMessagesView onViewSellerProfile={(sId) => setSelectedSellerId(sId)} />}
            {activeTab === "payments" && <PaymentsView payoutRequests={payoutRequests} transactions={transactions} onActionComplete={loadAdminData} adminEmail={user?.email} globalSearch={globalSearch} />}
            {activeTab === "disputes" && <DisputesView disputes={disputes} onResolve={loadAdminData} adminEmail={user?.email} />}
            {activeTab === "analytics" && <AdminAnalyticsCharts data={analyticsData!} />}
            {activeTab === "orders" && (
              <OrderManagementView 
                orders={allOrders} 
                onUpdateStatus={loadAdminData} 
                globalSearch={globalSearch} 
                sellers={pendingSellers}
                initialSelectedSellerId={selectedSellerFilterForOrders}
                onClearSellerFilter={() => setSelectedSellerFilterForOrders(null)}
              />
            )}
            {activeTab === "cancellations" && (
              <OrderCancellationsAdminView
                onActionComplete={loadAdminData}
                globalSearch={globalSearch}
                adminEmail={user?.email}
              />
            )}
            {activeTab === "credentials" && <CredentialsManagerView credentials={credentials} reload={loadAdminData} globalSearch={globalSearch} />}
            {activeTab === "categories" && <CategoryManagementView adminEmail={user?.email} globalSearch={globalSearch} />}
          </FadeIn>
        </main>
      </div>

      {selectedSellerId && (
        <AdminSellerDetailModal 
          sellerId={selectedSellerId} 
          onClose={() => setSelectedSellerId(null)} 
          adminEmail={user?.email}
          onActionComplete={loadAdminData}
          onViewOrders={(sId) => {
            setSelectedSellerFilterForOrders(sId);
            setSelectedSellerId(null);
            setActiveTab("orders");
          }}
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
function SellerApprovalsView({ pendingSellers, reload, onInspectSeller, globalSearch, adminEmail }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc"); // Default: latest applied on top!
  const [sellerToRemove, setSellerToRemove] = useState<any>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch (error) {
      console.error("Could not refresh seller applications:", error);
      toast.error("Could not refresh seller applications. Try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!sellerToRemove) return;
    if (!removeReason.trim()) {
      toast.error("Please enter a reason for removing this seller.");
      return;
    }
    setIsRemoving(true);
    try {
      const res = await removeSellerAsSeller(
        sellerToRemove.userId || sellerToRemove.id,
        removeReason.trim(),
        adminEmail || "admin@earthcentric.com"
      );
      if (!res.success) {
        toast.error(res.error || "Failed to remove seller.");
        return;
      }
      toast.success(`Seller "${sellerToRemove.companyName}" has been removed as seller.`);
      setSellerToRemove(null);
      setRemoveReason("");
      await handleRefresh();
    } catch (err) {
      console.error("Failed to remove seller:", err);
      toast.error("Could not remove seller. Try again.");
    } finally {
      setIsRemoving(false);
    }
  };

  // Helper helpers to categorize seller states accurately
  const isSellerRemoved = (s: any): boolean => Boolean(s.isRemoved || s.rejectionReason?.startsWith("[SELLER_REMOVED]:"));
  const isSellerPending = (s: any): boolean => !isSellerRemoved(s) && ((s.verificationStatus || s.status) === "PENDING" || (s.verificationStatus || s.status) === "UNDER_REVIEW");
  const isSellerApproved = (s: any): boolean => !isSellerRemoved(s) && ((s.verificationStatus || s.status) === "APPROVED" || (s.verificationStatus || s.status) === "VERIFIED");
  const isSellerRejected = (s: any): boolean => !isSellerRemoved(s) && ((s.verificationStatus || s.status) === "REJECTED");

  // Helper to reliably extract the application timestamp
  const getAppliedTimestamp = (s: any): number => {
    if (s.appliedAt) {
      const t = new Date(s.appliedAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (s.documents && Array.isArray(s.documents) && s.documents.length > 0) {
      const docTimes = s.documents
        .map((d: any) => (d.uploadedAt ? new Date(d.uploadedAt).getTime() : 0))
        .filter((t: number) => !isNaN(t) && t > 0);
      if (docTimes.length > 0) return Math.max(...docTimes);
    }
    if (s.updatedAt) {
      const t = new Date(s.updatedAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (s.appliedOn) {
      const t = new Date(s.appliedOn).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (s.createdAt) {
      const t = new Date(s.createdAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    return 0;
  };

  // Process, filter, and sort sellers (strictly latest applied on top by default)
  const displaySellers = useMemo(() => {
    let list = [...(pendingSellers || [])];

    // Status filter
    if (statusFilter !== "ALL") {
      list = list.filter((s: any) => {
        if (statusFilter === "PENDING") return isSellerPending(s);
        if (statusFilter === "APPROVED") return isSellerApproved(s);
        if (statusFilter === "REJECTED") return isSellerRejected(s);
        if (statusFilter === "REMOVED") return isSellerRemoved(s);
        return true;
      });
    }

    // Global search
    if (globalSearch && globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      list = list.filter((s: any) =>
        s.companyName?.toLowerCase().includes(q) ||
        s.user?.email?.toLowerCase().includes(q) ||
        s.user?.name?.toLowerCase().includes(q) ||
        s.userName?.toLowerCase().includes(q) ||
        s.founderName?.toLowerCase().includes(q) ||
        s.ownerName?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q)
      );
    }

    // Sort by Applied Date: latest applied on top (desc) or oldest (asc)
    list.sort((a: any, b: any) => {
      const timeA = getAppliedTimestamp(a);
      const timeB = getAppliedTimestamp(b);
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [pendingSellers, statusFilter, globalSearch, sortOrder]);

  const pendingCount = (pendingSellers || []).filter(isSellerPending).length;
  const approvedCount = (pendingSellers || []).filter(isSellerApproved).length;
  const rejectedCount = (pendingSellers || []).filter(isSellerRejected).length;
  const removedCount = (pendingSellers || []).filter(isSellerRemoved).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a3321]">Seller Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage seller verification records.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
            className="text-xs text-[#1a3321] border-slate-200 gap-1.5 h-8 font-semibold shadow-none cursor-pointer"
            title="Toggle sort order"
          >
            <ArrowUpDown className="h-3 w-3 text-emerald-600" />
            <span>{sortOrder === "desc" ? "Latest First" : "Oldest First"}</span>
          </Button>
          <Button variant="outline" size="sm" disabled={refreshing} onClick={handleRefresh} className="h-8 shadow-none">
            {refreshing ? "Refreshing..." : "Refresh applications"}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/70 w-fit text-xs font-semibold">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            statusFilter === "ALL"
              ? "bg-[#1a3321] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          All ({(pendingSellers || []).length})
        </button>
        <button
          onClick={() => setStatusFilter("PENDING")}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            statusFilter === "PENDING"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span>Pending</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
            statusFilter === "PENDING" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
          }`}>
            {pendingCount}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter("APPROVED")}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            statusFilter === "APPROVED"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span>Verified</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
            statusFilter === "APPROVED" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
          }`}>
            {approvedCount}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter("REJECTED")}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            statusFilter === "REJECTED"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span>Rejected</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
            statusFilter === "REJECTED" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
          }`}>
            {rejectedCount}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter("REMOVED")}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            statusFilter === "REMOVED"
              ? "bg-rose-700 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span>Removed</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
            statusFilter === "REMOVED" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
          }`}>
            {removedCount}
          </span>
        </button>
      </div>

      <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Business / Applicant</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Contact</TableHead>
              <TableHead 
                className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4 cursor-pointer hover:text-slate-700 select-none"
                onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Applied On</span>
                  <ArrowUpDown className="h-3 w-3 text-emerald-600" />
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded normal-case tracking-normal">
                    {sortOrder === "desc" ? "Latest First ↓" : "Oldest First ↑"}
                  </span>
                </div>
              </TableHead>
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
              displaySellers.map((seller: any, i: number) => {
                const appliedTs = getAppliedTimestamp(seller);
                const appliedDateStr = appliedTs > 0
                  ? new Date(appliedTs).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
                  : seller.appliedOn || (seller.createdAt ? new Date(seller.createdAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }));

                const removed = isSellerRemoved(seller);
                const approved = isSellerApproved(seller);
                const rejected = isSellerRejected(seller);

                return (
                  <TableRow key={seller.id || i} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                    <TableCell className="py-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-[#f4f5f3] rounded border border-[#e9ece6] flex items-center justify-center text-[#8ca193]">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1a3321]">{seller.companyName}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center">
                            <Users className="h-2.5 w-2.5 mr-1" /> {seller.userName || seller.user?.name || seller.founderName || seller.ownerName || "Applicant"}
                          </p>
                          {seller.hasPriorRemoval && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded px-1.5 py-0.5" title="Prior seller status was removed; re-applied">
                                <History className="h-2.5 w-2.5 text-amber-600" />
                                Re-applicant • Prior Removed
                              </span>
                            </div>
                          )}
                          {removed && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 rounded px-1.5 py-0.5">
                                <UserX className="h-2.5 w-2.5 text-rose-600" />
                                Removed as Seller
                              </span>
                              {seller.priorRemovalReason && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 italic max-w-xs">
                                  "{seller.priorRemovalReason}"
                                </p>
                              )}
                            </div>
                          )}
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
                          <span className="font-medium text-slate-700">{appliedDateStr}</span>
                        </p>
                        <p className="text-muted-foreground flex items-center" title="Approved Date">
                          <CheckCircle2 className="h-3 w-3 mr-1.5 text-emerald-600" />
                          <span className="font-semibold text-[#1a3321]">Approved:</span>&nbsp;
                          {seller.verifiedAt
                            ? new Date(seller.verifiedAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
                            : approved
                            ? "Verified"
                            : removed
                            ? "Revoked"
                            : "Pending"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {removed ? (
                        <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-[9px] hover:bg-rose-100 font-bold">
                          <UserX className="h-3 w-3 mr-1 inline-block" /> REMOVED
                        </Badge>
                      ) : approved ? (
                        <Badge className="bg-[#e8f3ec] text-emerald-700 border-none text-[9px] hover:bg-[#e8f3ec] font-semibold">
                          <CheckCircle2 className="h-3 w-3 mr-1 inline-block" /> VERIFIED
                        </Badge>
                      ) : rejected ? (
                        <Badge className="bg-rose-50 text-rose-700 border-none text-[9px] hover:bg-rose-50 font-semibold">
                          <X className="h-3 w-3 mr-1 inline-block" /> REJECTED
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700 border-none text-[9px] hover:bg-amber-50 font-semibold">
                          <AlertCircle className="h-3 w-3 mr-1 inline-block" /> PENDING
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6">
                      {approved ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 px-2.5 h-8 font-semibold cursor-pointer"
                            onClick={() => {
                              setSellerToRemove(seller);
                              setRemoveReason("");
                            }}
                            title="Remove seller account and unlist from marketplace"
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Remove
                          </Button>
                          <Button
                            variant="ghost"
                            className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 h-8 font-semibold cursor-pointer"
                            onClick={() => onInspectSeller(seller.id || seller.userId)}
                          >
                            View Record
                          </Button>
                        </div>
                      ) : removed ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-rose-700 font-bold px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
                            Removed
                          </span>
                          <Button
                            variant="ghost"
                            className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 h-8 font-semibold cursor-pointer"
                            onClick={() => onInspectSeller(seller.id || seller.userId)}
                          >
                            View Record
                          </Button>
                        </div>
                      ) : isSellerPending(seller) ? (
                        <Button
                          variant="outline"
                          className="text-xs text-[#1a3321] border-[#1a3321]/30 hover:bg-[#f4f5f3] px-3 h-8 cursor-pointer font-semibold"
                          onClick={() => onInspectSeller(seller.id || seller.userId)}
                        >
                          <Eye className="h-3 w-3 mr-1.5" /> Review
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 h-8 font-semibold cursor-pointer"
                          onClick={() => onInspectSeller(seller.id || seller.userId)}
                        >
                          View Record
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {sellerToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-100 border border-rose-200">
                <AlertOctagon className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Remove as Seller?</h3>
                <p className="text-xs text-muted-foreground">{sellerToRemove.companyName || "Seller"}</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2 text-rose-900">
              <p className="font-semibold">Immediate consequences:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>User role will be demoted to <span className="font-semibold text-slate-900">BUYER</span>.</li>
                <li>Seller store page and products will be removed from marketplace & homepage.</li>
                <li>All listings blocked immediately.</li>
                <li>Full snapshot of prior company data & verification documents is preserved in audit records so Super Admin can review prior history if they apply again.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Reason for Removal <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                rows={3}
                placeholder="e.g. Platform policy violation, requested offboarding, inactive or fraudulent..."
                className="w-full text-xs p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSellerToRemove(null);
                  setRemoveReason("");
                }}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5"
                onClick={handleConfirmRemove}
                disabled={isRemoving || !removeReason.trim()}
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Confirm & Remove Seller
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
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
  const [refreshing, setRefreshing] = useState(false);
  const displayProducts = globalSearch
    ? pendingProducts.filter((p: any) => 
        p.name?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        p.seller?.companyName?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        p.category?.name?.toLowerCase().includes(globalSearch.toLowerCase())
      )
    : pendingProducts;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch (error) {
      console.error("Could not refresh product approval requests:", error);
      toast.error("Could not refresh product approval requests. Try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveProductItem, setApproveProductItem] = useState<any | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryActionOption, setCategoryActionOption] = useState<"keep" | "change" | "create">("keep");
  const [categoryFilterSearch, setCategoryFilterSearch] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [allCategories, setAllCategories] = useState<{id: string; name: string; slug: string; description?: string; productCount?: number}[]>([]);
  const [inspectProductId, setInspectProductId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories?for=seller");
      const data = await res.json();
      setAllCategories(data.categories || []);
    } catch {
      setAllCategories([]);
    }
  }, []);

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleApproveClick = (p: any) => {
    setApproveId(p.id);
    setApproveProductItem(p);
    setSelectedCategoryId(p.categoryId || "");
    setCategoryActionOption("keep");
    setCategoryFilterSearch("");
    setNewCategoryName("");
    setNewCategorySlug("");
    setNewCategoryDesc("");
  };

  const handleCreateCategoryDuringReview = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    setIsCreatingCategory(true);
    try {
      const res = await adminCreateCategory({
        name: newCategoryName.trim(),
        slug: newCategorySlug.trim() || undefined,
        description: newCategoryDesc.trim() || undefined,
      }, adminEmail || "admin@earthcentric.com");

      if (res.success && res.category) {
        toast.success(`Category "${res.category.name}" created and assigned!`);
        await loadCategories();
        setSelectedCategoryId(res.category.id);
        setCategoryActionOption("change");
        setNewCategoryName("");
        setNewCategorySlug("");
        setNewCategoryDesc("");
      } else {
        toast.error(res.error || "Failed to create category");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to create category");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleApproveConfirm = async () => {
    if (!approveId) return;
    setIsApproving(true);
    try {
      const ok = await approveProduct(
        approveId,
        adminEmail || "admin@earthcentric.com",
        selectedCategoryId || undefined
      );
      if (ok) {
        toast.success("Product approved and is now live on the marketplace!");
        setApproveId(null);
        setApproveProductItem(null);
        setSelectedCategoryId("");
        reload();
      } else {
        toast.error("Failed to approve product.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to approve product.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    try {
      const ok = await rejectProduct(rejectId, rejectReason || "Product claims do not meet sustainable standards.", adminEmail || "admin@earthcentric.com");
      if (ok) {
        toast.success("Product rejected. Seller has been notified.");
      } else {
        toast.error("Failed to reject product.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to reject product.");
    } finally {
      setRejectId(null);
      setRejectReason("");
      reload();
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a3321]">Product Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">Review newly submitted catalog items for sustainable verification compliance.</p>
        </div>
        <Button variant="outline" size="sm" disabled={refreshing} onClick={handleRefresh}>
          {refreshing ? "Refreshing..." : "Refresh products"}
        </Button>
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
                <TableCell colSpan={9} className="text-center py-10 text-xs text-muted-foreground">
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
                  <TableCell className="py-4 max-w-xs">
                    <div className="flex items-center space-x-1 mb-1">
                      <Leaf className="h-3 w-3 text-emerald-600 shrink-0" />
                      <span className="text-[10px] font-bold text-emerald-800">
                        Sustainability: {p.sustainabilityScore ?? 85}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2" title={p.sustainabilityDetail || p.claims}>
                      {p.sustainabilityDetail || p.claims || "Eco-certified sustainable claims"}
                    </p>
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

      {/* ── Super Admin Category Assignment + Approve Modal (Option A / B / C) ── */}
      {approveId && approveProductItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !isApproving && setApproveId(null)} />
          <Card className="relative w-full max-w-lg p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-[#1a3321] flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Product Approval &amp; Category Verification
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Confirm the canonical category before approving this item for the live marketplace.
                </p>
              </div>
            </div>

            {/* Product summary card */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3">
              <img
                src={approveProductItem.images?.[0] || "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=100"}
                className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                alt="Product"
              />
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-bold text-slate-900 truncate">{approveProductItem.name}</p>
                <p className="text-[11px] text-slate-500">Seller: <strong className="text-slate-700">{approveProductItem.seller?.companyName}</strong> · Price: <strong className="text-emerald-700">₹{approveProductItem.price}</strong></p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Submitted Category:</span>
                  <Badge variant="outline" className="text-[10px] bg-white font-medium">
                    {approveProductItem.category || "Uncategorized"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 3 Decision Options */}
            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Category Selection Action
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryActionOption("keep");
                    setSelectedCategoryId(approveProductItem.categoryId || "");
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer text-xs
                    ${categoryActionOption === "keep" 
                      ? "border-[#1a3321] bg-[#1a3321]/5 text-[#1a3321] font-bold shadow-xs" 
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"}
                  `}
                >
                  <p className="font-semibold text-xs leading-tight">Option A</p>
                  <p className="text-[11px] mt-0.5 opacity-80">Keep Existing</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCategoryActionOption("change")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer text-xs
                    ${categoryActionOption === "change" 
                      ? "border-[#1a3321] bg-[#1a3321]/5 text-[#1a3321] font-bold shadow-xs" 
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"}
                  `}
                >
                  <p className="font-semibold text-xs leading-tight">Option B</p>
                  <p className="text-[11px] mt-0.5 opacity-80">Change Category</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCategoryActionOption("create")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer text-xs
                    ${categoryActionOption === "create" 
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-xs" 
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"}
                  `}
                >
                  <p className="font-semibold text-xs leading-tight">Option C</p>
                  <p className="text-[11px] mt-0.5 opacity-80">+ Create New</p>
                </button>
              </div>

              {/* Option A: Keep Existing Category */}
              {categoryActionOption === "keep" && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Using Submitted Category</span>
                  </div>
                  <p className="text-slate-600 text-[11px] pl-6">
                    Product will be approved under <strong>"{approveProductItem.category || "General"}"</strong>.
                  </p>
                </div>
              )}

              {/* Option B: Change to another existing category */}
              {categoryActionOption === "change" && (
                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search existing approved categories..."
                      value={categoryFilterSearch}
                      onChange={(e) => setCategoryFilterSearch(e.target.value)}
                      className="pl-8 text-xs h-8 bg-slate-50"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {allCategories
                      .filter((c) =>
                        !categoryFilterSearch.trim() ||
                        c.name.toLowerCase().includes(categoryFilterSearch.toLowerCase()) ||
                        c.slug.toLowerCase().includes(categoryFilterSearch.toLowerCase())
                      )
                      .map((cat) => {
                        const isSelected = selectedCategoryId === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer
                              ${isSelected ? "bg-emerald-50 text-emerald-900 font-bold" : "hover:bg-slate-50 text-slate-700"}
                            `}
                          >
                            <span className="truncate">{cat.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-slate-400 font-mono">/category/{cat.slug}</span>
                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                            </div>
                          </button>
                        );
                      })}
                  </div>

                  {selectedCategoryId && (
                    <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                      <span>Selected for approval:</span>
                      <strong className="underline">
                        {allCategories.find((c) => c.id === selectedCategoryId)?.name || selectedCategoryId}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Option C: Create new category during review */}
              {categoryActionOption === "create" && (
                <div className="p-3.5 border border-emerald-200 bg-emerald-50/40 rounded-xl space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-emerald-700" />
                      Create New Category During Review
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      The new category will be added to the marketplace taxonomy and assigned to this product.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Category Name *</Label>
                      <Input
                        value={newCategoryName}
                        onChange={(e) => {
                          setNewCategoryName(e.target.value);
                          if (!newCategorySlug || newCategorySlug === normalizeCategorySlug(newCategoryName)) {
                            setNewCategorySlug(normalizeCategorySlug(e.target.value));
                          }
                        }}
                        placeholder="e.g. Organic Cotton Linens"
                        className="text-xs h-8 bg-white mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">URL Slug *</Label>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-slate-400 font-mono">/category/</span>
                        <Input
                          value={newCategorySlug}
                          onChange={(e) => setNewCategorySlug(normalizeCategorySlug(e.target.value))}
                          placeholder="cotton-linens"
                          className="text-xs h-8 font-mono bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Description (Optional)</Label>
                      <Input
                        value={newCategoryDesc}
                        onChange={(e) => setNewCategoryDesc(e.target.value)}
                        placeholder="Brief description..."
                        className="text-xs h-8 bg-white mt-1"
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 italic">
                        Creating category does not auto-approve product.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isCreatingCategory || !newCategoryName.trim()}
                        onClick={handleCreateCategoryDuringReview}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-7.5 px-3 cursor-pointer"
                      >
                        {isCreatingCategory ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                        Create &amp; Select
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <Button variant="ghost" size="sm" onClick={() => setApproveId(null)} disabled={isApproving}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#1a3321] hover:bg-[#25422d] text-white text-xs px-4 cursor-pointer gap-1.5"
                onClick={handleApproveConfirm}
                disabled={isApproving}
              >
                {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Confirm &amp; Approve Product
              </Button>
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
function PaymentsView({ payoutRequests: propPayoutRequests = [], transactions = [], onActionComplete, adminEmail, globalSearch }: { payoutRequests?: any[], transactions?: any[], onActionComplete: () => void, adminEmail?: string, globalSearch?: string }) {
  const [subTab, setSubTab] = useState<"sellerOnboarding" | "sellerPending" | "sellerSettled" | "completed" | "pending">("sellerPending");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "PAY" | "CASHFREE_PAY" | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [amountToSettle, setAmountToSettle] = useState("");
  const [settlementError, setSettlementError] = useState("");
  const [searchCompleted, setSearchCompleted] = useState("");
  const [searchPending, setSearchPending] = useState("");
  const [searchSellerPending, setSearchSellerPending] = useState("");
  const [searchSellerSettled, setSearchSellerSettled] = useState("");
  const [searchOnboarding, setSearchOnboarding] = useState("");

  // Payout requests management inside PaymentsView
  const [localPayoutRequests, setLocalPayoutRequests] = useState<any[]>(propPayoutRequests || []);
  const [loadingPayouts, setLoadingPayouts] = useState(false);

  // Sync when prop updates
  useEffect(() => {
    if (propPayoutRequests && propPayoutRequests.length > 0) {
      setLocalPayoutRequests(propPayoutRequests);
    }
  }, [propPayoutRequests]);

  const loadPayouts = useCallback(async () => {
    setLoadingPayouts(true);
    try {
      const data = await getAdminPayoutRequests();
      setLocalPayoutRequests(data);
    } catch (err) {
      console.error("Failed to load payout requests in PaymentsView:", err);
    } finally {
      setLoadingPayouts(false);
    }
  }, []);

  // Fetch immediately on mount & when subTab changes
  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts, subTab]);

  // Periodic polling every 8s to pick up new seller withdrawal requests automatically
  useEffect(() => {
    const timer = setInterval(() => {
      void loadPayouts();
    }, 8000);
    return () => clearInterval(timer);
  }, [loadPayouts]);

  // Seller Onboarding & Fee Configuration state
  const [onboardingProfiles, setOnboardingProfiles] = useState<SellerOnboardingProfile[]>([]);
  const [feeConfig, setFeeConfig] = useState<{ enabled: boolean; amount: number }>({ enabled: false, amount: 1.0 });
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);
  const [updatingFee, setUpdatingFee] = useState(false);
  const [selectedSellerForReview, setSelectedSellerForReview] = useState<SellerOnboardingProfile | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"APPROVE" | "REJECT" | "UPDATE_REQUIRED" | null>(null);
  const [reviewReason, setReviewReason] = useState("");

  const loadOnboardingData = useCallback(async () => {
    setLoadingOnboarding(true);
    try {
      const [profiles, cfg] = await Promise.all([
        getAdminSellerOnboardingProfiles(),
        getAdminRegistrationFeeConfig(),
      ]);
      setOnboardingProfiles(profiles);
      setFeeConfig(cfg);
    } catch (err) {
      console.error("Failed to load seller onboarding profiles in admin:", err);
    } finally {
      setLoadingOnboarding(false);
    }
  }, []);

  useEffect(() => {
    void loadOnboardingData();
  }, [loadOnboardingData]);

  // Handle Toggle of ₹1 Registration Fee
  const handleToggleRegistrationFee = async (nextEnabled: boolean) => {
    setUpdatingFee(true);
    try {
      const res = await updateAdminRegistrationFeeConfig(nextEnabled, 1.0);
      if (res.success) {
        setFeeConfig({ enabled: nextEnabled, amount: 1.0 });
        toast.success(`Seller Registration Fee is now ${nextEnabled ? "ENABLED (₹1.00)" : "DISABLED"}.`);
        await loadOnboardingData();
      } else {
        toast.error(res.error || "Failed to update registration fee configuration.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An error occurred updating fee setting.");
    } finally {
      setUpdatingFee(false);
    }
  };

  // Handle Review of Seller Payout Details
  const handleReviewSellerPayout = async () => {
    if (!selectedSellerForReview || !reviewDecision) return;
    if ((reviewDecision === "REJECT" || reviewDecision === "UPDATE_REQUIRED") && !reviewReason.trim()) {
      toast.error("A reason is required when rejecting or requesting updated details.");
      return;
    }

    setProcessing(true);
    try {
      const res = await adminReviewPayoutProfile(
        selectedSellerForReview.sellerId,
        reviewDecision,
        adminEmail || "admin@earthcentric.com",
        reviewReason.trim() || undefined
      );

      if (res.success) {
        toast.success(
          `Payout details for ${selectedSellerForReview.companyName} ${
            reviewDecision === "APPROVE" ? "approved & verified" : reviewDecision === "REJECT" ? "rejected" : "marked update required"
          }!`
        );
        setSelectedSellerForReview(null);
        setReviewDecision(null);
        setReviewReason("");
        await loadOnboardingData();
        onActionComplete();
      } else {
        toast.error(res.error || "Failed to submit review.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error submitting review.");
    } finally {
      setProcessing(false);
    }
  };

  // Handle Standard / Manual Actions on Payout Request
  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    setProcessing(true);

    if (actionType === "CASHFREE_PAY") {
      try {
        const res = await executeCashfreePayout(selectedRequest.id, adminEmail || "admin@earthcentric.com");
        setProcessing(false);
        if (res.success) {
          toast.success(res.message || "Cashfree transfer initiated successfully!");
          setSelectedRequest(null);
          setActionType(null);
          await loadPayouts();
          onActionComplete();
        } else {
          toast.error(res.error || "Cashfree transfer failed.");
        }
      } catch (err: any) {
        setProcessing(false);
        toast.error(err?.message || "Cashfree execution encountered an error.");
      }
      return;
    }

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
      await loadPayouts();
      onActionComplete();
    } else {
      toast.error("Failed to update payout request.");
    }
  };

  // Handle Cashfree Reconcile Status
  const handleReconcile = async (requestId: string) => {
    setProcessing(true);
    try {
      const res = await reconcileCashfreePayout(requestId);
      if (res.success) {
        toast.success(`Reconciliation complete. Status: ${res.status}`);
        await loadPayouts();
        onActionComplete();
      } else {
        toast.error(res.error || "Reconciliation failed.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Reconcile failed.");
    } finally {
      setProcessing(false);
    }
  };

  // Handle Cashfree Retry Failed Payout
  const handleRetryFailedPayout = async (requestId: string) => {
    setProcessing(true);
    try {
      const res = await retryFailedPayout(requestId, adminEmail || "admin@earthcentric.com");
      if (res.success) {
        toast.success(res.message || "Payout retry initiated via Cashfree!");
        await loadPayouts();
        onActionComplete();
      } else {
        toast.error(res.error || "Retry failed.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Retry failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSettle = async (full = false) => {
    if (!selectedRequest) return;
    const remaining = selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null
      ? selectedRequest.remainingAmount : selectedRequest.amount;
    const amt = full ? remaining : Number(amountToSettle);
    if (isNaN(amt) || amt <= 0) { setSettlementError("Amount must be greater than Rs.0."); return; }
    if (amt > remaining) { setSettlementError("Amount cannot exceed the remaining pending amount."); return; }
    setSettlementError(""); setProcessing(true);
    const success = await settlePayoutRequest(
      selectedRequest.id,
      adminEmail || "admin@earthcentric.com",
      adminNotes || `Payout settlement of Rs.${amt.toLocaleString("en-IN")}`,
      transactionId || undefined,
      "PAID", undefined, amt
    );
    setProcessing(false);
    if (success) {
      toast.success(`Successfully settled Rs.${amt.toLocaleString("en-IN")}!`);
      setSelectedRequest(null); setAmountToSettle(""); setTransactionId(""); setAdminNotes("");
      await loadPayouts();
      onActionComplete();
    } else { toast.error("Failed to process payout settlement."); }
  };

  const filterTx = (list: any[], q: string) => {
    if (!q.trim()) return list;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((t: any) => {
      const s = `${t.id} ${t.orderId} ${t.cashfreePaymentId || ""} ${t.buyerName || ""} ${t.buyerEmail || ""} ${t.sellerCompany || ""} ${(t.products || []).map((p: any) => p.name).join(" ")}`.toLowerCase();
      return words.every((w: string) => s.includes(w));
    });
  };

  const filterPayout = (list: any[], q: string) => {
    if (!q.trim()) return list;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((r: any) => {
      const s = `${r.id} ${r.transactionId || ""} ${r.cfTransferId || ""} ${r.companyName || ""} ${r.sellerName || ""} ${r.sellerEmail || ""} ${r.paymentMethod || ""}`.toLowerCase();
      return words.every((w: string) => s.includes(w));
    });
  };

  const filterOnboarding = (list: SellerOnboardingProfile[], q: string) => {
    if (!q.trim()) return list;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((s) => {
      const str = `${s.companyName} ${s.sellerName} ${s.sellerEmail} ${s.sellerPhone || ""} ${s.maskedBankNumber || ""} ${s.maskedUpiId || ""} ${s.payoutVerificationStatus}`.toLowerCase();
      return words.every((w) => str.includes(w));
    });
  };

  const completedTxns = filterTx(
    transactions.filter((t: any) => ["COMPLETED","SUCCESS","PAID","CONFIRMED"].includes((t.status || "").toUpperCase())),
    searchCompleted
  );
  const pendingTxns = filterTx(
    transactions.filter((t: any) => !["COMPLETED","SUCCESS","PAID","CONFIRMED"].includes((t.status || "").toUpperCase())),
    searchPending
  );
  const sellerPayoutPending = filterPayout(
    localPayoutRequests.filter((r: any) => {
      const st = String(r.status || "").trim().toUpperCase();
      return ["PENDING", "APPROVED", "PROCESSING"].includes(st);
    }),
    searchSellerPending
  );
  const sellerPayoutSettled = filterPayout(
    localPayoutRequests.filter((r: any) => {
      const st = String(r.status || "").trim().toUpperCase();
      return ["PAID", "SETTLED", "PARTIALLY_PAID", "FAILED", "REJECTED"].includes(st);
    }),
    searchSellerSettled
  );
  const filteredOnboarding = filterOnboarding(onboardingProfiles, searchOnboarding);

  const payoutStatusClass = (status: string) =>
    status === "PAID" || status === "SETTLED" ? "bg-emerald-50 text-emerald-700" :
    status === "PROCESSING" ? "bg-purple-50 text-purple-700 animate-pulse" :
    status === "PARTIALLY_PAID" ? "bg-cyan-50 text-cyan-700" :
    status === "APPROVED" ? "bg-blue-50 text-blue-700" :
    status === "REJECTED" || status === "FAILED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";

  const renderTransactionTable = (rows: any[], emptyLabel: string, variant: "success" | "warn") => (
    <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
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
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="text-center py-12 text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-slate-300" /></div>
                {emptyLabel}
              </div>
            </TableCell></TableRow>
          ) : rows.map((t: any) => (
            <TableRow key={t.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
              <TableCell className="py-4 pl-6 align-top">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono font-bold text-[#1a3321]">Txn: {t.id}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">Ord: {t.orderId}</p>
                  {t.cashfreePaymentId && <p className="text-[10px] font-mono text-blue-600/80">CF: {t.cashfreePaymentId}</p>}
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
                          <span className="text-slate-500">{p.quantity} x Rs.{p.price}</span>
                          {p.sellerCompany !== t.sellerCompany && <span className="text-[9px] text-emerald-600 truncate ml-2">({p.sellerCompany})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[10px] text-slate-400 italic">No products recorded.</p>}
              </TableCell>
              <TableCell className="py-4 align-top">
                <p className="text-sm font-black text-[#1a3321]">Rs.{t.amount}</p>
                <p className="text-[9px] text-emerald-600 font-bold mt-1">Platform Fee: Rs.{(t.amount * 0.1).toFixed(0)}</p>
              </TableCell>
              <TableCell className="py-4 align-top">
                {variant === "success"
                  ? <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px] hover:bg-emerald-50"><CheckCircle2 className="h-2.5 w-2.5 mr-1" />{t.status}</Badge>
                  : <Badge className="bg-amber-50 text-amber-700 border-none text-[9px] hover:bg-amber-50"><AlertCircle className="h-2.5 w-2.5 mr-1" />{t.status || "PENDING"}</Badge>
                }
              </TableCell>
              <TableCell className="py-4 text-right pr-6 align-top">
                <p className="text-[10px] font-medium text-muted-foreground">{new Date(t.date).toLocaleDateString()}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(t.date).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  const renderPayoutTable = (rows: any[], emptyLabel: string, showActions: boolean) => (
    <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden text-left">
      <Table>
        <TableHeader>
          <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
            <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 pl-6">Seller Company</TableHead>
            <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Amount</TableHead>
            <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Method &amp; Destination</TableHead>
            <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Requested Date</TableHead>
            <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Status</TableHead>
            <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-12 text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center"><Wallet className="h-5 w-5 text-slate-300" /></div>
                {emptyLabel}
              </div>
            </TableCell></TableRow>
          ) : rows.map((r: any) => {
            const maskedDest = r.paymentMethod === "UPI"
              ? (r.upiDetails?.upiId || "UPI")
              : (r.bankDetails?.accountNumber || "Bank Account");
            return (
              <TableRow key={r.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                <TableCell className="py-4 pl-6 align-top">
                  <p className="text-xs font-bold text-[#1a3321]">{r.companyName}</p>
                  {r.sellerName && <p className="text-[10px] text-muted-foreground mt-0.5">{r.sellerName}</p>}
                  {r.sellerEmail && <p className="text-[10px] text-muted-foreground mt-0.5">{r.sellerEmail}</p>}
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[9px] text-muted-foreground font-mono">ID: {r.id}</p>
                    {r.cfReferenceId && <p className="text-[9px] text-emerald-700 font-mono">Ref: {r.cfReferenceId}</p>}
                    {r.cfTransferId && <p className="text-[9px] text-blue-700 font-mono">CF: {r.cfTransferId}</p>}
                    {r.cfUtr && <p className="text-[9px] text-purple-700 font-mono">UTR: {r.cfUtr}</p>}
                  </div>
                </TableCell>
                <TableCell className="py-4 text-xs font-black text-[#1a3321] align-top">
                  ₹{r.amount.toLocaleString("en-IN")}
                  {r.status === "PARTIALLY_PAID" && (
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Rem: ₹{(r.remainingAmount !== undefined && r.remainingAmount !== null ? r.remainingAmount : r.amount).toLocaleString("en-IN")}
                    </div>
                  )}
                </TableCell>
                <TableCell className="py-4 text-xs align-top">
                  <span className="font-bold uppercase text-[#2d4a36]">{r.paymentMethod}</span>
                  <p className="text-[11px] font-mono text-slate-600 mt-0.5">{maskedDest}</p>
                  {r.bankDetails?.ifscCode && (
                    <p className="text-[9px] text-slate-400 font-mono">IFSC: {r.bankDetails.ifscCode}</p>
                  )}
                </TableCell>
                <TableCell className="py-4 text-xs text-muted-foreground align-top">{new Date(r.requestedAt).toLocaleDateString()}</TableCell>
                <TableCell className="py-4 align-top">
                  <Badge className={`border-none text-[9px] font-bold uppercase ${payoutStatusClass(r.status)}`}>{r.status.replace("_", " ")}</Badge>
                  {r.cfFailureReason && (
                    <p className="text-[9px] text-red-600 max-w-[140px] truncate mt-1" title={r.cfFailureReason}>
                      {r.cfFailureReason}
                    </p>
                  )}
                </TableCell>
                <TableCell className="py-4 text-right pr-6 space-x-1.5 align-top">
                  <Button size="sm" variant="cool" className="text-[10px] h-7 px-2.5" onClick={() => setSelectedRequest(r)}>View Details</Button>

                  {/* Pending actions */}
                  {showActions && r.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] h-7 px-2.5 border-none font-bold"
                        onClick={() => { setSelectedRequest(r); setActionType("CASHFREE_PAY"); }}
                      >
                        Approve &amp; Pay via Cashfree
                      </Button>
                      <Button
                        size="sm"
                        className="bg-slate-700 hover:bg-slate-800 text-white text-[10px] h-7 px-2.5 border-none"
                        onClick={() => { setSelectedRequest(r); setActionType("APPROVE"); }}
                      >
                        Approve (Manual)
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-[10px] h-7 px-2.5"
                        onClick={() => { setSelectedRequest(r); setActionType("REJECT"); }}
                      >
                        Reject
                      </Button>
                    </>
                  )}

                  {/* Approved actions */}
                  {showActions && r.status === "APPROVED" && (
                    <>
                      <Button
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] h-7 px-2.5 border-none font-bold"
                        onClick={() => { setSelectedRequest(r); setActionType("CASHFREE_PAY"); }}
                      >
                        Pay via Cashfree
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#1a3321] hover:bg-[#122417] text-white text-[10px] h-7 px-2.5 border-none"
                        onClick={() => { setSelectedRequest(r); setActionType("PAY"); }}
                      >
                        Mark as Paid (Manual)
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-[10px] h-7 px-2.5"
                        onClick={() => { setSelectedRequest(r); setActionType("REJECT"); }}
                      >
                        Reject
                      </Button>
                    </>
                  )}

                  {/* Processing actions */}
                  {r.status === "PROCESSING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[10px] h-7 px-2.5 border-purple-300 text-purple-700"
                      onClick={() => handleReconcile(r.id)}
                    >
                      Check Status
                    </Button>
                  )}

                  {/* Failed actions */}
                  {r.status === "FAILED" && (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] h-7 px-2.5 border-none"
                      onClick={() => handleRetryFailedPayout(r.id)}
                    >
                      Retry Cashfree Payout
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Payments &amp; Payouts</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage seller bank verification, Cashfree payout disbursements, and customer order transactions.</p>
      </div>

      {/* Tab Pills */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: "sellerPending",    label: "Pending Withdrawal Requests",  count: sellerPayoutPending.length,   activeCls: "bg-rose-50 text-rose-700 border-rose-300 shadow-sm",          pillCls: "bg-rose-100 text-rose-700"     },
          { id: "sellerOnboarding", label: "Seller Payout Onboarding",     count: onboardingProfiles.filter(p => p.payoutVerificationStatus === "PENDING_VERIFICATION").length, activeCls: "bg-purple-50 text-purple-700 border-purple-300 shadow-sm", pillCls: "bg-purple-100 text-purple-800" },
          { id: "sellerSettled",    label: "Settled & Historical Payouts", count: sellerPayoutSettled.length,   activeCls: "bg-blue-50 text-blue-700 border-blue-300 shadow-sm",          pillCls: "bg-blue-100 text-blue-800"     },
          { id: "completed",        label: "Order Completed History",      count: completedTxns.length,        activeCls: "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm", pillCls: "bg-emerald-100 text-emerald-800" },
          { id: "pending",          label: "Order Pending Payment History",count: pendingTxns.length,          activeCls: "bg-amber-50 text-amber-700 border-amber-300 shadow-sm",       pillCls: "bg-amber-100 text-amber-800"   },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 border ${
              subTab === t.id ? t.activeCls : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {t.label}
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${subTab === t.id ? t.pillCls : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Section: Seller Payout Onboarding & Verification */}
      {subTab === "sellerOnboarding" && (
        <div className="space-y-4 text-left">
          {/* Registration Fee Config Banner */}
          <Card className="p-5 bg-gradient-to-r from-slate-50 to-[#f6f9f6] border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-[#1a3321]">Optional Seller Registration Fee</h3>
                <Badge className={feeConfig.enabled ? "bg-emerald-600 text-white border-none text-[9px]" : "bg-slate-200 text-slate-700 border-none text-[9px]"}>
                  {feeConfig.enabled ? "ENABLED (₹1.00)" : "DISABLED"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                When enabled, approved sellers are asked to pay a one-time ₹1.00 onboarding fee before configuring bank/UPI details. Disabled by default.
              </p>
            </div>
            <div>
              <Button
                size="sm"
                disabled={updatingFee}
                onClick={() => handleToggleRegistrationFee(!feeConfig.enabled)}
                className={feeConfig.enabled
                  ? "bg-slate-700 hover:bg-slate-800 text-white text-xs h-8 px-4"
                  : "bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-8 px-4 font-bold"}
              >
                {updatingFee ? "Updating..." : feeConfig.enabled ? "Disable ₹1 Fee" : "Enable ₹1 Fee"}
              </Button>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-[#1a3321]">Seller Payout Beneficiaries</h2>
              <p className="text-[10px] text-muted-foreground">Review bank accounts and UPI IDs submitted by approved sellers for payout settlement</p>
            </div>
            <Input
              type="text"
              placeholder="Search by Company, Name, Email, Bank..."
              value={searchOnboarding}
              onChange={(e) => setSearchOnboarding(e.target.value)}
              className="max-w-xs h-9 text-xs border-slate-200"
            />
          </div>

          <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#e9ece6] bg-[#fdfdfc]">
                  <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase py-4 pl-6">Seller Details</TableHead>
                  <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase py-4">Application</TableHead>
                  <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase py-4">Account Activation</TableHead>
                  <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase py-4">₹1 Fee Status</TableHead>
                  <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase py-4">Beneficiary Destination</TableHead>
                  <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase py-4">Payout Verification</TableHead>
                  <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase py-4 text-right pr-6">Review Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOnboarding.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                      No seller onboarding records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOnboarding.map((s) => (
                    <TableRow key={s.sellerId} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50">
                      <TableCell className="py-4 pl-6 align-top">
                        <p className="text-xs font-bold text-[#1a3321]">{s.companyName}</p>
                        <p className="text-[10px] text-muted-foreground">{s.sellerName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{s.sellerEmail}</p>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <Badge className={
                          s.applicationStatus === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-none text-[9px] font-bold"
                            : "bg-amber-50 text-amber-700 border-none text-[9px] font-bold"
                        }>
                          {s.applicationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        {s.activationStatus === "ACTIVE" ? (
                          <Badge className="bg-emerald-600 text-white border-none text-[9px] font-bold">
                            ACTIVE
                          </Badge>
                        ) : s.activationStatus === "PAYMENT_REQUIRED" ? (
                          <Badge className="bg-amber-500 text-white border-none text-[9px] font-bold">
                            PAYMENT REQUIRED
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-200 text-slate-700 border-none text-[9px] font-bold">
                            RESTRICTED
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        {!s.registrationFeeEnabled ? (
                          <span className="text-[10px] text-slate-400 font-semibold">DISABLED</span>
                        ) : s.registrationFeePaid ? (
                          <div>
                            <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px] font-bold">PAID (₹{s.registrationFeeAmount?.toFixed(2) || "1.00"})</Badge>
                            {s.registrationFeeTransactionId && (
                              <p className="text-[9px] font-mono text-slate-500 truncate max-w-[120px] mt-0.5" title={s.registrationFeeTransactionId}>
                                {s.registrationFeeTransactionId}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border-none text-[9px] font-bold">PENDING (₹{s.registrationFeeAmount?.toFixed(2) || "1.00"})</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        {s.maskedBankNumber ? (
                          <div className="text-xs">
                            <span className="font-bold text-[#2d4a36]">Bank: </span>
                            <span className="font-mono text-[11px]">{s.maskedBankNumber}</span>
                            {s.bankIfsc && <p className="text-[9px] text-slate-500 font-mono">IFSC: {s.bankIfsc}</p>}
                            {s.bankAccountHolderName && <p className="text-[9px] text-slate-600">Holder: {s.bankAccountHolderName}</p>}
                          </div>
                        ) : s.maskedUpiId ? (
                          <div className="text-xs">
                            <span className="font-bold text-[#2d4a36]">UPI: </span>
                            <span className="font-mono text-[11px]">{s.maskedUpiId}</span>
                            {s.upiHolderName && <p className="text-[9px] text-slate-600">Holder: {s.upiHolderName}</p>}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Not submitted</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <Badge className={
                          s.payoutVerificationStatus === "VERIFIED"
                            ? "bg-emerald-50 text-emerald-700 border-none text-[9px] font-bold"
                            : s.payoutVerificationStatus === "PENDING_VERIFICATION"
                            ? "bg-amber-50 text-amber-700 border-none text-[9px] font-bold animate-pulse"
                            : s.payoutVerificationStatus === "VERIFICATION_FAILED"
                            ? "bg-red-50 text-red-700 border-none text-[9px] font-bold"
                            : "bg-slate-100 text-slate-600 border-none text-[9px] font-bold"
                        }>
                          {s.payoutVerificationStatus.replace("_", " ")}
                        </Badge>
                        {s.payoutRejectionReason && (
                          <p className="text-[9px] text-red-600 max-w-[140px] truncate mt-0.5" title={s.payoutRejectionReason}>
                            Reason: {s.payoutRejectionReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6 space-x-1.5 align-top">
                        {s.payoutVerificationStatus === "PENDING_VERIFICATION" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] h-7 px-2.5 border-none"
                              onClick={() => { setSelectedSellerForReview(s); setReviewDecision("APPROVE"); }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-[10px] h-7 px-2.5"
                              onClick={() => { setSelectedSellerForReview(s); setReviewDecision("REJECT"); }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {s.payoutVerificationStatus === "VERIFIED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[10px] h-7 px-2.5 border-slate-200"
                            onClick={() => { setSelectedSellerForReview(s); setReviewDecision("UPDATE_REQUIRED"); }}
                          >
                            Request Update
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Section: Pending Withdrawal Requests */}
      {subTab === "sellerPending" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-rose-100 flex items-center justify-center"><Wallet className="h-4 w-4 text-rose-600" /></div>
              <div>
                <h2 className="text-sm font-extrabold text-[#1a3321]">Pending Withdrawal Requests</h2>
                <p className="text-[10px] text-muted-foreground">Seller payout requests awaiting Super Admin review or Cashfree disbursement</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={loadingPayouts}
                onClick={() => void loadPayouts()}
                className="h-8 px-2.5 text-xs gap-1.5 border-slate-200 hover:bg-slate-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loadingPayouts ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
              {sellerPayoutPending.length > 0 ? (
                <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full animate-pulse">
                  {sellerPayoutPending.length} need action
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">0 records</span>
              )}
            </div>
          </div>
          <Input type="text" placeholder="Search by Seller, Company, ID, Payment Method..." value={searchSellerPending} onChange={(e) => setSearchSellerPending(e.target.value)} className="max-w-md h-9 text-xs border-slate-200" />
          {renderPayoutTable(sellerPayoutPending, "No pending seller payout requests.", true)}
        </div>
      )}

      {/* Section: Settled Payouts */}
      {subTab === "sellerSettled" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center"><Coins className="h-4 w-4 text-blue-600" /></div>
              <div>
                <h2 className="text-sm font-extrabold text-[#1a3321]">Settled &amp; Historical Payouts</h2>
                <p className="text-[10px] text-muted-foreground">All completed settlements, failed transfers, and administrative payout logs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={loadingPayouts}
                onClick={() => void loadPayouts()}
                className="h-8 px-2.5 text-xs gap-1.5 border-slate-200 hover:bg-slate-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loadingPayouts ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">{sellerPayoutSettled.length} records</span>
            </div>
          </div>
          <Input type="text" placeholder="Search by Seller, Company, ID, Reference..." value={searchSellerSettled} onChange={(e) => setSearchSellerSettled(e.target.value)} className="max-w-md h-9 text-xs border-slate-200" />
          {renderPayoutTable(sellerPayoutSettled, "No settled seller payout records.", false)}
        </div>
      )}

      {/* Section: Order Completed History */}
      {subTab === "completed" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div><div><h2 className="text-sm font-extrabold text-[#1a3321]">Order Completed History</h2><p className="text-[10px] text-muted-foreground">All successfully paid and confirmed customer orders</p></div></div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">{completedTxns.length} records</span>
          </div>
          <Input type="text" placeholder="Search by Transaction ID, Order ID, Buyer, Seller, Product..." value={searchCompleted} onChange={(e) => setSearchCompleted(e.target.value)} className="max-w-md h-9 text-xs border-slate-200" />
          {renderTransactionTable(completedTxns, "No completed orders found.", "success")}
        </div>
      )}

      {/* Section: Order Pending Payment History */}
      {subTab === "pending" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center"><AlertCircle className="h-4 w-4 text-amber-600" /></div><div><h2 className="text-sm font-extrabold text-[#1a3321]">Order Pending Payment History</h2><p className="text-[10px] text-muted-foreground">Orders where payment is still awaiting confirmation</p></div></div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">{pendingTxns.length} records</span>
          </div>
          <Input type="text" placeholder="Search by Transaction ID, Order ID, Buyer, Seller, Product..." value={searchPending} onChange={(e) => setSearchPending(e.target.value)} className="max-w-md h-9 text-xs border-slate-200" />
          {renderTransactionTable(pendingTxns, "No pending payment orders found.", "warn")}
        </div>
      )}

      {/* Payout Details Modal */}
      {selectedRequest && !actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="absolute inset-0" onClick={() => setSelectedRequest(null)} />
          <Card className="relative w-full max-w-lg p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-sm text-[#1a3321]">Payout Request Details</h3>
              <button onClick={() => setSelectedRequest(null)} className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">x</button>
            </div>
            <div className="text-xs space-y-2.5 pt-2 max-h-[80vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <p><strong>Seller Name:</strong> {selectedRequest.sellerName || "N/A"}</p>
                <p><strong>Seller Company:</strong> {selectedRequest.companyName}</p>
                <p><strong>Requested Amount:</strong> ₹{selectedRequest.amount.toLocaleString("en-IN")}</p>
                <p><strong>Payment Method:</strong> <span className="font-bold uppercase">{selectedRequest.paymentMethod}</span></p>
                <p><strong>Request Date:</strong> {new Date(selectedRequest.requestedAt).toLocaleString()}</p>
                <p><strong>Current Status:</strong>{" "}<Badge className={`border-none text-[9px] font-bold uppercase ml-1 ${payoutStatusClass(selectedRequest.status)}`}>{selectedRequest.status}</Badge></p>
                {selectedRequest.cfReferenceId && <p><strong>CF Reference:</strong> <span className="font-mono text-emerald-700">{selectedRequest.cfReferenceId}</span></p>}
                {selectedRequest.cfUtr && <p><strong>UTR:</strong> <span className="font-mono text-purple-700">{selectedRequest.cfUtr}</span></p>}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border mt-2">
                <p className="font-bold text-[#1a3321] mb-1">Beneficiary Credentials:</p>
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

              {selectedRequest.cfFailureReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <p className="font-bold">Provider Failure Reason:</p>
                  <p className="mt-0.5">{selectedRequest.cfFailureReason}</p>
                </div>
              )}

              {selectedRequest.isUrgent && (
                <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-700">
                  <p className="font-bold">Urgent Request Reason:</p>
                  <p className="mt-0.5">{selectedRequest.reason || "No reason provided."}</p>
                </div>
              )}

              {/* Settlement History */}
              <div className="pt-3 border-t">
                <h4 className="font-bold text-xs text-[#1a3321] mb-2">Audit &amp; Settlement History</h4>
                {selectedRequest.auditHistory && Array.isArray(selectedRequest.auditHistory) && selectedRequest.auditHistory.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {selectedRequest.auditHistory.map((hist: any, index: number) => (
                      <div key={index} className="p-2 bg-slate-50/70 border rounded-lg flex flex-col space-y-0.5 text-[10px]">
                        <div className="flex justify-between items-center text-slate-500">
                          <span className="font-bold text-[#1a3321]">{hist.action}</span>
                          <span>{new Date(hist.timestamp || hist.date).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-600">{hist.notes || hist.adminNotes || "Action recorded."}</p>
                        {hist.performedBy && <p className="text-slate-400">By: {hist.performedBy}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-slate-400 italic">No audit events recorded yet.</p>}
              </div>

              {/* Manual Settlement Box */}
              {selectedRequest.status !== "REJECTED" && (selectedRequest.remainingAmount !== 0) && (
                <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-3 mt-4 text-left">
                  <h4 className="font-bold text-xs text-[#1a3321]">Manual Settlement (Offline Banking)</h4>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Amount to Settle (₹) *</Label>
                    <div className="flex space-x-2">
                      <Input type="number" placeholder="e.g. 5000" value={amountToSettle} onChange={(e) => setAmountToSettle(e.target.value)} className="bg-white border-slate-200 text-xs h-9 flex-1" />
                      <Button type="button" size="sm" variant="outline" className="text-xs h-9 text-[#1a3321]" onClick={() => { const rem = selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null ? selectedRequest.remainingAmount : selectedRequest.amount; setAmountToSettle(rem.toString()); }}>Max</Button>
                    </div>
                    {settlementError && <p className="text-red-600 text-[10px] font-semibold">{settlementError}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-400">Transaction ID</Label><Input placeholder="TXN..." value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="bg-white border-slate-200 text-xs h-9" /></div>
                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-400">Admin Notes</Label><Input placeholder="Transfer details..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="bg-white border-slate-200 text-xs h-9" /></div>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 border-none text-xs" onClick={() => handleSettle(false)} disabled={processing}>{processing ? "Processing..." : "Settle Amount"}</Button>
                    <Button size="sm" className="bg-[#1a3321] hover:bg-[#122417] text-white flex-1 border-none text-xs" onClick={() => handleSettle(true)} disabled={processing}>{processing ? "Processing..." : "Settle Full Amount"}</Button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="ghost" onClick={() => setSelectedRequest(null)}>Close</Button>
              {selectedRequest.status === "PENDING" && (
                <Button className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs border-none font-bold" onClick={() => setActionType("CASHFREE_PAY")}>
                  Approve &amp; Pay via Cashfree
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Cashfree Transfer Confirmation Modal */}
      {selectedRequest && actionType === "CASHFREE_PAY" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="absolute inset-0" onClick={() => setActionType(null)} />
          <Card className="relative w-full max-w-md p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4 text-left">
            <h3 className="font-bold text-base text-[#1a3321]">Execute Cashfree Payout Transfer</h3>
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2 text-xs">
              <p><strong>Seller:</strong> {selectedRequest.companyName}</p>
              <p><strong>Payout Amount:</strong> <span className="font-extrabold text-emerald-700 text-sm">₹{selectedRequest.amount.toLocaleString("en-IN")}</span></p>
              <p><strong>Method:</strong> <span className="font-bold uppercase">{selectedRequest.paymentMethod}</span></p>
              <p><strong>Destination:</strong> <span className="font-mono text-slate-700">{selectedRequest.paymentMethod === "UPI" ? (selectedRequest.upiDetails?.upiId || "UPI") : (selectedRequest.bankDetails?.accountNumber || "Bank Account")}</span></p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This will invoke Cashfree Direct Transfer API to disburse funds. The status will transition to <strong>PROCESSING</strong> and finalize upon provider confirmation.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="ghost" disabled={processing} onClick={() => setActionType(null)}>Cancel</Button>
              <Button
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold border-none"
                disabled={processing}
                onClick={handleAction}
              >
                {processing ? "Executing Transfer..." : "Confirm & Transfer Funds"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Manual Action Confirm Modal */}
      {selectedRequest && actionType && actionType !== "CASHFREE_PAY" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="absolute inset-0" onClick={() => setActionType(null)} />
          <Card className="relative w-full max-w-sm p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4 text-left">
            <h3 className="font-bold text-sm">
              {actionType === "APPROVE" ? "Approve Payout Request (Manual)" : actionType === "REJECT" ? "Reject Payout Request" : "Mark Payout as Paid"}
            </h3>
            {actionType === "REJECT" && (
              <div className="space-y-1.5">
                <Label>Rejection Reason *</Label>
                <Textarea placeholder="Detail the reason for rejecting this payout..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required className="text-xs min-h-[60px]" />
                <p className="text-[10px] text-muted-foreground">Rejecting this payout will release the reserved funds back to the seller.</p>
              </div>
            )}
            {actionType === "PAY" && (
              <div className="space-y-1.5"><Label>Transaction Reference ID *</Label><Input placeholder="e.g. TXN92834823" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required /></div>
            )}
            <div className="space-y-1.5"><Label>Internal Admin Notes (Optional)</Label><Input placeholder="e.g. Audited and confirmed..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} /></div>
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setActionType(null)}>Back</Button>
              <Button className={actionType === "REJECT" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"} disabled={processing || (actionType === "REJECT" && !rejectReason) || (actionType === "PAY" && !transactionId)} onClick={handleAction}>
                {processing ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Seller Beneficiary Review Modal */}
      {selectedSellerForReview && reviewDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="absolute inset-0" onClick={() => setSelectedSellerForReview(null)} />
          <Card className="relative w-full max-w-md p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4 text-left">
            <h3 className="font-bold text-sm text-[#1a3321]">
              {reviewDecision === "APPROVE" ? "Approve & Verify Payout Beneficiary" : reviewDecision === "REJECT" ? "Reject Payout Beneficiary Details" : "Request Updated Payout Details"}
            </h3>
            <div className="p-3 bg-slate-50 border rounded-xl text-xs space-y-1">
              <p><strong>Seller:</strong> {selectedSellerForReview.companyName}</p>
              <p><strong>Destination:</strong> {selectedSellerForReview.maskedBankNumber ? `Bank: ${selectedSellerForReview.maskedBankNumber} (IFSC: ${selectedSellerForReview.bankIfsc})` : `UPI: ${selectedSellerForReview.maskedUpiId}`}</p>
            </div>
            {reviewDecision !== "APPROVE" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Reason / Feedback for Seller *</Label>
                <Textarea
                  placeholder="Explain why the bank/UPI details were rejected or need updating..."
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  required
                  className="text-xs min-h-[70px]"
                />
              </div>
            )}
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="ghost" disabled={processing} onClick={() => setSelectedSellerForReview(null)}>Cancel</Button>
              <Button
                className={reviewDecision === "APPROVE" ? "bg-emerald-700 hover:bg-emerald-800 text-white font-bold" : "bg-red-600 hover:bg-red-700 text-white"}
                disabled={processing || (reviewDecision !== "APPROVE" && !reviewReason.trim())}
                onClick={handleReviewSellerPayout}
              >
                {processing ? "Submitting..." : reviewDecision === "APPROVE" ? "Approve & Verify" : "Confirm"}
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

function OrderManagementView({ 
  orders, 
  onUpdateStatus, 
  globalSearch,
  sellers = [],
  initialSelectedSellerId,
  onClearSellerFilter
}: { 
  orders: any[], 
  onUpdateStatus: () => void, 
  globalSearch?: string,
  sellers?: any[],
  initialSelectedSellerId?: string | null,
  onClearSellerFilter?: () => void
}) {
  const [trackInput, setTrackInput] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string>(initialSelectedSellerId || "");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isSearchingTrack, setIsSearchingTrack] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [inspectProductId, setInspectProductId] = useState<string | null>(null);
  const [cancellationRequests, setCancellationRequests] = useState<any[]>([]);
  const [processingCancellationId, setProcessingCancellationId] = useState<string | null>(null);

  const loadCancellationRequests = async () => {
    try {
      const requests = await getOrderCancellationsForAdmin();
      setCancellationRequests(requests);
    } catch (error) {
      console.error("Failed to load cancellation requests:", error);
      toast.error("Could not load order cancellation requests.");
    }
  };

  useEffect(() => {
    void loadCancellationRequests();
  }, []);

  const selectedOrderCancellations = useMemo(() => {
    if (!selectedOrder) return [];
    const directMatches = cancellationRequests.filter(
      (req) => req.orderId === selectedOrder.id || req.order?.id === selectedOrder.id
    );
    if (directMatches.length > 0) return directMatches;
    if (selectedOrder.cancellations && Array.isArray(selectedOrder.cancellations) && selectedOrder.cancellations.length > 0) {
      return selectedOrder.cancellations;
    }
    if (selectedOrder.cancellation) {
      return [selectedOrder.cancellation];
    }
    return [];
  }, [selectedOrder, cancellationRequests]);

  const handleCancellationReview = async (request: any, decision: "APPROVE" | "REJECT") => {
    const note = window.prompt(
      decision === "REJECT" ? "Enter the reason for rejecting this cancellation:" : "Optional note for the buyer:"
    );
    if (note === null) return;
    if (decision === "REJECT" && note.trim().length < 8) {
      toast.error("Please enter a rejection reason of at least 8 characters.");
      return;
    }
    setProcessingCancellationId(request.id);
    const result = await reviewOrderCancellation(request.id, decision, note);
    setProcessingCancellationId(null);
    if (!result.success) {
      toast.error(result.error || "Could not review this cancellation.");
      return;
    }
    toast.success(
      decision === "REJECT"
        ? "Cancellation request rejected."
        : result.refundStatus === "SUCCESS"
          ? "Order cancelled and refund completed."
          : result.refundStatus === "PENDING_PAYMENT"
            ? "Order cancelled. Refund will be checked if payment completes."
            : result.refundStatus === "NOT_REQUIRED"
              ? "Order cancelled. No captured payment was due for refund."
              : "Order cancelled. Refund is being processed."
    );
    await Promise.all([loadCancellationRequests(), onUpdateStatus()]);
  };

  const handleRefundRefresh = async (request: any) => {
    setProcessingCancellationId(request.id);
    const result = await refreshOrderCancellationRefund(request.id);
    setProcessingCancellationId(null);
    if (!result.success) {
      toast.error(result.error || "Could not refresh Cashfree refund status.");
      return;
    }
    toast.success(`Refund status: ${result.status}`);
    await Promise.all([loadCancellationRequests(), onUpdateStatus()]);
  };

  const handleRefundResume = async (request: any) => {
    setProcessingCancellationId(request.id);
    const result = await resumePendingOrderCancellationRefund(request.id);
    setProcessingCancellationId(null);
    if (!result.success) {
      toast.error(result.error || "Could not safely resume the refund request.");
      return;
    }
    toast.success(`Refund status: ${result.status}`);
    await Promise.all([loadCancellationRequests(), onUpdateStatus()]);
  };

  const handleRefundRetry = async (request: any) => {
    if (!window.confirm("Cashfree marked this refund as failed. Start a new, separately tracked refund attempt?")) return;
    setProcessingCancellationId(request.id);
    const result = await retryOrderCancellationRefund(request.id);
    setProcessingCancellationId(null);
    if (!result.success) {
      toast.error(result.error || "Could not retry the refund.");
      return;
    }
    toast.success(`Refund attempt status: ${result.status}`);
    await Promise.all([loadCancellationRequests(), onUpdateStatus()]);
  };

  // Scalable combobox & filter states
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState(false);
  const [sellerSearchQuery, setSellerSearchQuery] = useState("");
  const [sellerFilterTab, setSellerFilterTab] = useState<"all" | "active">("all");
  const [orderSortBy, setOrderSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const sellerDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(event.target as Node)) {
        setIsSellerDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSellerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Sync external seller filter prop if provided
  useEffect(() => {
    if (initialSelectedSellerId !== undefined && initialSelectedSellerId !== null) {
      setSelectedSellerId(initialSelectedSellerId);
    }
  }, [initialSelectedSellerId]);

  // Aggregate comprehensive seller list strictly in alphabetical order (A to Z)
  const baseSellersList = useMemo(() => {
    const sellerMap = new Map<string, { id: string; companyName: string; email?: string }>();

    // 1. All registered sellers
    (sellers || []).forEach((s: any) => {
      const id = s.id || s.userId;
      if (id && s.companyName && !sellerMap.has(id)) {
        sellerMap.set(id, {
          id: id,
          companyName: s.companyName.trim(),
          email: s.user?.email || s.email || "",
        });
      }
    });

    // 2. Any seller attached to orders or items
    (orders || []).forEach((o: any) => {
      if (o.seller?.id && !sellerMap.has(o.seller.id)) {
        sellerMap.set(o.seller.id, {
          id: o.seller.id,
          companyName: (o.seller.companyName || "").trim(),
          email: o.seller.email || "",
        });
      }
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach((it: any) => {
          if (it.seller?.id && !sellerMap.has(it.seller.id)) {
            sellerMap.set(it.seller.id, {
              id: it.seller.id,
              companyName: (it.seller.companyName || "").trim(),
              email: it.seller.email || "",
            });
          }
        });
      }
    });

    // Compute order counts and sort strictly alphabetically (A to Z)
    return Array.from(sellerMap.values())
      .filter((s) => s.companyName && s.companyName.length > 0)
      .map((seller) => {
        const orderCount = (orders || []).filter((o: any) => {
          if (o.sellerId === seller.id || o.seller?.id === seller.id) return true;
          if (o.items?.some((it: any) => it.seller?.id === seller.id || (it.seller?.companyName && it.seller.companyName.toLowerCase() === seller.companyName.toLowerCase()))) return true;
          return false;
        }).length;

        const totalRevenue = (orders || []).reduce((acc: number, o: any) => {
          const match = o.sellerId === seller.id || o.seller?.id === seller.id || o.items?.some((it: any) => it.seller?.id === seller.id || (it.seller?.companyName && it.seller.companyName.toLowerCase() === seller.companyName.toLowerCase()));
          return match ? acc + (o.totalAmount || 0) : acc;
        }, 0);

        return {
          ...seller,
          orderCount,
          totalRevenue,
        };
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: "base" }));
  }, [sellers, orders]);

  // Active seller object
  const activeSeller = useMemo(() => {
    if (!selectedSellerId) return null;
    return baseSellersList.find((s) => s.id === selectedSellerId) || null;
  }, [selectedSellerId, baseSellersList]);

  // Top active sellers with orders (for fast 1-click pills)
  const activeSellersWithOrders = useMemo(() => {
    return baseSellersList.filter((s) => s.orderCount > 0);
  }, [baseSellersList]);

  // Dynamic filtered list inside the combobox for fast search when sellers scale to 50+ / 100+
  const visibleSellersInDropdown = useMemo(() => {
    let list = baseSellersList;
    if (sellerFilterTab === "active") {
      list = list.filter((s) => s.orderCount > 0);
    }
    if (!sellerSearchQuery.trim()) return list;

    const q = sellerSearchQuery.trim().toLowerCase();
    return list.filter((s) => 
      s.companyName.toLowerCase().includes(q) || 
      (s.email && s.email.toLowerCase().includes(q)) ||
      s.id.toLowerCase().includes(q)
    );
  }, [baseSellersList, sellerSearchQuery, sellerFilterTab]);

  // Handle clearing the seller filter
  const handleClearSellerFilter = () => {
    setSelectedSellerId("");
    if (onClearSellerFilter) onClearSellerFilter();
  };

  // Helper to extract seller info for an order row
  const getOrderSellerInfo = (order: any) => {
    if (order.seller?.companyName) {
      return { 
        name: order.seller.companyName, 
        email: order.seller.email || "", 
        id: order.seller.id || order.sellerId || "" 
      };
    }
    const itemWithSeller = order.items?.find((it: any) => it.seller?.companyName);
    if (itemWithSeller?.seller) {
      return { 
        name: itemWithSeller.seller.companyName, 
        email: itemWithSeller.seller.email || "", 
        id: itemWithSeller.seller.id || "" 
      };
    }
    return { name: "EarthCentric Direct", email: "", id: "" };
  };

  // 1. Filter orders by selected seller (if any)
  const sellerFilteredOrders = useMemo(() => {
    if (!selectedSellerId) return orders || [];

    return (orders || []).filter((o: any) => {
      if (o.sellerId && o.sellerId === selectedSellerId) return true;
      if (o.seller?.id && o.seller.id === selectedSellerId) return true;
      if (o.items && Array.isArray(o.items)) {
        if (o.items.some((it: any) => it.seller?.id === selectedSellerId)) return true;
      }
      if (activeSeller) {
        if (o.seller?.companyName && o.seller.companyName.toLowerCase() === activeSeller.companyName.toLowerCase()) return true;
        if (o.items && Array.isArray(o.items)) {
          if (o.items.some((it: any) => it.seller?.companyName && it.seller.companyName.toLowerCase() === activeSeller.companyName.toLowerCase())) return true;
        }
      }
      return false;
    });
  }, [orders, selectedSellerId, activeSeller]);

  // 2. Filter orders by search terms AND apply order sorting (Date / Amount)
  const displayOrders = useMemo(() => {
    const term = (trackInput || globalSearch || "").trim().toLowerCase();
    let result = sellerFilteredOrders;

    if (term) {
      const words = term.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        result = result.filter((o: any) => {
          const targetStr = `
            ${o.id || ""}
            ec-ord-${(o.id || "").substring(4, 10).toLowerCase()}
            ${o.user?.name || ""}
            ${o.user?.email || ""}
            ${o.seller?.companyName || ""}
            ${(o.items || []).map((it: any) => `${it.name || ""} ${it.seller?.companyName || ""}`).join(" ")}
          `.toLowerCase();

          return words.every((word) => targetStr.includes(word));
        });
      }
    }

    // Sort orders table
    const sorted = [...result];
    if (orderSortBy === "newest") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (orderSortBy === "oldest") {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (orderSortBy === "highest") {
      sorted.sort((a, b) => b.totalAmount - a.totalAmount);
    } else if (orderSortBy === "lowest") {
      sorted.sort((a, b) => a.totalAmount - b.totalAmount);
    }

    return sorted;
  }, [sellerFilteredOrders, trackInput, globalSearch, orderSortBy]);

  // Executive KPI summary metrics
  const totalRevenueDisplayed = useMemo(() => {
    return displayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [displayOrders]);

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
      {/* Executive Header & Filter Context */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 flex-wrap">
            <h1 className="text-2xl font-extrabold text-[#1a3321] tracking-tight">Order Tracking &amp; Management System</h1>
            {selectedSellerId && activeSeller ? (
              <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs px-2.5 py-0.5 font-bold flex items-center space-x-1">
                <Store className="h-3 w-3 text-emerald-700" />
                <span>{activeSeller.companyName}</span>
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-0.5 font-bold flex items-center space-x-1">
                <Layers className="h-3 w-3 text-slate-500" />
                <span>Platform-Wide ({orders.length} Orders)</span>
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {selectedSellerId && activeSeller ? (
              <span>
                Isolated fulfillment orders for <strong className="text-emerald-950 font-bold">{activeSeller.companyName}</strong>. Click &quot;All Sellers&quot; to restore platform-wide management.
              </span>
            ) : (
              "Platform-wide overview of all customer order stages, payment status, seller fulfillment, and carbon offsets."
            )}
          </p>
        </div>

        {/* Quick Reset if filtered */}
        {selectedSellerId && (
          <Button
            onClick={handleClearSellerFilter}
            className="bg-white hover:bg-emerald-50 text-[#1a3321] border border-emerald-300 text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center space-x-2 cursor-pointer transition-all self-start md:self-auto"
          >
            <X className="h-3.5 w-3.5 text-emerald-800" />
            <span>Reset to Overall Platform View</span>
          </Button>
        )}
      </div>

      {/* 3 Executive High-Value KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Orders */}
        <div className="bg-white border border-[#e8ece7] rounded-2xl p-4.5 shadow-xs flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-100">
            <PackageCheck className="h-6 w-6 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {selectedSellerId ? "Seller Orders" : "Platform Orders"}
            </p>
            <h3 className="text-2xl font-black text-[#1a3321] tracking-tight">
              {displayOrders.length}
              <span className="text-xs font-bold text-slate-400 ml-1.5 font-normal">
                / {orders.length} total
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {selectedSellerId && activeSeller ? `Fulfilled by ${activeSeller.companyName}` : "Across all registered sellers"}
            </p>
          </div>
        </div>

        {/* Card 2: Revenue */}
        <div className="bg-white border border-[#e8ece7] rounded-2xl p-4.5 shadow-xs flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-100">
            <DollarSign className="h-6 w-6 text-teal-700" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {selectedSellerId ? "Seller Volume (GMV)" : "Total Orders Value"}
            </p>
            <h3 className="text-2xl font-black text-[#1a3321] tracking-tight">
              ₹{totalRevenueDisplayed.toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {selectedSellerId ? "Order value for this seller" : "Gross merchandise handled"}
            </p>
          </div>
        </div>

        {/* Card 3: Fulfillment Partners */}
        <div className="bg-white border border-[#e8ece7] rounded-2xl p-4.5 shadow-xs flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-slate-50 text-[#1a3321] flex items-center justify-center shrink-0 border border-slate-200">
            <Store className="h-6 w-6 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fulfillment Partners</p>
            <h3 className="text-2xl font-black text-[#1a3321] tracking-tight">
              {baseSellersList.length}
              <span className="text-xs font-bold text-slate-400 ml-1.5 font-normal">
                Sellers (A → Z)
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {activeSellersWithOrders.length} currently fulfilling orders
            </p>
          </div>
        </div>
      </div>

      {/* Enterprise Filter & Search Control Center (Zero clipping, fully scalable) */}
      <div className="bg-white border border-[#e8ece7] rounded-2xl shadow-xs p-4 sm:p-5 space-y-4 relative">
        {/* Top Row: Global Order Search & Direct Tracker */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID (e.g. EC-ORD-4729), Buyer Name, Email, or Product..."
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              className="w-full bg-[#f8faf7] hover:bg-white focus:bg-white border border-[#e2e7e0] rounded-xl pl-10 pr-10 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3321] transition-all"
              onKeyDown={(e) => { if (e.key === "Enter") handleTrackSearch(); }}
            />
            {trackInput && (
              <button
                type="button"
                onClick={() => setTrackInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            onClick={handleTrackSearch}
            disabled={isSearchingTrack || !trackInput.trim()}
            className="bg-[#1a3321] hover:bg-[#122417] text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center justify-center space-x-2 shrink-0 border-none cursor-pointer shadow-xs transition-all"
          >
            <Search className="h-4 w-4" />
            <span>Track Order</span>
          </Button>
        </div>

        {/* Bottom Row: Perfect Seller Account Selector + Sort Orders Control */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3.5 pt-3.5 border-t border-[#f0f3ef]">
          {/* Left: Scalable Seller Account Combobox + Quick-Access Seller Badges */}
          <div className="flex items-center gap-2.5 flex-wrap flex-1">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#1a3321] shrink-0 mr-1">
              <Store className="h-4 w-4 text-emerald-700" />
              <span>Seller Account:</span>
            </div>

            {/* Custom Scalable Seller Selector Dropdown (Scales smoothly to 50+ / 100+ sellers) */}
            <div className="relative" ref={sellerDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSellerDropdownOpen((prev) => !prev)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2.5 border shadow-xs min-w-[220px] justify-between ${
                  selectedSellerId
                    ? "bg-emerald-50/90 border-emerald-300 text-emerald-950 ring-2 ring-emerald-600/15"
                    : isSellerDropdownOpen
                      ? "bg-white border-[#1a3321] ring-2 ring-[#1a3321]/15 text-[#1a3321]"
                      : "bg-slate-50 hover:bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  {selectedSellerId && activeSeller ? (
                    <>
                      <div className="h-5 w-5 rounded-md bg-[#1a3321] text-white flex items-center justify-center text-[10px] font-black shrink-0 uppercase">
                        {activeSeller.companyName.substring(0, 2)}
                      </div>
                      <span className="truncate max-w-[150px] font-extrabold text-[#1a3321]">
                        {activeSeller.companyName}
                      </span>
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span className="font-bold text-[#1a3321]">All Sellers (Platform-wide)</span>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedSellerId 
                      ? "bg-emerald-200/80 text-emerald-900" 
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {selectedSellerId && activeSeller ? `${activeSeller.orderCount} orders` : `${orders.length} orders`}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                    isSellerDropdownOpen ? "rotate-180 text-emerald-800" : ""
                  }`} />
                </div>
              </button>

              {/* Floating Directory Popover (Guaranteed ZERO clipping, rendered with z-50 and absolute placement) */}
              {isSellerDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-[340px] sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200/95 z-50 p-3.5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Header inside popover */}
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-[#1a3321] flex items-center space-x-1.5">
                      <Store className="h-3.5 w-3.5 text-emerald-700" />
                      <span>Select Seller Account</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                      Strictly A → Z ({baseSellersList.length} Sellers)
                    </span>
                  </div>

                  {/* Real-time search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search seller by company name or email..."
                      value={sellerSearchQuery}
                      onChange={(e) => setSellerSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3321]"
                    />
                    {sellerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSellerSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs: All Sellers vs With Orders */}
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSellerFilterTab("all")}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        sellerFilterTab === "all"
                          ? "bg-white text-[#1a3321] shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      All Sellers ({baseSellersList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellerFilterTab("active")}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        sellerFilterTab === "active"
                          ? "bg-white text-[#1a3321] shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      With Orders ({activeSellersWithOrders.length})
                    </button>
                  </div>

                  {/* Pinned "All Sellers" Option */}
                  <button
                    type="button"
                    onClick={() => {
                      handleClearSellerFilter();
                      setIsSellerDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer border ${
                      !selectedSellerId 
                        ? "bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold" 
                        : "hover:bg-slate-50 border-transparent text-slate-700"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center text-xs font-black shrink-0">
                        <Building2 className="h-4 w-4 text-emerald-800" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1a3321]">All Sellers (Platform-wide)</p>
                        <p className="text-[10px] text-slate-400">View orders across all fulfillment partners</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-slate-100 text-slate-700 border-none text-[10px] font-bold">
                        {orders.length} orders
                      </Badge>
                      {!selectedSellerId && <Check className="h-4 w-4 text-emerald-700 shrink-0" />}
                    </div>
                  </button>

                  {/* Scrollable Seller List strictly in Alphabetical Order (A to Z) */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-50">
                    {visibleSellersInDropdown.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground space-y-1">
                        <p className="font-semibold text-slate-600">No sellers matching &quot;{sellerSearchQuery}&quot;</p>
                        <button
                          type="button"
                          onClick={() => { setSellerSearchQuery(""); setSellerFilterTab("all"); }}
                          className="text-[11px] text-emerald-700 hover:underline font-bold cursor-pointer"
                        >
                          Reset filters
                        </button>
                      </div>
                    ) : (
                      visibleSellersInDropdown.map((seller) => {
                        const isSelected = selectedSellerId === seller.id;
                        return (
                          <button
                            key={seller.id}
                            type="button"
                            onClick={() => {
                              setSelectedSellerId(seller.id);
                              setIsSellerDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer border ${
                              isSelected
                                ? "bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold"
                                : "hover:bg-slate-50 border-transparent text-slate-700"
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                              <div className="h-7 w-7 rounded-lg bg-slate-100 text-[#1a3321] flex items-center justify-center text-xs font-black shrink-0 uppercase border border-slate-200">
                                {seller.companyName.substring(0, 2)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-[#1a3321] truncate">{seller.companyName}</p>
                                {seller.email && (
                                  <p className="text-[10px] text-slate-400 truncate">{seller.email}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0 ml-2">
                              <Badge className={`text-[10px] border-none font-bold ${
                                seller.orderCount > 0 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : "bg-slate-100 text-slate-400"
                              }`}>
                                {seller.orderCount} {seller.orderCount === 1 ? "order" : "orders"}
                              </Badge>
                              {isSelected && <Check className="h-4 w-4 text-emerald-700 shrink-0" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Popover Footer Info */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Sorted A → Z automatically</span>
                    <span>Scales to 500+ sellers</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick-Access 1-Click Pills for Active Sellers */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleClearSellerFilter}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 border shadow-xs ${
                  !selectedSellerId
                    ? "bg-[#1a3321] text-white border-[#1a3321]"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-[#1a3321]"
                }`}
              >
                <span>All Sellers</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  !selectedSellerId ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {orders.length}
                </span>
              </button>

              {activeSellersWithOrders.map((seller) => {
                const isSelected = selectedSellerId === seller.id;
                return (
                  <button
                    key={seller.id}
                    type="button"
                    onClick={() => setSelectedSellerId(seller.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 border truncate max-w-[180px] shadow-xs ${
                      isSelected
                        ? "bg-[#1a3321] text-white border-[#1a3321]"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-[#1a3321]"
                    }`}
                    title={`${seller.companyName} (${seller.orderCount} orders)`}
                  >
                    <span className="truncate">{seller.companyName}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                      isSelected 
                        ? "bg-white/25 text-white" 
                        : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {seller.orderCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Sort Control & Active Orders Count */}
          <div className="flex items-center space-x-2.5 shrink-0 self-end xl:self-auto">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-500">Sort:</span>
              <select
                value={orderSortBy}
                onChange={(e) => setOrderSortBy(e.target.value as any)}
                className="bg-transparent text-[#1a3321] text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Amount: High to Low</option>
                <option value="lowest">Amount: Low to High</option>
              </select>
            </div>

            {selectedSellerId && (
              <button
                type="button"
                onClick={handleClearSellerFilter}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {trackError && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{trackError}</span>
          </div>
        )}
      </div>

      {/* Prominent Active Seller Filter Ribbon */}
      {activeSeller && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gradient-to-r from-[#1a3321] via-[#23482f] to-[#1a3321] text-white rounded-2xl shadow-sm gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center font-black text-sm shrink-0">
              <Store className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="font-extrabold text-white text-base">
                  {activeSeller.companyName}
                </span>
                <Badge className="bg-emerald-500 text-[#1a3321] text-[9px] font-black border-none uppercase tracking-wider">
                  Active Filter
                </Badge>
                {activeSeller.email && (
                  <span className="text-xs text-emerald-200/80 font-medium">({activeSeller.email})</span>
                )}
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Showing <strong>{displayOrders.length}</strong> of <strong>{orders.length}</strong> total platform orders fulfilled by this seller • Total Order Value: <strong>₹{totalRevenueDisplayed.toLocaleString()}</strong>
              </p>
            </div>
          </div>

          <Button
            onClick={handleClearSellerFilter}
            className="bg-white hover:bg-emerald-50 text-[#1a3321] border-none text-xs px-4 py-2 h-9 rounded-xl font-bold shadow-md flex items-center space-x-1.5 cursor-pointer shrink-0 transition-all"
          >
            <X className="h-3.5 w-3.5 text-emerald-800" />
            <span>Show All {orders.length} Orders</span>
          </Button>
        </div>
      )}

      {/* Orders Table */}
      <Card className="bg-white border border-[#e8ece7] shadow-xs rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4 pl-6">Order ID</TableHead>
              <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Seller Account</TableHead>
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
                <TableCell colSpan={9} className="text-center py-16 text-xs text-muted-foreground">
                  {selectedSellerId ? (
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Store className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="font-bold text-slate-700 text-sm">No orders found for {activeSeller?.companyName || "this seller account"}.</p>
                      <p className="text-xs text-slate-400 max-w-sm">This merchant is registered on the platform, but has not yet received or fulfilled any customer orders.</p>
                      <Button
                        onClick={handleClearSellerFilter}
                        className="bg-[#1a3321] hover:bg-[#122417] text-white text-xs font-bold px-4 py-2 rounded-xl mt-2 cursor-pointer shadow-xs"
                      >
                        Return to All Platform Orders ({orders.length})
                      </Button>
                    </div>
                  ) : (
                    <p>No orders found matching your criteria.</p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              displayOrders.map((order: any) => {
                const sellerInfo = getOrderSellerInfo(order);
                const isFilteredSeller = selectedSellerId && sellerInfo.id === selectedSellerId;

                return (
                  <TableRow key={order.id} className={`border-[#e9ece6] transition-colors ${isFilteredSeller ? "bg-emerald-50/20 hover:bg-emerald-50/40" : "hover:bg-[#fbfcfb]"}`}>
                    <TableCell className="font-bold text-xs text-[#1a3321] py-4 pl-6">
                      EC-ORD-{(order.id || "").substring(4, 10).toUpperCase()}
                    </TableCell>

                    {/* Clickable Seller Account Column */}
                    <TableCell className="py-4">
                      {sellerInfo.id ? (
                        <button
                          type="button"
                          onClick={() => setSelectedSellerId(sellerInfo.id)}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            selectedSellerId === sellerInfo.id
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300 ring-1 ring-emerald-500/20"
                              : "bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 hover:border-emerald-200"
                          }`}
                          title={`Click to filter orders specifically for ${sellerInfo.name}`}
                        >
                          <Store className="h-3 w-3 text-emerald-700 shrink-0" />
                          <span className="truncate max-w-[130px]">{sellerInfo.name}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">{sellerInfo.name}</span>
                      )}
                    </TableCell>

                    <TableCell className="py-4">
                      <div className="text-xs font-medium text-slate-800">{order.user?.name || "Direct Customer"}</div>
                      <div className="text-[10px] text-muted-foreground">{order.user?.email || "customer@earthcentric.com"}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-4">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-700 py-4">
                      {order.items?.length || 1} items
                    </TableCell>
                    <TableCell className="font-extrabold text-xs text-[#1a3321] py-4">
                      ₹{order.totalAmount?.toLocaleString()}
                    </TableCell>
                    <TableCell className="py-4">
                      {(() => {
                        const effectiveStatus = (order.orderStatus || order.status || "CONFIRMED").toUpperCase();
                        const cancelReq = cancellationRequests.find((c) => c.orderId === order.id || c.order?.id === order.id) || order.cancellation;
                        return (
                          <div className="flex flex-col gap-1 items-start">
                            <Badge className={`text-[10px] font-bold border-none capitalize ${
                              effectiveStatus === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-800"
                                : effectiveStatus === "SHIPPED"
                                ? "bg-blue-100 text-blue-800"
                                : effectiveStatus === "CANCELLED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              {effectiveStatus}
                            </Badge>
                            {cancelReq && (
                              <Badge className={`text-[9px] font-semibold border ${
                                cancelReq.status === "REQUESTED"
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : cancelReq.status === "APPROVED"
                                  ? "bg-blue-50 text-blue-800 border-blue-200"
                                  : "bg-rose-50 text-rose-800 border-rose-200"
                              }`}>
                                {cancelReq.status === "REQUESTED" ? "Cancellation Pending" : `Cancelled (${cancelReq.refundStatus || "Refund"})`}
                              </Badge>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge className={`text-[10px] font-bold border-none capitalize ${
                        order.paymentStatus === "PAID" || order.paymentStatus === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {order.paymentStatus || "COMPLETED"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                        className="text-xs font-bold text-[#1a3321] border-[#1a3321] hover:bg-[#1a3321] hover:text-white rounded-xl h-8 px-3.5 transition-colors cursor-pointer"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Order Detail Modal with Seller Timeline, Item Inspection, & Cancellation/Refund Info */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-6">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <h3 className="font-bold text-base text-[#1a3321]">Order Details: EC-ORD-{selectedOrder.id.substring(4, 10).toUpperCase()}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            
            {/* Seller Account Indicator inside Modal */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Store className="h-4 w-4 text-emerald-700 shrink-0" />
                <span className="text-emerald-900 font-semibold">
                  Fulfilling Seller: <strong>{getOrderSellerInfo(selectedOrder).name}</strong>
                </span>
              </div>
              {selectedSellerId !== getOrderSellerInfo(selectedOrder).id && getOrderSellerInfo(selectedOrder).id && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSellerId(getOrderSellerInfo(selectedOrder).id);
                    setSelectedOrder(null);
                  }}
                  className="text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  Filter this seller&apos;s orders →
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Order Items & Summary */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Order Items</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {selectedOrder.items.map((it: any, idx: number) => {
                      const isTargetSeller = selectedSellerId && (
                        it.seller?.id === selectedSellerId || 
                        it.seller?.companyName?.toLowerCase() === activeSeller?.companyName?.toLowerCase()
                      );
                      return (
                        <div key={idx} className={`flex items-center space-x-3 text-xs p-2.5 rounded-lg border ${isTargetSeller ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                          <img src={it.image || "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=100"} className="h-10 w-10 object-cover rounded" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <p className="font-bold text-[#1a3321] truncate">{it.name}</p>
                              {isTargetSeller && (
                                <Badge className="bg-emerald-600 text-white text-[8px] px-1 py-0 font-bold shrink-0">Selected Seller</Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">Qty: {it.quantity} × ₹{it.price}</p>
                            {it.seller?.companyName && (
                              <p className="text-[9px] text-emerald-800 font-semibold truncate">Seller: {it.seller.companyName}</p>
                            )}
                          </div>
                          {it.productId && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 px-2 text-[10px] text-emerald-800 hover:bg-emerald-100/50"
                              onClick={() => setInspectProductId(it.productId)}
                            >
                              Inspect
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Payment Method:</span>
                    <span className="font-semibold text-slate-700 capitalize">{selectedOrder.paymentMethod || "Prepaid"}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Amount:</span>
                    <span className="font-bold text-[#1a3321]">₹{selectedOrder.totalAmount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Tracking Timeline */}
              <div>
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Tracking Milestones</h4>
                <div className="border rounded-lg p-3 bg-slate-50 max-h-56 overflow-y-auto space-y-3">
                  <div className="space-y-4">
                    {selectedOrder.trackingEvents && selectedOrder.trackingEvents.length > 0 ? (
                      selectedOrder.trackingEvents.map((evt: any, i: number) => (
                        <div key={i} className="flex space-x-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                          <div>
                            <p className="font-bold text-[#1a3321]">{evt.status}</p>
                            <p className="text-[10px] text-muted-foreground">{evt.message}</p>
                            <p className="text-[9px] text-slate-400">{new Date(evt.timestamp).toLocaleString()}</p>
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

            {/* Extra Information: Cancellation & Refund Details */}
            {selectedOrderCancellations.length > 0 && (
              <div className="border border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-[#fdfaf5] rounded-2xl p-4.5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <RotateCcw className="h-4 w-4 text-amber-700" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#1a3321] tracking-wide uppercase">
                        Cancellation &amp; Refund Details
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Order lifecycle exception and Cashfree refund telemetry
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] px-2 py-0.5">
                    {selectedOrderCancellations.length} Record{selectedOrderCancellations.length > 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {selectedOrderCancellations.map((cancellation: any) => (
                    <div
                      key={cancellation.id}
                      className="bg-white border border-amber-200/70 rounded-xl p-3.5 space-y-2.5 text-xs shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-slate-800">
                            Order {cancellation.orderId || selectedOrder.id}
                          </span>
                          <Badge
                            className={
                              cancellation.status === "REQUESTED"
                                ? "bg-amber-100 text-amber-800 border-amber-300 font-bold text-[10px]"
                                : cancellation.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800 border-blue-300 font-bold text-[10px]"
                                : "bg-rose-100 text-rose-800 border-rose-300 font-bold text-[10px]"
                            }
                          >
                            {cancellation.status}
                          </Badge>
                          {cancellation.status === "APPROVED" && (
                            <Badge
                              className={`border font-bold text-[10px] ${
                                cancellation.refundStatus === "SUCCESS"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : cancellation.refundStatus === "FAILED"
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : cancellation.refundStatus === "PENDING" || cancellation.refundStatus === "PENDING_PAYMENT"
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              Refund: {cancellation.refundStatus}
                            </Badge>
                          )}
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {cancellation.status === "REQUESTED" && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white border-none shadow-xs cursor-pointer"
                                disabled={processingCancellationId === cancellation.id}
                                onClick={() => handleCancellationReview(cancellation, "APPROVE")}
                              >
                                Approve &amp; refund
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-[10px] font-bold text-rose-700 border-rose-300 hover:bg-rose-50 cursor-pointer"
                                disabled={processingCancellationId === cancellation.id}
                                onClick={() => handleCancellationReview(cancellation, "REJECT")}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {cancellation.status === "APPROVED" &&
                            (cancellation.refundStatus === "PENDING" || cancellation.refundStatus === "PENDING_PAYMENT") &&
                            cancellation.cashfreeRefundId && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-[10px] font-bold text-blue-700 border-blue-300 hover:bg-blue-50 cursor-pointer"
                                  disabled={processingCancellationId === cancellation.id}
                                  onClick={() => handleRefundRefresh(cancellation)}
                                >
                                  Refresh refund
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-[10px] font-bold text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer"
                                  disabled={processingCancellationId === cancellation.id}
                                  onClick={() => handleRefundResume(cancellation)}
                                >
                                  Retry safely
                                </Button>
                              </>
                            )}
                          {cancellation.status === "APPROVED" && cancellation.refundStatus === "FAILED" && (
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white border-none shadow-xs cursor-pointer"
                              disabled={processingCancellationId === cancellation.id}
                              onClick={() => handleRefundRetry(cancellation)}
                            >
                              Retry failed refund
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1 border-t border-slate-100 text-slate-700">
                        <p className="text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-900">Buyer:</span> {cancellation.order?.user?.name || selectedOrder.user?.name || "Customer"} ({cancellation.order?.user?.email || selectedOrder.user?.email || "no email"}) · <span className="font-semibold text-slate-900">Seller:</span> {cancellation.order?.seller?.companyName || getOrderSellerInfo(selectedOrder).name || "Marketplace seller"}
                        </p>
                        <p className="text-xs">
                          <span className="font-bold text-slate-900">Reason:</span> <span className="text-slate-800 font-medium">{cancellation.reason}</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Requested by <strong className="text-slate-700 uppercase">{cancellation.requestedByRole || "BUYER"}</strong> · {new Date(cancellation.requestedAt).toLocaleString()} · Payment: <span className="font-semibold text-slate-700">{cancellation.order?.payment?.status || selectedOrder.paymentStatus || "COMPLETED"}</span>
                        </p>
                        {cancellation.refundAmount != null && (
                          <p className="text-xs text-[#1a3321]">
                            <strong>Refund amount:</strong> <span className="font-black text-emerald-800">₹{cancellation.refundAmount.toLocaleString("en-IN")}</span>
                          </p>
                        )}
                        {(cancellation.cashfreeRefundReference || cancellation.cashfreeRefundId) && (
                          <p className="text-[10px] text-slate-600 font-mono break-all bg-slate-50 p-1.5 rounded border border-slate-200">
                            <strong>Cashfree refund reference:</strong> {cancellation.cashfreeRefundReference || cancellation.cashfreeRefundId}
                          </p>
                        )}
                        {cancellation.refundArn && (
                          <p className="text-[10px] text-slate-600 font-mono">
                            <strong>Refund ARN:</strong> {cancellation.refundArn}
                          </p>
                        )}
                        {cancellation.refundError && (
                          <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                            <strong>Refund note:</strong> {cancellation.refundError}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between space-x-2 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-200"
                onClick={async () => {
                  const reason = window.prompt("Enter the reason for cancelling this order:");
                  if (reason === null) return;
                  const result = await cancelOrderAsAdmin(selectedOrder.id, reason);
                  if (!result.success) {
                    toast.error(result.error || "Could not cancel this order.");
                    return;
                  }
                  toast.success(`Order cancelled. Refund status: ${result.refundStatus || "pending review"}.`);
                  await Promise.all([loadCancellationRequests(), onUpdateStatus()]);
                  setSelectedOrder(null);
                }}
              >
                Cancel &amp; refund
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
}function CredentialsManagerView({ credentials, reload, globalSearch }: { credentials: CredentialItem[], reload: () => void, globalSearch?: string }) {
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
                <h3 className="text-xs font-bold text-[#1a3321]">Cashfree Gateway &amp; Payouts</h3>
                <p className="text-[9px] text-[#8ca193] uppercase font-semibold">Payment collection (PG) &amp; seller withdrawal disbursement (Payouts) credentials</p>
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
// PROMOTIONS & DISCOUNT APPROVAL VIEW
// --------------------------------------------------------------------------
function DiscountApprovalView({ pendingDiscounts, reload, adminEmail, globalSearch }: { pendingDiscounts: any[]; reload: () => void; adminEmail?: string; globalSearch?: string }) {
  const [subTab, setSubTab] = useState<"pending" | "catalog">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [discountStatusFilter, setDiscountStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");

  // Rejection modal state
  const [rejectModalItem, setRejectModalItem] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [detailModalItem, setDetailModalItem] = useState<any | null>(null);

  // Catalog promotions state
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [promoSearch, setPromoSearch] = useState("");

  // Edit promotions modal state
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [savingPromo, setSavingPromo] = useState(false);

  // Form states for modal
  const [individualDiscount, setIndividualDiscount] = useState<{
    enabled: boolean;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    startDate?: string;
    endDate?: string;
  }>({
    enabled: false,
    discountType: "PERCENTAGE",
    discountValue: 10,
  });

  const [tierDiscounts, setTierDiscounts] = useState<{
    enabled: boolean;
    tiers: Array<{ minQuantity: number; discountType: "PERCENTAGE" | "FIXED"; discountValue: number }>;
  }>({
    enabled: false,
    tiers: [{ minQuantity: 5, discountType: "PERCENTAGE", discountValue: 10 }],
  });

  const [buyXGetYOffer, setBuyXGetYOffer] = useState<{
    enabled: boolean;
    buyQty: number;
    getQty: number;
    maxFree: number;
  }>({
    enabled: false,
    buyQty: 2,
    getQty: 1,
    maxFree: 5,
  });

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const prods = await getAllProductsForAdminPromotions();
      setCatalogProducts(prods);
    } catch (err) {
      console.error("Failed to load catalog for promotions:", err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const openPromoEditor = (prod: any) => {
    setEditingProduct(prod);

    // Populate individual discount
    const ind = prod.individualDiscount;
    if (ind && (ind.enabled !== false || ind.status === "APPROVED")) {
      setIndividualDiscount({
        enabled: ind.enabled ?? (ind.status === "APPROVED"),
        discountType: ind.discountType || "PERCENTAGE",
        discountValue: Number(ind.discountValue || 10),
        startDate: ind.startDate || "",
        endDate: ind.endDate || "",
      });
    } else {
      setIndividualDiscount({
        enabled: false,
        discountType: "PERCENTAGE",
        discountValue: 10,
      });
    }

    // Populate tier discounts
    const td = prod.tierDiscounts;
    if (td && Array.isArray(td.tiers) && td.tiers.length > 0) {
      setTierDiscounts({
        enabled: td.enabled ?? true,
        tiers: td.tiers.map((t: any) => ({
          minQuantity: Number(t.minQuantity || 5),
          discountType: t.discountType || "PERCENTAGE",
          discountValue: Number(t.discountValue || 10),
        })),
      });
    } else {
      setTierDiscounts({
        enabled: false,
        tiers: [{ minQuantity: 5, discountType: "PERCENTAGE", discountValue: 10 }],
      });
    }

    // Populate buy X get Y offer
    const bogo = prod.buyXGetYOffer;
    if (bogo && (bogo.enabled !== false)) {
      setBuyXGetYOffer({
        enabled: bogo.enabled ?? true,
        buyQty: Number(bogo.buyQty || 2),
        getQty: Number(bogo.getQty || 1),
        maxFree: Number(bogo.maxFree || 5),
      });
    } else {
      setBuyXGetYOffer({
        enabled: false,
        buyQty: 2,
        getQty: 1,
        maxFree: 5,
      });
    }
  };

  const handleSavePromo = async () => {
    if (!editingProduct) return;
    setSavingPromo(true);

    const payload: any = {
      individualDiscount: individualDiscount.enabled
        ? {
            enabled: true,
            discountType: individualDiscount.discountType,
            discountValue: Number(individualDiscount.discountValue),
            status: "APPROVED",
            approvedBy: adminEmail || "admin@earthcentric.com",
            approvedAt: new Date().toISOString(),
            startDate: individualDiscount.startDate || undefined,
            endDate: individualDiscount.endDate || undefined,
          }
        : { enabled: false, status: "DISABLED" },
      tierDiscounts: tierDiscounts.enabled
        ? {
            enabled: true,
            tiers: tierDiscounts.tiers.map((t) => ({
              minQuantity: Math.max(2, Number(t.minQuantity)),
              discountType: t.discountType,
              discountValue: Number(t.discountValue),
            })),
          }
        : { enabled: false, tiers: [] },
      buyXGetYOffer: buyXGetYOffer.enabled
        ? {
            enabled: true,
            buyQty: Math.max(1, Number(buyXGetYOffer.buyQty)),
            getQty: Math.max(1, Number(buyXGetYOffer.getQty)),
            maxFree: Math.max(1, Number(buyXGetYOffer.maxFree)),
          }
        : { enabled: false },
    };

    const success = await updateProductPromotionsByAdmin(
      editingProduct.id,
      payload,
      adminEmail || "admin@earthcentric.com"
    );

    setSavingPromo(false);

    if (success) {
      toast.success("Promotional rules updated successfully!");
      setEditingProduct(null);
      await loadCatalog();
      reload();
    } else {
      toast.error("Failed to update promotional rules.");
    }
  };

  const handleApprove = async (item: any) => {
    const idToUse = item.id || item.productId;
    setProcessingId(idToUse);
    const ok = await approveDiscount(idToUse, adminEmail || "admin@earthcentric.com");
    setProcessingId(null);
    if (ok) {
      toast.success("Discount request approved successfully! Live status updated.");
      loadCatalog();
    } else {
      toast.error("Failed to approve discount.");
    }
    reload();
  };

  const openRejectModal = (item: any) => {
    setRejectModalItem(item);
    setRejectionReasonInput("");
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;
    const idToUse = rejectModalItem.id || rejectModalItem.productId;
    setProcessingId(idToUse);
    const ok = await rejectDiscount(idToUse, rejectionReasonInput || "Does not meet promotional policy guidelines.", adminEmail || "admin@earthcentric.com");
    setProcessingId(null);
    setRejectModalItem(null);
    if (ok) {
      toast.success("Discount request rejected.");
      loadCatalog();
    } else {
      toast.error("Failed to reject discount.");
    }
    reload();
  };

  // Filter normalization
  const normalizedDiscounts = pendingDiscounts.map((item: any) => {
    // If legacy format where discount is inside item.discount
    if (item.discount && !item.discountType) {
      return {
        id: item.productId,
        sellerId: item.sellerId || "",
        sellerName: item.sellerName || "Seller",
        productId: item.productId,
        productName: item.productName || "Product",
        productPrice: Number(item.price || item.originalPrice || 259),
        originalPrice: Number(item.originalPrice || item.price || 259),
        discountType: "INDIVIDUAL",
        requestedAction: "ACTIVATE",
        status: item.discount.status || "PENDING",
        proposedConfig: item.discount,
        currentConfig: null,
        requestedAt: new Date(),
      };
    }
    return item;
  });

  const displayDiscounts = normalizedDiscounts.filter((d: any) => {
    const q = (globalSearch || "").toLowerCase();
    if (!q) return true;
    return (
      d.productName?.toLowerCase().includes(q) ||
      d.sellerName?.toLowerCase().includes(q) ||
      d.discountType?.toLowerCase().includes(q) ||
      d.requestedAction?.toLowerCase().includes(q)
    );
  });

  const pendingCount = displayDiscounts.filter((d: any) => (d.status || d.discount?.status) === "PENDING").length;
  const approvedCount = displayDiscounts.filter((d: any) => (d.status || d.discount?.status) === "APPROVED").length;
  const rejectedCount = displayDiscounts.filter((d: any) => (d.status || d.discount?.status) === "REJECTED").length;

  const filteredDiscounts = displayDiscounts.filter((d: any) => {
    const st = d.status || d.discount?.status || "PENDING";
    if (discountStatusFilter === "ALL") return true;
    return st === discountStatusFilter;
  });

  const displayCatalog = catalogProducts.filter((p: any) => {
    const q = (promoSearch || globalSearch || "").toLowerCase();
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sellerName?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a3321] flex items-center space-x-2">
            <Tag className="h-6 w-6 text-emerald-700" />
            <span>Promotions & Discount Approval Workflow</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Super Admin approval dashboard for seller discount activations, deactivations, tier volume rules, and Buy X Get Y Free offers.
          </p>
        </div>

        {/* Sub tabs */}
        <div className="flex items-center space-x-2 bg-[#e9ece6] p-1 rounded-xl self-start">
          <button
            onClick={() => setSubTab("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "pending"
                ? "bg-white text-[#1a3321] shadow-sm"
                : "text-muted-foreground hover:text-[#1a3321]"
            }`}
          >
            Discount Requests ({displayDiscounts.length})
          </button>
          <button
            onClick={() => {
              setSubTab("catalog");
              loadCatalog();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "catalog"
                ? "bg-white text-[#1a3321] shadow-sm"
                : "text-muted-foreground hover:text-[#1a3321]"
            }`}
          >
            Catalog Promotional Rules ({catalogProducts.length})
          </button>
        </div>
      </div>

      {subTab === "pending" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Filter by status:</span>
            <button
              onClick={() => setDiscountStatusFilter("PENDING")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                discountStatusFilter === "PENDING"
                  ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Pending Approval ({pendingCount})
            </button>
            <button
              onClick={() => setDiscountStatusFilter("APPROVED")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                discountStatusFilter === "APPROVED"
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setDiscountStatusFilter("REJECTED")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                discountStatusFilter === "REJECTED"
                  ? "bg-rose-100 text-rose-900 border border-rose-300 shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Rejected ({rejectedCount})
            </button>
            <button
              onClick={() => setDiscountStatusFilter("ALL")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                discountStatusFilter === "ALL"
                  ? "bg-[#1a3321] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({displayDiscounts.length})
            </button>
          </div>

          <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#e9ece6] bg-[#fdfdfc]">
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Seller & Product</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Discount Type</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Requested Action</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Discount Details</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Dates & Requested At</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Status & Live State</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4 text-right pr-6">Decision Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDiscounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-muted-foreground">
                      No discount requests found for status &quot;{discountStatusFilter.toLowerCase()}&quot;.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDiscounts.map((item: any) => {
                    const reqAction = item.requestedAction || "ACTIVATE";
                    const discType = item.discountType || "INDIVIDUAL";
                    const cfg = item.proposedConfig || item.discount || {};
                    const origPrice = Number(item.originalPrice || item.productPrice || item.price || 259);
                    const itemStatus = item.status || item.discount?.status || "PENDING";

                    // Pricing breakdown for individual discounts
                    let discountAmount = 0;
                    let finalPrice = origPrice;
                    if (discType === "INDIVIDUAL") {
                      const val = Number(cfg.discountValue || 0);
                      if (cfg.discountType === "PERCENTAGE") {
                        discountAmount = (origPrice * val) / 100;
                        finalPrice = Math.max(0, origPrice - discountAmount);
                      } else {
                        discountAmount = val;
                        finalPrice = Math.max(0, origPrice - discountAmount);
                      }
                    }

                    // Determine current live state
                    let liveStateLabel = "INACTIVE";
                    let liveStateClass = "bg-slate-100 text-slate-700";
                    if (itemStatus === "APPROVED" && (reqAction === "ACTIVATE" || reqAction === "UPDATE")) {
                      liveStateLabel = "ACTIVE (Live for Buyers)";
                      liveStateClass = "bg-emerald-100 text-emerald-800 font-bold";
                    } else if (itemStatus === "PENDING" && reqAction === "DEACTIVATE") {
                      liveStateLabel = "ACTIVE (Live until approved)";
                      liveStateClass = "bg-amber-100 text-amber-900 font-bold border border-amber-300";
                    } else if (itemStatus === "REJECTED" && reqAction === "DEACTIVATE") {
                      liveStateLabel = "ACTIVE (Deactivation rejected)";
                      liveStateClass = "bg-emerald-100 text-emerald-800 font-bold";
                    } else if (itemStatus === "PENDING" && reqAction === "UPDATE") {
                      liveStateLabel = "ACTIVE (Old config live)";
                      liveStateClass = "bg-sky-100 text-sky-800 font-bold";
                    }

                    const requestedDateFormatted = item.requestedAt
                      ? new Date(item.requestedAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recently";

                    return (
                      <TableRow key={item.id || item.productId} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50">
                        {/* 1. Seller & Product */}
                        <TableCell className="py-4">
                          <div>
                            <p className="text-xs font-bold text-[#1a3321]">{item.productName}</p>
                            <p className="text-[10px] text-muted-foreground">Seller: <strong className="text-foreground">{item.sellerName}</strong></p>
                            <p className="text-[10px] text-slate-400">Base Price: ₹{origPrice}</p>
                          </div>
                        </TableCell>

                        {/* 2. Discount Type Badge */}
                        <TableCell className="py-4">
                          {discType === "INDIVIDUAL" ? (
                            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                              🏷️ Individual Discount
                            </Badge>
                          ) : discType === "TIER" ? (
                            <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold">
                              📊 Tier Discounts
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-bold">
                              🎁 Buy X Get Y Free
                            </Badge>
                          )}
                        </TableCell>

                        {/* 3. Requested Action Badge */}
                        <TableCell className="py-4">
                          {reqAction === "ACTIVATE" ? (
                            <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold">
                              ▲ ACTIVATE
                            </Badge>
                          ) : reqAction === "DEACTIVATE" ? (
                            <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold">
                              ▼ DEACTIVATE
                            </Badge>
                          ) : (
                            <Badge className="bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-extrabold">
                              ⚡ UPDATE
                            </Badge>
                          )}
                        </TableCell>

                        {/* 4. Discount Details */}
                        <TableCell className="py-4">
                          {reqAction === "DEACTIVATE" ? (
                            <span className="text-[11px] text-muted-foreground italic">Request to disable active discount</span>
                          ) : discType === "INDIVIDUAL" ? (
                            <div className="text-xs space-y-0.5">
                              <p className="font-bold text-[#1a3321]">
                                {cfg.discountType === "PERCENTAGE" ? `${cfg.discountValue}% OFF` : `₹${cfg.discountValue} FLAT OFF`}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Disc: <span className="text-amber-700 font-bold">-₹{discountAmount.toFixed(2)}</span> → Final: <span className="text-emerald-700 font-extrabold">₹{finalPrice.toFixed(2)}</span>
                              </p>
                            </div>
                          ) : discType === "TIER" ? (
                            <div className="text-[11px] space-y-0.5">
                              {Array.isArray(cfg.tiers) && cfg.tiers.length > 0 ? (
                                cfg.tiers.map((t: any, idx: number) => (
                                  <p key={idx} className="font-semibold text-slate-700">
                                    Buy {t.minQuantity}+ → {t.discountType === "PERCENTAGE" ? `${t.discountValue}% off` : `₹${t.discountValue} off`}
                                  </p>
                                ))
                              ) : (
                                <span className="text-muted-foreground">No tiers defined</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs space-y-0.5">
                              <p className="font-bold text-purple-900">
                                Buy {cfg.buyQuantity ?? cfg.buyQty ?? 2} → Get {cfg.getQuantity ?? cfg.getQty ?? 1} FREE
                              </p>
                              {(cfg.maxFreeQuantity ?? cfg.maxFree) && (
                                <p className="text-[10px] text-muted-foreground">Max free: {cfg.maxFreeQuantity ?? cfg.maxFree} units</p>
                              )}
                            </div>
                          )}
                        </TableCell>

                        {/* 5. Dates & Requested At */}
                        <TableCell className="py-4">
                          <div className="text-[10px] space-y-0.5">
                            <p className="text-muted-foreground">
                              Requested: <strong className="text-slate-700">{requestedDateFormatted}</strong>
                            </p>
                            {(cfg.startDate || cfg.endDate) && (
                              <p className="text-slate-500 font-medium">
                                Period: {cfg.startDate || "Immediate"} to {cfg.endDate || "Ongoing"}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* 6. Status & Live State */}
                        <TableCell className="py-4">
                          <div className="space-y-1">
                            <div>
                              {itemStatus === "APPROVED" ? (
                                <Badge className="bg-[#e8f3ec] text-emerald-700 border-none text-[10px] font-bold">APPROVED</Badge>
                              ) : itemStatus === "REJECTED" ? (
                                <Badge className="bg-rose-50 text-rose-700 border-none text-[10px] font-bold">REJECTED</Badge>
                              ) : (
                                <Badge className="bg-amber-50 text-amber-700 border-none text-[10px] font-bold">PENDING APPROVAL</Badge>
                              )}
                            </div>
                            <div className="text-[9px]">
                              <span className={`px-1.5 py-0.5 rounded-sm ${liveStateClass}`}>
                                Live: {liveStateLabel}
                              </span>
                            </div>
                            {item.rejectionReason && itemStatus === "REJECTED" && (
                              <p className="text-[9px] text-rose-600 bg-rose-50 p-1 rounded border border-rose-100 max-w-[160px] break-words">
                                Reason: {item.rejectionReason}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* 7. Decision Actions */}
                        <TableCell className="py-4 text-right pr-6 space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs px-2.5 h-8 rounded-lg cursor-pointer border-[#2d4a36]/30 text-[#2d4a36] hover:bg-[#e8f3ec]"
                            onClick={() => setDetailModalItem(item)}
                          >
                            Review
                          </Button>
                          {itemStatus === "PENDING" ? (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 h-8 rounded-lg cursor-pointer"
                                disabled={processingId === (item.id || item.productId)}
                                onClick={() => handleApprove(item)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-xs px-3 h-8 rounded-lg cursor-pointer"
                                disabled={processingId === (item.id || item.productId)}
                                onClick={() => openRejectModal(item)}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Reviewed by {item.reviewedBy ? item.reviewedBy.split("@")[0] : "Admin"}
                            </span>
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
      )}

      {/* ── Rejection Reason Modal for Super Admin ── */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !processingId && setRejectModalItem(null)} />
          <Card className="relative w-full max-w-md bg-white border border-[#e9ece6] rounded-2xl shadow-2xl z-10 p-6 space-y-4 text-left">
            <div className="flex items-start justify-between border-b border-[#e9ece6] pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#1a3321]">Reject Discount Request</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Provide a clear reason for rejecting this discount request. The seller will receive a notification with this feedback.
                </p>
              </div>
              <button
                onClick={() => !processingId && setRejectModalItem(null)}
                className="text-muted-foreground hover:text-[#1a3321] p-1 rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><strong className="text-[#1a3321]">Seller:</strong> {rejectModalItem.sellerName}</p>
              <p><strong className="text-[#1a3321]">Product:</strong> {rejectModalItem.productName}</p>
              <p><strong className="text-[#1a3321]">Discount Type:</strong> {rejectModalItem.discountType}</p>
              <p><strong className="text-[#1a3321]">Action:</strong> {rejectModalItem.requestedAction}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#1a3321]">Rejection Reason / Feedback</Label>
              <Textarea
                placeholder="e.g. Discount percentage is higher than maximum allowed (40%), minimum tier quantity too low, etc."
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="text-xs h-24 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#e9ece6]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectModalItem(null)}
                disabled={Boolean(processingId)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmReject}
                disabled={Boolean(processingId)}
                className="text-xs rounded-xl font-bold"
              >
                {processingId ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Dedicated DISCOUNT APPROVAL REQUEST Detail Modal (Requirement 10) ── */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => !processingId && setDetailModalItem(null)} />
          <Card className="relative w-full max-w-lg bg-white border border-[#e9ece6] rounded-3xl shadow-2xl z-10 p-6 space-y-4 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#e9ece6] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  Super Admin Approval Section
                </span>
                <h3 className="font-extrabold text-lg text-[#1a3321] mt-1 tracking-tight">
                  DISCOUNT APPROVAL REQUEST
                </h3>
              </div>
              <button
                onClick={() => !processingId && setDetailModalItem(null)}
                className="text-muted-foreground hover:text-[#1a3321] p-1 rounded-full cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Special Notice Banner for Action Types */}
            {detailModalItem.requestedAction === "DEACTIVATE" ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-900">
                  <span>⚠️</span>
                  <span>Notice: Seller Requesting Deactivation</span>
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  This discount is currently <strong>ACTIVE</strong> and visible to buyers on the marketplace. The seller is requesting to turn it OFF.
                  <br />• <strong>Approve</strong>: Turns discount OFF, removes from Buyer Portal, and restores original price.
                  <br />• <strong>Reject</strong>: Discount <strong>REMAINS ACTIVE</strong> for buyers on the marketplace.
                </p>
              </div>
            ) : detailModalItem.requestedAction === "UPDATE" ? (
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-sky-900">
                  <span>⚡</span>
                  <span>Notice: Active Discount Update Request</span>
                </p>
                <p className="text-[11px] leading-relaxed text-sky-800">
                  The seller has requested to update an existing active discount. The current configuration remains live for buyers until you approve the update.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <span>ℹ️</span>
                  <span>Notice: New Activation Request</span>
                </p>
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  This discount is currently <strong>INACTIVE / OFF</strong> and not visible to buyers. Approving will activate it on the marketplace.
                </p>
              </div>
            )}

            {/* Structured Details Layout Matching Requirement 10 */}
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 text-xs space-y-2.5">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-muted-foreground font-semibold">Seller:</span>
                <strong className="text-slate-900 font-bold text-sm">{detailModalItem.sellerName}</strong>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-muted-foreground font-semibold">Discount Type:</span>
                <span className="font-bold text-slate-800">
                  {detailModalItem.discountType === "INDIVIDUAL"
                    ? "Individual Product Discount"
                    : detailModalItem.discountType === "TIER"
                    ? "Tier Discounts"
                    : "Buy X Get Y Free Offer"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-muted-foreground font-semibold">Product:</span>
                <span className="text-slate-900 font-bold text-right max-w-[240px] truncate">{detailModalItem.productName}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-muted-foreground font-semibold">Current Status:</span>
                <span className="font-bold">
                  {detailModalItem.requestedAction === "DEACTIVATE" ? (
                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                      ACTIVE (Currently Live)
                    </Badge>
                  ) : detailModalItem.status === "APPROVED" ? (
                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                      APPROVED & ACTIVE
                    </Badge>
                  ) : detailModalItem.status === "REJECTED" ? (
                    <Badge className="bg-rose-100 text-rose-900 border-rose-300 text-[10px]">
                      REJECTED
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                      Pending Approval
                    </Badge>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-muted-foreground font-semibold">Requested Action:</span>
                <Badge className={detailModalItem.requestedAction === "ACTIVATE" ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold" : detailModalItem.requestedAction === "DEACTIVATE" ? "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold" : "bg-sky-100 text-sky-900 border border-sky-300 font-extrabold"}>
                  {detailModalItem.requestedAction}
                </Badge>
              </div>

              {/* Pricing breakdown for Individual Discounts */}
              {detailModalItem.discountType === "INDIVIDUAL" && (() => {
                const cfg = detailModalItem.proposedConfig || detailModalItem.discount || {};
                const orig = Number(detailModalItem.originalPrice || detailModalItem.productPrice || 259);
                const val = Number(cfg.discountValue || 0);
                const discountAmount = cfg.discountType === "PERCENTAGE" ? (orig * val) / 100 : val;
                const finalPrice = Math.max(0, orig - discountAmount);

                return (
                  <div className="space-y-2 pt-0.5">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-muted-foreground font-semibold">Discount:</span>
                      <strong className="text-slate-900 font-bold">{cfg.discountType === "PERCENTAGE" ? `${val}%` : `₹${val} Flat`}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-muted-foreground font-semibold">Original Price:</span>
                      <span className="font-semibold text-slate-700">₹{orig.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-muted-foreground font-semibold">Discount Amount:</span>
                      <span className="font-bold text-amber-700">-₹{discountAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-muted-foreground font-semibold">Final Price:</span>
                      <strong className="text-emerald-700 font-extrabold text-sm">₹{finalPrice.toFixed(2)}</strong>
                    </div>
                  </div>
                );
              })()}

              {/* Tier Discounts Breakdown */}
              {detailModalItem.discountType === "TIER" && (() => {
                const cfg = detailModalItem.proposedConfig || detailModalItem.discount || {};
                const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
                return (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-muted-foreground font-semibold block">Configured Tiers:</span>
                    {tiers.map((t: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span>Buy <strong>{t.minQuantity}+ units</strong></span>
                        <strong className="text-emerald-700 font-bold">
                          {t.discountType === "PERCENTAGE" ? `${t.discountValue}% OFF` : `₹${t.discountValue} OFF`}
                        </strong>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Buy X Get Y Offer Breakdown */}
              {detailModalItem.discountType === "BUY_X_GET_Y" && (() => {
                const cfg = detailModalItem.proposedConfig || detailModalItem.discount || {};
                return (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-muted-foreground font-semibold">Offer Rule:</span>
                      <strong className="text-purple-900 font-bold">
                        Buy {cfg.buyQuantity ?? cfg.buyQty ?? 2} → Get {cfg.getQuantity ?? cfg.getQty ?? 1} FREE
                      </strong>
                    </div>
                    {(cfg.maxFreeQuantity ?? cfg.maxFree) && (
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                        <span className="text-muted-foreground font-semibold">Max Free Quantity:</span>
                        <span className="font-semibold text-slate-700">{cfg.maxFreeQuantity ?? cfg.maxFree} units</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Dates & Timestamp */}
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-muted-foreground font-semibold">Start Date:</span>
                <span className="text-slate-700 font-medium">
                  {detailModalItem.proposedConfig?.startDate || "Immediate"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-muted-foreground font-semibold">End Date:</span>
                <span className="text-slate-700 font-medium">
                  {detailModalItem.proposedConfig?.endDate || "Ongoing"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-semibold">Requested At:</span>
                <span className="text-slate-700 font-medium">
                  {detailModalItem.requestedAt
                    ? new Date(detailModalItem.requestedAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Recently"}
                </span>
              </div>
            </div>

            {/* Decision Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#e9ece6]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailModalItem(null)}
                className="text-xs rounded-xl cursor-pointer"
              >
                Close
              </Button>
              {(detailModalItem.status || detailModalItem.discount?.status) === "PENDING" && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={processingId === (detailModalItem.id || detailModalItem.productId)}
                    onClick={() => {
                      const itemToReject = detailModalItem;
                      setDetailModalItem(null);
                      openRejectModal(itemToReject);
                    }}
                    className="text-xs rounded-xl font-bold cursor-pointer"
                  >
                    REJECT
                  </Button>
                  <Button
                    size="sm"
                    disabled={processingId === (detailModalItem.id || detailModalItem.productId)}
                    onClick={async () => {
                      const itemToApprove = detailModalItem;
                      setDetailModalItem(null);
                      await handleApprove(itemToApprove);
                    }}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-xl font-bold px-4 cursor-pointer"
                  >
                    APPROVE
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {subTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products, sellers, categories..."
                value={promoSearch}
                onChange={(e) => setPromoSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-white rounded-xl border-[#e9ece6]"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadCatalog}
              disabled={loadingCatalog}
              className="text-xs border-[#e9ece6] rounded-xl hover:bg-[#f4f5f3]"
            >
              {loadingCatalog ? "Refreshing..." : "Refresh Catalog"}
            </Button>
          </div>

          <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#e9ece6] bg-[#fdfdfc]">
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Product</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Seller</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Base Price</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Individual Discount</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Tier Discounts</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Buy X Get Y</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4">Market Status</TableHead>
                  <TableHead className="text-[10px] font-bold text-[#8ca193] uppercase py-4 text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCatalog ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-xs text-muted-foreground">
                      <div className="h-6 w-6 border-2 border-[#1a3321] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading promotional catalog...
                    </TableCell>
                  </TableRow>
                ) : displayCatalog.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-xs text-muted-foreground">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayCatalog.map((p: any) => {
                    const ind = p.individualDiscount;
                    const hasInd = ind && (ind.enabled ?? (ind.status === "APPROVED")) && Number(ind.discountValue) > 0;
                    
                    const td = p.tierDiscounts;
                    const hasTd = td && (td.enabled ?? true) && Array.isArray(td.tiers) && td.tiers.length > 0;

                    const bxgy = p.buyXGetYOffer;
                    const hasBxgy = bxgy && (bxgy.enabled ?? true) && Number(bxgy.buyQty) > 0 && Number(bxgy.getQty) > 0;

                    return (
                      <TableRow key={p.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50">
                        <TableCell className="py-4">
                          <div>
                            <p className="text-xs font-bold text-[#1a3321]">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">{p.category}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-xs text-[#1a3321] font-semibold">
                          {p.sellerName}
                        </TableCell>
                        <TableCell className="py-4 text-xs font-black text-[#1a3321]">
                          ₹{p.price}
                        </TableCell>
                        <TableCell className="py-4">
                          {hasInd ? (
                            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                              {ind.discountType === "PERCENTAGE" ? `${ind.discountValue}% OFF` : `₹${ind.discountValue} OFF`}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {hasTd ? (
                            <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold">
                              {td.tiers.length} Tier{td.tiers.length > 1 ? "s" : ""}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {hasBxgy ? (
                            <Badge className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-bold">
                              Buy {bxgy.buyQty} Get {bxgy.getQty}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {p.isApproved && p.status === "APPROVED" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] font-bold">Active</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-none text-[9px] font-bold">{p.status || "Pending"}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4 text-right pr-6">
                          <Button
                            size="sm"
                            onClick={() => openPromoEditor(p)}
                            className="bg-[#1a3321] hover:bg-[#25422d] text-white text-xs px-3 h-8 rounded-xl flex items-center space-x-1.5 ml-auto"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Configure</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── Modal for Super Admin to Configure Product Promotions ── */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !savingPromo && setEditingProduct(null)} />
          <Card className="relative w-full max-w-2xl bg-white border border-[#e9ece6] rounded-3xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-[#e9ece6] pb-4">
              <div>
                <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] font-bold mb-1.5">
                  Super Admin Promotional Rules
                </Badge>
                <h2 className="text-xl font-extrabold text-[#1a3321]">{editingProduct.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Category: {editingProduct.category} | Seller: {editingProduct.sellerName} | Base Price: ₹{editingProduct.price}
                </p>
              </div>
              <button
                onClick={() => !savingPromo && setEditingProduct(null)}
                className="text-muted-foreground hover:text-[#1a3321] p-1 rounded-full hover:bg-[#f4f5f3]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Section 1: Individual Discount */}
            <div className="p-4 rounded-2xl border border-[#e9ece6] bg-[#fdfdfc] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Percent className="h-4 w-4 text-emerald-700" />
                  <span className="text-sm font-bold text-[#1a3321]">1. Individual Product Discount</span>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={individualDiscount.enabled}
                    onChange={(e) => setIndividualDiscount((prev) => ({ ...prev, enabled: e.target.checked }))}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-semibold text-[#1a3321]">
                    {individualDiscount.enabled ? "Active" : "Disabled"}
                  </span>
                </label>
              </div>

              {individualDiscount.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#e9ece6]">
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Type</Label>
                    <select
                      value={individualDiscount.discountType}
                      onChange={(e: any) =>
                        setIndividualDiscount((prev) => ({ ...prev, discountType: e.target.value }))
                      }
                      className="w-full mt-1 border border-input rounded-xl px-3 py-1.5 text-xs bg-white"
                    >
                      <option value="PERCENTAGE">Percentage (% Off)</option>
                      <option value="FIXED">Flat Amount (₹ Off)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Value</Label>
                    <Input
                      type="number"
                      min="1"
                      value={individualDiscount.discountValue}
                      onChange={(e) =>
                        setIndividualDiscount((prev) => ({ ...prev, discountValue: Number(e.target.value) }))
                      }
                      className="mt-1 h-8 text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Calculated Price</Label>
                    <div className="mt-1 h-8 px-3 flex items-center bg-emerald-50 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-100">
                      ₹
                      {individualDiscount.discountType === "PERCENTAGE"
                        ? Math.max(0, Math.round(editingProduct.price * (1 - individualDiscount.discountValue / 100)))
                        : Math.max(0, editingProduct.price - individualDiscount.discountValue)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Tier / Volume Discounts */}
            <div className="p-4 rounded-2xl border border-[#e9ece6] bg-[#fdfdfc] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-blue-700" />
                  <span className="text-sm font-bold text-[#1a3321]">2. Tier / Volume Discounts</span>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tierDiscounts.enabled}
                    onChange={(e) => setTierDiscounts((prev) => ({ ...prev, enabled: e.target.checked }))}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-[#1a3321]">
                    {tierDiscounts.enabled ? "Active" : "Disabled"}
                  </span>
                </label>
              </div>

              {tierDiscounts.enabled && (
                <div className="space-y-3 pt-2 border-t border-[#e9ece6]">
                  <p className="text-[11px] text-muted-foreground">
                    Define bulk quantity purchase tiers. Buyers who order at least the tier threshold will automatically receive that tier's discount.
                  </p>
                  {tierDiscounts.tiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-[#e9ece6]">
                      <div className="flex-1">
                        <Label className="text-[10px] text-muted-foreground">Min Quantity</Label>
                        <Input
                          type="number"
                          min="2"
                          value={tier.minQuantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTierDiscounts((prev) => {
                              const copy = [...prev.tiers];
                              copy[idx] = { ...copy[idx], minQuantity: val };
                              return { ...prev, tiers: copy };
                            });
                          }}
                          className="h-7 text-xs rounded-lg mt-0.5"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-[10px] text-muted-foreground">Type</Label>
                        <select
                          value={tier.discountType}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            setTierDiscounts((prev) => {
                              const copy = [...prev.tiers];
                              copy[idx] = { ...copy[idx], discountType: val };
                              return { ...prev, tiers: copy };
                            });
                          }}
                          className="w-full mt-0.5 border border-input rounded-lg px-2 py-1 text-xs bg-white"
                        >
                          <option value="PERCENTAGE">% Off</option>
                          <option value="FIXED">₹ Off</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-[10px] text-muted-foreground">Discount Value</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.discountValue}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTierDiscounts((prev) => {
                              const copy = [...prev.tiers];
                              copy[idx] = { ...copy[idx], discountValue: val };
                              return { ...prev, tiers: copy };
                            });
                          }}
                          className="h-7 text-xs rounded-lg mt-0.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTierDiscounts((prev) => ({
                            ...prev,
                            tiers: prev.tiers.filter((_, i) => i !== idx),
                          }));
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg mt-3"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTierDiscounts((prev) => ({
                        ...prev,
                        tiers: [
                          ...prev.tiers,
                          {
                            minQuantity: (prev.tiers[prev.tiers.length - 1]?.minQuantity || 5) + 5,
                            discountType: "PERCENTAGE",
                            discountValue: (prev.tiers[prev.tiers.length - 1]?.discountValue || 10) + 5,
                          },
                        ],
                      }));
                    }}
                    className="text-xs border-dashed border-[#8ca193] text-[#1a3321] rounded-xl hover:bg-[#f4f5f3]"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Another Tier
                  </Button>
                </div>
              )}
            </div>

            {/* Section 3: Buy X Get Y Free */}
            <div className="p-4 rounded-2xl border border-[#e9ece6] bg-[#fdfdfc] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Gift className="h-4 w-4 text-purple-700" />
                  <span className="text-sm font-bold text-[#1a3321]">3. Buy X Get Y Free (BOGO / BXGY)</span>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={buyXGetYOffer.enabled}
                    onChange={(e) => setBuyXGetYOffer((prev) => ({ ...prev, enabled: e.target.checked }))}
                    className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs font-semibold text-[#1a3321]">
                    {buyXGetYOffer.enabled ? "Active" : "Disabled"}
                  </span>
                </label>
              </div>

              {buyXGetYOffer.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#e9ece6]">
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Buy Quantity (X)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={buyXGetYOffer.buyQty}
                      onChange={(e) => setBuyXGetYOffer((prev) => ({ ...prev, buyQty: Number(e.target.value) }))}
                      className="mt-1 h-8 text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Get Free Quantity (Y)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={buyXGetYOffer.getQty}
                      onChange={(e) => setBuyXGetYOffer((prev) => ({ ...prev, getQty: Number(e.target.value) }))}
                      className="mt-1 h-8 text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Max Free Per Order</Label>
                    <Input
                      type="number"
                      min="1"
                      value={buyXGetYOffer.maxFree}
                      onChange={(e) => setBuyXGetYOffer((prev) => ({ ...prev, maxFree: Number(e.target.value) }))}
                      className="mt-1 h-8 text-xs rounded-xl"
                    />
                  </div>
                  <div className="sm:col-span-3 bg-purple-50 text-purple-900 text-xs p-2.5 rounded-xl border border-purple-100 flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-purple-700 shrink-0" />
                    <span>
                      Customer Rule: For every <strong>{buyXGetYOffer.buyQty}</strong> purchased, they receive <strong>{buyXGetYOffer.getQty} free</strong> (capped at {buyXGetYOffer.maxFree} free units).
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#e9ece6]">
              <Button
                variant="outline"
                onClick={() => setEditingProduct(null)}
                disabled={savingPromo}
                className="text-xs rounded-xl border-[#e9ece6]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePromo}
                disabled={savingPromo}
                className="bg-[#1a3321] hover:bg-[#25422d] text-white text-xs px-5 rounded-xl"
              >
                {savingPromo ? "Saving Rules..." : "Save Promotional Rules"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
