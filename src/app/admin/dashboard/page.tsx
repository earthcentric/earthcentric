"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getPendingSellers, approveSeller, rejectSeller, getPlatformStats, PlatformStats, getDisputes, resolveDispute, DisputeCase, getAllSellersRevenue, SellerRevenueInfo, getAdminAnalyticsTimeSeries, getPlatformUsers, UserManagementData, getPendingProducts, approveProduct, rejectProduct } from "@/actions/admin";
import { getAdminPayoutRequests, settlePayoutRequest, PayoutRequestInfo } from "@/actions/payouts";
import { getAllOrdersForAdmin, updateOrderStatus } from "@/actions/orders";
import { SellerProfile } from "@/actions/sellers";
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableCell, TableHead, Input, LiquidButton, Label } from "@/components/ui/shared";
import { FadeIn, ScaleHover } from "@/components/FramerComponents";
import { AdminAnalyticsCharts, AdminAnalyticsData } from "@/components/ui/admin-analytics-charts";
import { AdminSellerDetailModal } from "@/components/ui/admin-seller-detail-modal";
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
  Settings,
  LogOut,
  ChevronDown,
  DollarSign,
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
  { id: "TXN-93284", orderId: "EC-ORD-4729", amount: 598, method: "UPI / Razorpay", commission: 59.8, status: "Success", date: "12/06/2026" },
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
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    const s = await getPlatformStats();
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

    const orders = await getAllOrdersForAdmin();
    setAllOrders(orders);

    setLoading(false);
  };

  useEffect(() => {
    loadAdminData();
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
        onClick={() => setActiveTab(value)}
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
      
      {/* --------------------------------------------------------------------------
          LEFT SIDEBAR
          -------------------------------------------------------------------------- */}
      <aside className="w-[260px] bg-[#1a3321] text-white flex flex-col h-full shrink-0 z-20 shadow-xl overflow-y-auto hidden md:flex">
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
            <SidebarLink icon={ShoppingBag} label="Order Management" value="orders" />
            <SidebarLink icon={Wallet} label="Payments" value="payments" />
          </div>

          <div className="space-y-1">
            <p className="px-6 text-[10px] font-bold text-[#627d6a] uppercase tracking-wider mb-2">Sustainability</p>
            <SidebarLink icon={Leaf} label="Impact Analytics" value="impact" />
            <SidebarLink icon={Award} label="Certifications" value="certifications" />
          </div>

        </div>
        
        {/* Footer Area */}
        <div className="p-4 border-t border-white/5">
          <button onClick={() => logout()} className="flex items-center space-x-2 text-xs font-semibold text-[#8ca193] hover:text-red-400 transition-colors w-full px-2 py-2">
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
        <header className="h-16 shrink-0 flex items-center justify-between px-8 bg-white shadow-sm z-10">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="w-full bg-[#f4f5f3] hover:bg-[#e9ece6] focus:bg-[#e9ece6] border-none rounded-full pl-10 pr-4 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-all"
            />
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-muted-foreground hover:text-foreground relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
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
            {activeTab === "dashboard" && <DashboardView stats={stats} analyticsData={analyticsData} pendingSellers={pendingSellers} />}
            {activeTab === "sellers" && <SellerApprovalsView pendingSellers={pendingSellers} reload={loadAdminData} onInspectSeller={setSelectedSellerId} />}
            {activeTab === "users" && <UserManagementView usersData={usersData} onInspectSeller={setSelectedSellerId} />}
            {activeTab === "products" && <ProductApprovalView pendingProducts={pendingProducts} reload={loadAdminData} adminEmail={user?.email} />}
            {activeTab === "payments" && <PaymentsView payoutRequests={payoutRequests} onActionComplete={loadAdminData} adminEmail={user?.email} />}
            {activeTab === "analytics" && <AdminAnalyticsCharts data={analyticsData!} />}
            {activeTab === "orders" && <OrderManagementView orders={allOrders} onUpdateStatus={loadAdminData} />}
            {activeTab === "impact" && <ImpactView />}
            {activeTab === "certifications" && <CertificationsView />}
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
    </div>
  );
}

