"use client";

import React, { useState, useEffect } from "react";
import { X, Phone, Calendar, Clock, MessageSquare, AlertCircle, RefreshCw, History, Check } from "lucide-react";
import { toast } from "sonner";
import { saveCustomerFeedback, saveAbandonedCheckoutFeedback, getCustomerFeedbackHistory } from "@/actions/worker";

const CALL_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "CALLED", label: "Called" },
  { value: "NOT_ANSWERED", label: "Call Not Answered" },
  { value: "UNREACHABLE", label: "Number Unreachable" },
  { value: "CALLBACK_REQUESTED", label: "Requested Callback" },
  { value: "FEEDBACK_RECEIVED", label: "Feedback Received" },
];

const ABANDONMENT_REASONS = [
  { value: "Payment Issue", label: "Payment Issue" },
  { value: "Product Price", label: "Product Price" },
  { value: "Delivery Charges", label: "Delivery Charges" },
  { value: "Technical Problem", label: "Technical Problem" },
  { value: "Changed Mind", label: "Changed Mind" },
  { value: "Other", label: "Other" },
];

export interface FeedbackModalTarget {
  id: string; // customerId or checkoutId
  userId?: string;
  name: string;
  email: string;
  phone?: string | null;
  customerType: "BUYER" | "SELLER" | "ABANDONED_CHECKOUT";
  initialStatus?: string | null;
  initialNotes?: string | null;
  initialReason?: string | null;
}

interface FeedbackModalProps {
  target: FeedbackModalTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FeedbackModal({ target, isOpen, onClose, onSuccess }: FeedbackModalProps) {
  const [callStatus, setCallStatus] = useState<string>("CALLED");
  const [feedbackNotes, setFeedbackNotes] = useState<string>("");
  const [workerNotes, setWorkerNotes] = useState<string>("");
  const [abandonmentReason, setAbandonmentReason] = useState<string>("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Historical feedback list
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  useEffect(() => {
    if (target && isOpen) {
      setCallStatus(target.initialStatus || "CALLED");
      setFeedbackNotes(target.initialNotes || "");
      setWorkerNotes("");
      setAbandonmentReason(target.initialReason || "Payment Issue");
      setNextFollowUpDate("");
      setShowHistory(false);

      // Fetch prior history
      const historyId = target.customerType === "ABANDONED_CHECKOUT" ? (target.userId || target.id) : target.id;
      setLoadingHistory(true);
      getCustomerFeedbackHistory(historyId)
        .then((res) => {
          if (res.success && res.feedbacks) {
            setHistory(res.feedbacks);
          }
        })
        .finally(() => setLoadingHistory(false));
    }
  }, [target, isOpen]);

  if (!isOpen || !target) return null;

  const isCheckout = target.customerType === "ABANDONED_CHECKOUT";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isCheckout) {
        const res = await saveAbandonedCheckoutFeedback({
          checkoutId: target.id,
          callStatus,
          feedbackNotes,
          workerNotes,
          abandonmentReason,
          nextFollowUpDate: nextFollowUpDate || undefined,
        });

        if (!res.success) {
          toast.error(res.error || "Failed to save feedback.");
          return;
        }
      } else {
        const res = await saveCustomerFeedback({
          customerId: target.id,
          customerType: target.customerType as "BUYER" | "SELLER",
          callStatus,
          feedbackNotes,
          workerNotes,
          nextFollowUpDate: nextFollowUpDate || undefined,
        });

        if (!res.success) {
          toast.error(res.error || "Failed to save feedback.");
          return;
        }
      }

      toast.success("Customer feedback recorded successfully!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#0F6E56]/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#0F6E56]/10 text-[#0F6E56] rounded-xl">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Log Customer Call Feedback
              </h3>
              <p className="text-xs text-slate-500">
                {target.name} ({target.email}) {target.phone ? `• ${target.phone}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Call Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Call Status <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CALL_STATUSES.map((status) => (
                <button
                  type="button"
                  key={status.value}
                  onClick={() => setCallStatus(status.value)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                    callStatus === status.value
                      ? "bg-[#0F6E56] text-white border-[#0F6E56] shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason for not completing purchase (Abandoned Checkout only) */}
          {isCheckout && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reason for Not Completing Purchase <span className="text-red-500">*</span>
              </label>
              <select
                value={abandonmentReason}
                onChange={(e) => setAbandonmentReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
              >
                {ABANDONMENT_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer Feedback Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Customer Feedback Notes
            </label>
            <textarea
              rows={3}
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              placeholder="Record customer's exact words, questions, objections, or compliments..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white resize-none"
            />
          </div>

          {/* Worker Internal Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Internal Worker Notes
            </label>
            <textarea
              rows={2}
              value={workerNotes}
              onChange={(e) => setWorkerNotes(e.target.value)}
              placeholder="Private notes for team follow-up..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white resize-none"
            />
          </div>

          {/* Next Follow-up Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Next Follow-up Date (Optional)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
              />
            </div>
          </div>

          {/* Previous History Accordion */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full text-xs font-bold text-[#0F6E56] hover:underline"
            >
              <span className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                <span>View Previous Call History ({history.length})</span>
              </span>
              <span>{showHistory ? "Hide" : "Show"}</span>
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                {loadingHistory ? (
                  <p className="text-xs text-slate-400 py-2 text-center">Loading history...</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 text-center">No prior call records found.</p>
                ) : (
                  history.map((h, i) => (
                    <div key={h.id || i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800">{h.callStatus}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(h.createdAt).toLocaleDateString()} {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {h.feedbackNotes && (
                        <p className="text-slate-600 text-[11px] mt-0.5">{h.feedbackNotes}</p>
                      )}
                      {h.nextFollowUpDate && (
                        <p className="text-[10px] text-purple-700 font-semibold mt-1">
                          Follow-up scheduled: {new Date(h.nextFollowUpDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0F6E56] hover:bg-[#0c5a46] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Call Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
