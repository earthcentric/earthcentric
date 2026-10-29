"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  getOrderCancellationsForAdmin,
  reviewOrderCancellation,
  retryOrderCancellationRefund,
  refreshOrderCancellationRefund,
  updateReturnCollectionStatus,
} from "@/actions/orders";
import {
  Card,
  Badge,
  Button,
  Input,
  Textarea,
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
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Loader2,
  ExternalLink,
  Store,
  User,
  CreditCard,
  FileText,
  Truck,
  CheckSquare,
} from "lucide-react";

interface OrderCancellationsAdminViewProps {
  onActionComplete?: () => void;
  globalSearch?: string;
  adminEmail?: string;
}

export function OrderCancellationsAdminView({
  onActionComplete,
  globalSearch = "",
  adminEmail,
}: OrderCancellationsAdminViewProps) {
  const [cancellations, setCancellations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState(globalSearch);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modals state
  const [inspectItem, setInspectItem] = useState<any | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    item: any;
    decision: "APPROVE" | "REJECT";
    note: string;
  } | null>(null);

  // Return Collection management modal
  const [collectionModal, setCollectionModal] = useState<{
    item: any;
    status: "COLLECTION_PENDING" | "SCHEDULED" | "COLLECTED" | "INSPECTION_PENDING" | "RETURNED_TO_SELLER" | "FAILED";
    notes: string;
    failureReason: string;
    scheduledAt: string;
  } | null>(null);

  const fetchCancellations = async () => {
    setLoading(true);
    try {
      const data = await getOrderCancellationsForAdmin();
      setCancellations(data || []);
    } catch (err: any) {
      console.error("Failed to load cancellations:", err);
      toast.error(err.message || "Failed to load cancellation requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCancellations();
  }, []);

  useEffect(() => {
    if (globalSearch) {
      setSearchQuery(globalSearch);
    }
  }, [globalSearch]);

  // Handle Review (Approve or Reject)
  const handleConfirmReview = async () => {
    if (!reviewModal) return;
    const { item, decision, note } = reviewModal;
    const trimmed = note.trim();

    if (decision === "REJECT" && trimmed.length < 8) {
      toast.error("Please provide a rejection reason of at least 8 characters.");
      return;
    }

    const isReturn = item.type === "RETURN";
    setActionLoadingId(item.id);
    try {
      const res = await reviewOrderCancellation(item.id, decision, trimmed);
      if (!res.success) {
        toast.error(res.error || `Failed to ${decision.toLowerCase()} ${isReturn ? "return" : "cancellation"}.`);
        return;
      }

      toast.success(
        decision === "APPROVE"
          ? isReturn
            ? "Delivered return approved! 5-day collection scheduled, Cashfree refund initiated, and approval email sent."
            : "Cancellation approved! Cashfree refund initiated and customer notified."
          : `${isReturn ? "Return" : "Cancellation"} rejected. Customer and seller have been informed.`
      );
      setReviewModal(null);
      await fetchCancellations();
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      console.error("Error reviewing cancellation:", err);
      toast.error(err.message || "Failed to submit review.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Return Collection Status Update
  const handleUpdateCollectionStatus = async () => {
    if (!collectionModal) return;
    const { item, status, notes, failureReason, scheduledAt } = collectionModal;

    setActionLoadingId(item.id);
    try {
      const res = await updateReturnCollectionStatus(item.id, status, {
        notes: notes.trim() || undefined,
        failureReason: status === "FAILED" ? failureReason.trim() || "Collection attempt failed." : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update return collection status.");
        return;
      }

      toast.success(`Return collection status updated to ${status.replace(/_/g, " ")}.`);
      setCollectionModal(null);
      await fetchCancellations();
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      console.error("Error updating collection status:", err);
      toast.error(err.message || "Failed to update return collection status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Retry Refund
  const handleRetryRefund = async (cancellationId: string) => {
    setActionLoadingId(cancellationId);
    try {
      const res = await retryOrderCancellationRefund(cancellationId);
      if (!res.success) {
        toast.error(res.error || "Failed to re-attempt refund.");
        return;
      }
      toast.success(`Refund re-attempted. Current status: ${res.status}`);
      await fetchCancellations();
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      toast.error(err.message || "Retry refund failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Refresh Status
  const handleRefreshRefundStatus = async (cancellationId: string) => {
    setActionLoadingId(cancellationId);
    try {
      const res = await refreshOrderCancellationRefund(cancellationId);
      if (!res.success) {
        toast.error(res.error || "Could not sync status with Cashfree.");
        return;
      }
      toast.success(`Synced with Cashfree! Current status: ${res.status}`);
      await fetchCancellations();
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      toast.error(err.message || "Status sync failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── 7 KPI Metrics ──
  const metrics = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let refundsProcessing = 0;
    let refundsCompleted = 0;
    let refundsFailed = 0;
    let totalRefundAmount = 0;

    for (const c of cancellations) {
      if (c.status === "REQUESTED") pending++;
      if (c.status === "APPROVED") {
        approved++;
        if (c.refundStatus === "SUCCESS") {
          refundsCompleted++;
          totalRefundAmount += Number(c.refundAmount || c.order?.totalAmount || 0);
        } else if (c.refundStatus === "PENDING" || c.refundStatus === "PENDING_PAYMENT") {
          refundsProcessing++;
        } else if (c.refundStatus === "FAILED") {
          refundsFailed++;
        }
      }
      if (c.status === "REJECTED") rejected++;
    }

    return {
      pending,
      approved,
      rejected,
      refundsProcessing,
      refundsCompleted,
      refundsFailed,
      totalRefundAmount,
    };
  }, [cancellations]);

  // ── Filtered & Searched Data ──
  const filteredCancellations = useMemo(() => {
    return cancellations.filter((c) => {
      const isReturn = c.type === "RETURN";
      // Type and status filters
      if (activeFilter === "RETURNS" && !isReturn) return false;
      if (activeFilter === "CANCELLATIONS" && isReturn) return false;
      if (activeFilter === "COLLECTIONS" && !c.returnCollection) return false;
      if (activeFilter === "PENDING" && c.status !== "REQUESTED") return false;
      if (activeFilter === "APPROVED" && c.status !== "APPROVED") return false;
      if (activeFilter === "REJECTED" && c.status !== "REJECTED") return false;
      if (activeFilter === "PROCESSING" && !(c.status === "APPROVED" && (c.refundStatus === "PENDING" || c.refundStatus === "PENDING_PAYMENT"))) return false;
      if (activeFilter === "REFUNDED" && !(c.status === "APPROVED" && c.refundStatus === "SUCCESS")) return false;
      if (activeFilter === "FAILED" && !(c.status === "APPROVED" && c.refundStatus === "FAILED")) return false;

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const orderId = (c.orderId || "").toLowerCase();
        const userName = (c.order?.user?.name || "").toLowerCase();
        const userEmail = (c.order?.user?.email || c.requestedByEmail || "").toLowerCase();
        const reason = (c.reason || "").toLowerCase();
        const cfRef = (c.cashfreeRefundReference || "").toLowerCase();
        const arn = (c.refundArn || "").toLowerCase();
        const collStatus = (c.returnCollection?.status || "").toLowerCase();

        const matchesItem = (c.order?.items || []).some((item: any) =>
          (item.product?.name || "").toLowerCase().includes(q)
        );

        if (
          !orderId.includes(q) &&
          !userName.includes(q) &&
          !userEmail.includes(q) &&
          !reason.includes(q) &&
          !cfRef.includes(q) &&
          !arn.includes(q) &&
          !collStatus.includes(q) &&
          !matchesItem
        ) {
          return false;
        }
      }

      return true;
    });
  }, [cancellations, activeFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-[#1a3321] tracking-tight">Order Cancellation & Refund Manager</h1>
            <Badge className="bg-[#1a3321] text-white text-[10px] font-bold px-2 py-0.5">
              Live Gateway Sync
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Review buyer & seller cancellation requests, trigger automated Cashfree refunds, and monitor reversals.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCancellations}
            disabled={loading}
            className="text-xs border-[#d8dcd3] bg-white hover:bg-[#f4f5f3] rounded-xl gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ── 7 KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* 1. Pending */}
        <Card className="p-4 bg-white border border-amber-200/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
            {metrics.pending > 0 && (
              <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                Action Req.
              </span>
            )}
          </div>
          <div>
            <span className="text-2xl font-extrabold text-amber-800">{metrics.pending}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Pending Review</p>
          </div>
        </Card>

        {/* 2. Approved */}
        <Card className="p-4 bg-white border border-[#e9ece6] rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-emerald-800">{metrics.approved}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Approved</p>
          </div>
        </Card>

        {/* 3. Rejected */}
        <Card className="p-4 bg-white border border-[#e9ece6] rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-2">
            <XCircle className="h-4 w-4" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-rose-800">{metrics.rejected}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Rejected</p>
          </div>
        </Card>

        {/* 4. Refunds Processing */}
        <Card className="p-4 bg-white border border-[#e9ece6] rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2">
            <RotateCcw className="h-4 w-4" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-blue-800">{metrics.refundsProcessing}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Processing</p>
          </div>
        </Card>

        {/* 5. Successfully Refunded */}
        <Card className="p-4 bg-white border border-[#e9ece6] rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-emerald-900">{metrics.refundsCompleted}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Refunded</p>
          </div>
        </Card>

        {/* 6. Total Refund Amount */}
        <Card className="p-4 bg-white border border-[#e9ece6] rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="h-7 w-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center mb-2">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-teal-900">₹{metrics.totalRefundAmount.toLocaleString("en-IN")}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Total Refunded</p>
          </div>
        </Card>

        {/* 7. Failed Refunds Requiring Attention */}
        <Card className={`p-4 bg-white rounded-2xl shadow-xs flex flex-col justify-between border ${
          metrics.refundsFailed > 0 ? "border-rose-300 bg-rose-50/40" : "border-[#e9ece6]"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
              metrics.refundsFailed > 0 ? "bg-rose-200 text-rose-800" : "bg-slate-100 text-slate-600"
            }`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            {metrics.refundsFailed > 0 && (
              <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                Needs Retry
              </span>
            )}
          </div>
          <div>
            <span className={`text-2xl font-extrabold ${metrics.refundsFailed > 0 ? "text-rose-700" : "text-slate-700"}`}>
              {metrics.refundsFailed}
            </span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Failed Refunds</p>
          </div>
        </Card>
      </div>

      {/* ── Search & Filter Tabs ── */}
      <Card className="p-4 bg-white border border-[#e9ece6] rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filter Tabs */}
          <div className="flex items-center flex-wrap gap-1.5">
            {[
              { id: "ALL", label: "All Requests", count: cancellations.length },
              { id: "RETURNS", label: "Delivered Returns", count: cancellations.filter((c) => c.type === "RETURN").length },
              { id: "CANCELLATIONS", label: "Pre-Ship Cancellations", count: cancellations.filter((c) => c.type !== "RETURN").length },
              { id: "COLLECTIONS", label: "Collections", count: cancellations.filter((c) => Boolean(c.returnCollection)).length },
              { id: "PENDING", label: "Pending Review", count: metrics.pending },
              { id: "APPROVED", label: "Approved", count: metrics.approved },
              { id: "REJECTED", label: "Rejected", count: metrics.rejected },
              { id: "PROCESSING", label: "Refund Processing", count: metrics.refundsProcessing },
              { id: "REFUNDED", label: "Refunded", count: metrics.refundsCompleted },
              { id: "FAILED", label: "Failed Refunds", count: metrics.refundsFailed },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? "bg-[#1a3321] text-white shadow-xs"
                    : "bg-[#f4f5f3] text-slate-600 hover:bg-[#e9ece6]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeFilter === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Search Order ID, user, Cashfree ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f4f5f3] hover:bg-[#e9ece6] focus:bg-white border border-transparent focus:border-[#1a3321] rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-all"
            />
          </div>
        </div>
      </Card>

      {/* ── Cancellations Table ── */}
      <Card className="bg-white border border-[#e9ece6] rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-7 w-7 animate-spin text-[#1a3321]" />
            <p className="text-xs text-muted-foreground">Loading cancellation & return requests...</p>
          </div>
        ) : filteredCancellations.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-slate-700">No requests found</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {searchQuery || activeFilter !== "ALL"
                ? "Try clearing your search query or selecting a different status filter."
                : "Delivered return requests and pre-shipment cancellation requests will appear here for review."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#f8f9f7] border-b border-[#e9ece6]">
                <TableRow>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Order & Dates</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Type & Policy</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Customer & Seller</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Product / Items</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Collection Tracking</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Review Status</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3">Refund Status</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-[#e9ece6]">
                {filteredCancellations.map((c) => {
                  const isReturn = c.type === "RETURN";
                  const isPending = c.status === "REQUESTED";
                  const isApproved = c.status === "APPROVED";
                  const isRejected = c.status === "REJECTED";
                  const refundState = c.refundStatus;
                  const refundAmount = c.refundAmount ?? c.order?.totalAmount ?? 0;
                  const returnColl = c.returnCollection;
                  const deliveryDate = c.deliveredAt || c.order?.deliveredAt || c.order?.timeline?.find((t: any) => t.status === "DELIVERED")?.createdAt;

                  return (
                    <TableRow key={c.id} className="hover:bg-[#fcfdfc] transition-colors">
                      {/* Order & Dates */}
                      <TableCell className="py-3.5">
                        <div className="space-y-0.5">
                          <span className="font-mono text-xs font-bold text-[#1a3321] block">
                            #{c.orderId}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            Placed: {new Date(c.order?.createdAt || c.requestedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          {deliveryDate && (
                            <span className="text-[10px] text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Delivered: {new Date(deliveryDate).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400 block">
                            Req: {new Date(c.requestedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </TableCell>

                      {/* Type & Policy */}
                      <TableCell className="py-3.5">
                        <div className="space-y-1">
                          {isReturn ? (
                            <Badge className="bg-emerald-700 text-white text-[9px] gap-1 py-0.2">
                              <RotateCcw className="h-2.5 w-2.5" /> Delivered Return
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[9px] gap-1 py-0.2">
                              <RotateCcw className="h-2.5 w-2.5" /> Pre-Shipment
                            </Badge>
                          )}

                          {isReturn ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[9px] gap-1 py-0.2 block w-fit">
                              <Clock className="h-2.5 w-2.5 text-emerald-600" /> 7-Day Return Policy
                            </Badge>
                          ) : c.isAutoApproved ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[9px] gap-1 py-0.2 block w-fit">
                              <Zap className="h-2.5 w-2.5 text-emerald-600" /> 24h Auto-Approve
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[9px] gap-1 py-0.2 block w-fit">
                              <Clock className="h-2.5 w-2.5 text-amber-600" /> 3-Day Policy
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Customer & Seller */}
                      <TableCell className="py-3.5">
                        <div className="space-y-1 max-w-[150px]">
                          <div>
                            <p className="font-semibold text-xs text-slate-800 line-clamp-1">
                              {c.order?.user?.name || "Customer"}
                            </p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">
                              {c.order?.user?.email || c.requestedByEmail}
                            </p>
                          </div>
                          <div className="pt-0.5 border-t border-slate-100">
                            <p className="text-[10px] font-semibold text-slate-700 line-clamp-1 flex items-center gap-1">
                              <Store className="h-2.5 w-2.5 text-slate-400" />
                              {c.order?.seller?.companyName || c.order?.items?.[0]?.product?.seller?.companyName || "Earth Centric Seller"}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Product / Items */}
                      <TableCell className="py-3.5">
                        <div className="space-y-1 max-w-[200px]">
                          {(c.order?.items || []).slice(0, 2).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              {item.product?.images?.[0]?.url ? (
                                <img
                                  src={item.product.images[0].url}
                                  alt={item.product.name}
                                  className="h-7 w-7 rounded object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="h-7 w-7 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                  <Package className="h-3.5 w-3.5 text-slate-400" />
                                </div>
                              )}
                              <div className="truncate">
                                <p className="font-medium text-slate-800 text-[11px] truncate">
                                  {item.product?.name || "Product"}
                                </p>
                                <p className="text-[9px] text-muted-foreground">
                                  {item.quantity} × ₹{item.price}
                                </p>
                              </div>
                            </div>
                          ))}
                          {(c.order?.items?.length || 0) > 2 && (
                            <p className="text-[9px] text-muted-foreground">
                              +{c.order.items.length - 2} more item(s)
                            </p>
                          )}
                          <p className="font-bold text-xs text-slate-900 mt-0.5">
                            Total: ₹{Number(c.order?.totalAmount || 0).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </TableCell>

                      {/* Collection Tracking */}
                      <TableCell className="py-3.5">
                        {isReturn ? (
                          <div className="space-y-1">
                            {returnColl ? (
                              <>
                                <Badge variant="primary" className="text-[9px] gap-1 py-0.2">
                                  <Truck className="h-2.5 w-2.5" />
                                  {returnColl.status.replace(/_/g, " ")}
                                </Badge>
                                <p className="text-[9px] text-slate-600 block">
                                  Target: 5 days ({new Date(returnColl.collectionDeadline).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short"
                                  })})
                                </p>
                                {isApproved && (
                                  <button
                                    onClick={() =>
                                      setCollectionModal({
                                        item: c,
                                        status: returnColl.status,
                                        notes: returnColl.notes || "",
                                        failureReason: returnColl.failureReason || "",
                                        scheduledAt: returnColl.scheduledAt ? new Date(returnColl.scheduledAt).toISOString().split("T")[0] : "",
                                      })
                                    }
                                    className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold underline bg-transparent border-none cursor-pointer p-0"
                                  >
                                    Update Status
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                {isPending ? "Pending Approval" : "N/A"}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Not Applicable</span>
                        )}
                      </TableCell>

                      {/* Review Status */}
                      <TableCell className="py-3.5">
                        {isPending ? (
                          <Badge variant="accent" className="text-[10px] gap-1 py-0.5">
                            <Clock className="h-3 w-3" /> Pending Review
                          </Badge>
                        ) : isApproved ? (
                          <Badge variant="success" className="text-[10px] gap-1 py-0.5">
                            <CheckCircle2 className="h-3 w-3" /> Approved
                          </Badge>
                        ) : (
                          <Badge variant="danger" className="text-[10px] gap-1 py-0.5">
                            <XCircle className="h-3 w-3" /> Rejected
                          </Badge>
                        )}
                        {c.reviewedAt && (
                          <p className="text-[9px] text-muted-foreground mt-1">
                            {new Date(c.reviewedAt).toLocaleDateString()}
                          </p>
                        )}
                      </TableCell>

                      {/* Refund Status */}
                      <TableCell className="py-3.5">
                        <div className="space-y-1">
                          <span className="font-extrabold text-xs text-emerald-800 block">
                            ₹{refundAmount.toLocaleString("en-IN")}
                          </span>
                          {refundState === "SUCCESS" ? (
                            <Badge variant="success" className="text-[9px] gap-1 py-0.2">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Refunded
                            </Badge>
                          ) : refundState === "PENDING" ? (
                            <Badge variant="primary" className="text-[9px] gap-1 py-0.2">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Processing
                            </Badge>
                          ) : refundState === "FAILED" ? (
                            <Badge variant="danger" className="text-[9px] gap-1 py-0.2">
                              <AlertCircle className="h-2.5 w-2.5" /> Failed
                            </Badge>
                          ) : refundState === "PENDING_PAYMENT" ? (
                            <Badge variant="outline" className="text-[9px] py-0.2">
                              Pending Pay
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] py-0.2">
                              Not Required
                            </Badge>
                          )}

                          {c.cashfreeRefundReference && (
                            <p className="font-mono text-[9px] text-slate-500 truncate max-w-[120px]" title={c.cashfreeRefundReference}>
                              Ref: {c.cashfreeRefundReference}
                            </p>
                          )}
                          {c.refundArn && (
                            <p className="font-mono text-[9px] text-slate-500 truncate max-w-[120px]" title={c.refundArn}>
                              ARN: {c.refundArn}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Pending Review Actions */}
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                disabled={actionLoadingId === c.id}
                                onClick={() =>
                                  setReviewModal({
                                    item: c,
                                    decision: "APPROVE",
                                    note: isReturn
                                      ? "Approved delivered order return. Return collection will be arranged within 5 days and Cashfree refund processed."
                                      : "Approved pre-shipment cancellation. Cashfree refund initiated.",
                                  })
                                }
                                className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 rounded-lg gap-1"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionLoadingId === c.id}
                                onClick={() =>
                                  setReviewModal({
                                    item: c,
                                    decision: "REJECT",
                                    note: "",
                                  })
                                }
                                className="h-7 text-[10px] border-rose-200 text-rose-700 hover:bg-rose-50 px-2.5 rounded-lg gap-1"
                              >
                                <XCircle className="h-3 w-3" />
                                Reject
                              </Button>
                            </>
                          )}

                          {/* Collection Update Action if Approved Return */}
                          {isApproved && isReturn && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setCollectionModal({
                                  item: c,
                                  status: returnColl?.status || "COLLECTION_PENDING",
                                  notes: returnColl?.notes || "",
                                  failureReason: returnColl?.failureReason || "",
                                  scheduledAt: returnColl?.scheduledAt ? new Date(returnColl.scheduledAt).toISOString().split("T")[0] : "",
                                })
                              }
                              className="h-7 text-[10px] border-emerald-300 text-emerald-800 hover:bg-emerald-50 px-2 rounded-lg gap-1"
                              title="Update Return Collection Status"
                            >
                              <Truck className="h-3 w-3 text-emerald-700" />
                              Collection
                            </Button>
                          )}

                          {/* Retry Refund if failed */}
                          {isApproved && refundState === "FAILED" && (
                            <Button
                              size="sm"
                              disabled={actionLoadingId === c.id}
                              onClick={() => handleRetryRefund(c.id)}
                              className="h-7 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 rounded-lg gap-1"
                            >
                              <RotateCcw className={`h-3 w-3 ${actionLoadingId === c.id ? "animate-spin" : ""}`} />
                              Retry Refund
                            </Button>
                          )}

                          {/* Sync / Refresh Status if processing */}
                          {isApproved && (refundState === "PENDING" || refundState === "PENDING_PAYMENT") && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoadingId === c.id}
                              onClick={() => handleRefreshRefundStatus(c.id)}
                              className="h-7 text-[10px] border-[#d8dcd3] text-slate-700 hover:bg-slate-100 px-2 rounded-lg gap-1"
                              title="Sync latest status with Cashfree"
                            >
                              <RefreshCw className={`h-3 w-3 ${actionLoadingId === c.id ? "animate-spin" : ""}`} />
                              Sync
                            </Button>
                          )}

                          {/* View details */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInspectItem(c)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 rounded-lg"
                            title="Inspect complete request audit details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Review Modal (Approve / Reject) ── */}
      {reviewModal && (() => {
        const isReturn = reviewModal.item.type === "RETURN";
        const refundAmt = Number(reviewModal.item.refundAmount || reviewModal.item.order?.totalAmount || 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="relative w-full max-w-md bg-white border border-[#e9ece6] rounded-3xl shadow-2xl z-10 p-6 space-y-4 text-left animate-in zoom-in-95 duration-200">
              <button
                onClick={() => !actionLoadingId && setReviewModal(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
                <div
                  className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    reviewModal.decision === "APPROVE"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {reviewModal.decision === "APPROVE" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {reviewModal.decision === "APPROVE"
                      ? isReturn
                        ? "Approve Delivered Order Return"
                        : "Approve Order Cancellation"
                      : isReturn
                        ? "Reject Return Request"
                        : "Reject Cancellation Request"}
                  </h3>
                  <p className="text-xs text-muted-foreground">Order #{reviewModal.item.orderId}</p>
                </div>
              </div>

              {reviewModal.decision === "APPROVE" ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1.5 text-xs">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <DollarSign className="h-4 w-4 shrink-0" />
                    Cashfree Refund & {isReturn ? "5-Day Collection" : "Reversal"}
                  </p>
                  <p className="text-emerald-900 leading-relaxed">
                    Approving this request will mark Order #{reviewModal.item.orderId} as{" "}
                    <strong>{isReturn ? "RETURNED" : "CANCELLED"}</strong>,
                    {isReturn ? " create a Return Collection record with a 5-day collection deadline," : ""}
                    {" "}initiate an automated Cashfree gateway refund of <strong>₹{refundAmt.toLocaleString("en-IN")}</strong>,
                    {" "}reverse seller revenue (-90% net earnings, 10% commission waived), and dispatch the branded approval email to the customer.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1.5 text-xs">
                  <p className="font-bold flex items-center gap-1.5 text-rose-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {isReturn ? "Delivered Order Remains Active" : "Order Fulfillment Continues"}
                  </p>
                  <p className="text-rose-900 leading-relaxed">
                    Rejecting this request will leave the order and financial records intact.
                    The customer will receive an email with your rejection reason explaining why this request was declined.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  {reviewModal.decision === "APPROVE" ? "Administrator Note (Optional)" : "Rejection Reason (Required, min 8 chars)"}
                </label>
                <Textarea
                  value={reviewModal.note}
                  onChange={(e) => setReviewModal({ ...reviewModal, note: e.target.value })}
                  placeholder={
                    reviewModal.decision === "APPROVE"
                      ? "Add any optional notes for audit history..."
                      : "Explain why this request is rejected (minimum 8 characters)..."
                  }
                  className="text-xs bg-slate-50 border-slate-200 min-h-[90px] rounded-xl focus:bg-white"
                />
                {reviewModal.decision === "REJECT" && (
                  <span className={`text-[10px] font-semibold ${
                    reviewModal.note.trim().length >= 8 ? "text-emerald-600" : "text-amber-600"
                  }`}>
                    {reviewModal.note.trim().length}/500 characters {reviewModal.note.trim().length < 8 ? `(${8 - reviewModal.note.trim().length} more needed)` : "✓"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  disabled={Boolean(actionLoadingId)}
                  onClick={() => setReviewModal(null)}
                  className="flex-1 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    Boolean(actionLoadingId) ||
                    (reviewModal.decision === "REJECT" && reviewModal.note.trim().length < 8)
                  }
                  onClick={handleConfirmReview}
                  className={`flex-1 text-xs font-bold text-white shadow-md ${
                    reviewModal.decision === "APPROVE"
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "bg-rose-700 hover:bg-rose-800"
                  }`}
                >
                  {actionLoadingId ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Processing...
                    </span>
                  ) : reviewModal.decision === "APPROVE" ? (
                    isReturn ? "Approve & Initiate Refund" : "Confirm & Initiate Refund"
                  ) : (
                    "Confirm Rejection"
                  )}
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* ── Return Collection Management Modal ── */}
      {collectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="relative w-full max-w-md bg-white border border-[#e9ece6] rounded-3xl shadow-2xl z-10 p-6 space-y-4 text-left animate-in zoom-in-95 duration-200">
            <button
              onClick={() => !actionLoadingId && setCollectionModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Update Return Collection
                </h3>
                <p className="text-xs text-muted-foreground">Order #{collectionModal.item.orderId}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                <Clock className="h-3.5 w-3.5" />
                Target 5-Day Collection Deadline
              </p>
              <p className="text-[11px] leading-relaxed">
                Collection deadline:{" "}
                <strong>
                  {collectionModal.item.returnCollection?.collectionDeadline
                    ? new Date(collectionModal.item.returnCollection.collectionDeadline).toLocaleDateString("en-IN")
                    : "Within 5 days of approval"}
                </strong>
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Collection Status
                </label>
                <select
                  value={collectionModal.status}
                  onChange={(e: any) => setCollectionModal({ ...collectionModal, status: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
                >
                  <option value="COLLECTION_PENDING">Collection Pending</option>
                  <option value="SCHEDULED">Collection Scheduled</option>
                  <option value="COLLECTED">Product Collected</option>
                  <option value="INSPECTION_PENDING">Inspection Pending</option>
                  <option value="RETURNED_TO_SELLER">Returned to Seller</option>
                  <option value="FAILED">Collection Failed / Delayed</option>
                </select>
              </div>

              {collectionModal.status === "SCHEDULED" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Scheduled Pickup Date
                  </label>
                  <input
                    type="date"
                    value={collectionModal.scheduledAt}
                    onChange={(e) => setCollectionModal({ ...collectionModal, scheduledAt: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              )}

              {collectionModal.status === "FAILED" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                    Failure / Delay Reason <span className="text-rose-500">*</span>
                  </label>
                  <Textarea
                    value={collectionModal.failureReason}
                    onChange={(e) => setCollectionModal({ ...collectionModal, failureReason: e.target.value })}
                    placeholder="Describe why collection could not be completed..."
                    className="text-xs bg-rose-50/40 border-rose-200 min-h-[70px] rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Internal Notes & Logistics Update
                </label>
                <Textarea
                  value={collectionModal.notes}
                  onChange={(e) => setCollectionModal({ ...collectionModal, notes: e.target.value })}
                  placeholder="Optional notes regarding courier or warehouse..."
                  className="text-xs bg-slate-50 border-slate-200 min-h-[70px] rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                disabled={Boolean(actionLoadingId)}
                onClick={() => setCollectionModal(null)}
                className="flex-1 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                disabled={Boolean(actionLoadingId)}
                onClick={handleUpdateCollectionStatus}
                className="flex-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-md"
              >
                {actionLoadingId ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating...
                  </span>
                ) : (
                  "Save & Notify"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Inspection / Audit Modal (Comprehensive Section 2 Details) ── */}
      {inspectItem && (() => {
        const isReturn = inspectItem.type === "RETURN";
        const returnColl = inspectItem.returnCollection;
        const deliveryDate = inspectItem.deliveredAt || inspectItem.order?.deliveredAt || inspectItem.order?.timeline?.find((t: any) => t.status === "DELIVERED")?.createdAt;
        const refundAmt = Number(inspectItem.refundAmount || inspectItem.order?.totalAmount || 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="relative w-full max-w-3xl bg-white border border-[#e9ece6] rounded-3xl shadow-2xl z-10 p-6 space-y-5 text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setInspectItem(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-9 w-9 rounded-xl bg-[#1a3321] text-white flex items-center justify-center">
                    <FileText className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Audit Inspection — Order #{inspectItem.orderId}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {isReturn ? "Delivered Order Return" : "Pre-Shipment Cancellation"} • Record ID: {inspectItem.id}
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. ORDER DETAILS */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  1. Order Details
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Order ID</span>
                    <p className="font-mono font-bold text-slate-800">#{inspectItem.orderId}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Order Date & Time</span>
                    <p className="font-semibold text-slate-800">
                      {new Date(inspectItem.order?.createdAt || inspectItem.requestedAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Delivery Date & Time</span>
                    <p className="font-semibold text-slate-800">
                      {deliveryDate ? new Date(deliveryDate).toLocaleString("en-IN") : "N/A (Not Delivered)"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Request Date</span>
                    <p className="font-semibold text-slate-800">
                      {new Date(inspectItem.requestedAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Order Status</span>
                    <Badge variant="outline" className="text-[9px] mt-0.5">{inspectItem.order?.status || "UNKNOWN"}</Badge>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Request Status</span>
                    <Badge variant={inspectItem.status === "APPROVED" ? "success" : inspectItem.status === "REJECTED" ? "danger" : "accent"} className="text-[9px] mt-0.5">
                      {inspectItem.status}
                    </Badge>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Request Policy Route</span>
                    <p className="font-semibold text-slate-800">
                      {isReturn
                        ? "7-Day Return Policy (Delivered)"
                        : inspectItem.isAutoApproved
                          ? "24-Hour Auto-Approved (Pre-Shipment)"
                          : "3-Day Review Policy (Pre-Shipment)"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. CUSTOMER & SELLER DETAILS */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  2. Customer & Seller Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-800 uppercase font-extrabold flex items-center gap-1">
                      <User className="h-3 w-3" /> Customer Profile
                    </span>
                    <p><strong>Name:</strong> {inspectItem.order?.user?.name || "Customer"}</p>
                    <p><strong>Customer ID:</strong> <span className="font-mono text-[11px]">{inspectItem.order?.user?.id || inspectItem.order?.userId || "N/A"}</span></p>
                    <p><strong>Email:</strong> {inspectItem.order?.user?.email || inspectItem.requestedByEmail}</p>
                    <p><strong>Phone:</strong> {inspectItem.order?.user?.phone || inspectItem.order?.address?.phone || "N/A"}</p>
                  </div>
                  <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-3 pt-2 sm:pt-0">
                    <span className="text-[10px] text-[#1a3321] uppercase font-extrabold flex items-center gap-1">
                      <Store className="h-3 w-3" /> Seller Information
                    </span>
                    <p><strong>Seller Name:</strong> {inspectItem.order?.seller?.companyName || inspectItem.order?.items?.[0]?.product?.seller?.companyName || "Earth Centric Seller"}</p>
                    <p><strong>Seller ID:</strong> <span className="font-mono text-[11px]">{inspectItem.order?.sellerId || inspectItem.order?.items?.[0]?.product?.sellerId || "N/A"}</span></p>
                    <p><strong>Contact:</strong> {inspectItem.order?.seller?.phone || "Provided upon dispatch"}</p>
                  </div>
                </div>
              </div>

              {/* 3. PRODUCT DETAILS */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  3. Product Details & Returned Items
                </span>
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/40 p-3 max-h-48 overflow-y-auto">
                  {(inspectItem.order?.items || []).map((it: any, idx: number) => {
                    const sku = it.product?.slug || it.product?.sku || it.productId.slice(0, 8).toUpperCase();

                    return (
                      <div key={idx} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-xs">
                        <div className="flex items-center gap-2.5">
                          {it.product?.images?.[0]?.url ? (
                            <img src={it.product.images[0].url} alt="" className="h-9 w-9 rounded-lg object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-slate-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-800">{it.product?.name || "Product"}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Product ID: <span className="font-mono">{it.productId.slice(0, 10)}</span> • SKU: <span className="font-mono">{sku}</span>
                            </p>
                            <p className="text-[10px] text-slate-600">
                              Unit Price: ₹{it.price} • Purchased Qty: {it.quantity}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block">
                            ₹{(it.quantity * it.price).toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-semibold">
                            Qty Returned: {it.quantity}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. PAYMENT & REFUND DETAILS */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  4. Payment & Cashfree Refund Details
                </span>
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Original Paid Amount</span>
                      <p className="font-extrabold text-slate-800 text-sm mt-0.5">
                        ₹{Number(inspectItem.order?.totalAmount || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Refundable Amount</span>
                      <p className="font-extrabold text-emerald-800 text-sm mt-0.5">
                        ₹{refundAmt.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Cashfree Payment Ref</span>
                      <p className="font-mono text-[11px] text-slate-800 mt-0.5">
                        {inspectItem.order?.payment?.cfPaymentId || inspectItem.order?.payment?.orderId || "CF_REF_PAID"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Refund Status</span>
                      <Badge variant={inspectItem.refundStatus === "SUCCESS" ? "success" : inspectItem.refundStatus === "FAILED" ? "danger" : "primary"} className="text-[9px] mt-0.5">
                        {inspectItem.refundStatus}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-emerald-100 text-[11px]">
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Cashfree Refund ID</span>
                      <p className="font-mono text-slate-800 mt-0.5">
                        {inspectItem.cashfreeRefundReference || "Not yet generated"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Refund Initiation Date</span>
                      <p className="text-slate-800 mt-0.5">
                        {inspectItem.reviewedAt ? new Date(inspectItem.reviewedAt).toLocaleString("en-IN") : "Pending Approval"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Bank ARN</span>
                      <p className="font-mono text-slate-800 mt-0.5">
                        {inspectItem.refundArn || "N/A"}
                      </p>
                    </div>
                  </div>

                  {inspectItem.refundError && (
                    <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                      <strong>Gateway error:</strong> {inspectItem.refundError}
                    </p>
                  )}
                </div>
              </div>

              {/* 5. RETURN COLLECTION DETAILS (if Return) */}
              {isReturn && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      5. Return Collection Details
                    </span>
                    {inspectItem.status === "APPROVED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCollectionModal({
                            item: inspectItem,
                            status: returnColl?.status || "COLLECTION_PENDING",
                            notes: returnColl?.notes || "",
                            failureReason: returnColl?.failureReason || "",
                            scheduledAt: returnColl?.scheduledAt ? new Date(returnColl.scheduledAt).toISOString().split("T")[0] : "",
                          })
                        }
                        className="h-6 text-[10px] border-emerald-300 text-emerald-800 hover:bg-emerald-50 px-2 rounded-lg gap-1"
                      >
                        <Truck className="h-3 w-3 text-emerald-700" />
                        Update Collection Status
                      </Button>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold block">Collection Status</span>
                        <Badge variant="primary" className="text-[9px] mt-0.5">
                          {returnColl?.status?.replace(/_/g, " ") || "Pending Approval"}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold block">Target 5-Day Deadline</span>
                        <p className="font-bold text-slate-800 mt-0.5">
                          {returnColl?.collectionDeadline
                            ? new Date(returnColl.collectionDeadline).toLocaleDateString("en-IN")
                            : "Within 5 days of approval"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold block">Scheduled Pickup</span>
                        <p className="text-slate-800 mt-0.5">
                          {returnColl?.scheduledAt ? new Date(returnColl.scheduledAt).toLocaleDateString("en-IN") : "Not scheduled"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold block">Collected At</span>
                        <p className="text-slate-800 mt-0.5">
                          {returnColl?.collectedAt ? new Date(returnColl.collectedAt).toLocaleDateString("en-IN") : "Pending collection"}
                        </p>
                      </div>
                    </div>

                    {returnColl?.failureReason && (
                      <p className="text-[11px] text-rose-800 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        <strong>Collection Failure Reason:</strong> {returnColl.failureReason}
                      </p>
                    )}

                    {returnColl?.notes && (
                      <p className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                        <strong>Logistics Notes:</strong> {returnColl.notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 6. REASON & DECISION HISTORY */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Customer Reason</span>
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 font-medium">
                  "{inspectItem.reason}"
                </div>
              </div>

              {inspectItem.reviewedAt && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Decision History</span>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <p>
                      <strong>Decision:</strong> {inspectItem.status} on {new Date(inspectItem.reviewedAt).toLocaleString("en-IN")}
                    </p>
                    <p><strong>Reviewer:</strong> {inspectItem.reviewedByEmail || "Super Admin"}</p>
                    {inspectItem.adminNote && <p><strong>Admin Note:</strong> {inspectItem.adminNote}</p>}
                    {inspectItem.rejectionReason && (
                      <p className="text-rose-700"><strong>Rejection Reason:</strong> {inspectItem.rejectionReason}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button variant="outline" onClick={() => setInspectItem(null)} className="text-xs rounded-xl">
                  Close Audit View
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