// --------------------------------------------------------------------------
// DASHBOARD VIEW
// --------------------------------------------------------------------------
function DashboardView({ stats, analyticsData, pendingSellers }: any) {
  const chartData = analyticsData?.monthly?.income?.slice(0, 6).reverse() || [];
  
  return (
    <div className="space-y-6">
      {/* Title & Breadcrumbs */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321] flex items-center space-x-2">
          <span>Admin Dashboard</span>
          <span className="text-xl">📊</span>
        </h1>
        <p className="text-[10px] text-muted-foreground font-semibold mt-1 flex items-center space-x-1 uppercase tracking-wider">
          <span>EarthCentric</span> <span className="mx-1">{">"}</span> <span>Super Admin</span> <span className="mx-1">{">"}</span> <span className="text-[#1a3321]">Dashboard</span>
        </p>
      </div>

      {/* Top KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-[#e8f3ec] text-emerald-600 rounded-md flex items-center justify-center"><DollarSign className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold">Total Revenue</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1a3321]">₹{stats?.totalRevenue?.toLocaleString() || "10,24,832"}</h3>
            <Badge className="bg-[#e8f3ec] text-emerald-700 hover:bg-[#e8f3ec] border-none text-[9px] px-1.5 py-0 mt-1">↑ 18.4%</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-[#e8f0f4] text-blue-600 rounded-md flex items-center justify-center"><Users className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold">Total Orders</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1a3321]">{stats?.totalOrders || "64"}</h3>
            <Badge className="bg-[#e8f3ec] text-emerald-700 hover:bg-[#e8f3ec] border-none text-[9px] px-1.5 py-0 mt-1">↑ 12.1%</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-amber-50 text-amber-600 rounded-md flex items-center justify-center"><Users className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold">Total Sellers</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1a3321]">{stats?.totalSellers || "8"}</h3>
            <Badge className="bg-[#e8f3ec] text-emerald-700 hover:bg-[#e8f3ec] border-none text-[9px] px-1.5 py-0 mt-1">↑ 8.3%</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-purple-50 text-purple-600 rounded-md flex items-center justify-center"><ShoppingBag className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold">Total Products</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1a3321]">{stats?.totalProducts || "42"}</h3>
            <Badge className="bg-[#e8f3ec] text-emerald-700 hover:bg-[#e8f3ec] border-none text-[9px] px-1.5 py-0 mt-1">↑ 22%</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <div className="h-6 w-6 bg-rose-50 text-rose-600 rounded-md flex items-center justify-center"><AlertCircle className="h-3 w-3" /></div>
            <span className="text-[11px] font-semibold whitespace-nowrap">Pending Sellers</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-rose-600">{pendingSellers.length}</h3>
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
              <p className="text-[10px] text-muted-foreground">Monthly revenue in ₹ Lakhs</p>
            </div>
            <div className="bg-[#f4f5f3] px-3 py-1.5 rounded-full flex items-center space-x-2 cursor-pointer">
              <span className="text-[10px] font-bold text-[#1a3321]">This Year</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
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
            {[
              { month: 'Jan', val: '2.4L', h: '35%' },
              { month: 'Feb', val: '3.8L', h: '55%' },
              { month: 'Mar', val: '3.2L', h: '45%' },
              { month: 'Apr', val: '5.6L', h: '75%' },
              { month: 'May', val: '7.2L', h: '90%' },
              { month: 'Jun', val: '8L', h: '100%' },
            ].map((bar, i) => (
              <div key={i} className="flex flex-col items-center z-10 w-[12%]">
                <span className="text-[10px] font-bold text-muted-foreground mb-2">{bar.val}</span>
                <div 
                  className="w-full rounded-t-sm"
                  style={{ 
                    height: `calc(${bar.h} * 2.2)`, 
                    background: 'linear-gradient(to bottom, #1a3321, #0ea5e9)'
                  }}
                ></div>
                <span className="text-[10px] font-semibold text-muted-foreground mt-3">{bar.month}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Platform Health */}
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl lg:col-span-1 flex flex-col">
          <h3 className="text-sm font-bold text-[#1a3321] mb-6">Platform Health</h3>
          <div className="space-y-6 flex-1">
            
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Order Success Rate</span>
                <span className="text-[#1a3321]">97.2%</span>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '97.2%' }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Seller Approval Rate</span>
                <span className="text-[#1a3321]">84.5%</span>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: '84.5%' }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Customer Satisfaction</span>
                <span className="text-[#1a3321]">4.9 / 5</span>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '95%' }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Eco Certified Products</span>
                <span className="text-[#1a3321]">92.4%</span>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '92.4%' }} />
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
function SellerApprovalsView({ pendingSellers, reload, onInspectSeller }: any) {
  const displaySellers = pendingSellers.length > 0 ? pendingSellers : [
    { id: "seller-1", companyName: "SHIVA CLOTHING", user: { name: "Shiva Teja" }, contact: "bluegamer355@gmail.com", appliedOn: "11/6/2026", status: "INCOMPLETE" },
    { id: "seller-2", companyName: "SHIVA CLOTHING", user: { name: "Shiva Teja Yadav" }, contact: "imshivateja082@gmail.com", appliedOn: "10/6/2026", status: "VERIFIED" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Seller Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and manage new seller applications.</p>
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
            {displaySellers.map((seller: any, i: number) => (
              <TableRow key={i} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                <TableCell className="py-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-[#f4f5f3] rounded border border-[#e9ece6] flex items-center justify-center text-[#8ca193]">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1a3321]">{seller.companyName}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center"><Users className="h-2.5 w-2.5 mr-1" /> {seller.user?.name || "Applicant"}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <p className="text-xs text-muted-foreground flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1.5 opacity-50" />
                    {seller.contact || "email@example.com"}
                  </p>
                </TableCell>
                <TableCell className="py-4">
                  <p className="text-xs text-muted-foreground flex items-center">
                    <LayoutDashboard className="h-3 w-3 mr-1.5 opacity-50" />
                    {seller.appliedOn || new Date().toLocaleDateString()}
                  </p>
                </TableCell>
                <TableCell className="py-4">
                  {seller.status === "VERIFIED" || seller.verificationStatus === "APPROVED" ? (
                    <Badge className="bg-[#e8f3ec] text-emerald-700 border-none text-[9px] hover:bg-[#e8f3ec]"><CheckCircle2 className="h-3 w-3 mr-1" /> VERIFIED</Badge>
                  ) : (
                    <Badge className="bg-[#f4f5f3] text-muted-foreground border-none text-[9px] hover:bg-[#f4f5f3]"><AlertCircle className="h-3 w-3 mr-1" /> PENDING</Badge>
                  )}
                </TableCell>
                <TableCell className="py-4 text-right pr-6">
                  {seller.status === "VERIFIED" || seller.verificationStatus === "APPROVED" ? (
                    <Button variant="ghost" className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 h-8 font-semibold" onClick={() => onInspectSeller(seller.id || seller.userId)}>View Record</Button>
                  ) : (
                    <Button variant="outline" className="text-xs text-[#8ca193] border-[#e9ece6] hover:bg-[#f4f5f3] px-3 h-8" onClick={() => onInspectSeller(seller.id || seller.userId)}><Eye className="h-3 w-3 mr-1.5" /> Review</Button>
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
// USER MANAGEMENT VIEW
// --------------------------------------------------------------------------
function UserManagementView({ usersData, onInspectSeller }: any) {
  const displayData = usersData || {
    totalUsers: 4,
    totalOrdersBooked: 3,
    totalRevenue: 6097,
    users: MOCK_USERS
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321] flex items-center space-x-2">
          <Users className="h-6 w-6 text-blue-500" />
          <span>User Management</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">View and manage all registered users and their recent order history.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider mb-2">Total Registered Users</p>
          <h3 className="text-3xl font-black text-[#1a3321]">{displayData.totalUsers}</h3>
        </Card>
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider mb-2">Total Orders Booked</p>
          <h3 className="text-3xl font-black text-[#1a3321]">{displayData.totalOrdersBooked}</h3>
        </Card>
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider mb-2">Total Revenue Generated</p>
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
                  {u.role === "SELLER" && (
                    <Button variant="ghost" className="text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 h-7" onClick={() => onInspectSeller(u.id)}>Inspect</Button>
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
function ProductApprovalView({ pendingProducts, reload, adminEmail }: { pendingProducts: any[], reload: () => void, adminEmail?: string }) {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = async (id: string) => {
    await approveProduct(id, adminEmail || "admin@earthcentric.com");
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
            <h3 className="text-xl font-bold text-amber-600">{pendingProducts.length} items</h3>
          </div>
          <div className="h-10 w-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center"><AlertCircle className="h-5 w-5" /></div>
        </Card>
        <Card className="p-4 bg-white border border-emerald-100 shadow-sm rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider mb-1">Approved Today</p>
            <h3 className="text-xl font-bold text-emerald-600">5 items</h3>
          </div>
          <div className="h-10 w-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center"><CheckCircle2 className="h-5 w-5" /></div>
        </Card>
        <Card className="p-4 bg-white border border-rose-100 shadow-sm rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider mb-1">Rejected Today</p>
            <h3 className="text-xl font-bold text-rose-600">0 items</h3>
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
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 w-48">Sustainability Claims</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Compliance Status</TableHead>
              <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                  No products pending sustainable verification review.
                </TableCell>
              </TableRow>
            ) : (
              pendingProducts.map((p) => (
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
                    <p className="text-[9px] text-[#4a5d4e] bg-[#e8f3ec] p-1.5 rounded">{p.sustainabilityDetail || p.description}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge className="bg-amber-100 text-amber-800 border-none text-[9px]"><AlertCircle className="h-2.5 w-2.5 mr-1" /> Pending review</Badge>
                  </TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    <div className="flex items-center justify-end space-x-2">
                      <Button size="sm" className="bg-[#1a3321] hover:bg-[#25422d] text-white text-[10px] h-7 px-3 rounded-full" onClick={() => handleApprove(p.id)}>Approve</Button>
                      <Button size="sm" variant="ghost" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 text-[10px] h-7 px-3 rounded-full" onClick={() => setRejectId(p.id)}>Reject</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

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
    </div>
  );
}

// --------------------------------------------------------------------------
// PAYMENTS VIEW
// --------------------------------------------------------------------------
function PaymentsView({ payoutRequests, onActionComplete, adminEmail }: { payoutRequests: any[], onActionComplete: () => void, adminEmail?: string }) {
  const [subTab, setSubTab] = useState("transactions");
  const [settleId, setSettleId] = useState<string | null>(null);
  const [settleNotes, setSettleNotes] = useState("");

  const handleSettle = async () => {
    if (!settleId) return;
    await settlePayoutRequest(settleId, adminEmail || "admin@earthcentric.com", settleNotes || "Settle payout via supervisor dashboard IMPS");
    setSettleId(null);
    setSettleNotes("");
    onActionComplete();
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
          <Table>
            <TableHeader>
              <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 pl-6">Transaction ID</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Order ID</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Amount</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Method</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Commission (10%)</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Status</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_TRANSACTIONS.map((t) => (
                <TableRow key={t.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                  <TableCell className="py-4 pl-6">
                    <p className="text-xs font-bold text-[#1a3321]">{t.id}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs text-muted-foreground">{t.orderId}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs font-black text-[#1a3321]">₹{t.amount}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs text-muted-foreground">{t.method}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-xs font-bold text-emerald-600">₹{t.commission}</p>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge className="bg-[#e8f3ec] text-emerald-700 border-none text-[9px] hover:bg-[#e8f3ec]"><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Success</Badge>
                  </TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden mt-6">
          <Table>
            <TableHeader>
              <TableRow className="border-[#e9ece6] bg-[#fdfdfc] hover:bg-[#fdfdfc]">
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 pl-6">Request ID</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Seller Company</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Requested Amount</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Date Requested</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4">Payout Status</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-4 text-right pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payoutRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No payout requests submitted.
                  </TableCell>
                </TableRow>
              ) : (
                payoutRequests.map((r) => (
                  <TableRow key={r.id} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50 transition-colors">
                    <TableCell className="py-4 pl-6 font-mono text-xs text-[#1a3321]">
                      {r.id}
                    </TableCell>
                    <TableCell className="py-4 text-xs font-semibold">
                      {r.companyName}
                    </TableCell>
                    <TableCell className="py-4 text-xs font-black text-[#1a3321]">
                      ₹{r.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="py-4 text-xs text-muted-foreground">
                      {new Date(r.requestedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge className={r.status === "SETTLED" ? "bg-emerald-50 text-emerald-700 border-none text-[9px]" : "bg-amber-50 text-amber-700 border-none text-[9px]"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6">
                      {r.status === "PENDING" ? (
                        <Button size="sm" className="bg-[#1a3321] text-white text-[10px] h-7" onClick={() => setSettleId(r.id)}>
                          Settle Request
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold">Settled</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {settleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSettleId(null)} />
          <Card className="relative w-full max-w-sm p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm">Settle Seller Payout</h3>
            <div className="space-y-1.5">
              <Label>Settlement Notes / Transaction Ref</Label>
              <Input
                placeholder="e.g. Paid via IMPS Ref #92834..."
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setSettleId(null)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSettle}>Confirm Settlement</Button>
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
function OrderManagementView({ orders, onUpdateStatus }: { orders: any[], onUpdateStatus: () => void }) {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Order Tracking System</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide overview of all customer order stages, payment status, and carbon offsets.</p>
      </div>

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
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                  No orders recorded on the platform yet.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <Card className="relative w-full max-w-md p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-sm">Order EC-ORD-{selectedOrder.id.substring(4, 10).toUpperCase()} Timeline</h3>
              <button onClick={() => setSelectedOrder(null)}><X className="h-4 w-4" /></button>
            </div>
            
            <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
              {selectedOrder.timeline && selectedOrder.timeline.length > 0 ? (
                selectedOrder.timeline.map((step: any, idx: number) => (
                  <div key={idx} className="flex space-x-3 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 mt-1" />
                      {idx < selectedOrder.timeline.length - 1 && <div className="w-0.5 h-10 bg-border" />}
                    </div>
                    <div>
                      <p className="font-bold text-[#1a3321]">{step.status}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{step.description}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{new Date(step.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No timeline events recorded.</p>
              )}
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
    </div>
  );
}

// --------------------------------------------------------------------------
// SUSTAINABILITY IMPACT VIEW
// --------------------------------------------------------------------------
function ImpactView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Sustainability Impact Metrics</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide cumulative environmental offsets and sustainable supply metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-[#1a3321] text-white rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <span className="text-3xl">🌱</span>
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mt-2">Carbon Offset (CO2)</p>
            <h3 className="text-3xl font-black mt-1">1,248.4 kg</h3>
            <p className="text-[10px] text-emerald-100/60 mt-1">Equivalent to 62 trees growing for 10 years</p>
          </div>
        </Card>

        <Card className="p-6 bg-[#1a3321] text-white rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <span className="text-3xl">🥤</span>
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mt-2">Plastic Saved</p>
            <h3 className="text-3xl font-black mt-1">482.6 kg</h3>
            <p className="text-[10px] text-emerald-100/60 mt-1">Equal to 24,000 standard plastic water bottles avoided</p>
          </div>
        </Card>

        <Card className="p-6 bg-[#1a3321] text-white rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <span className="text-3xl">🌳</span>
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mt-2">Eco Reforestation</p>
            <h3 className="text-3xl font-black mt-1">124 Credits</h3>
            <p className="text-[10px] text-emerald-100/60 mt-1">Trees sponsored directly in global mangrove reserves</p>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-white border-none shadow-sm rounded-2xl space-y-4">
        <h3 className="font-bold text-sm text-[#1a3321]">Monthly Eco-Savings Timeline</h3>
        <div className="h-48 w-full flex items-end justify-between px-6 pt-4 border-b pb-4">
          {[
            { month: 'Jan', co2: '180kg', h: '30%' },
            { month: 'Feb', co2: '220kg', h: '40%' },
            { month: 'Mar', co2: '310kg', h: '60%' },
            { month: 'Apr', co2: '280kg', h: '55%' },
            { month: 'May', co2: '410kg', h: '85%' },
            { month: 'Jun', co2: '482kg', h: '100%' }
          ].map((bar, i) => (
            <div key={i} className="flex flex-col items-center w-[12%]">
              <span className="text-[9px] font-bold text-emerald-700 mb-1">{bar.co2}</span>
              <div className="w-8 bg-gradient-to-t from-emerald-800 to-emerald-400 rounded-t" style={{ height: `calc(${bar.h} * 1.2)` }} />
              <span className="text-[10px] text-muted-foreground mt-2 font-semibold">{bar.month}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------
// CERTIFICATIONS VIEW
// --------------------------------------------------------------------------
function CertificationsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a3321]">Organic Certifications Compliance</h1>
        <p className="text-sm text-muted-foreground mt-1">Audit statuses and validation metrics of third-party ecological certificates.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { name: "GOTS Organic", code: "GOTS", desc: "Global Organic Textile Standard", count: 8, status: "Active" },
          { name: "FSC Certified", code: "FSC", desc: "Forest Stewardship Council", count: 12, status: "Active" },
          { name: "FairTrade Certified", code: "FT", desc: "Ethical trade production audits", count: 6, status: "Active" },
          { name: "USDA Biobased", code: "USDA", desc: "Bio-derived organic materials rating", count: 9, status: "Active" },
        ].map((c) => (
          <Card key={c.code} className="p-5 bg-white border-none shadow-sm rounded-2xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">{c.code}</span>
                <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px]">{c.status}</Badge>
              </div>
              <div>
                <h4 className="font-bold text-xs text-[#1a3321]">{c.name}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{c.desc}</p>
              </div>
            </div>
            <div className="pt-2 border-t flex justify-between text-[10px] font-bold text-muted-foreground">
              <span>Audited Listings</span>
              <span className="text-foreground">{c.count} items</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

