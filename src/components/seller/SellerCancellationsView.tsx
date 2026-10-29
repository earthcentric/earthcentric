"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getSellerCancelledOrders } from "@/actions/orders";
import {
  Card,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/shared";
import {
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  Eye,
  X,
  Package,
  Calendar,
  DollarSign,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Loader2,
  MapPin,
  HelpCircle,
  Coins,
  Truck,
} from "lucide-react";

interface SellerCancellationsViewProps {
  sellerId: string;
}

export function SellerCancellationsView({ sellerId }: SellerCancellationsViewProps) {
  const [cancelledOrders, setCancelledOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectOrder, setInspectOrder] = useState<any | null>(null);

  const loadData = async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const data = await getSellerCancelledOrders(sellerId);
      setCancelledOrders(data || []);
    } catch (err: any) {
      console.error("Failed to load seller cancelled orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sellerId]);

  // ── Metrics ──
  const metrics = useMemo(() => {
    let pendingRequests = 0;
    let approvedCancellations = 0;
    let rejectedRequests = 0;
    let deliveredReturns = 0;
    let totalGrossReversal = 0;
    let totalNetReversal = 0;
    let totalCommissionReversed = 0;

    for (const item of cancelledOrders) {
      const status = item.cancellation?.status || (item.orderStatus === "CANCELLED" || item.orderStatus === "REFUNDED" ? "APPROVED" : "REQUESTED");
      const isReturn = item.cancellation?.type === "RETURN" || item.orderStatus === "RETURNED";
      if (isReturn) deliveredReturns++;

      if (status === "REQUESTED") {
        pendingRequests++;
      } else if (status === "APPROVED") {
        approvedCancellations++;
        const gross = Number(item.sellerSubtotal || 0);
        const comm = gross * 0.1;
        const net = gross * 0.9;
        totalGrossReversal += gross;
        totalCommissionReversed += comm;
        totalNetReversal += net;
      } else if (status === "REJECTED") {
        rejectedRequests++;
      }
    }

    return {
      pendingRequests,
      approvedCancellations,
      rejectedRequests,
      deliveredReturns,
      totalGrossReversal,
      totalCommissionReversed,
      totalNetReversal,
    };
  }, [cancelledOrders]);

  // ── Filtered & Searched Orders ──
  const filteredOrders = useMemo(() => {
    return cancelledOrders.filter((item) => {
      const status = item.cancellation?.status || (item.orderStatus === "CANCELLED" || item.orderStatus === "REFUNDED" ? "APPROVED" : "REQUESTED");
      const isReturn = item.cancellation?.type === "RETURN" || item.orderStatus === "RETURNED";

      if (activeFilter === "RETURNS" && !isReturn) return false;
      if (activeFilter === "CANCELLATIONS" && isReturn) return false;
      if (activeFilter === "PENDING" && status !== "REQUESTED") return false;
      if (activeFilter === "APPROVED" && status !== "APPROVED") return false;
      if (activeFilter === "REJECTED" && status !== "REJECTED") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const orderId = (item.orderId || "").toLowerCase();
        const buyerName = (item.buyer?.name || "").toLowerCase();
        const buyerCity = (item.buyer?.city || "").toLowerCase();
        const buyerState = (item.buyer?.state || "").toLowerCase();
        const reason = (item.cancellation?.reason || "").toLowerCase();

        const matchesProduct = (item.sellerItems || []).some((it: any) =>
          (it.name || "").toLowerCase().includes(q) || (it.sku || "").toLowerCase().includes(q)
        );

        if (
          !orderId.includes(q) &&
          !buyerName.includes(q) &&
          !buyerCity.includes(q) &&
          !buyerState.includes(q) &&
          !reason.includes(q) &&
          !matchesProduct
        ) {
          return false;
        }
      }

      return true;
    });
  }, [cancelledOrders, activeFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#2d4a36]">Cancelled Orders & Returns</h1>
            <Badge className="bg-[#2d4a36] text-white text-[10px] font-bold px-2 py-0.5">
              Seller Portal
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Track customer return requests, return collection timelines, and transparent seller earnings reversals.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="text-xs border-[#d8dcd3] bg-white hover:bg-[#e9ece6] rounded-xl gap-1.5 w-fit"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* ── Summary Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Approved Cancellations & Returns */}
        <Card className="p-5 bg-white border border-[#d8dcd3]/60 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="h-9 w-9 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">
              {metrics.deliveredReturns} Returns
            </Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">{metrics.approvedCancellations}</h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Approved Cancellations & Returns</p>
            <p className="text-[10px] text-muted-foreground mt-1">Active sales adjusted in dashboard</p>
          </div>
        </Card>

        {/* Pending Review Requests */}
        <Card className="p-5 bg-white border border-amber-200/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="h-9 w-9 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center">
              <Clock className="h-4.5 w-4.5" />
            </div>
            {metrics.pendingRequests > 0 && (
              <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                Under Review
              </span>
            )}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-amber-800">{metrics.pendingRequests}</h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Pending Review Requests</p>
            <p className="text-[10px] text-muted-foreground mt-1">Awaiting Super Admin decision</p>
          </div>
        </Card>

        {/* Net Seller Earnings Reversal */}
        <Card className="p-5 bg-white border border-[#d8dcd3]/60 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="h-9 w-9 bg-rose-50 text-rose-700 rounded-xl flex items-center justify-center">
              <TrendingDown className="h-4.5 w-4.5" />
            </div>
            <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">Reversal (90%)</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-rose-700">-₹{Math.round(metrics.totalNetReversal).toLocaleString("en-IN")}</h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Reversed Net Earnings</p>
            <p className="text-[10px] text-muted-foreground mt-1">Deducted from eligible payout balance</p>
          </div>
        </Card>

        {/* Marketplace Commission Reversal */}
        <Card className="p-5 bg-white border border-[#d8dcd3]/60 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="h-9 w-9 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center">
              <Coins className="h-4.5 w-4.5" />
            </div>
            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Waived (10%)</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-blue-800">₹{Math.round(metrics.totalCommissionReversed).toLocaleString("en-IN")}</h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Platform Fee Waived</p>
            <p className="text-[10px] text-muted-foreground mt-1">10% commission not charged</p>
          </div>
        </Card>
      </div>

      {/* ── Search & Filter Tabs ── */}
      <Card className="p-4 bg-white border border-[#d8dcd3]/60 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-1.5">
            {[
              { id: "ALL", label: "All Records", count: cancelledOrders.length },
              { id: "RETURNS", label: "Delivered Returns", count: cancelledOrders.filter((it) => it.cancellation?.type === "RETURN" || it.orderStatus === "RETURNED").length },
              { id: "CANCELLATIONS", label: "Pre-Ship Cancellations", count: cancelledOrders.filter((it) => it.cancellation?.type !== "RETURN" && it.orderStatus !== "RETURNED").length },
              { id: "APPROVED", label: "Approved", count: metrics.approvedCancellations },
              { id: "PENDING", label: "Pending Review", count: metrics.pendingRequests },
              { id: "REJECTED", label: "Rejected", count: metrics.rejectedRequests },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? "bg-[#2d4a36] text-white shadow-xs"
                    : "bg-[#f4f5f3] text-slate-600 hover:bg-[#e9ece6]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeFilter === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Search Order ID, product, SKU, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f4f5f3] hover:bg-[#e9ece6] focus:bg-white border border-transparent focus:border-[#2d4a36] rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-all"
            />
          </div>
        </div>
      </Card>

      {/* ── Table View ── */}
      <Card className="bg-white border border-[#d8dcd3]/60 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-7 w-7 animate-spin text-[#2d4a36]" />
            <p className="text-xs text-muted-foreground">Loading records...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-slate-700">No records found</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {searchQuery || activeFilter !== "ALL"
                ? "Try clearing your search query or selecting a different status filter."
                : "Cancelled orders and returns for your products will appear here with inventory & reversal details."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#f8f9f7] border-b border-[#e9ece6]">
                <TableRow>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Order & Dates</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Type</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Your Products</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Collection Tracking</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Earnings Reversal</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Status</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Refund Status</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3 text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-[#e9ece6]">
                {filteredOrders.map((item) => {
                  const isReturn = item.cancellation?.type === "RETURN" || item.orderStatus === "RETURNED";
                  const status = item.cancellation?.status || (item.orderStatus === "CANCELLED" || item.orderStatus === "REFUNDED" || item.orderStatus === "RETURNED" ? "APPROVED" : "REQUESTED");
                  const gross = Number(item.sellerSubtotal || 0);
                  const netReversal = gross * 0.9;
                  const comm = gross * 0.1;
                  const returnColl = item.cancellation?.returnCollection;

                  return (
                    <TableRow key={item.orderId} className="hover:bg-[#fcfdfc] transition-colors">
                      {/* Order & Dates */}
                      <TableCell className="py-3.5">
                        <div className="space-y-0.5">
                          <span className="font-mono text-xs font-bold text-[#2d4a36] block">
                            #{item.orderId}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Placed: {new Date(item.orderCreatedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          {item.deliveredAt && (
                            <span className="text-[10px] text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Delivered: {new Date(item.deliveredAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          )}
                          {item.cancellation?.requestedAt && (
                            <span className="text-[9px] text-slate-400 block">
                              Req: {new Date(item.cancellation.requestedAt).toLocaleDateString("en-IN")}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Type */}
                      <TableCell className="py-3.5">
                        {isReturn ? (
                          <Badge className="bg-emerald-700 text-white text-[9px] gap-1 py-0.2">
                            <RotateCcw className="h-2.5 w-2.5" /> Return
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[9px] gap-1 py-0.2">
                            Cancellation
                          </Badge>
                        )}
                      </TableCell>

                      {/* Products */}
                      <TableCell className="py-3.5">
                        <div className="space-y-1.5 max-w-[200px]">
                          {item.sellerItems.map((prod: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              {prod.image ? (
                                <img src={prod.image} alt={prod.name} className="h-8 w-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                              ) : (
                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                  <Package className="h-4 w-4 text-slate-400" />
                                </div>
                              )}
                              <div className="truncate">
                                <p className="font-semibold text-slate-800 text-xs truncate">{prod.name}</p>
                                <p className="text-[9px] text-muted-foreground">
                                  SKU: <span className="font-mono">{prod.sku || prod.productId?.slice(0, 8)}</span> • Qty: {prod.quantity} × ₹{prod.price}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TableCell>

                      {/* Collection Tracking */}
                      <TableCell className="py-3.5">
                        {isReturn && returnColl ? (
                          <div className="space-y-0.5">
                            <Badge variant="primary" className="text-[9px] gap-1 py-0.2">
                              <Truck className="h-2.5 w-2.5" />
                              {returnColl.status.replace(/_/g, " ")}
                            </Badge>
                            <p className="text-[9px] text-slate-500 block">
                              Deadline: {new Date(returnColl.collectionDeadline).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">N/A</span>
                        )}
                      </TableCell>

                      {/* Earnings Reversal Accounting */}
                      <TableCell className="py-3.5">
                        <div className="space-y-0.5">
                          <span className="font-extrabold text-xs text-rose-700 block">
                            -₹{Math.round(netReversal).toLocaleString("en-IN")} (90%)
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Gross: ₹{gross.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[9px] text-blue-600 block">
                            Fee waived: ₹{Math.round(comm).toLocaleString("en-IN")} (10%)
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3.5">
                        {status === "REQUESTED" ? (
                          <Badge variant="accent" className="text-[10px] gap-1 py-0.5">
                            <Clock className="h-3 w-3" /> Pending Review
                          </Badge>
                        ) : status === "APPROVED" ? (
                          <div className="space-y-0.5">
                            <Badge variant="success" className="text-[10px] gap-1 py-0.5">
                              <CheckCircle2 className="h-3 w-3" /> {isReturn ? "Returned" : "Cancelled"}
                            </Badge>
                            {item.cancellation?.reviewedAt && (
                              <span className="text-[9px] text-slate-400 block">
                                Appr: {new Date(item.cancellation.reviewedAt).toLocaleDateString("en-IN")}
                              </span>
                            )}
                            {item.cancellation?.isAutoApproved && (
                              <span className="text-[9px] text-emerald-700 block font-semibold">⚡ 24h Auto</span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="danger" className="text-[10px] gap-1 py-0.5">
                            <XCircle className="h-3 w-3" /> Rejected
                          </Badge>
                        )}
                      </TableCell>

                      {/* Refund Status */}
                      <TableCell className="py-3.5">
                        <div className="space-y-0.5">
                          {item.cancellation?.refundStatus === "SUCCESS" ? (
                            <Badge variant="success" className="text-[9px] py-0.2">Refunded</Badge>
                          ) : item.cancellation?.refundStatus === "PENDING" ? (
                            <Badge variant="primary" className="text-[9px] py-0.2">Processing</Badge>
                          ) : item.cancellation?.refundStatus === "FAILED" ? (
                            <Badge variant="danger" className="text-[9px] py-0.2">Failed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] py-0.2">
                              {item.cancellation?.refundStatus || "N/A"}
                            </Badge>
                          )}
                          <p className="text-[10px] text-muted-foreground font-semibold">
                            ₹{gross.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </TableCell>

                      {/* Details */}
                      <TableCell className="py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setInspectOrder(item)}
                          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 rounded-lg"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Details Modal ── */}
      {inspectOrder && (() => {
        const isReturn = inspectOrder.cancellation?.type === "RETURN" || inspectOrder.orderStatus === "RETURNED";
        const returnColl = inspectOrder.cancellation?.returnCollection;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="relative w-full max-w-lg bg-white border border-[#d8dcd3] rounded-3xl shadow-2xl z-10 p-6 space-y-4 text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setInspectOrder(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <RotateCcw className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      {isReturn ? "Returned Order" : "Cancelled Order"} #{inspectOrder.orderId}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Placed on {new Date(inspectOrder.orderCreatedAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery and Return Collection Info */}
              {isReturn && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
                  <span className="font-bold text-emerald-950 uppercase tracking-wider block text-[10px]">
                    Delivery & Collection Status
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-semibold">Delivery Date:</span>
                      <span className="font-bold text-slate-800">
                        {inspectOrder.deliveredAt ? new Date(inspectOrder.deliveredAt).toLocaleDateString("en-IN") : "Delivered"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-semibold">Collection Deadline:</span>
                      <span className="font-bold text-slate-800">
                        {returnColl?.collectionDeadline
                          ? new Date(returnColl.collectionDeadline).toLocaleDateString("en-IN")
                          : "Within 5 days of approval"}
                      </span>
                    </div>
                  </div>
                  {returnColl && (
                    <div className="pt-1 border-t border-emerald-200/60 flex items-center justify-between">
                      <span className="text-muted-foreground font-semibold">Return Collection Progress:</span>
                      <Badge variant="primary" className="text-[10px] py-0.2">
                        {returnColl.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Financial Accounting Breakdown */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-800 block text-xs uppercase tracking-wider">
                  Seller Accounting Reconciliation
                </span>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-muted-foreground">Your Product Subtotal (Gross)</span>
                  <span className="font-semibold text-slate-800">₹{inspectOrder.sellerSubtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-blue-700">
                  <span>Platform Commission Waived (10%)</span>
                  <span className="font-semibold">₹{Math.round(inspectOrder.sellerSubtotal * 0.1).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-1 font-bold text-rose-700">
                  <span>Net Earnings Reversed (90%)</span>
                  <span>-₹{Math.round(inspectOrder.sellerSubtotal * 0.9).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Reason & Admin update */}
              {inspectOrder.cancellation?.reason && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Reason</span>
                  <p className="text-xs text-slate-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                    "{inspectOrder.cancellation.reason}"
                  </p>
                </div>
              )}

              {inspectOrder.cancellation?.rejectionReason && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rejection Reason</span>
                  <p className="text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {inspectOrder.cancellation.rejectionReason}
                  </p>
                </div>
              )}

              {inspectOrder.cancellation?.adminNote && !inspectOrder.cancellation?.rejectionReason && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Super Admin Note</span>
                  <p className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {inspectOrder.cancellation.adminNote}
                  </p>
                </div>
              )}

              {/* Products List with SKU */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Products in this Order</span>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 p-2 max-h-40 overflow-y-auto">
                  {inspectOrder.sellerItems.map((prod: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        {prod.image && (
                          <img src={prod.image} alt="" className="h-8 w-8 rounded-lg object-cover border border-slate-200" />
                        )}
                        <div>
                          <p className="font-semibold text-slate-800">{prod.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            SKU: <span className="font-mono">{prod.sku || prod.productId?.slice(0, 8)}</span> • Qty: {prod.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-800">
                        ₹{(prod.price * prod.quantity).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button variant="outline" onClick={() => setInspectOrder(null)} className="text-xs rounded-xl">
                  Close
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
