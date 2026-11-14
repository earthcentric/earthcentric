"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Search,
  ShoppingCart,
  Calendar,
  Phone,
  PhoneCall,
  User,
  Mail,
  RefreshCw,
  Eye,
  X,
  ArrowUpDown,
  AlertTriangle,
  Package,
  CreditCard,
  Clock,
} from "lucide-react";
import { getWorkerAbandonedCheckouts, WorkerAbandonedCheckoutItem } from "@/actions/worker";
import { CustomerFeedbackBadge } from "@/components/worker/CustomerFeedbackBadge";
import { FeedbackModal, FeedbackModalTarget } from "@/components/worker/FeedbackModal";

export default function WorkerAbandonedCheckoutsPage() {
  const [checkouts, setCheckouts] = useState<WorkerAbandonedCheckoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Feedback modal
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackModalTarget | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Checkout details modal
  const [selectedCheckout, setSelectedCheckout] = useState<WorkerAbandonedCheckoutItem | null>(null);

  const fetchCheckouts = async () => {
    setLoading(true);
    try {
      const res = await getWorkerAbandonedCheckouts({
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortOrder,
      });
      if (res.success && res.abandonedCheckouts) {
        setCheckouts(res.abandonedCheckouts);
      }
    } catch (err) {
      console.error("fetchCheckouts error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCheckouts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, startDate, endDate, sortOrder]);

  const handleRecordFeedback = (item: WorkerAbandonedCheckoutItem) => {
    setFeedbackTarget({
      id: item.id,
      userId: item.userId,
      name: item.customerName,
      email: item.customerEmail,
      phone: item.customerPhone,
      customerType: "ABANDONED_CHECKOUT",
      initialStatus: item.feedbackCallStatus,
      initialNotes: item.feedbackNotes,
      initialReason: item.abandonmentReason,
    });
    setIsFeedbackOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <span>Abandoned Checkouts</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
              High Priority Follow-up
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Customers who initiated checkout with products in their cart but did not complete payment.
          </p>
        </div>
        <button
          onClick={fetchCheckouts}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, email, or mobile number..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
          />
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Start checkout date"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-[#0F6E56]"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="End checkout date"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-[#0F6E56]"
          />
        </div>

        {/* Sort Toggle */}
        <button
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 transition-colors cursor-pointer shrink-0"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
        </button>

        {(search || startDate || endDate) && (
          <button
            onClick={() => {
              setSearch("");
              setStartDate("");
              setEndDate("");
            }}
            className="text-xs text-red-600 hover:underline font-bold px-2 shrink-0 cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Abandoned Checkouts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#0F6E56]" />
              <span>Loading abandoned checkouts...</span>
            </div>
          ) : checkouts.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs">
              No unpaid abandoned checkouts found matching your criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Customer Details</th>
                  <th className="py-3 px-5">Mobile Number</th>
                  <th className="py-3 px-5">Checkout Date & Time</th>
                  <th className="py-3 px-5">Cart Value</th>
                  <th className="py-3 px-5">Products in Checkout</th>
                  <th className="py-3 px-5">Attempts</th>
                  <th className="py-3 px-5">Feedback Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checkouts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Customer */}
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-800">{item.customerName}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{item.customerEmail}</div>
                    </td>

                    {/* Mobile */}
                    <td className="py-3.5 px-5">
                      {item.customerPhone ? (
                        <span className="font-mono font-bold text-slate-800">
                          {item.customerPhone}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not provided</span>
                      )}
                    </td>

                    {/* Checkout Date */}
                    <td className="py-3.5 px-5 text-slate-500 font-medium whitespace-nowrap">
                      {new Date(item.checkoutStartedAt).toLocaleDateString()} at{" "}
                      {new Date(item.checkoutStartedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Cart Value */}
                    <td className="py-3.5 px-5">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        ₹{item.totalCartValue.toLocaleString()}
                      </span>
                    </td>

                    {/* Products Preview */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                        {item.products.slice(0, 2).map((p, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold truncate max-w-[140px]"
                            title={p.name}
                          >
                            <span className="truncate">{p.name}</span>
                            <span className="text-slate-400">×{p.quantity}</span>
                          </span>
                        ))}
                        {item.products.length > 2 && (
                          <span className="text-[10px] text-slate-400 font-bold">
                            +{item.products.length - 2} more
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Attempts */}
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {item.attemptCount} {item.attemptCount === 1 ? "attempt" : "attempts"}
                      </span>
                    </td>

                    {/* Feedback Status */}
                    <td className="py-3.5 px-5">
                      <CustomerFeedbackBadge status={item.feedbackCallStatus} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedCheckout(item)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="View Full Checkout Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRecordFeedback(item)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#0F6E56] hover:bg-[#0c5a46] text-white text-[11px] font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
                        >
                          <PhoneCall className="h-3 w-3" />
                          <span>Call / Log</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Checkout Details Modal */}
      {selectedCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#0F6E56]" />
                <span>Abandoned Checkout Details</span>
              </h3>
              <button
                onClick={() => setSelectedCheckout(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Customer Info Card */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-200/80">
                <h4 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                  <span>{selectedCheckout.customerName}</span>
                  <span className="font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full text-xs font-bold">
                    Total: ₹{selectedCheckout.totalCartValue.toLocaleString()}
                  </span>
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Email:</span>
                    <p className="font-semibold text-slate-800">{selectedCheckout.customerEmail}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Mobile Phone:</span>
                    <p className="font-semibold text-slate-800 font-mono">
                      {selectedCheckout.customerPhone || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Checkout Started:</span>
                    <p className="font-semibold text-slate-800">
                      {new Date(selectedCheckout.checkoutStartedAt).toLocaleDateString()} at{" "}
                      {new Date(selectedCheckout.checkoutStartedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Last Attempt:</span>
                    <p className="font-semibold text-slate-800">
                      {new Date(selectedCheckout.lastAttemptAt).toLocaleDateString()} at{" "}
                      {new Date(selectedCheckout.lastAttemptAt).toLocaleTimeString()} ({selectedCheckout.attemptCount} total)
                    </p>
                  </div>
                </div>
              </div>

              {/* Products in Checkout */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-[#0F6E56]" />
                  <span>Products in Abandoned Cart ({selectedCheckout.products.length})</span>
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedCheckout.products.map((p, i) => (
                    <div key={i} className="p-3 bg-white flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">ID: {p.productId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-800">
                          ₹{Number(p.price).toLocaleString()} × {p.quantity}
                        </p>
                        <p className="text-[11px] font-bold text-[#0F6E56]">
                          ₹{(Number(p.price) * Number(p.quantity)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feedback History & Abandonment Reason */}
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                <h4 className="font-bold text-amber-900 text-xs">Call Status & Abandonment Insights</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Current Call Status:</span>
                    <p className="font-bold text-slate-800 mt-0.5">
                      {selectedCheckout.feedbackCallStatus || "Pending Outreach"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Reported Reason:</span>
                    <p className="font-bold text-slate-800 mt-0.5">
                      {selectedCheckout.abandonmentReason || "Not recorded yet"}
                    </p>
                  </div>
                </div>
                {selectedCheckout.feedbackNotes && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Feedback Notes:</span>
                    <p className="text-slate-700 bg-white p-2 rounded-lg border border-amber-200/60 mt-1">
                      {selectedCheckout.feedbackNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setSelectedCheckout(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const targetItem = selectedCheckout;
                  setSelectedCheckout(null);
                  handleRecordFeedback(targetItem);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0F6E56] hover:bg-[#0c5a46] text-white rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>Call & Record Feedback</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Feedback Modal */}
      <FeedbackModal
        target={feedbackTarget}
        isOpen={isFeedbackOpen}
        onClose={() => {
          setIsFeedbackOpen(false);
          setFeedbackTarget(null);
        }}
        onSuccess={fetchCheckouts}
      />
    </div>
  );
}
