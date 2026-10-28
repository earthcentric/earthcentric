"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelOrder } from "@/actions/orders";
import { Button, Badge, Textarea } from "@/components/ui/shared";
import { RotateCcw, Clock, X, Loader2, AlertCircle, ShieldAlert } from "lucide-react";

interface OrderCancellationActionProps {
  orderId: string;
  orderStatus: string;
  createdAt: string | Date;
  totalAmount: number;
  userId?: string;
}

export function OrderCancellationAction({
  orderId,
  orderStatus,
  createdAt,
  totalAmount,
  userId,
}: OrderCancellationActionProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const orderAgeHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  const isWithin3Days = orderAgeHours <= 72;
  const daysLeft = Math.max(0, Math.ceil((72 - orderAgeHours) / 24));
  const isPreShipment = ["PLACED", "CONFIRMED", "PACKED"].includes(orderStatus);

  if (!isPreShipment) {
    return null;
  }

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

    setSubmitting(true);
    try {
      const res = await cancelOrder(orderId, userId, trimmed);
      if (!res.success) {
        toast.error(res.error || "Could not submit cancellation request.");
        return;
      }
      toast.success("Cancellation request submitted to Super Admin for approval. Refund will be processed upon approval.");
      setIsOpen(false);
      setReason("");
      router.refresh();
    } catch (err: any) {
      console.error("Order cancellation error:", err);
      toast.error(err.message || "Failed to submit cancellation request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {isWithin3Days ? (
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
                <span className="h-9 w-9 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <RotateCcw className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Cancel Order #{orderId}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Placed on {new Date(createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })} • {daysLeft} day(s) remaining in 3-day window
                  </p>
                </div>
              </div>
            </div>

            {/* Policy Info Card */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                <Clock className="h-4 w-4 text-amber-700 shrink-0" />
                <span>3-Day Cancellation Policy • Super Admin Review Required</span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Orders can be cancelled within 3 days of placement before shipment. Refunds are not automated — your request will be reviewed by our Super Admin. Once the Super Admin accepts your cancellation request, your full refund of <strong className="font-bold">₹{totalAmount.toLocaleString("en-IN")}</strong> will be processed to your original payment method.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Reason for Cancellation <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  placeholder="Please describe why you wish to cancel this order (minimum 8 characters)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={submitting}
                  required
                  className="text-xs bg-slate-50 border-slate-200 min-h-[100px] rounded-xl focus:bg-white"
                />
                <span className="text-[10px] text-muted-foreground block text-right">
                  {reason.length}/500 characters
                </span>
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
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl gap-1.5 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Submit Cancellation Request
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
