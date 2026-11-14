"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Search,
  Filter,
  Calendar,
  Phone,
  PhoneCall,
  User,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  RefreshCw,
  Eye,
  X,
  ArrowUpDown,
} from "lucide-react";
import { getWorkerBuyers, getWorkerBuyerDetails, WorkerBuyerItem } from "@/actions/worker";
import { CustomerFeedbackBadge } from "@/components/worker/CustomerFeedbackBadge";
import { FeedbackModal, FeedbackModalTarget } from "@/components/worker/FeedbackModal";

export default function WorkerBuyersPage() {
  const [buyers, setBuyers] = useState<WorkerBuyerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Feedback modal
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackModalTarget | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Buyer details modal
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [buyerDetails, setBuyerDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchBuyers = async () => {
    setLoading(true);
    try {
      const res = await getWorkerBuyers({
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortOrder,
      });
      if (res.success && res.buyers) {
        setBuyers(res.buyers);
      }
    } catch (err) {
      console.error("fetchBuyers error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBuyers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, startDate, endDate, sortOrder]);

  const handleOpenDetails = async (buyerId: string) => {
    setSelectedBuyerId(buyerId);
    setLoadingDetails(true);
    try {
      const res = await getWorkerBuyerDetails(buyerId);
      if (res.success && res.buyer) {
        setBuyerDetails(res.buyer);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRecordFeedback = (buyer: WorkerBuyerItem) => {
    setFeedbackTarget({
      id: buyer.id,
      name: buyer.name,
      email: buyer.email,
      phone: buyer.mobileNumber,
      customerType: "BUYER",
      initialStatus: buyer.latestFeedback?.callStatus,
      initialNotes: buyer.latestFeedback?.feedbackNotes,
    });
    setIsFeedbackOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800">New Buyer Registrations</h2>
          <p className="text-xs text-slate-500">
            Identify, contact, and record feedback for newly registered EarthCentric buyers.
          </p>
        </div>
        <button
          onClick={fetchBuyers}
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
            placeholder="Search by buyer name, email, or mobile number..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:bg-white"
          />
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Start registration date"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-[#0F6E56]"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="End registration date"
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

      {/* Buyers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#0F6E56]" />
              <span>Loading registered buyers...</span>
            </div>
          ) : buyers.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs">
              No registered buyers match your search or date criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Buyer Name</th>
                  <th className="py-3 px-5">Email / Gmail</th>
                  <th className="py-3 px-5">Mobile Number</th>
                  <th className="py-3 px-5">Registered Date & Time</th>
                  <th className="py-3 px-5">Profile Status</th>
                  <th className="py-3 px-5">Feedback Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buyers.map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-800">{buyer.name}</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 font-medium">
                      {buyer.email}
                    </td>
                    <td className="py-3.5 px-5">
                      {buyer.mobileNumber ? (
                        <span className="font-mono font-bold text-slate-800">
                          {buyer.mobileNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not provided</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 font-medium whitespace-nowrap">
                      {new Date(buyer.registrationDate).toLocaleDateString()} at{" "}
                      {new Date(buyer.registrationDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-5">
                      {buyer.profileStatus === "COMPLETED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <span>Complete</span>
                        </span>
                      ) : buyer.profileStatus === "PROFILE_PENDING" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                          <span>Address Pending</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                          <span>Mobile Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      <CustomerFeedbackBadge status={buyer.latestFeedback?.callStatus} />
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetails(buyer.id)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="View Profile Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRecordFeedback(buyer)}
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

      {/* Buyer Details Modal */}
      {selectedBuyerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <User className="h-4 w-4 text-[#0F6E56]" />
                <span>Buyer Profile Details</span>
              </h3>
              <button
                onClick={() => {
                  setSelectedBuyerId(null);
                  setBuyerDetails(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {loadingDetails ? (
                <div className="p-8 text-center text-slate-400">Loading details...</div>
              ) : !buyerDetails ? (
                <div className="p-8 text-center text-slate-400">Buyer details unavailable.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Name</p>
                      <p className="font-bold text-slate-800">{buyerDetails.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Email</p>
                      <p className="font-bold text-slate-800 truncate">{buyerDetails.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Mobile</p>
                      <p className="font-bold text-slate-800">
                        {buyerDetails.mobileNumber || buyerDetails.phone || "None"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Registered</p>
                      <p className="font-bold text-slate-800">
                        {new Date(buyerDetails.createdAt).toLocaleDateString()} {new Date(buyerDetails.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    {buyerDetails.gstin && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">GSTIN</p>
                        <p className="font-mono font-bold text-[#0F6E56]">{buyerDetails.gstin}</p>
                      </div>
                    )}
                  </div>

                  {/* Delivery Addresses */}
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2">Saved Delivery Addresses</h4>
                    {!buyerDetails.addresses || buyerDetails.addresses.length === 0 ? (
                      <p className="text-slate-400 italic">No delivery addresses saved yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {buyerDetails.addresses.map((addr: any) => (
                          <div key={addr.id} className="p-2.5 rounded-lg border border-slate-200 bg-white">
                            <span className="font-bold text-slate-800">{addr.label || "Home"}: </span>
                            <span className="text-slate-600">
                              {addr.street}, {addr.city}, {addr.state} - {addr.postalCode}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Prior Call History */}
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2">Executive Call History</h4>
                    {!buyerDetails.feedbackHistory || buyerDetails.feedbackHistory.length === 0 ? (
                      <p className="text-slate-400 italic">No calls made to this buyer yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {buyerDetails.feedbackHistory.map((fb: any) => (
                          <div key={fb.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#0F6E56]">{fb.callStatus}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(fb.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {fb.feedbackNotes && (
                              <p className="text-slate-600 mt-1">{fb.feedbackNotes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => {
                  setSelectedBuyerId(null);
                  setBuyerDetails(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                Close
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
        onSuccess={fetchBuyers}
      />
    </div>
  );
}
