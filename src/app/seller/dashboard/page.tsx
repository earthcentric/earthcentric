"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { AdminSellerMessenger } from "@/components/ui/admin-seller-messenger";
import { getSellerDashboardStats, getSellerProfile, SellerProfile, getSellerAnalyticsTimeSeries } from "@/actions/sellers";
import { getUserNotifications, markNotificationAsRead } from "@/actions/notifications";
import { getProducts, createProduct, archiveProduct, ProductItem, updateProductStock, updateProduct } from "@/actions/products";
import { getOrdersBySeller, updateOrderStatus, OrderDetail } from "@/actions/orders";
import { getSellerPayoutStats, requestPayout, getSellerPayoutRequests, SellerPayoutStats, PayoutRequestInfo } from "@/actions/payouts";
import { getSellerEnquiries, updateEnquiryStatus, EnquiryData } from "@/actions/enquiries";
import { getSellerComplaints, updateComplaintStatus, ComplaintData } from "@/actions/complaints";
import * as XLSX from "xlsx";
import { Button, Card, Badge, Input, Textarea, Label, Table, TableHeader, TableBody, TableRow, TableCell, TableHead, MetalButton } from "@/components/ui/shared";
import { FadeIn } from "@/components/FramerComponents";
import { Logo } from "@/components/Logo";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  BarChart2,
  ShieldCheck,
  Wallet,
  Settings,
  LogOut,
  Plus,
  Trash2,
  ImagePlus,
  X,
  AlertCircle,
  CheckCircle2,
  Send,
  History,
  TrendingUp,
  Activity,
  DollarSign,
  Leaf,
  Star,
  Mail,
  Home,
  MessageSquare,
  Bell,
  Menu,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Image Upload Preview Item ──
