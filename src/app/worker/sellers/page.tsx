"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Calendar,
  Phone,
  PhoneCall,
  Store,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  RefreshCw,
  Eye,
  X,
  ArrowUpDown,
  Building2,
} from "lucide-react";
import { getWorkerSellers, getWorkerSellerDetails, WorkerSellerItem } from "@/actions/worker";
import { CustomerFeedbackBadge } from "@/components/worker/CustomerFeedbackBadge";
import { FeedbackModal, FeedbackModalTarget } from "@/components/worker/FeedbackModal";

export default function WorkerSellersPage() {
  const [sellers, setSellers] = useState<WorkerSellerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Feedback modal
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackModalTarget | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Seller details modal
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [sellerDetails, setSellerDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchSellers = async () => {
    setLoading(true);
    try {
      const res = await getWorkerSellers({
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortOrder,
      });
      if (res.success && res.sellers) {
        setSellers(res.sellers);
      }
    } catch (err) {
      console.error("fetchSellers error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSellers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, startDate, endDate, sortOrder]);

  const handleOpenDetails = async (sellerId: string) => {
    setSelectedSellerId(sellerId);
    setLoadingDetails(true);
    try {
      const res = await getWorkerSellerDetails(sellerId);
      if (res.success && res.seller) {
        setSellerDetails(res.seller);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRecordFeedback = (seller: WorkerSellerItem) => {
    setFeedbackTarget({
      id: seller.id,
      name: seller.companyName,
      email: seller.email,
      phone: seller.mobileNumber,
      customerType: "SELLER",
      initialStatus: seller.latestFeedback?.callStatus,
      initialNotes: seller.latestFeedback?.feedbackNotes,
    });
    setIsFeedbackOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800">New Seller Registrations</h2>
          <p className="text-xs text-slate-500">
            View manufacturer and brand onboarding applications, track statuses, and record feedback.
          </p>
        </div>
        <button
          onClick={fetchSellers}
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
            placeholder="Search by business name, contact person, email, or phone..."
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

      {/* Sellers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#0F6E56]" />
              <span>Loading sellers...</span>
            </div>
          ) : sellers.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs">
              No registered sellers match your search or date criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Seller / Business Name</th>
                  <th className="py-3 px-5">Contact Person</th>
                  <th className="py-3 px-5">Gmail / Email</th>
                  <th className="py-3 px-5">Mobile Number</th>
                  <th className="py-3 px-5">Date & Time</th>
                  <th className="py-3 px-5">Application Status</th>
                  <th className="py-3 px-5">Feedback Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sellers.map((seller) => {
                  const status = seller.verificationStatus || "PENDING";
                  return (
                    <tr key={seller.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-800">{seller.companyName}</div>
                        <div className="text-[10px] text-slate-400">{seller.businessType}</div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-700 font-medium">
                        {seller.ownerName || "Representative"}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 font-medium">
                        {seller.email}
                      </td>
                      <td className="py-3.5 px-5">
                        {seller.mobileNumber ? (
                          <span className="font-mono font-bold text-slate-800">
                            {seller.mobileNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not provided</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 font-medium whitespace-nowrap">
                        {new Date(seller.registrationDate).toLocaleDateString()} at{" "}
                        {new Date(seller.registrationDate).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-5">
                        {status === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Approved
                          </span>
                        ) : status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            Rejected
                          </span>
                        ) : status === "NEED_MORE_DOCS" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Needs Docs
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Pending Review
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <CustomerFeedbackBadge status={seller.latestFeedback?.callStatus} />
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(seller.id)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Seller Application Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRecordFeedback(seller)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-[#0F6E56] hover:bg-[#0c5a46] text-white text-[11px] font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
                          >
                            <PhoneCall className="h-3 w-3" />
                            <span>Call / Log</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Seller Details Modal (Read-Only as required by prompt) */}
      {selectedSellerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Store className="h-4 w-4 text-[#0F6E56]" />
                <span>Seller Application Details</span>
              </h3>
              <button
                onClick={() => {
                  setSelectedSellerId(null);
                  setSellerDetails(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {loadingDetails ? (
                <div className="p-8 text-center text-slate-400">Loading details...</div>
              ) : !sellerDetails ? (
                <div className="p-8 text-center text-slate-400">Seller details unavailable.</div>
              ) : (
                <>
                  <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-sm">{sellerDetails.companyName}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                        Status: {sellerDetails.verificationStatus}
                      </span>
                    </div>
                    <p className="text-slate-600">{sellerDetails.description || "No company description provided."}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Contact Person</p>
                      <p className="font-bold text-slate-800">{sellerDetails.ownerName || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Email</p>
                      <p className="font-bold text-slate-800 truncate">{sellerDetails.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Phone</p>
                      <p className="font-bold text-slate-800">{sellerDetails.phone || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Business Type</p>
                      <p className="font-bold text-slate-800">{sellerDetails.businessType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">GST Number</p>
                      <p className="font-mono font-bold text-slate-800">{sellerDetails.gstNumber || "Not submitted"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">PAN Number</p>
                      <p className="font-mono font-bold text-slate-800">{sellerDetails.panNumber || "Not submitted"}</p>
                    </div>
                  </div>

                  {/* Addresses */}
                  <div>
                    <h4 className="font-bold text-slate-700 mb-1">Company / Factory Address</h4>
                    <p className="text-slate-600 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      {sellerDetails.companyAddress || sellerDetails.factoryAddress || "Address details not provided."}
                    </p>
                  </div>

                  {/* Prior Call History */}
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2">Executive Call History</h4>
                    {!sellerDetails.feedbackHistory || sellerDetails.feedbackHistory.length === 0 ? (
                      <p className="text-slate-400 italic">No calls made to this seller yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {sellerDetails.feedbackHistory.map((fb: any) => (
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

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 italic">
                * Note: Worker account cannot approve or reject seller applications.
              </span>
              <button
                onClick={() => {
                  setSelectedSellerId(null);
                  setSellerDetails(null);
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
        onSuccess={fetchSellers}
      />
    </div>
  );
}
