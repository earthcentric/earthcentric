"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelOrder } from "@/actions/orders";
import { Button, Badge, Textarea } from "@/components/ui/shared";
import { RotateCcw, Clock, X, Loader2, AlertCircle, PackageCheck, Package, CheckSquare, Square } from "lucide-react";

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  sku?: string;
}

interface OrderCancellationActionProps {
  orderId: string;
  orderStatus: string;
  createdAt: string | Date;
  deliveredAt?: string | Date | null;
  totalAmount: number;
  userId?: string;
  items?: OrderItem[];
}

export function OrderCancellationAction({
  orderId,
  orderStatus,
  createdAt,
  deliveredAt,
  totalAmount,
  userId,
  items = [],
}: OrderCancellationActionProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selected items for return (default all items selected)
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    items.forEach((it) => {
      init[it.productId] = true;
    });
    return init;
  });

  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    items.forEach((it) => {
      init[it.productId] = it.quantity;
    });
    return init;
  });

  const isDelivered = orderStatus === "DELIVERED";
  const isPreShipment = ["PLACED", "CONFIRMED", "PACKED"].includes(orderStatus);

  if (!isPreShipment && !isDelivered) {
    return null;
  }

  // Pre-shipment: 3-day policy (72 hours)
  const orderAgeHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  const isWithin3Days = orderAgeHours <= 72;
  const daysLeftPreShipment = Math.max(0, Math.ceil((72 - orderAgeHours) / 24));

  // Delivered: 7-day policy from delivery date
  const deliveryDateObj = deliveredAt ? new Date(deliveredAt) : new Date(createdAt);
  const daysSinceDelivery = (Date.now() - deliveryDateObj.getTime()) / (1000 * 60 * 60 * 24);
  const isWithin7Days = daysSinceDelivery <= 7;
  const daysLeftReturn = Math.max(0, Math.ceil(7 - daysSinceDelivery));

  // Calculate refundable amount
  const computedRefundAmount = useMemo(() => {
    if (!isDelivered || items.length === 0) {
      return totalAmount;
    }
    let sum = 0;
    for (const item of items) {
      if (selectedItems[item.productId]) {
        const qty = itemQuantities[item.productId] ?? item.quantity;
        sum += item.price * qty;
      }
    }
    return sum > 0 ? sum : totalAmount;
  }, [isDelivered, items, selectedItems, itemQuantities, totalAmount]);

  const RETURN_REASON_PRESETS = [
    "Product damaged or defective",
    "Item not as described",
    "Received wrong product",
    "Quality not as expected",
    "Packaging unsealed / broken",
    "Changed mind / No longer needed",
  ];

  const CANCELLATION_REASON_PRESETS = [
    "Ordered by mistake",
    "Found alternative product",
    "Delivery timeframe too long",
    "Incorrect shipping address",
    "Need to modify items",
    "Changed my mind",
  ];

  const presets = isDelivered ? RETURN_REASON_PRESETS : CANCELLATION_REASON_PRESETS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 8) {
      toast.error("Please provide a reason of at least 8 characters.");
      return;
    }
    if (trimmed.length > 500) {
      toast.error("Reason cannot exceed 500 characters.");
      return;
    }

    // If delivered and multi-item, verify at least one item selected
    let selectedProductIds: string[] | undefined;
    let selectedQuantities: Record<string, number> | undefined;
    if (isDelivered && items.length > 0) {
      const selected = Object.keys(selectedItems).filter((id) => selectedItems[id]);
      if (selected.length === 0) {
        toast.error("Please select at least one item to return.");
        return;
      }
      selectedProductIds = selected;
      selectedQuantities = {};
      for (const id of selected) {
        selectedQuantities[id] = itemQuantities[id] ?? 1;
      }
    }

    setSubmitting(true);
    try {
      const res = await cancelOrder(orderId, userId, trimmed, {
        selectedProductIds,
        itemQuantities: selectedQuantities,
      });

      if (!res.success) {
        toast.error(res.error || `Could not submit ${isDelivered ? "return" : "cancellation"} request.`);
        return;
      }

      toast.success(
        isDelivered
          ? "Return request submitted to Super Admin. Our team will arrange collection within 5 days upon approval."
          : "Cancellation request submitted to Super Admin for approval. Refund will be processed upon approval."
      );
      setIsOpen(false);
      setReason("");
      router.refresh();
    } catch (err: any) {
      console.error("Order action error:", err);
      toast.error(err.message || `Failed to submit ${isDelivered ? "return" : "cancellation"} request.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {isDelivered ? (
          isWithin7Days ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold gap-1.5 transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
              Request Return / Cancellation
            </Button>
          ) : (
            <Badge variant="outline" className="text-xs text-slate-400 bg-slate-50 border-slate-200 py-1 gap-1">
              <Clock className="w-3 h-3 text-slate-400" /> 7-day return policy expired
            </Badge>
          )
        ) : isWithin3Days ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 text-xs font-semibold gap-1.5 transition-all shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Cancel Order
          </Button>
        ) : (
          <Badge variant="outline" className="text-xs text-slate-400 bg-slate-50 border-slate-200 py-1 gap-1">
            <Clock className="w-3 h-3 text-slate-400" /> 3-day cancellation window passed
          </Badge>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 border border-slate-100 text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                if (submitting) return;
                setIsOpen(false);
                setReason("");
              }}
              disabled={submitting}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  isDelivered ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"
                }`}>
                  <RotateCcw className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {isDelivered ? `Return Order #${orderId}` : `Cancel Order #${orderId}`}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isDelivered
                      ? `Delivered on ${deliveryDateObj.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })} • ${daysLeftReturn} day(s) remaining in 7-day return window`
                      : `Placed on ${new Date(createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })} • ${daysLeftPreShipment} day(s) remaining in 3-day window`}
                  </p>
                </div>
              </div>
            </div>

            {/* Policy Info Card */}
            <div className={`p-4 rounded-2xl border space-y-1.5 ${
              isDelivered ? "bg-emerald-50/70 border-emerald-200 text-emerald-950" : "bg-amber-50 border-amber-200 text-amber-950"
            }`}>
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Clock className={`h-4 w-4 shrink-0 ${isDelivered ? "text-emerald-700" : "text-amber-700"}`} />
                <span>
                  {isDelivered
                    ? "7-Day Return Policy • 5-Day Collection Guarantee"
                    : "3-Day Cancellation Policy • Super Admin Review Required"}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {isDelivered
                  ? `Delivered orders can be returned within 7 days of delivery. Upon approval by our Super Admin, our team will arrange collection of the returned product within 5 days. Please keep the product and its original packaging ready. Your refund of ₹${computedRefundAmount.toLocaleString("en-IN")} will be processed to your original payment method via Cashfree.`
                  : `Orders can be cancelled within 3 days of placement before shipment. Refunds are not automated — your request will be reviewed by our Super Admin. Once approved, your full refund of ₹${totalAmount.toLocaleString("en-IN")} will be processed via Cashfree.`}
              </p>
            </div>

            {/* Item Selection for Delivered Orders with items */}
            {isDelivered && items.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Select Items to Return
                </span>
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-2 bg-slate-50/50">
                  {items.map((it) => {
                    const isChecked = Boolean(selectedItems[it.productId]);
                    const currentQty = itemQuantities[it.productId] ?? it.quantity;

                    return (
                      <div key={it.productId} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedItems((prev) => ({
                                ...prev,
                                [it.productId]: !isChecked,
                              }))
                            }
                            className="text-emerald-700 hover:text-emerald-800 bg-transparent border-none cursor-pointer p-0"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          {it.image ? (
                            <img src={it.image} alt={it.name} className="h-8 w-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-slate-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-800 line-clamp-1">{it.name}</p>
                            <p className="text-[10px] text-muted-foreground">₹{it.price.toLocaleString("en-IN")} each</p>
                          </div>
                        </div>

                        {isChecked && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-500">Qty:</span>
                            <select
                              value={currentQty}
                              onChange={(e) =>
                                setItemQuantities((prev) => ({
                                  ...prev,
                                  [it.productId]: Number(e.target.value),
                                }))
                              }
                              className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5"
                            >
                              {Array.from({ length: it.quantity }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Refund summary banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700">Estimated Refund Amount</span>
              <span className="font-extrabold text-emerald-700 text-base">
                ₹{computedRefundAmount.toLocaleString("en-IN")}
              </span>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Quick Reason
              </span>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      reason === preset
                        ? "bg-[#0c3c26] text-white border-[#0c3c26] shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">
                    Detailed Reason <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[10px] font-semibold ${
                    reason.trim().length >= 8 && reason.trim().length <= 500 ? "text-emerald-600" : "text-amber-600"
                  }`}>
                    {reason.trim().length}/500 chars {reason.trim().length < 8 ? `(${8 - reason.trim().length} more needed)` : "✓"}
                  </span>
                </div>
                <Textarea
                  placeholder={
                    isDelivered
                      ? "Please describe the reason for return (e.g. damaged seal, wrong size, minimum 8 characters)..."
                      : "Please describe why you wish to cancel this order (minimum 8 characters)..."
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={submitting}
                  required
                  className="text-xs bg-slate-50 border-slate-200 min-h-[90px] rounded-xl focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl"
                >
                  Keep Order
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || reason.trim().length < 8}
                  className={`text-white font-bold rounded-xl gap-1.5 shadow-sm ${
                    isDelivered ? "bg-emerald-700 hover:bg-emerald-800" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      {isDelivered ? "Submit Return Request" : "Submit Cancellation Request"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