interface ImagePreview {
  id: string;
  file: File;
  previewUrl: string;
  dataUrl: string;
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // Payout states
  const [payoutStats, setPayoutStats] = useState<SellerPayoutStats | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestInfo[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Sync data on load
  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    
    const p = await getSellerProfile(user.id);
    setProfile(p);

    const sellerId = p?.id || user.id;

    const s = await getSellerDashboardStats(sellerId || "seller-1");
    setStats(s);

    const aData = await getSellerAnalyticsTimeSeries(sellerId || "seller-1");
    setAnalyticsData(aData);

    const sellerProducts = await getProducts({ sellerId: sellerId });
    setProducts(sellerProducts);

    const sellerOrders = await getOrdersBySeller(sellerId);
    setOrders(sellerOrders);

    const pStats = await getSellerPayoutStats(sellerId);
    setPayoutStats(pStats);

    const pRequests = await getSellerPayoutRequests(sellerId);
    setPayoutRequests(pRequests);

    const userNotifs = await getUserNotifications(user.id);
    setNotifications(userNotifs);

    setLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  // Actions
  const handleUpdateStock = async (id: string, newStock: number) => {
    await updateProductStock(id, newStock);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock: newStock } : p)));
  };

  const handleArchive = async (id: string) => {
    await archiveProduct(id);
    loadDashboardData();
  };

  const handleUpdateFulfillment = async (orderId: string, currentStatus: string) => {
    let nextStatus: OrderDetail["status"] = "PLACED";
    let desc = "";

    if (currentStatus === "PLACED") {
      nextStatus = "CONFIRMED";
      desc = "Seller confirmed stock availability. Moving to packing bay.";
    } else if (currentStatus === "CONFIRMED") {
      nextStatus = "PACKED";
      desc = "Wrapped in recyclable plastic-free cardboard and tape.";
    } else if (currentStatus === "PACKED") {
      nextStatus = "SHIPPED";
      desc = "Dispatched via carbon-offset logistical partners.";
    } else if (currentStatus === "SHIPPED") {
      nextStatus = "DELIVERED";
      desc = "Package received by buyer. Carbon offset verified.";
    } else {
      return; 
    }

    await updateOrderStatus(orderId, nextStatus, desc);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: nextStatus } : o));
  };

  if (loading) {
    return <div className="min-h-screen bg-[#f4f5f3] flex items-center justify-center text-xs text-muted-foreground">Loading Seller Studio...</div>;
  }

  if (profile?.verificationStatus === "PENDING" || profile?.verificationStatus === "REJECTED") {
    return (
      <div className="min-h-screen bg-[#f4f5f3] flex flex-col items-center justify-center space-y-4 px-4 text-center">
        <AlertCircle className="h-10 w-10 text-amber-600 mx-auto" />
        <h2 className="text-xl font-bold">Dashboard Locked</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Your verification request status is currently <strong>{profile.verificationStatus}</strong>. You will gain dashboard access once an administrator approves your certificates.
        </p>
        <Button variant="cool" onClick={() => window.location.href = "/seller/verification"}>Check Status</Button>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "products", label: "Products", icon: Package },
    { id: "orders", label: "Orders", icon: ShoppingBag },
    { id: "enquiries", label: "Enquiries", icon: MessageSquare },
    { id: "complaints", label: "Complaints", icon: AlertCircle },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
    { id: "messages", label: "Messages", icon: Mail },
    { id: "verification", label: "Verification", icon: ShieldCheck },
    { id: "payments", label: "Payments", icon: Wallet },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#f4f5f3] font-sans text-foreground">
      {/* Mobile Sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-25 md:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <div className={`w-64 bg-[#e9ece6] border-r border-[#d8dcd3] flex flex-col fixed h-full z-30 transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        
        {/* Profile Summary Card */}
        <div className="p-6 pt-10">
          <div className="bg-[#f4f5f3] rounded-xl p-4 shadow-sm border border-[#d8dcd3]/50 flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-xl mb-3 flex items-center justify-center text-primary">
              <Leaf className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">{profile?.companyName || "Your Company"}</h3>
            <p className="text-[10px] text-muted-foreground mb-3">Bangalore, Karnataka</p>
            <Badge variant="success" className="text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white border-none py-0.5 px-2">
              <CheckCircle2 className="w-3 h-3 mr-1 inline-block" /> Premium Verified
            </Badge>

            <div className="w-full mt-4 space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                <span>Eco Score</span>
                <span className="text-foreground">98/100</span>
              </div>
              <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: '98%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id 
                  ? "bg-[#d9e2d5] text-[#2d4a36]" 
                  : "text-muted-foreground hover:bg-[#d9e2d5]/50 hover:text-foreground"
              }`}
            >
              <item.icon className={`h-4 w-4 ${activeTab === item.id ? "text-[#2d4a36]" : "text-muted-foreground"}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-[#d8dcd3]">
          <button 
            onClick={() => {
              setIsSidebarOpen(false);
              window.location.href = "/";
            }}
            className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer border-none bg-transparent"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <div className="h-14 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-10 bg-[#f4f5f3] border-b border-[#d8dcd3]/40">
          <div className="flex items-center space-x-2 text-[#4a5d4e] font-bold text-sm tracking-tight">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 text-[#4a5d4e] hover:text-[#2d4a36] md:hidden border-none bg-transparent cursor-pointer mr-2 flex items-center justify-center"
              aria-label="Toggle Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Logo hideTextOnMobile={true} />
            <span className="ml-1 text-[10px] sm:text-xs font-semibold bg-[#2d4a36] text-white px-2 py-0.5 rounded-full">Seller</span>
          </div>
          <div className="flex items-center space-x-6">
            <a href="/" className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center space-x-1">
              <Home className="h-3.5 w-3.5" />
              <span>Back to Home</span>
            </a>
            <a href="/marketplace" className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer">View Marketplace</a>
            
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
                            loadDashboardData();
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
                              if (n.actionUrl && n.actionUrl.includes('tab=')) {
                                const tab = n.actionUrl.split('tab=')[1];
                                setActiveTab(tab);
                              } else if (n.actionUrl && n.actionUrl.startsWith('/')) {
                                window.location.href = n.actionUrl;
                              } else if (n.actionUrl) {
                                setActiveTab(n.actionUrl);
                              }
                              loadDashboardData();
                            }}
                            className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                              n.isRead 
                                ? "bg-slate-50/50 border-slate-100 hover:bg-slate-50" 
                                : "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/50 font-medium"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-foreground truncate max-w-[180px]">{n.title}</span>
                              <span className="text-[8px] text-muted-foreground uppercase">{new Date(n.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </>
              )}
            </div>

            <div className="flex items-center space-x-2 bg-white px-2.5 py-1 rounded-full shadow-sm border border-[#d8dcd3]">
              <div className="h-5 w-5 bg-primary/20 text-primary rounded-full flex items-center justify-center">
                <Leaf className="h-3 w-3" />
              </div>
              <span className="text-[10px] font-bold pr-1">{profile?.companyName}</span>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          <FadeIn>
            {activeTab === "dashboard" && <DashboardView stats={stats} products={products} setTab={setActiveTab} profile={profile} />}
            {activeTab === "products" && <ProductsView products={products} stats={stats} handleArchive={handleArchive} handleUpdateStock={handleUpdateStock} reload={loadDashboardData} profile={profile!} />}
            {activeTab === "orders" && <OrdersView orders={orders} handleUpdateFulfillment={handleUpdateFulfillment} />}
            {activeTab === "enquiries" && <EnquiriesView sellerId={profile?.id || ""} />}
            { activeTab === "complaints" && <ComplaintsView sellerId={profile?.id || ""} />}
            { activeTab === "messages" && <MessagesView sellerId={profile?.id || ""} /> }
            { activeTab === "analytics" && <AnalyticsView stats={stats} analyticsData={analyticsData} />}
            {activeTab === "payments" && (
              <PaymentsView 
                payoutStats={payoutStats} 
                payoutRequests={payoutRequests} 
                user={user} 
                sellerId={profile?.id || user?.id || ""} 
                reload={loadDashboardData} 
              />
            )}
            {activeTab === "verification" && <VerificationView profile={profile} />}
            {activeTab === "settings" && <SettingsView profile={profile} />}
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// DASHBOARD TAB VIEW
// --------------------------------------------------------------------------
function DashboardView({ stats, products, setTab, profile }: any) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2d4a36]">Seller Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back! Here's your business overview.</p>
        </div>
        <Button onClick={() => setTab("products")} className="bg-[#2d4a36] hover:bg-[#1e3425] text-white text-xs font-semibold rounded-full px-5 py-2 shadow-sm">
          + Add Product
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="h-8 w-8 bg-[#e8f3ec] text-[#2d4a36] rounded-md flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
            <Badge variant="success" className="bg-[#e8f3ec] text-[#2d4a36] border-none text-[10px] px-1.5 py-0.5">↑ 18%</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">₹{stats?.revenue?.toLocaleString() || 0}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">Total Revenue</p>
            <p className="text-[9px] text-[#2d4a36] mt-0.5">+18% this month</p>
          </div>
        </Card>

        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="h-8 w-8 bg-[#e8f3ec] text-[#2d4a36] rounded-md flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <Badge variant="success" className="bg-[#e8f3ec] text-[#2d4a36] border-none text-[10px] px-1.5 py-0.5">↑ 5%</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">{stats?.ordersCount || 0}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">Total Orders</p>
            <p className="text-[9px] text-[#2d4a36] mt-0.5">+43 this week</p>
          </div>
        </Card>

        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="h-8 w-8 bg-[#f4f5f3] text-muted-foreground rounded-md flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-none text-amber-600 bg-amber-50">→ 0%</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">{stats?.productsCount || 0}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">Products Listed</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">3 pending approval</p>
          </div>
        </Card>

        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="h-8 w-8 bg-amber-50 text-amber-500 rounded-md flex items-center justify-center">
              <Star className="h-4 w-4" />
            </div>
            {profile?.trustScore && profile.trustScore > 4 ? (
              <Badge variant="success" className="bg-[#e8f3ec] text-[#2d4a36] border-none text-[10px] px-1.5 py-0.5">Trusted</Badge>
            ) : null}
          </div>
          <div>
            <div className="flex items-baseline space-x-1">
              <h3 className="text-2xl font-bold text-foreground">{profile?.trustScore?.toFixed(1) || "0.0"}</h3>
              <Star className="h-3.5 w-3.5 text-foreground fill-foreground" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Trust Score</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Admin Assigned</p>
          </div>
        </Card>
      </div>

      {/* Product Inventory Table Preview */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#e9ece6] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#e9ece6]">
          <h3 className="text-sm font-bold text-[#2d4a36]">Product Inventory</h3>
          <button onClick={() => setTab("products")} className="text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center">
            Manage All <span className="ml-1">›</span>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#e9ece6] hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4 pl-6">PRODUCT</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">STOCK</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">PRICE</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">SOLD</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">STATUS</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.slice(0, 4).map((p: any) => {
                const isLow = p.stock > 0 && p.stock <= 15;
                const isOut = p.stock === 0;
                return (
                  <TableRow key={p.id} className="border-b border-[#e9ece6]/50">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center space-x-3">
                        <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover shadow-sm" />
                        <span className="text-xs font-bold text-[#2d4a36]">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-xs font-medium py-4 ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-foreground'}`}>
                      {p.stock}
                    </TableCell>
                    <TableCell className="text-xs font-bold py-4">₹{p.price}</TableCell>
                    <TableCell className="text-xs text-muted-foreground py-4">{stats?.productSalesMap?.[p.id] || Math.floor(Math.random()*200)}</TableCell>
                    <TableCell className="py-4">
                      {isOut ? (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-none text-[9px]">Out of Stock</Badge>
                      ) : isLow ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-none text-[9px]">Low Stock</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none text-[9px]">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex space-x-3 text-[10px] font-semibold">
                        <button className="text-muted-foreground hover:text-primary">Edit</button>
                        <button className="text-red-400 hover:text-red-600">Delete</button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRODUCTS TAB VIEW
// --------------------------------------------------------------------------
function ProductsView({ products, stats, handleArchive, handleUpdateStock, reload, profile }: any) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  // Edit Product Fields
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editScore, setEditScore] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editMoq, setEditMoq] = useState("");
  const [editWholesalePrice, setEditWholesalePrice] = useState("");
  const [editOriginalPrice, setEditOriginalPrice] = useState("");
  const [editSlabs, setEditSlabs] = useState<{ min: number; price: number; total?: number }[]>([]);

  const handleEditClick = (p: any) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditDesc(p.description);
    setEditPrice(p.price.toString());
    setEditStock(p.stock.toString());
    setEditCat(p.category);
    setEditScore(p.sustainabilityScore.toString());
    setEditDetails(p.sustainabilityDetail || "");
    setEditMoq(p.moq?.toString() || "");
    setEditWholesalePrice(p.wholesalePrice?.toString() || "");
    setEditOriginalPrice(p.originalPrice?.toString() || "");
    setEditSlabs(p.bulkPriceSlabs || []);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    await updateProduct(editingProduct.id, {
      name: editName,
      description: editDesc,
      price: Number(editPrice),
      stock: Number(editStock),
      categoryName: editCat,
      sustainabilityScore: Number(editScore),
      sustainabilityDetail: editDetails,
      moq: editMoq ? Number(editMoq) : undefined,
      wholesalePrice: editWholesalePrice ? Number(editWholesalePrice) : undefined,
      originalPrice: editOriginalPrice ? Number(editOriginalPrice) : undefined,
      bulkPriceSlabs: editSlabs.length > 0 ? editSlabs : undefined,
    });
    setEditingProduct(null);
    reload();
  };

  const activeCount = products.filter((p:any) => p.stock > 0).length;
  const issueCount = products.filter((p:any) => p.stock <= 15).length;
  const totalSold = Object.values(stats?.productSalesMap || {}).reduce((a:any,b:any)=>a+b, 0) || 898;

  if (showAddForm) {
    return <AddProductForm onBack={() => setShowAddForm(false)} profile={profile} reload={reload} />;
  }

  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCat === "all" || p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-") === selectedCat.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2d4a36]">Products Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your listed items, update stock levels, and monitor sales performance.</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="bg-[#2d4a36] hover:bg-[#1e3425] text-white text-xs font-semibold rounded-full px-5 py-2 shadow-sm">
          + Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Active Products</p>
            <h3 className="text-2xl font-black text-foreground">{activeCount}</h3>
          </div>
          <Package className="h-5 w-5 text-[#2d4a36]" />
        </Card>
        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Low / Out of Stock</p>
            <h3 className="text-2xl font-black text-red-500">{issueCount}</h3>
          </div>
          <AlertCircle className="h-5 w-5 text-red-400" />
        </Card>
        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Units Sold</p>
            <h3 className="text-2xl font-black text-foreground">{totalSold as React.ReactNode}</h3>
          </div>
          <TrendingUp className="h-5 w-5 text-emerald-600" />
        </Card>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#e9ece6] p-4">
        <div className="mb-4">
          <Input 
            placeholder="Search products or category..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#f4f5f3] border-none text-xs rounded-xl py-2 px-4" 
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-4">
          <span className="font-semibold px-2 py-1">Filter:</span>
          {[
            { name: "All", slug: "all" },
            { name: "Personal Care", slug: "personal-care" },
            { name: "Bags", slug: "bags" },
            { name: "Kitchenware", slug: "kitchenware" },
            { name: "Disposables", slug: "disposables" },
            { name: "Organic Apparel", slug: "organic-apparel" }
          ].map((cat) => {
            const isActive = selectedCat === cat.slug;
            return (
              <Badge 
                key={cat.slug}
                variant={isActive ? "success" : "outline"} 
                className={`border-none px-3 py-1 rounded-full cursor-pointer transition-all ${
                  isActive ? "bg-[#2d4a36] text-white hover:bg-[#2d4a36]" : "bg-[#f4f5f3] hover:bg-[#e9ece6] text-foreground"
                }`}
                onClick={() => setSelectedCat(cat.slug)}
              >
                {cat.name}
              </Badge>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#e9ece6] hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">PRODUCT INFO</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">CATEGORY</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">STOCK LEVEL</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">RETAIL PRICE</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">SOLD VOLUME</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">STATUS</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4 text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p: any) => {
                const isLow = p.stock > 0 && p.stock <= 15;
                const isOut = p.stock === 0;
                return (
                  <TableRow key={p.id} className="border-b border-[#e9ece6]/50">
                    <TableCell className="pl-4 py-4">
                      <div className="flex items-center space-x-3">
                        <img src={p.images?.[0] || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80"} alt="" className="h-8 w-8 rounded object-cover shadow-sm" />
                        <div>
                          <p className="text-xs font-bold text-[#2d4a36]">{p.name}</p>
                          <p className="text-[9px] text-muted-foreground">ID: {p.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="w-16 break-words">{p.category}</div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="0"
                          defaultValue={p.stock}
                          className="w-12 text-[11px] font-bold bg-transparent focus:outline-none border-b border-transparent focus:border-primary px-1"
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val !== p.stock) handleUpdateStock(p.id, val);
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground">units</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] font-bold py-4">₹{p.price}</TableCell>
                    <TableCell className="py-4">
                      <span className="text-[11px] font-bold block">{stats?.productSalesMap?.[p.id] || Math.floor(Math.random()*200)}</span>
                      <span className="text-[9px] text-muted-foreground">orders</span>
                    </TableCell>
                    <TableCell className="py-4">
                      {p.isApproved === false ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-none text-[9px]">Pending Approval</Badge>
                      ) : isOut ? (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-none text-[9px]">Out of Stock</Badge>
                      ) : isLow ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-none text-[9px]">Low Stock</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none text-[9px]">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <div className="flex items-center justify-end space-x-2 text-[10px] font-semibold">
                        <button onClick={() => handleEditClick(p)} className="px-2 py-1 bg-muted/50 rounded hover:bg-muted text-muted-foreground flex items-center"><Package className="h-3 w-3 mr-1" /> Edit</button>
                        <button onClick={() => handleArchive(p.id)} className="px-2 py-1 bg-red-50 text-red-500 rounded hover:bg-red-100 flex items-center"><Trash2 className="h-3 w-3 mr-1" /> Delete</button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditingProduct(null)} />
          <Card className="relative w-full max-w-lg p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <h3 className="font-extrabold text-sm text-[#2d4a36]">Edit Product Listing</h3>
                <p className="text-[10px] text-muted-foreground">Modify details for {editingProduct.name}</p>
              </div>
              <button onClick={() => setEditingProduct(null)} className="p-1 hover:bg-muted rounded-full"><X className="h-4 w-4" /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Product Name</Label>
                  <Input required value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Input required value={editCat} onChange={(e) => setEditCat(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea required value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-20" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Original Price / MRP (₹)</Label>
                  <Input type="number" placeholder="MRP" value={editOriginalPrice} onChange={(e) => setEditOriginalPrice(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Active Deal Price (₹)</Label>
                  <Input type="number" required value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Stock</Label>
                  <Input type="number" required value={editStock} onChange={(e) => setEditStock(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>MOQ (Min Order Qty)</Label>
                  <Input type="number" placeholder="Optional" value={editMoq} onChange={(e) => setEditMoq(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Eco Score (1-100)</Label>
                  <Input type="number" required value={editScore} onChange={(e) => setEditScore(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Sustainability Details</Label>
                <Textarea value={editDetails} onChange={(e) => setEditDetails(e.target.value)} className="h-16" />
              </div>

              {/* Edit Slabs Section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between items-center">
                  <Label className="font-bold text-xs text-[#2d4a36]">Volume Pricing Deals (Buy More, Pay Less)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditSlabs([...editSlabs, { min: 2, price: 0, total: 0 }])} className="text-xs h-7">
                    + Add Tier
                  </Button>
                </div>
                {editSlabs.map((slab: any, index) => (
                  <div key={index} className="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-xs font-semibold">Buy</span>
                    <Input
                      type="number"
                      required
                      placeholder="Qty"
                      value={slab.min || ""}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        const newSlabs = [...editSlabs];
                        newSlabs[index].min = qty;
                        const totalVal = newSlabs[index].total || (newSlabs[index].price * qty) || 0;
                        newSlabs[index].total = totalVal;
                        newSlabs[index].price = qty > 0 ? Math.round(totalVal / qty) : 0;
                        setEditSlabs(newSlabs);
                      }}
                      className="w-16 text-xs h-8 bg-white"
                    />
                    <span className="text-xs font-semibold">units for a total of ₹</span>
                    <Input
                      type="number"
                      required
                      placeholder="Total Price"
                      value={slab.total || (slab.price * slab.min) || ""}
                      onChange={(e) => {
                        const total = Number(e.target.value);
                        const newSlabs = [...editSlabs];
                        newSlabs[index].total = total;
                        const qty = newSlabs[index].min || 1;
                        newSlabs[index].price = qty > 0 ? Math.round(total / qty) : 0;
                        setEditSlabs(newSlabs);
                      }}
                      className="w-24 text-xs h-8 bg-white"
                    />
                    {slab.price > 0 && (
                      <span className="text-[10px] text-slate-500 font-semibold italic">
                        (₹{slab.price}/each)
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditSlabs(editSlabs.filter((_, i) => i !== index))}
                      className="text-rose-500 hover:text-rose-600 text-xs h-8 hover:bg-rose-50 ml-auto"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <Button variant="ghost" size="sm" type="button" onClick={() => setEditingProduct(null)}>Cancel</Button>
                <Button className="bg-[#2d4a36] hover:bg-[#1e3425] text-white" size="sm" type="submit">Save Changes</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// ADD PRODUCT FORM
// --------------------------------------------------------------------------
function AddProductForm({ onBack, profile, reload }: any) {
  const { user } = useAuth();
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodStock, setProdStock] = useState("30");
  const [prodCat, setProdCat] = useState("Organic Apparel");
  const [prodScore, setProdScore] = useState("90");
  const [prodDetails, setProdDetails] = useState("");
  const [prodOriginalPrice, setProdOriginalPrice] = useState("");
  const [prodSlabs, setProdSlabs] = useState<{ min: number; price: number; total?: number }[]>([]);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Implementation omitted for brevity to focus on layout, 
  // reusing the same logic from before.
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const imageFiles = fileArr.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const remaining = 5 - imagePreviews.length;
    const toAdd = imageFiles.slice(0, remaining);
    toAdd.forEach((file) => {
      const previewUrl = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, { id: Date.now().toString(), file, previewUrl, dataUrl: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  }, [imagePreviews.length]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !prodName || !prodPrice) return;
    const imageUrls = imagePreviews.length > 0 ? imagePreviews.map((img) => img.dataUrl) : ["https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80"];
    await createProduct({
      name: prodName,
      description: prodDesc,
      price: Number(prodPrice),
      stock: Number(prodStock),
      categoryName: prodCat,
      sustainabilityScore: Number(prodScore),
      sustainabilityDetail: prodDetails,
      imageUrls,
      sellerId: user.id,
      sellerName: profile?.companyName || "Seller",
      originalPrice: prodOriginalPrice ? Number(prodOriginalPrice) : undefined,
      bulkPriceSlabs: prodSlabs.length > 0 ? prodSlabs : undefined,
    });
    reload();
    onBack();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">← Back</Button>
        <h1 className="text-xl font-bold text-[#2d4a36]">Add New Listing</h1>
      </div>
      <Card className="p-6 border-none shadow-sm rounded-2xl bg-white max-w-2xl">
        <form onSubmit={handleAddProduct} className="space-y-6">
          {/* Form fields here */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Product Name</Label><Input required value={prodName} onChange={(e) => setProdName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Category</Label><Input required value={prodCat} onChange={(e) => setProdCat(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Description</Label><Textarea required value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1"><Label>Original Price / MRP (₹)</Label><Input type="number" placeholder="MRP" value={prodOriginalPrice} onChange={(e) => setProdOriginalPrice(e.target.value)} /></div>
            <div className="space-y-1"><Label>Active Sale Price (₹)</Label><Input type="number" required value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} /></div>
            <div className="space-y-1"><Label>Stock</Label><Input type="number" required value={prodStock} onChange={(e) => setProdStock(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Eco Score (1-100)</Label><Input type="number" required value={prodScore} onChange={(e) => setProdScore(e.target.value)} /></div>
            <div className="space-y-1"><Label>Sustainability Details</Label><Input value={prodDetails} onChange={(e) => setProdDetails(e.target.value)} /></div>
          </div>

          {/* Volume pricing deals */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex justify-between items-center">
              <Label className="font-bold text-xs text-[#2d4a36]">Volume Pricing Deals (Buy More, Pay Less)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setProdSlabs([...prodSlabs, { min: 2, price: 0, total: 0 }])} className="text-xs h-7">
                + Add Tier
              </Button>
            </div>
            {prodSlabs.map((slab: any, index) => (
              <div key={index} className="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold">Buy</span>
                <Input
                  type="number"
                  required
                  placeholder="Qty"
                  value={slab.min || ""}
                  onChange={(e) => {
                    const qty = Number(e.target.value);
                    const newSlabs = [...prodSlabs];
                    newSlabs[index].min = qty;
                    const totalVal = newSlabs[index].total || (newSlabs[index].price * qty) || 0;
                    newSlabs[index].total = totalVal;
                    newSlabs[index].price = qty > 0 ? Math.round(totalVal / qty) : 0;
                    setProdSlabs(newSlabs);
                  }}
                  className="w-16 text-xs h-8 bg-white"
                />
                <span className="text-xs font-semibold">units for a total of ₹</span>
                <Input
                  type="number"
                  required
                  placeholder="Total Price"
                  value={slab.total || (slab.price * slab.min) || ""}
                  onChange={(e) => {
                    const total = Number(e.target.value);
                    const newSlabs = [...prodSlabs];
                    newSlabs[index].total = total;
                    const qty = newSlabs[index].min || 1;
                    newSlabs[index].price = qty > 0 ? Math.round(total / qty) : 0;
                    setProdSlabs(newSlabs);
                  }}
                  className="w-24 text-xs h-8 bg-white"
                />
                {slab.price > 0 && (
                  <span className="text-[10px] text-slate-500 font-semibold italic">
                    (₹{slab.price}/each)
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setProdSlabs(prodSlabs.filter((_, i) => i !== index))}
                  className="text-rose-500 hover:text-rose-600 text-xs h-8 hover:bg-rose-50 ml-auto"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          
          <div className="space-y-2">
            <Label>Images</Label>
            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => {if(e.target.files) processFiles(e.target.files);}} className="hidden" />
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-muted/50" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Click to upload images (up to 5)</span>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {imagePreviews.map(img => <img key={img.id} src={img.previewUrl} className="h-12 w-12 object-cover rounded" />)}
              </div>
            </div>
          </div>
          <MetalButton type="submit" variant="success">Publish Product</MetalButton>
        </form>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------
// ORDERS TAB VIEW
// --------------------------------------------------------------------------
function OrdersView({ orders, handleUpdateFulfillment }: any) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const pendingCount = orders.filter((o: any) => o.status !== "DELIVERED" && o.status !== "CANCELLED").length;
  const shippedCount = orders.filter((o: any) => o.status === "SHIPPED").length;
  const deliveredCount = orders.filter((o: any) => o.status === "DELIVERED").length;

  const filteredOrders = orders.filter((o: any) => {
    if (statusFilter === "pending") return o.status !== "DELIVERED" && o.status !== "CANCELLED";
    if (statusFilter === "shipped") return o.status === "SHIPPED";
    if (statusFilter === "delivered") return o.status === "DELIVERED";
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-[#2d4a36]">Orders Fulfillment</h1>
        <p className="text-sm text-muted-foreground mt-1">Track order requests, fulfill pending shipments, and review sales receipts.</p>
      </div>

      <div className="flex items-center space-x-2 bg-white w-max p-1.5 rounded-full shadow-sm border border-[#e9ece6]">
        <Badge 
          className={`border-none px-4 py-1.5 rounded-full cursor-pointer text-xs font-semibold ${statusFilter === "all" ? "bg-[#2d4a36] text-white hover:bg-[#2d4a36]" : "bg-transparent text-muted-foreground hover:bg-[#e9ece6]"}`}
          onClick={() => setStatusFilter("all")}
        >
          All ({orders.length})
        </Badge>
        <Badge 
          className={`border-none px-4 py-1.5 rounded-full cursor-pointer text-xs font-semibold ${statusFilter === "pending" ? "bg-[#2d4a36] text-white hover:bg-[#2d4a36]" : "bg-transparent text-muted-foreground hover:bg-[#e9ece6]"}`}
          onClick={() => setStatusFilter("pending")}
        >
          Pending ({pendingCount})
        </Badge>
        <Badge 
          className={`border-none px-4 py-1.5 rounded-full cursor-pointer text-xs font-semibold ${statusFilter === "shipped" ? "bg-[#2d4a36] text-white hover:bg-[#2d4a36]" : "bg-transparent text-muted-foreground hover:bg-[#e9ece6]"}`}
          onClick={() => statusFilter !== "shipped" ? setStatusFilter("shipped") : setStatusFilter("all")}
        >
          Shipped ({shippedCount})
        </Badge>
        <Badge 
          className={`border-none px-4 py-1.5 rounded-full cursor-pointer text-xs font-semibold ${statusFilter === "delivered" ? "bg-[#2d4a36] text-white hover:bg-[#2d4a36]" : "bg-transparent text-muted-foreground hover:bg-[#e9ece6]"}`}
          onClick={() => statusFilter !== "delivered" ? setStatusFilter("delivered") : setStatusFilter("all")}
        >
          Delivered ({deliveredCount})
        </Badge>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#e9ece6] overflow-hidden p-2">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#e9ece6] hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4 pl-4">ORDER ID</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">CUSTOMER DETAILS</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">ORDER DATE</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">ITEMS / DESCRIPTION</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">AMOUNT</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4">FULFILLMENT</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8ca193] tracking-wider py-4 text-center">ACTION STEPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">No orders matching the filter.</TableCell></TableRow>
              ) : (
                filteredOrders.map((o: any) => {
                  const isDelivered = o.status === "DELIVERED" || o.status === "COMPLETED";
                  return (
                    <TableRow key={o.id} className="border-b border-[#e9ece6]/50">
                      <TableCell className="pl-4 py-4 font-bold text-[11px] text-[#2d4a36]">EC-ORD-{o.id.substring(4, 10).toUpperCase()}</TableCell>
                      <TableCell className="py-4">
                        <p className="text-xs font-bold">{o.user?.name || "Customer"}</p>
                        <p className="text-[9px] text-muted-foreground">{o.user?.email || "Retail Buyer"}</p>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground py-4">
                        {new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="text-[11px] font-medium text-[#2d4a36]">{o.items?.[0]?.product?.name || o.items?.[0]?.name || "Product"} (x{o.items?.[0]?.quantity || 1})</p>
                        <p className="text-[9px] text-muted-foreground">{o.items?.length || 1} package units</p>
                      </TableCell>
                      <TableCell className="text-[11px] font-bold py-4">₹{o.totalAmount}</TableCell>
                      <TableCell className="py-4">
                        {o.status === "PLACED" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-none text-[9px] px-2 py-0.5 rounded-full font-semibold">Placed</Badge>
                        ) : o.status === "CONFIRMED" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-none text-[9px] px-2 py-0.5 rounded-full font-semibold">Confirmed</Badge>
                        ) : o.status === "PACKED" ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-none text-[9px] px-2 py-0.5 rounded-full font-semibold">Packed</Badge>
                        ) : o.status === "SHIPPED" ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-none text-[9px] px-2 py-0.5 rounded-full font-semibold">Shipped</Badge>
                        ) : isDelivered ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none text-[9px] px-2 py-0.5 rounded-full font-semibold"><CheckCircle2 className="h-3 w-3 mr-1 inline" /> Delivered</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-600 border-none text-[9px] px-2 py-0.5 rounded-full font-semibold">{o.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        {!isDelivered ? (
                          <div className="flex items-center justify-center space-x-2">
                            <button onClick={() => handleUpdateFulfillment(o.id, o.status)} className="bg-[#2d4a36] hover:bg-[#1e3425] text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap">
                              {o.status === "PLACED" ? "Confirm Order" : o.status === "CONFIRMED" ? "Pack Items" : o.status === "PACKED" ? "Ship Cargo" : "Deliver Package"}
                            </button>
                            <button onClick={() => setSelectedInvoice(o)} className="text-[10px] text-muted-foreground border border-[#d8dcd3] px-2 py-1.5 rounded-lg">Invoice</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2 text-[10px] text-muted-foreground font-semibold">
                            <span><CheckCircle2 className="h-3 w-3 inline mr-0.5 text-emerald-500" /> Complete</span>
                            <button onClick={() => setSelectedInvoice(o)} className="border border-[#d8dcd3] px-2 py-1 rounded-lg hover:bg-muted/50">Invoice</button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)} />
          <Card className="relative w-full max-w-lg p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <div className="flex items-center space-x-1.5 mb-0.5">
                  <Leaf className="h-4 w-4 text-[#2d4a36]" />
                  <h3 className="font-extrabold text-sm text-[#2d4a36]">EarthCentric Sales Receipt</h3>
                </div>
                <p className="text-[10px] text-muted-foreground">Invoice #EC-INV-{selectedInvoice.id.substring(4, 10).toUpperCase()}</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-1 hover:bg-muted rounded-full"><X className="h-4 w-4" /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-[11px] leading-relaxed">
              <div>
                <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider">Billed To:</p>
                <p className="font-semibold text-foreground mt-0.5">{selectedInvoice.user?.name || "Customer"}</p>
                <p className="text-muted-foreground mt-0.5">{selectedInvoice.user?.email || "buyer@earthcentric.com"}</p>
              </div>
              <div>
                <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider">Shipping Address:</p>
                <p className="text-foreground font-semibold mt-0.5">
                  {selectedInvoice.address.street}, {selectedInvoice.address.city}, {selectedInvoice.address.state} - {selectedInvoice.address.postalCode}, {selectedInvoice.address.country}
                </p>
              </div>
            </div>

            <div className="border-y border-dashed py-4 space-y-2">
              <p className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider">Items Ordered:</p>
              {selectedInvoice.items && selectedInvoice.items.map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between text-xs font-medium">
                  <span className="text-foreground">{it.name} (x{it.quantity})</span>
                  <span className="font-bold">₹{(it.price * it.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{selectedInvoice.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Green Tax (0.5%)</span>
                <span>₹{Math.round(selectedInvoice.totalAmount * 0.005)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-[#2d4a36] pt-2 border-t">
                <span>Invoice Total</span>
                <span>₹{Math.round(selectedInvoice.totalAmount * 1.005).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>Close</Button>
              <Button className="bg-[#2d4a36] hover:bg-[#1e3425] text-white" size="sm" onClick={() => window.print()}>Print Invoice</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// ANALYTICS TAB VIEW
// --------------------------------------------------------------------------
function AnalyticsView({ stats, analyticsData }: any) {
  const [period, setPeriod] = useState<"daily" | "this_month" | "monthly" | "yearly">("monthly");

  let chartData = [];
  let periodLabel = "Monthly Sales Performance";
  
  if (period === "daily") {
    chartData = analyticsData?.daily?.income?.slice(0, 7).reverse() || [];
    periodLabel = "Daily Sales Performance (This Week)";
  } else if (period === "this_month") {
    chartData = analyticsData?.daily?.income?.slice(0, 30).reverse() || [];
    periodLabel = "Daily Sales Performance (This Month)";
  } else if (period === "yearly") {
    chartData = analyticsData?.yearly?.income?.slice(0, 5).reverse() || [];
    periodLabel = "Yearly Sales Performance (All Time)";
  } else {
    chartData = analyticsData?.monthly?.income?.slice(0, 12).reverse() || [];
    periodLabel = "Monthly Sales Performance (This Year)";
  }

  const handleExportToExcel = () => {
    try {
      // 1. Create Summary sheet data
      const summaryData = [
        ["EarthCentric Seller Analytics Report"],
        ["Generated on:", new Date().toLocaleString()],
        [],
        ["KPI Indicator", "Value"],
        ["Total Earnings (₹)", stats?.revenue || 0],
        ["Sales Conversion", `${stats?.salesConversion || 3.4}%`],
        ["Average Order Value (₹)", stats?.averageOrderValue || 525],
        ["Total Store Visits", stats?.totalStoreVisits || 24840],
        [],
        ["Category", "Percentage (%)"],
        ...((stats?.categoryBreakdown || [
          { name: "Disposables", percentage: 45 },
          { name: "Kitchenware", percentage: 30 },
          { name: "Personal Care", percentage: 25 }
        ]).map((cat: any) => [cat.name, `${cat.percentage}%`]))
      ];

      // 2. Create monthly performance data
      const monthlyHeaders = [["Month", "Revenue (₹)", "Orders Count"]];
      const monthlyData = (analyticsData?.monthly?.income || []).map((m: any, idx: number) => {
        const ords = analyticsData?.monthly?.orders?.[idx]?.orders || 0;
        return [m.name, m.income, ords];
      });

      // 3. Create daily performance data
      const dailyHeaders = [["Date", "Revenue (₹)", "Orders Count"]];
      const dailyData = (analyticsData?.daily?.income || []).map((d: any, idx: number) => {
        const ords = analyticsData?.daily?.orders?.[idx]?.orders || 0;
        return [d.name, d.income, ords];
      });

      // 4. Create yearly performance data
      const yearlyHeaders = [["Year", "Revenue (₹)", "Orders Count"]];
      const yearlyData = (analyticsData?.yearly?.income || []).map((y: any, idx: number) => {
        const ords = analyticsData?.yearly?.orders?.[idx]?.orders || 0;
        return [y.name, y.income, ords];
      });

      // Generate Workbook
      const wb = XLSX.utils.book_new();

      // Add Summary Sheet
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary Dashboard");

      // Add Monthly Sheet
      const wsMonthly = XLSX.utils.aoa_to_sheet([...monthlyHeaders, ...monthlyData]);
      XLSX.utils.book_append_sheet(wb, wsMonthly, "Monthly Performance");

      // Add Daily Sheet
      const wsDaily = XLSX.utils.aoa_to_sheet([...dailyHeaders, ...dailyData]);
      XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Performance");

      // Add Yearly Sheet
      const wsYearly = XLSX.utils.aoa_to_sheet([...yearlyHeaders, ...yearlyData]);
      XLSX.utils.book_append_sheet(wb, wsYearly, "Yearly Performance");

      // Write and Download File
      XLSX.writeFile(wb, `Seller_Analytics_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel analytics data downloaded successfully!");
    } catch (error) {
      console.error("Failed to export Excel report:", error);
      toast.error("Failed to export Excel report.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 text-left">
        <div>
          <h1 className="text-2xl font-bold text-[#2d4a36]">Business Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor revenue trends, analyze product demand, and review your environmental sustainability metrics.</p>
        </div>
        <Button 
          onClick={handleExportToExcel}
          variant="cool" 
          className="flex items-center space-x-1.5 text-xs font-bold py-2 px-4 shadow-sm border border-emerald-200/50 hover:bg-emerald-50 transition-all cursor-pointer w-fit animate-pulse"
        >
          <History className="h-4 w-4 text-[#2d4a36]" />
          <span>Export to Excel</span>
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-start">
            <div className="h-8 w-8 bg-[#e8f3ec] text-[#2d4a36] rounded-md flex items-center justify-center"><DollarSign className="h-4 w-4" /></div>
            <Badge variant="success" className="bg-[#e8f3ec] text-[#2d4a36] border-none text-[10px] px-1.5 py-0.5">+18%</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">₹{stats?.revenue?.toLocaleString() || 0}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total Earnings</p>
          </div>
        </Card>

        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-start">
            <div className="h-8 w-8 bg-[#e8f3ec] text-[#2d4a36] rounded-md flex items-center justify-center text-xs font-bold">%</div>
            <Badge variant="success" className="bg-[#e8f3ec] text-[#2d4a36] border-none text-[10px] px-1.5 py-0.5">+0.8%</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">{stats?.salesConversion || 3.4}%</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Sales Conversion</p>
          </div>
        </Card>

        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-start">
            <div className="h-8 w-8 bg-[#e8f3ec] text-[#2d4a36] rounded-md flex items-center justify-center"><ShoppingBag className="h-4 w-4" /></div>
            <Badge variant="success" className="bg-[#e8f3ec] text-[#2d4a36] border-none text-[10px] px-1.5 py-0.5">+4.2%</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">₹{stats?.averageOrderValue || 525}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Average Order Value</p>
          </div>
        </Card>

        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-start">
            <div className="h-8 w-8 bg-amber-50 text-amber-500 rounded-md flex items-center justify-center"><Activity className="h-4 w-4" /></div>
            <Badge variant="success" className="bg-[#e8f3ec] text-[#2d4a36] border-none text-[10px] px-1.5 py-0.5">+12%</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">{stats?.totalStoreVisits?.toLocaleString() || "24,840"}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total Store Visits</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <Card className="lg:col-span-2 p-6 bg-white border-none shadow-sm rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-[#2d4a36]">{periodLabel}</h3>
            <select 
              className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1 outline-none text-[#2d4a36] font-medium cursor-pointer"
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
            >
              <option value="daily">This Week</option>
              <option value="this_month">This Month</option>
              <option value="monthly">This Year</option>
              <option value="yearly">All Time</option>
            </select>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ece6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8ca193' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8ca193' }} />
                <Tooltip cursor={{ fill: '#f4f5f3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar 
                  dataKey="income" 
                  radius={[4, 4, 0, 0]} 
                  fill="url(#colorIncome)"
                  barSize={40}
                  label={{ position: 'top', fill: '#2d4a36', fontSize: 9, fontWeight: 'bold', formatter: (val: any) => `₹${val}` }}
                />
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2d4a36" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#2d4a36" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category Breakdown */}
        <Card className="lg:col-span-1 p-6 bg-white border-none shadow-sm rounded-2xl">
          <h3 className="text-sm font-bold text-[#2d4a36] mb-6">Category Breakdown</h3>
          <div className="space-y-6">
            {(stats?.categoryBreakdown || [
              {name: "Disposables", percentage: 45},
              {name: "Kitchenware", percentage: 30},
              {name: "Personal Care", percentage: 25}
            ]).map((cat: any, i: number) => (
              <div key={cat.name} className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-foreground">{cat.name}</span>
                  <span className="text-muted-foreground">{cat.percentage}%</span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full" 
                    style={{ 
                      width: `${cat.percentage}%`, 
                      background: i === 0 ? '#2d4a36' : i === 1 ? '#4a5d4e' : '#8ca193' 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>


    </div>
  );
}

// --------------------------------------------------------------------------
// ENQUIRIES TAB VIEW
// --------------------------------------------------------------------------
function EnquiriesView({ sellerId }: { sellerId: string }) {
  const [enquiries, setEnquiries] = useState<EnquiryData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEnquiries = async () => {
    setLoading(true);
    const data = await getSellerEnquiries(sellerId);
    setEnquiries(data);
    setLoading(false);
  };

  useEffect(() => {
    loadEnquiries();
  }, [sellerId]);

  const handleUpdateStatus = async (enquiryId: string, status: string) => {
    const success = await updateEnquiryStatus(enquiryId, status);
    if (success) {
      toast.success(`Updated enquiry status to ${status}`);
      loadEnquiries();
    } else {
      toast.error("Failed to update status.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-[#2d4a36]">Bulk Quote Enquiries</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and respond to incoming wholesale quote requests from organic buyers.
        </p>
      </div>

      <Card className="p-6 bg-white border-none shadow-sm rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9ece6]">
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Buyer</TableHead>
              <TableHead className="text-xs">Product</TableHead>
              <TableHead className="text-xs">Qty</TableHead>
              <TableHead className="text-xs">Target Price</TableHead>
              <TableHead className="text-xs">Location</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-xs py-6">Loading enquiries...</TableCell></TableRow>
            ) : enquiries.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-xs py-6">No bulk enquiries received yet.</TableCell></TableRow>
            ) : (
              enquiries.map((enq) => (
                <TableRow key={enq.id} className="border-[#e9ece6]/50">
                  <TableCell className="text-xs">{new Date(enq.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-bold">{enq.name}</div>
                    <div className="text-[10px] text-muted-foreground">{enq.email} | {enq.phone}</div>
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{enq.productName}</TableCell>
                  <TableCell className="text-xs">{enq.quantity} units</TableCell>
                  <TableCell className="text-xs font-bold">
                    {enq.targetPrice ? `₹${enq.targetPrice}` : "N/A"}
                  </TableCell>
                  <TableCell className="text-xs">{enq.location}</TableCell>
                  <TableCell className="text-xs">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      enq.status === "NEW" ? "bg-blue-100 text-blue-800" :
                      enq.status === "VIEWED" ? "bg-amber-100 text-amber-800" :
                      enq.status === "RESPONDED" ? "bg-emerald-100 text-emerald-800" :
                      "bg-slate-100 text-slate-800"
                    }`}>
                      {enq.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-right space-x-1.5">
                    {enq.status === "NEW" && (
                      <Button size="sm" variant="cool" onClick={() => handleUpdateStatus(enq.id, "VIEWED")}>
                        Mark Viewed
                      </Button>
                    )}
                    {enq.status !== "RESPONDED" && enq.status !== "CLOSED" && (
                      <Button size="sm" className="bg-[#2d4a36] hover:bg-[#1e3425] text-white cursor-pointer border-none" onClick={() => handleUpdateStatus(enq.id, "RESPONDED")}>
                        Respond Quote
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
  );
}

// --------------------------------------------------------------------------
// COMPLAINTS TAB VIEW
// --------------------------------------------------------------------------
function ComplaintsView({ sellerId }: { sellerId: string }) {
  const [complaints, setComplaints] = useState<ComplaintData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<ComplaintData | null>(null);
  const [responseMsg, setResponseMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadComplaints = async () => {
    setLoading(true);
    const data = await getSellerComplaints(sellerId);
    setComplaints(data);
    setLoading(false);
  };

  useEffect(() => {
    loadComplaints();
  }, [sellerId]);

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !responseMsg.trim()) return;
    setSubmitting(true);
    
    const success = await updateComplaintStatus(selectedTicket.id, {
      status: "UNDER_REVIEW",
      sellerResponse: responseMsg,
    });

    setSubmitting(false);
    if (success) {
      toast.success("Response submitted successfully.");
      setSelectedTicket(null);
      setResponseMsg("");
      loadComplaints();
    } else {
      toast.error("Failed to submit response.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-[#2d4a36]">Buyer Disputes & Complaints</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review return claims, dispute logs, and support queries filed against your orders.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-white border-none shadow-sm rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow className="border-[#e9ece6]">
                <TableHead className="text-xs">Ticket ID</TableHead>
                <TableHead className="text-xs">Order ID</TableHead>
                <TableHead className="text-xs">Buyer</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Subject</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs py-6">Loading tickets...</TableCell></TableRow>
              ) : complaints.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs py-6">No support complaints raised.</TableCell></TableRow>
              ) : (
                complaints.map((c) => (
                  <TableRow key={c.id} className="border-[#e9ece6]/50">
                    <TableCell className="text-xs font-mono font-bold">{c.id.substring(10, 15).toUpperCase()}</TableCell>
                    <TableCell className="text-xs font-mono">{c.orderId.substring(4, 9)}</TableCell>
                    <TableCell className="text-xs">{c.buyerName}</TableCell>
                    <TableCell className="text-xs uppercase font-bold text-[#2d4a36]">{c.type}</TableCell>
                    <TableCell className="text-xs font-semibold">{c.subject}</TableCell>
                    <TableCell className="text-xs">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                        c.status === "PENDING" ? "bg-amber-100 text-amber-800" :
                        c.status === "UNDER_REVIEW" ? "bg-blue-100 text-blue-800" :
                        c.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      <Button size="sm" variant="cool" onClick={() => setSelectedTicket(c)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {selectedTicket && (
          <Card className="lg:col-span-1 p-6 bg-white border-none shadow-sm rounded-2xl space-y-4 h-fit animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-sm text-[#2d4a36]">Ticket Details</h3>
              <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer">✕</button>
            </div>

            <div className="text-xs space-y-2 border-b border-[#e9ece6] pb-3">
              <p><strong>Order ID:</strong> <span className="font-mono">{selectedTicket.orderId}</span></p>
              <p><strong>Type:</strong> <span className="font-bold uppercase text-[#2d4a36]">{selectedTicket.type}</span></p>
              <p><strong>Subject:</strong> {selectedTicket.subject}</p>
              <p className="bg-slate-50 p-2.5 rounded-lg text-slate-600 leading-relaxed mt-1">
                {selectedTicket.message}
              </p>
              {selectedTicket.proofUrl && (
                <p>
                  <strong>Proof Document:</strong>{" "}
                  <a href={selectedTicket.proofUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">
                    View Attachment
                  </a>
                </p>
              )}
            </div>

            {selectedTicket.sellerResponse ? (
              <div className="text-xs bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                <p className="font-bold text-[#2d4a36]">Your Response:</p>
                <p className="text-slate-600 leading-relaxed mt-1">{selectedTicket.sellerResponse}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitResponse} className="space-y-3">
                <Label className="text-xs">Submit Response to dispute:</Label>
                <Textarea
                  placeholder="Detail your explanation or solution (e.g. replacement package dispatched, refund details...)"
                  value={responseMsg}
                  onChange={(e) => setResponseMsg(e.target.value)}
                  required
                  className="text-xs min-h-[80px]"
                />
                <MetalButton type="submit" variant="success" className="w-full text-xs" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Response"}
                </MetalButton>
              </form>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PAYMENTS TAB VIEW (Reused logic)
// --------------------------------------------------------------------------
function PaymentsView({ payoutStats, payoutRequests, user, sellerId, reload }: any) {
  const [payoutAmount, setPayoutAmount] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [reason, setReason] = useState("");
  const [payoutError, setPayoutError] = useState("");
  const [payoutSuccess, setPayoutSuccess] = useState("");
  const [requestingPayout, setRequestingPayout] = useState(false);

  // New payment method states
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER"); // BANK_TRANSFER or UPI
  
  // Bank details states
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");

  // UPI details states
  const [upiId, setUpiId] = useState("");
  const [upiAccountHolderName, setUpiAccountHolderName] = useState("");

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !payoutAmount) return;
    setPayoutError("");
    setPayoutSuccess("");
    setRequestingPayout(true);

    let paymentDetails = "";
    if (paymentMethod === "BANK_TRANSFER") {
      if (!accountNumber || !bankName || !ifscCode || !accountHolderName) {
        setPayoutError("Please fill in all bank transfer details.");
        setRequestingPayout(false);
        return;
      }
      paymentDetails = `Holder: ${accountHolderName} | Bank: ${bankName} | A/C: ${accountNumber} | IFSC: ${ifscCode}`;
    } else {
      if (!upiId || !upiAccountHolderName) {
        setPayoutError("Please fill in all UPI details.");
        setRequestingPayout(false);
        return;
      }
      paymentDetails = `Holder: ${upiAccountHolderName} | UPI ID: ${upiId}`;
    }

    try {
      const res = await requestPayout(
        sellerId, 
        Number(payoutAmount), 
        isUrgent, 
        reason, 
        paymentMethod, 
        paymentDetails
      );
      if (res.success) {
        setPayoutSuccess(`Successfully requested ₹${payoutAmount}!`);
        setPayoutAmount("");
        setIsUrgent(false);
        setReason("");
        
        // Reset details
        setAccountNumber("");
        setBankName("");
        setIfscCode("");
        setAccountHolderName("");
        setUpiId("");
        setUpiAccountHolderName("");
        
        reload();
      } else {
        setPayoutError(res.error || "Failed to request payout.");
      }
    } catch (err) {
      setPayoutError("An unexpected error occurred.");
    } finally {
      setRequestingPayout(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-[#2d4a36]">Payments & Settlements</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your wallet balance and review past settlements.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Simple payout metrics */}
        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Withdrawable Balance</p>
          <h3 className="text-2xl font-black text-emerald-600">₹{(payoutStats?.availableBalance ?? 0).toLocaleString()}</h3>
        </Card>
        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Pending Settlements</p>
          <h3 className="text-2xl font-black text-amber-500">₹{(payoutStats?.pendingAmount ?? 0).toLocaleString()}</h3>
        </Card>
        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Settled Payouts</p>
          <h3 className="text-2xl font-black text-[#2d4a36]">₹{(payoutStats?.settledAmount ?? 0).toLocaleString()}</h3>
        </Card>
        <Card className="p-5 bg-white border-none shadow-sm rounded-2xl">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Sales Revenue</p>
          <h3 className="text-2xl font-black text-foreground">₹{(payoutStats?.totalSalesRevenue ?? 0).toLocaleString()}</h3>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl lg:col-span-1 space-y-4">
          <h3 className="font-bold text-sm text-[#2d4a36] pb-2 border-b border-[#e9ece6]">Request Payment</h3>
          <form onSubmit={handleRequestPayout} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <Label>Amount to Withdraw (₹)</Label>
              <Input type="number" min="1" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} required />
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 text-left">
              <Label className="text-xs font-bold text-[#2d4a36]">Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                    paymentMethod === "BANK_TRANSFER"
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-[#FFFDF8]/40 hover:bg-[#FFFDF8]/80 text-[#2d4a36] border-[#d8dcd3]"
                  }`}
                >
                  Bank Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("UPI")}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                    paymentMethod === "UPI"
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-[#FFFDF8]/40 hover:bg-[#FFFDF8]/80 text-[#2d4a36] border-[#d8dcd3]"
                  }`}
                >
                  UPI
                </button>
              </div>
            </div>

            {/* Dynamic Form details based on Payment Method */}
            {paymentMethod === "BANK_TRANSFER" ? (
              <div className="space-y-3 p-3 bg-slate-50 dark:bg-emerald-950/20 rounded-2xl border border-[#d8dcd3]/60 animate-in fade-in duration-200 text-left">
                <p className="text-[10px] font-bold text-[#6a7b6e] uppercase tracking-wider">Bank Account Details</p>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Account Holder Name</Label>
                  <Input 
                    type="text" 
                    value={accountHolderName} 
                    onChange={(e) => setAccountHolderName(e.target.value)} 
                    placeholder="E.g. Rajesh Kumar" 
                    required 
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Bank Name</Label>
                  <Input 
                    type="text" 
                    value={bankName} 
                    onChange={(e) => setBankName(e.target.value)} 
                    placeholder="E.g. HDFC Bank" 
                    required 
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Account Number</Label>
                  <Input 
                    type="text" 
                    value={accountNumber} 
                    onChange={(e) => setAccountNumber(e.target.value)} 
                    placeholder="Enter Account Number" 
                    required 
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">IFSC Code</Label>
                  <Input 
                    type="text" 
                    value={ifscCode} 
                    onChange={(e) => setIfscCode(e.target.value)} 
                    placeholder="E.g. HDFC0000123" 
                    required 
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-3 bg-slate-50 dark:bg-emerald-950/20 rounded-2xl border border-[#d8dcd3]/60 animate-in fade-in duration-200 text-left">
                <p className="text-[10px] font-bold text-[#6a7b6e] uppercase tracking-wider">UPI Details</p>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Account Holder Name</Label>
                  <Input 
                    type="text" 
                    value={upiAccountHolderName} 
                    onChange={(e) => setUpiAccountHolderName(e.target.value)} 
                    placeholder="E.g. Rajesh Kumar" 
                    required 
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">UPI ID (VPA)</Label>
                  <Input 
                    type="text" 
                    value={upiId} 
                    onChange={(e) => setUpiId(e.target.value)} 
                    placeholder="E.g. rajesh@okaxis" 
                    required 
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2 py-1 text-left">
              <input
                type="checkbox"
                id="isUrgent"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="rounded border-[#d8dcd3] text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
              />
              <Label htmlFor="isUrgent" className="text-xs font-semibold cursor-pointer">
                Is this an Urgent Payout?
              </Label>
            </div>

            {isUrgent && (
              <div className="space-y-1.5 animate-in fade-in duration-200 text-left">
                <Label>Reason for Urgent Payout *</Label>
                <Textarea
                  placeholder="Explain why you need this payout urgently..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required={isUrgent}
                  className="text-xs min-h-[60px]"
                />
              </div>
            )}

            {payoutError && <p className="text-xs text-red-500 text-left">{payoutError}</p>}
            {payoutSuccess && <p className="text-xs text-emerald-600 text-left">{payoutSuccess}</p>}
            <MetalButton type="submit" variant="success" className="w-full" disabled={requestingPayout || (payoutStats?.availableBalance ?? 0) <= 0}>
              {requestingPayout ? "Submitting..." : "Request Payout"}
            </MetalButton>
          </form>
        </Card>
        
        <Card className="p-6 bg-white border-none shadow-sm rounded-2xl lg:col-span-2">
          <h3 className="font-bold text-sm text-[#2d4a36] pb-2 border-b border-[#e9ece6] mb-4">Settlement History</h3>
          <Table>
            <TableHeader>
              <TableRow className="border-[#e9ece6]">
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payoutRequests.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-xs py-6">No past requests.</TableCell></TableRow>
              ) : (
                payoutRequests.map((req: any) => (
                  <TableRow key={req.id} className="border-[#e9ece6]/50">
                    <TableCell className="text-xs">{new Date(req.requestedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-bold">₹{req.amount.toLocaleString()}</div>
                      {req.notes && (
                        <div className="text-[9px] text-[#6a7b6e] mt-0.5 font-normal max-w-[220px] truncate" title={req.notes}>
                          {req.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {req.isUrgent ? (
                        <Badge variant="danger" className="text-[9px] bg-red-100 text-red-700 border-none px-1.5 py-0.5">
                          Urgent
                        </Badge>
                      ) : (
                        <Badge className="text-[9px] bg-slate-100 text-slate-700 border-none px-1.5 py-0.5">
                          Normal
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className={`capitalize font-bold ${
                        req.status === "SETTLED" ? "text-emerald-600" :
                        req.status === "REJECTED" ? "text-red-600" :
                        "text-amber-500"
                      }`}>
                        {req.status.toLowerCase()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// VERIFICATION TAB VIEW
// --------------------------------------------------------------------------
function VerificationView({ profile }: any) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-[#2d4a36]">Seller Verification</h1>
        <p className="text-sm text-muted-foreground mt-1">Review your eco-compliance documents, certificates, and tax registration credentials.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-[#f4f5f3] border-none shadow-none rounded-2xl">
          <div className="flex items-center space-x-2 mb-6">
            <div className="bg-white p-1.5 rounded shadow-sm border border-[#e9ece6]">
              <ShieldCheck className="h-4 w-4 text-[#2d4a36]" />
            </div>
            <h3 className="font-bold text-sm text-[#2d4a36]">Verified Profile Details</h3>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[10px] font-bold text-[#8ca193] tracking-wider mb-1 uppercase">Company Name</p>
              <p className="text-sm font-bold text-foreground">{profile?.companyName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#8ca193] tracking-wider mb-1 uppercase">Business Type</p>
              <p className="text-sm font-bold text-foreground">{profile?.businessType || "Manufacturer"}</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-[10px] font-bold text-[#8ca193] tracking-wider mb-2 uppercase">Sustainability Statement</p>
            <div className="bg-[#e9ece6] rounded-xl p-4">
              <p className="text-sm text-[#4a5d4e] leading-relaxed">
                {profile?.description || "We craft zero-waste textiles utilizing organic linen and sustainable bamboo materials."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-bold text-[#8ca193] tracking-wider mb-1 uppercase">Website URL</p>
              <p className="text-sm font-bold text-foreground">{profile?.website || "https://greenleaf.com"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#8ca193] tracking-wider mb-1 uppercase">GSTIN ID Code</p>
              <p className="text-sm font-bold text-foreground">{profile?.gstNumber || "29GGGG1234F1Z5"}</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[10px] font-bold text-[#8ca193] tracking-wider mb-1 uppercase">Permanent Account Number (PAN)</p>
            <p className="text-sm font-bold text-foreground">{profile?.panNumber || "ABCDE1234F"}</p>
          </div>
        </Card>

        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 bg-[#e8f3ec] border border-[#c1d6c8] shadow-sm rounded-2xl">
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-[#2d4a36]">Verification Active</h3>
            </div>
            <p className="text-xs text-[#4a5d4e] leading-relaxed">
              All mandatory credentials have been audited and approved. {profile?.companyName} can sell in the marketplace.
            </p>
          </Card>

          <Card className="p-6 bg-[#f4f5f3] border-none shadow-none rounded-2xl">
            <h3 className="font-bold text-sm text-[#2d4a36] mb-4">Audit Trail Documents</h3>
            <div className="space-y-4">
              {profile?.documents?.length > 0 ? profile.documents.map((doc: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">{doc.type.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-muted-foreground">{doc.fileName}</p>
                  </div>
                  <Badge variant="outline" className="bg-[#e8f3ec] text-emerald-600 border-none text-[9px] px-2 py-0.5"><CheckCircle2 className="h-3 w-3 inline mr-1" /> Verified</Badge>
                </div>
              )) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground">GST Certificate</p>
                      <p className="text-[10px] text-muted-foreground">gst_registration.pdf</p>
                    </div>
                    <Badge variant="outline" className="bg-[#e8f3ec] text-emerald-600 border-none text-[9px] px-2 py-0.5"><CheckCircle2 className="h-3 w-3 inline mr-1" /> Verified</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground">PAN Card Image</p>
                      <p className="text-[10px] text-muted-foreground">pan_card_front.jpg</p>
                    </div>
                    <Badge variant="outline" className="bg-[#e8f3ec] text-emerald-600 border-none text-[9px] px-2 py-0.5"><CheckCircle2 className="h-3 w-3 inline mr-1" /> Verified</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground">Business Registration</p>
                      <p className="text-[10px] text-muted-foreground">certificate_incorporation.pdf</p>
                    </div>
                    <Badge variant="outline" className="bg-[#e8f3ec] text-emerald-600 border-none text-[9px] px-2 py-0.5"><CheckCircle2 className="h-3 w-3 inline mr-1" /> Verified</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground">Organic Certificates</p>
                      <p className="text-[10px] text-muted-foreground">usda_organic_cert.pdf</p>
                    </div>
                    <Badge variant="outline" className="bg-[#e8f3ec] text-emerald-600 border-none text-[9px] px-2 py-0.5"><CheckCircle2 className="h-3 w-3 inline mr-1" /> Verified</Badge>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// SETTINGS TAB VIEW
// --------------------------------------------------------------------------
function SettingsView({ profile }: any) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-[#2d4a36]">Store Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your public brand profile, contact information, and payment payout settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-[#f4f5f3] border-none shadow-none rounded-2xl space-y-8">
          
          {/* Store Identity */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-[#d8dcd3] pb-2">
              <Package className="h-4 w-4 text-[#2d4a36]" />
              <h3 className="font-bold text-sm text-[#2d4a36]">Store Identity</h3>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#8ca193] tracking-wider uppercase">Registered Brand Name</Label>
              <Input defaultValue={profile?.companyName || "GreenLeaf Organics"} className="bg-transparent border border-[#d8dcd3] shadow-none" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#8ca193] tracking-wider uppercase">Eco Bio / Store Description</Label>
              <Textarea defaultValue={profile?.description || "Handcrafting premium eco-friendly tableware, organic beeswax food wraps, and zero-waste bamboo dining sets."} className="bg-transparent border border-[#d8dcd3] shadow-none h-24 resize-none" />
            </div>
          </div>

          {/* Contact & Location */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-[#d8dcd3] pb-2 mt-8">
              <Mail className="h-4 w-4 text-[#2d4a36]" />
              <h3 className="font-bold text-sm text-[#2d4a36]">Contact & Location</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#8ca193] tracking-wider uppercase">Business Email</Label>
                <Input defaultValue="payouts@greenleaf.com" className="bg-transparent border border-[#d8dcd3] shadow-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#8ca193] tracking-wider uppercase">Contact Phone</Label>
                <Input defaultValue="+91 98765 43210" className="bg-transparent border border-[#d8dcd3] shadow-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#8ca193] tracking-wider uppercase">Warehouse Address</Label>
              <Input defaultValue="Bannerghatta Road, Bangalore, Karnataka - 560076" className="bg-transparent border border-[#d8dcd3] shadow-none" />
            </div>
          </div>

          {/* Payout Banking Details */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-[#d8dcd3] pb-2 mt-8">
              <Wallet className="h-4 w-4 text-[#2d4a36]" />
              <h3 className="font-bold text-sm text-[#2d4a36]">Payout Banking Details</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#8ca193] tracking-wider uppercase">Bank Name</Label>
                <Input defaultValue="State Bank of India" className="bg-transparent border border-[#d8dcd3] shadow-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#8ca193] tracking-wider uppercase">UPI ID</Label>
                <Input defaultValue="payouts.greenleaf@sbi" className="bg-transparent border border-[#d8dcd3] shadow-none" />
              </div>
            </div>
          </div>

        </Card>

        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 bg-[#f4f5f3] border border-[#e9ece6] shadow-sm rounded-2xl">
            <div className="flex items-center space-x-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-[#2d4a36]" />
              <h3 className="font-bold text-sm text-[#2d4a36]">Security Status</h3>
            </div>
            <p className="text-xs text-[#4a5d4e] leading-relaxed">
              Two-Factor Authentication is currently <strong className="text-foreground">Enabled</strong> for {profile?.companyName || "GreenLeaf Organics"}. Payout details can only be edited via authenticated sessions.
            </p>
          </Card>

          <Card className="p-6 bg-[#e8f3ec] border border-[#c1d6c8] shadow-sm rounded-2xl">
            <h3 className="font-bold text-sm text-[#2d4a36] mb-3">Eco Seller Badge</h3>
            <p className="text-xs text-[#4a5d4e] leading-relaxed mb-4">
              Your brand holds the <strong>**Gold Eco Rating**</strong> for zero-waste packaging compliance. Keep list descriptions updated to maintain rating points.
            </p>
            <Badge className="bg-[#2d4a36] hover:bg-[#2d4a36] text-white border-none text-[10px] px-2 py-1"><Star className="h-3 w-3 mr-1 inline fill-white" /> Gold Eco Brand</Badge>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// MESSAGES TAB VIEW
// --------------------------------------------------------------------------
function MessagesView({ sellerId }: { sellerId: string }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Messages</h2>
          <p className="text-sm text-muted-foreground mt-1">Communicate with the EarthCentric Admin team</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto">
        <AdminSellerMessenger sellerId={sellerId} adminId={"admin@earthcentric.com"} />
      </div>
    </div>
  );
}
