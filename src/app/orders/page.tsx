"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getOrdersByUser, OrderDetail } from "@/actions/orders";
import { Card, Badge, Button } from "@/components/ui/shared";
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
  HelpCircle
} from "lucide-react";

export default function UserOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const data = await getOrdersByUser(user.id);
        setOrders(data);
      } catch (err: any) {
        console.error("Failed to load user orders:", err);
        setError("Could not retrieve your orders. Please try again.");
      } finally {
        setLoading(false);
      }
    });
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

              {/* Order Items */}
              <div className="p-6 divide-y divide-border/30">
                {order.items.map((item, index) => (
                  <div key={index} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-100 bg-slate-50"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
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
                  </div>
                ))}
              </div>

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
    </div>
  );
}
