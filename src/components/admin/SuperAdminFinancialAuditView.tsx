"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { getSuperAdminFinancialAudit, SuperAdminFinancialAudit } from "@/actions/admin";
import {
  Card,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  Button,
  Input,
} from "@/components/ui/shared";
import {
  Coins,
  DollarSign,
  TrendingUp,
  Package,
  ShoppingBag,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  Receipt,
  ShieldAlert,
} from "lucide-react";

interface SuperAdminFinancialAuditViewProps {
  adminEmail?: string;
  globalSearch?: string;
}

export function SuperAdminFinancialAuditView({
  adminEmail,
  globalSearch = "",
}: SuperAdminFinancialAuditViewProps) {
  const [data, setData] = useState<SuperAdminFinancialAudit | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [subTab, setSubTab] = useState<"products" | "sellers" | "orders">("products");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const effectiveSearch = searchQuery || globalSearch;

  const loadAuditData = useCallback(async () => {
    try {
      const res = await getSuperAdminFinancialAudit();
      setData(res);
    } catch (err: any) {
      console.error("Failed to load financial audit data:", err);
      toast.error("Failed to load financial audit figures. Please refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAuditData();
    toast.success("Financial audit data updated from live orders.");
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!data?.productWiseBreakdown) return [];
    if (!effectiveSearch) return data.productWiseBreakdown;
    const q = effectiveSearch.toLowerCase();
    return data.productWiseBreakdown.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.sellerName.toLowerCase().includes(q) ||
        p.productId.toLowerCase().includes(q)
    );
  }, [data?.productWiseBreakdown, effectiveSearch]);

  // Filter sellers
  const filteredSellers = useMemo(() => {
    if (!data?.sellerWiseBreakdown) return [];
    if (!effectiveSearch) return data.sellerWiseBreakdown;
    const q = effectiveSearch.toLowerCase();
    return data.sellerWiseBreakdown.filter(
      (s) => s.sellerName.toLowerCase().includes(q) || s.sellerId.toLowerCase().includes(q)
    );
  }, [data?.sellerWiseBreakdown, effectiveSearch]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!data?.orderWiseBreakdown) return [];
    if (!effectiveSearch) return data.orderWiseBreakdown;
    const q = effectiveSearch.toLowerCase();
    return data.orderWiseBreakdown.filter(
      (o) =>
        o.orderId.toLowerCase().includes(q) ||
        (o.sellerName && o.sellerName.toLowerCase().includes(q)) ||
        o.status.toLowerCase().includes(q)
    );
  }, [data?.orderWiseBreakdown, effectiveSearch]);

  const totals = data?.totals || {
    totalMarketplaceSales: 0,
    totalSellerBaseValue: 0,
    totalCommissionEarned: 0,
    totalBoxesSold: 0,
    completedOrdersCount: 0,
    cancelledOrdersCount: 0,
    totalRefunds: 0,
    pendingPayouts: 0,
    settledPayouts: 0,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-[#1a3321]" />
        <p className="text-xs font-semibold text-muted-foreground">
          Auditing order items, product commissions, and payout records...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Coins className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-black text-[#1a3321]">
              Financial &amp; Product-Wise Commission Audit
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Super Admin financial reporting: product-wise commissions, seller base values, marketplace GMV, and order audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs h-8 px-3 border-[#e9ece6] hover:bg-[#f4f5f3] cursor-pointer gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh Ledger</span>
          </Button>
        </div>
      </div>

      {/* 4 Main Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Marketplace Sales */}
        <Card className="p-5 bg-white border border-[#e9ece6] shadow-xs rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="h-8 w-8 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-none font-bold">
              Buyer GMV
            </Badge>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">
              ₹{totals.totalMarketplaceSales.toLocaleString("en-IN")}
            </h3>
            <p className="text-[11px] font-bold text-slate-700 mt-0.5">Total Marketplace Sales</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Gross sales paid by buyers at approved box prices
            </p>
          </div>
        </Card>

        {/* Card 2: Total Seller Base Value */}
        <Card className="p-5 bg-white border border-[#e9ece6] shadow-xs rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="h-8 w-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-none font-bold">
              Net Payable
            </Badge>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">
              ₹{totals.totalSellerBaseValue.toLocaleString("en-IN")}
            </h3>
            <p className="text-[11px] font-bold text-slate-700 mt-0.5">Total Seller Base Value</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Expected seller payout before EarthCentric commission
            </p>
          </div>
        </Card>

        {/* Card 3: Total Commission Earned */}
        <Card className="p-5 bg-white border border-[#e9ece6] shadow-xs rounded-2xl flex flex-col justify-between ring-1 ring-emerald-500/20">
          <div className="flex justify-between items-start mb-3">
            <div className="h-8 w-8 bg-[#e8f3ec] text-[#2d4a36] rounded-lg flex items-center justify-center">
              <Coins className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[9px] bg-emerald-100 text-emerald-800 border-none font-bold">
              Platform Fee
            </Badge>
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-800">
              ₹{totals.totalCommissionEarned.toLocaleString("en-IN")}
            </h3>
            <p className="text-[11px] font-bold text-emerald-900 mt-0.5">EarthCentric Commission Earned</p>
            <p className="text-[10px] text-emerald-700 mt-0.5">
              Net profit retained by EarthCentric on completed orders
            </p>
          </div>
        </Card>

        {/* Card 4: Total Boxes Sold */}
        <Card className="p-5 bg-white border border-[#e9ece6] shadow-xs rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="h-8 w-8 bg-purple-50 text-purple-700 rounded-lg flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-none font-bold">
              Bulk Volume
            </Badge>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">
              {totals.totalBoxesSold.toLocaleString()} <span className="text-xs font-semibold text-slate-500">Boxes</span>
            </h3>
            <p className="text-[11px] font-bold text-slate-700 mt-0.5">{totals.completedOrdersCount} Completed Orders</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {totals.cancelledOrdersCount > 0 ? `${totals.cancelledOrdersCount} cancelled/refunded excluded` : "Zero cancelled deductions"}
            </p>
          </div>
        </Card>
      </div>

      {/* Payout Reconciliation Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200/90 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Settled Seller Payouts</p>
            <p className="text-sm font-black text-slate-900">₹{totals.settledPayouts.toLocaleString("en-IN")}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pending Payout Requests</p>
            <p className="text-sm font-black text-slate-900">₹{totals.pendingPayouts.toLocaleString("en-IN")}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Refunds &amp; Adjustments</p>
            <p className="text-sm font-black text-slate-900">₹{totals.totalRefunds.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setSubTab("products")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "products"
                ? "bg-white text-[#1a3321] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Product Breakdown ({filteredProducts.length})
          </button>
          <button
            onClick={() => setSubTab("sellers")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "sellers"
                ? "bg-white text-[#1a3321] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Seller Ledger ({filteredSellers.length})
          </button>
          <button
            onClick={() => setSubTab("orders")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "orders"
                ? "bg-white text-[#1a3321] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Order Audit Trail ({filteredOrders.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${subTab}...`}
            className="text-xs h-8 pl-8 bg-white"
          />
        </div>
      </div>

      {/* SUB-VIEW 1: Product-Wise Commission Breakdown */}
      {subTab === "products" && (
        <Card className="bg-white border border-[#e9ece6] shadow-xs rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#e9ece6] bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-[#1a3321] uppercase tracking-wider">
                Product-Wise Commission &amp; Margin Report
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Displays seller base payout, EarthCentric commission rate, commission in rupees, and final marketplace selling price for each product.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white text-emerald-800">
              Formula: Price = Base + (Base × Rate%)
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-[#e9ece6] bg-[#fdfdfc]">
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5 pl-4">Product</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Seller Base Payout</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Commission %</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Commission / Box</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Marketplace Price</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Boxes Sold</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Gross Sales</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">EarthCentric Comm</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5 pr-4 text-right">Net Seller Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-xs text-muted-foreground">
                    No products sold yet. When buyers complete orders, product-wise earnings appear here.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((p) => (
                  <TableRow key={p.productId} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50">
                    <TableCell className="py-3 pl-4">
                      <p className="text-xs font-bold text-slate-900">{p.productName}</p>
                      <p className="text-[10px] text-muted-foreground">Seller: {p.sellerName}</p>
                    </TableCell>

                    <TableCell className="py-3 font-semibold text-xs text-slate-800">
                      ₹{p.sellerBasePrice} <span className="text-[10px] text-slate-400">/ box</span>
                    </TableCell>

                    <TableCell className="py-3">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                        {p.commissionRate}%
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3 font-bold text-xs text-emerald-700">
                      +₹{p.commissionAmountPerBox.toFixed(2)}
                    </TableCell>

                    <TableCell className="py-3">
                      <span className="font-extrabold text-xs text-[#1a3321]">₹{p.marketplacePrice}</span>
                      <span className="text-[10px] text-slate-400"> / box</span>
                    </TableCell>

                    <TableCell className="py-3 font-bold text-xs text-slate-700">
                      {p.boxesSold}
                    </TableCell>

                    <TableCell className="py-3 font-semibold text-xs text-slate-900">
                      ₹{p.grossSales.toLocaleString("en-IN")}
                    </TableCell>

                    <TableCell className="py-3 font-extrabold text-xs text-emerald-800">
                      +₹{p.totalCommission.toLocaleString("en-IN")}
                    </TableCell>

                    <TableCell className="py-3 font-black text-xs text-right pr-4 text-slate-900">
                      ₹{p.netSellerAmount.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* SUB-VIEW 2: Seller-Wise Commission Breakdown */}
      {subTab === "sellers" && (
        <Card className="bg-white border border-[#e9ece6] shadow-xs rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#e9ece6] bg-slate-50/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                <h3 className="text-xs font-black text-[#1a3321] uppercase tracking-wider">
                  Seller-Wise Commission &amp; Payout Audit (Internal Reporting Only)
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Confidential administrative ledger. Displays gross volume, platform commission, and settlement totals per supplier.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 font-bold">
              Confidential Admin Audit
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-[#e9ece6] bg-[#fdfdfc]">
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5 pl-4">Seller Company Name</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Orders</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Boxes Sold</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Gross Marketplace GMV</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Commission Earned</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Net Seller Payable</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Payout Settled</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5 pr-4 text-right">Pending Payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-xs text-muted-foreground">
                    No seller orders found matching current filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSellers.map((s) => (
                  <TableRow key={s.sellerId} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50">
                    <TableCell className="py-3 pl-4">
                      <p className="text-xs font-bold text-slate-900">{s.sellerName}</p>
                      <p className="text-[10px] text-muted-foreground">ID: {s.sellerId.substring(0, 10)}</p>
                    </TableCell>

                    <TableCell className="py-3 font-semibold text-xs text-slate-800">
                      {s.ordersCount}
                    </TableCell>

                    <TableCell className="py-3 font-semibold text-xs text-slate-800">
                      {s.totalBoxes}
                    </TableCell>

                    <TableCell className="py-3 font-semibold text-xs text-slate-900">
                      ₹{s.grossSales.toLocaleString("en-IN")}
                    </TableCell>

                    <TableCell className="py-3 font-extrabold text-xs text-emerald-800">
                      +₹{s.commissionEarned.toLocaleString("en-IN")}
                    </TableCell>

                    <TableCell className="py-3 font-black text-xs text-slate-900">
                      ₹{s.netPayable.toLocaleString("en-IN")}
                    </TableCell>

                    <TableCell className="py-3 font-semibold text-xs text-emerald-700">
                      ₹{s.payoutSettled.toLocaleString("en-IN")}
                    </TableCell>

                    <TableCell className="py-3 font-bold text-xs text-right pr-4 text-amber-600">
                      ₹{s.payoutPending.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* SUB-VIEW 3: Order-Wise Commission Audit Trail */}
      {subTab === "orders" && (
        <Card className="bg-white border border-[#e9ece6] shadow-xs rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#e9ece6] bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-[#1a3321] uppercase tracking-wider">
                Order-Wise Financial Audit Trail
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Every order's snapshotted gross amount, EarthCentric commission deduction, and seller net payout.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-white text-slate-800">
              Immutable Snapshots
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-[#e9ece6] bg-[#fdfdfc]">
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5 pl-4">Order ID &amp; Date</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Status</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Supplier</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Boxes</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">Gross Marketplace GMV</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5">EarthCentric Commission</TableHead>
                <TableHead className="text-[9px] font-bold text-[#8ca193] uppercase tracking-wider py-3.5 pr-4 text-right">Net Seller Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                    No orders found matching the filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((o) => (
                  <TableRow key={o.orderId} className="border-[#e9ece6] hover:bg-[#f4f5f3]/50">
                    <TableCell className="py-3 pl-4">
                      <p className="text-xs font-bold font-mono text-slate-900">{o.orderId}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </TableCell>

                    <TableCell className="py-3">
                      <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] font-bold">
                        {o.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3 text-xs text-slate-700 font-medium">
                      {o.sellerName || "EarthCentric Partner"}
                    </TableCell>

                    <TableCell className="py-3 font-semibold text-xs text-slate-700">
                      {o.totalBoxes}
                    </TableCell>

                    <TableCell className="py-3 font-semibold text-xs text-slate-900">
                      ₹{o.grossAmount.toLocaleString("en-IN")}
                    </TableCell>

                    <TableCell className="py-3 font-extrabold text-xs text-emerald-800">
                      +₹{o.commissionAmount.toLocaleString("en-IN")}
                    </TableCell>

                    <TableCell className="py-3 font-black text-xs text-right pr-4 text-slate-900">
                      ₹{o.sellerNetAmount.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

