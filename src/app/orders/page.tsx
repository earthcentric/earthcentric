"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { cancelOrder, getOrdersByUser, OrderDetail } from "@/actions/orders";
import { addProductReview, getReviewedProductIds } from "@/actions/products";
import { toast } from "sonner";
import { Card, Badge, Button, Textarea } from "@/components/ui/shared";
import { 
  ShoppingBag, 
  Loader2, 
  CheckCircle2, 
  Truck, 
  Calendar, 
  ArrowRight, 
  Clock, 
  Leaf, 
  AlertCircle,
  Package,
  XCircle,
  HelpCircle,
  Star,
  X,
  Zap,
  AlertTriangle,
  RotateCcw,
  Info
} from "lucide-react";

export default function UserOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Product Review Modal State
  const [reviewModalProduct, setReviewModalProduct] = useState<{ id: string; name: string; image: string } | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewedProductStatus, setReviewedProductStatus] = useState<{
    userId: string | null;
    productIds: Set<string>;
  }>({ userId: null, productIds: new Set() });
  // Cancellation Modal State
  const [cancellationModalOrder, setCancellationModalOrder] = useState<OrderDetail | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const REASON_PRESETS = [
    "Ordered by mistake",
    "Found alternative product",
    "Delivery timeframe too long",
    "Incorrect shipping address",
    "Need to modify items",
    "Changed my mind",
  ];

  const handleOpenCancellationModal = (order: OrderDetail) => {
    setCancellationModalOrder(order);
    setCancellationReason("");
  };

  const handleConfirmCancellation = async () => {
    if (!user || !cancellationModalOrder) return;
    const trimmed = cancellationReason.trim();
    if (trimmed.length < 8 || trimmed.length > 500) {
      toast.error("Please provide a reason between 8 and 500 characters.");
      return;
    }

    setCancellingOrderId(cancellationModalOrder.id);
    try {
      const result = await cancelOrder(cancellationModalOrder.id, user.id, trimmed);
      if (!result.success) {
        toast.error(result.error || "Could not submit the cancellation request.");
        return;
      }

      if (result.autoApproved) {
        toast.success("⚡ Order cancelled! A full refund has been initiated to your original payment method.");
      } else {
        toast.success("Cancellation request submitted to Super Admin for prompt review.");
      }

      setCancellationModalOrder(null);
      setCancellationReason("");

      // Refresh orders
      const data = await getOrdersByUser(user.id);
      setOrders(data.filter((item) => item.paymentStatus === "COMPLETED"));
    } catch (requestError) {
      console.error("Failed to cancel order:", requestError);
      toast.error("Could not process your cancellation request. Please try again.");
    } finally {
      setCancellingOrderId(null);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadPaidOrders = async (includeReviewStatus = false) => {
      try {
        setError(null);
        const data = await getOrdersByUser(user.id);
        if (!isMounted) return;
        // Strictly filter to only display orders where payment is successful/done
        const paidOnly = data.filter((o) => o.paymentStatus === "COMPLETED");
        setOrders(paidOnly);
        if (includeReviewStatus) {
          const productIds = [...new Set(paidOnly.flatMap((order) => order.items.map((item) => item.productId)))];
          const reviewedIds = await getReviewedProductIds(user.id, productIds);
          if (isMounted) setReviewedProductStatus({ userId: user.id, productIds: new Set(reviewedIds) });
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Failed to load user orders:", err);
        setError("Could not retrieve your orders. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPaidOrders(true);

    // Poll periodically so when seller updates the order tracking, it immediately reflects on buyer portal
    const interval = setInterval(() => loadPaidOrders(), 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, authLoading]);

  // Status mapping to color/badge variants and text description
  const getStatusBadge = (status: OrderDetail["status"]) => {
    switch (status) {
      case "PLACED":
        return (
          <Badge variant="outline" className="text-slate-500 bg-slate-50 border-slate-200 gap-1.5 py-1">
            <Clock className="w-3.5 h-3.5" /> Placed
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge variant="primary" className="gap-1.5 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
          </Badge>
        );
      case "PACKED":
        return (
          <Badge variant="accent" className="gap-1.5 py-1">
            <Package className="w-3.5 h-3.5 text-amber-600" /> Packed
          </Badge>
        );
      case "SHIPPED":
        return (
          <Badge variant="premium" className="gap-1.5 py-1">
            <Truck className="w-3.5 h-3.5 text-indigo-600" /> Shipped
          </Badge>
        );
      case "DELIVERED":
        return (
          <Badge variant="success" className="gap-1.5 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Delivered
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="danger" className="gap-1.5 py-1">
            <XCircle className="w-3.5 h-3.5 text-red-600" /> Cancelled
          </Badge>
        );
      case "REFUNDED":
        return (
          <Badge variant="success" className="gap-1.5 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Refunded
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5 py-1">
            <HelpCircle className="w-3.5 h-3.5" /> {status}
          </Badge>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading your order history...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md text-center py-20 px-4 space-y-6">
        <div className="inline-flex p-4 rounded-full bg-slate-100 text-slate-400">
          <ShoppingBag className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Access Denied</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Please log in to view your orders, track shipment status, and check your purchase history.
          </p>
        </div>
        <Link href="/auth/login">
          <Button variant="cool" className="w-full">
            Log In to Your Account
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-6 gap-4">
        <div className="space-y-1">
          <Badge variant="primary" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
            🌿 Carbon-Neutral Operations
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">My Orders</h1>
          <p className="text-sm text-muted-foreground">
            Track current shipments, check payment status, and view past purchases.
          </p>
        </div>
        <Link href="/marketplace">
          <Button variant="cool" size="sm">
            Browse Marketplace
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-100 text-red-700 flex gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {orders.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-slate-200 bg-slate-50/50">
          <div className="p-4 rounded-full bg-emerald-50 text-emerald-600 mb-4">
            <Leaf className="w-10 h-10 animate-bounce" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No orders found</h3>
          <p className="text-sm text-slate-500 max-w-md mt-2 mb-6">
            You haven't placed any orders yet. Visit our marketplace to explore sustainable and eco-friendly products curated directly from trusted brand catalogs.
          </p>
          <Link href="/marketplace">
            <Button variant="cool">
              Browse Marketplace
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow duration-200">
              {/* Order Card Header */}
              <div className="bg-slate-50 border-b border-border/40 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">Order #{order.id}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>
                      Placed on:{" "}
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span>
                      Payment:{" "}
                      <span className={`font-semibold ${
                        order.paymentStatus === "COMPLETED" ? "text-emerald-600" : "text-amber-600 animate-pulse"
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center sm:text-right">
                  <div className="text-sm">
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider font-semibold">Total Amount</span>
                    <span className="font-extrabold text-slate-800 text-lg">₹{order.totalAmount.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* Cancellation status card */}
              {order.cancellation && (
                <div className={`px-6 py-4 border-b text-xs space-y-2 ${
                  order.cancellation.status === "APPROVED"
                    ? "bg-emerald-50/60 border-emerald-100"
                    : order.cancellation.status === "REJECTED"
                      ? "bg-rose-50/60 border-rose-100"
                      : "bg-amber-50/70 border-amber-100"
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {order.cancellation.status === "APPROVED" ? (
                        <Badge variant="success" className="gap-1 text-[11px] py-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cancellation Approved
                        </Badge>
                      ) : order.cancellation.status === "REJECTED" ? (
                        <Badge variant="danger" className="gap-1 text-[11px] py-0.5">
                          <XCircle className="w-3.5 h-3.5" /> Cancellation Rejected
                        </Badge>
                      ) : (
                        <Badge variant="accent" className="gap-1 text-[11px] py-0.5">
                          <Clock className="w-3.5 h-3.5" /> Cancellation Pending Admin Review
                        </Badge>
                      )}
                      {order.cancellation.isAutoApproved && (
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-1 py-0.5">
                          <Zap className="w-3 h-3 text-emerald-600" /> Instant 24h Approval
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Requested {new Date(order.cancellation.requestedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>

                  <p className="text-slate-800">
                    <span className="font-semibold text-slate-700">Reason:</span> {order.cancellation.reason}
                  </p>

                  {order.cancellation.rejectionReason && (
                    <div className="p-2.5 rounded-lg bg-rose-100/70 text-rose-900 border border-rose-200/60">
                      <p className="font-semibold text-[11px] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Admin Rejection Reason:
                      </p>
                      <p className="mt-0.5 text-rose-800">{order.cancellation.rejectionReason}</p>
                      <p className="mt-1 text-[10px] text-rose-700 italic">Your order remains active and will continue towards delivery as scheduled.</p>
                    </div>
                  )}

                  {order.cancellation.adminNote && !order.cancellation.rejectionReason && (
                    <p className="text-slate-700">
                      <span className="font-semibold">Admin update:</span> {order.cancellation.adminNote}
                    </p>
                  )}

                  {order.cancellation.status === "APPROVED" && (
                    <div className="mt-2 p-3 rounded-xl bg-white/80 border border-emerald-200/60 shadow-xs space-y-1.5 text-slate-700">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-emerald-100">
                        <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600" /> Refund Status
                        </span>
                        {order.cancellation.refundStatus === "SUCCESS" ? (
                          <Badge variant="success" className="gap-1 text-[10px] py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Refund Completed
                          </Badge>
                        ) : order.cancellation.refundStatus === "PENDING" ? (
                          <Badge variant="primary" className="gap-1 text-[10px] py-0.5">
                            <Loader2 className="w-3 h-3 animate-spin" /> Refund Processing
                          </Badge>
                        ) : order.cancellation.refundStatus === "FAILED" ? (
                          <Badge variant="danger" className="gap-1 text-[10px] py-0.5">
                            <AlertCircle className="w-3 h-3" /> Refund Delayed / Failed
                          </Badge>
                        ) : order.cancellation.refundStatus === "PENDING_PAYMENT" ? (
                          <Badge variant="outline" className="gap-1 text-[10px] py-0.5">
                            <Clock className="w-3 h-3" /> Awaiting Payment Capture
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0.5">
                            {order.cancellation.refundStatus.replaceAll("_", " ")}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Refund Amount</span>
                          <span className="font-extrabold text-emerald-700 text-sm">
                            ₹{(order.cancellation.refundAmount ?? order.totalAmount).toLocaleString("en-IN")}
                          </span>
                        </div>
                        {order.cancellation.cashfreeRefundReference && (
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Cashfree Ref ID</span>
                            <span className="font-mono text-slate-800 text-[11px]">{order.cancellation.cashfreeRefundReference}</span>
                          </div>
                        )}
                        {order.cancellation.refundArn && (
                          <div className="sm:col-span-2">
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Bank ARN (Tracking Number)</span>
                            <span className="font-mono text-slate-800 text-[11px]">{order.cancellation.refundArn}</span>
                          </div>
                        )}
                      </div>

                      {order.cancellation.refundStatus === "PENDING" && (
                        <p className="text-[11px] text-slate-600 bg-emerald-50/50 p-2 rounded-lg">
                          Cashfree is processing your refund. Funds typically reflect in your original payment method within 3–5 business days.
                        </p>
                      )}
                      {order.cancellation.refundStatus === "FAILED" && (
                        <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg">
                          {order.cancellation.refundError || "Refund could not be confirmed automatically. Our Super Admin team has been notified to re-attempt."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Order Items */}
              <div className="p-6 divide-y divide-border/30">
                {order.items.map((item, index) => (
                  <div key={index} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-100 bg-slate-50 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{item.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} × ₹{item.price.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    {/* Review Button for Delivered Products Only */}
                    {order.status === "DELIVERED" &&
                    reviewedProductStatus.userId === user?.id &&
                    reviewedProductStatus.productIds.has(item.productId) ? (
                      <span className="text-emerald-700 text-xs font-semibold">Review submitted</span>
                    ) : order.status === "DELIVERED" ? (
                      <button
                        onClick={() => {
                          setReviewModalProduct({ id: item.productId, name: item.name, image: item.image || "" });
                          setReviewRating(5);
                          setReviewComment("");
                        }}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 shrink-0"
                      >
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>Write Review</span>
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Shipped block notice */}
              {order.status === "SHIPPED" && (
                <div className="px-6 py-3 bg-amber-50/60 border-t border-amber-100 flex items-center gap-2.5 text-xs text-amber-800">
                  <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold">This order cannot be cancelled because it has already been shipped.</span>
                </div>
              )}

              {/* Cancellation Action Button for eligible pre-shipment orders */}
              {["PLACED", "CONFIRMED", "PACKED"].includes(order.status) &&
                (!order.cancellation || order.cancellation.status === "REJECTED") && (
                  <div className="px-6 py-3.5 bg-slate-50/40 border-t border-border/20 flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                      Eligible for pre-dispatch cancellation
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 text-xs font-semibold gap-1.5"
                      onClick={() => handleOpenCancellationModal(order)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Cancel Order
                    </Button>
                  </div>
                )}

              {/* Action Footer */}
              <div className="bg-slate-50/50 border-t border-border/20 px-6 py-3.5 flex justify-end">
                <Link href={`/orders/${order.id}`}>
                  <Button variant="outline" size="sm" className="gap-2 font-semibold text-slate-700 hover:text-slate-900">
                    Track & Details <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Write Review Modal for Delivered Products */}
      {reviewModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 border border-slate-100 text-left animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setReviewModalProduct(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
              <img
                src={reviewModalProduct.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=200"}
                alt={reviewModalProduct.name}
                className="h-12 w-12 object-cover rounded-xl border border-slate-200 shrink-0"
              />
              <div>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                  ✓ Verified Delivery Review
                </span>
                <h3 className="font-extrabold text-sm text-slate-800 line-clamp-1 mt-0.5">
                  {reviewModalProduct.name}
                </h3>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!user?.id || !reviewComment.trim()) return;
                setSubmittingReview(true);
                try {
                  const res = await addProductReview({
                    userId: user.id,
                    productId: reviewModalProduct.id,
                    rating: reviewRating,
                    comment: reviewComment,
                  });
                  if (res.success) {
                    toast.success("Thank you! Your verified purchase review has been submitted. ⭐");
                    setReviewedProductStatus((current) => ({
                      userId: user.id,
                      productIds: new Set(
                        current.userId === user.id ? current.productIds : []
                      ).add(reviewModalProduct.id),
                    }));
                    setReviewModalProduct(null);
                  } else {
                    toast.error(res.error || "Failed to submit review.");
                  }
                } catch (error) {
                  console.error("Failed to submit review from order history:", error);
                  toast.error("Could not submit your review. Please try again.");
                } finally {
                  setSubmittingReview(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Rating</span>
                <div className="flex space-x-1.5 pt-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setReviewRating(val)}
                      className="focus:outline-none cursor-pointer border-none bg-transparent"
                    >
                      <Star
                        className={`h-7 w-7 transition-all ${
                          val <= reviewRating ? "fill-amber-400 text-amber-400 scale-110" : "text-slate-200"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Review Comments</span>
                <Textarea
                  placeholder="How was the quality, packaging, and eco-friendliness of this product?"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  required
                  className="text-xs bg-slate-50 border-slate-200 min-h-[90px] rounded-xl focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full h-11 bg-[#0c3c26] hover:bg-[#082b1b] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer border-none flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {submittingReview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Submit Verified Review ⭐</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modern Order Cancellation Confirmation Modal */}
      {cancellationModalOrder && (() => {
        const orderAgeHours = (Date.now() - new Date(cancellationModalOrder.createdAt).getTime()) / (1000 * 60 * 60);
        const isAutoApprovable = orderAgeHours <= 24;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 border border-slate-100 text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => {
                  if (cancellingOrderId) return;
                  setCancellationModalOrder(null);
                  setCancellationReason("");
                }}
                disabled={Boolean(cancellingOrderId)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                    <RotateCcw className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Cancel Order #{cancellationModalOrder.id}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Placed on {new Date(cancellationModalOrder.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Policy Indicator */}
              {isAutoApprovable ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                    <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>⚡ Instant 24-Hour Approval Eligible</span>
                  </div>
                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    This order was placed within the last 24 hours and has not been dispatched. Your cancellation will be processed automatically and your full refund of <strong className="font-bold">₹{cancellationModalOrder.totalAmount.toLocaleString("en-IN")}</strong> will be initiated via Cashfree to your original payment method.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
                    <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>⏳ Standard Super Admin Review (&gt; 24 Hours)</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    This order was placed over 24 hours ago. In accordance with Earth Centric policy, your request will be reviewed by our Super Admin team within 24–48 business hours to confirm supplier fulfillment status.
                  </p>
                </div>
              )}

              {/* Items summary */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Order Items</span>
                <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto rounded-xl border border-slate-100 p-2 bg-slate-50/50">
                  {cancellationModalOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 text-xs">
                      <div className="flex items-center gap-2.5">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-9 w-9 object-cover rounded-lg border border-slate-200 shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-slate-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-800 line-clamp-1">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-700">₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refund summary banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700">Total Refund Amount</span>
                <span className="font-extrabold text-emerald-700 text-base">
                  ₹{cancellationModalOrder.totalAmount.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Reason Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quick Reason</span>
                <div className="flex flex-wrap gap-1.5">
                  {REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCancellationReason(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                        cancellationReason === preset
                          ? "bg-[#0c3c26] text-white border-[#0c3c26] shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Detailed Reason <span className="text-rose-500">*</span>
                  </span>
                  <span className={`text-[10px] font-semibold ${
                    cancellationReason.trim().length >= 8 && cancellationReason.trim().length <= 500
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}>
                    {cancellationReason.trim().length}/500 chars {cancellationReason.trim().length < 8 ? `(${8 - cancellationReason.trim().length} more needed)` : "✓"}
                  </span>
                </div>
                <Textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Please describe why you wish to cancel this order (minimum 8 characters)..."
                  className="text-xs bg-slate-50 border-slate-200 min-h-[85px] rounded-xl focus:bg-white"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(cancellingOrderId)}
                  onClick={() => {
                    setCancellationModalOrder(null);
                    setCancellationReason("");
                  }}
                  className="flex-1 rounded-xl text-xs"
                >
                  Keep Order
                </Button>
                <Button
                  type="button"
                  disabled={
                    cancellationReason.trim().length < 8 ||
                    cancellationReason.trim().length > 500 ||
                    Boolean(cancellingOrderId)
                  }
                  onClick={handleConfirmCancellation}
                  className={`flex-1 rounded-xl text-xs font-bold text-white shadow-md ${
                    isAutoApprovable
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "bg-[#0c3c26] hover:bg-[#082b1b]"
                  }`}
                >
                  {cancellingOrderId ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Processing...
                    </span>
                  ) : isAutoApprovable ? (
                    "Confirm & Auto-Refund"
                  ) : (
                    "Submit for Review"
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
