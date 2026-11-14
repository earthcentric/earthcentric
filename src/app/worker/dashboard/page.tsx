"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Store,
  UserPlus,
  ShoppingCart,
  Clock,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  PhoneCall,
  AlertCircle,
} from "lucide-react";
import { getWorkerOverviewStats, WorkerOverviewStats } from "@/actions/worker";

export default function WorkerDashboardPage() {
  const [stats, setStats] = useState<WorkerOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWorkerOverviewStats();
      if (res.success && res.stats) {
        setStats(res.stats);
      } else {
        setError(res.error || "Failed to load dashboard statistics.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-[#0F6E56]/10 via-emerald-50 to-white p-6 rounded-2xl border border-emerald-100">
        <div>
          <h2 className="text-lg font-black text-slate-800">
            Welcome to Calling Executive Operations
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Monitor real-time user registrations, follow up on pending customer calls, and re-engage abandoned checkouts.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 6 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Registered Buyers */}
        <Link
          href="/worker/buyers"
          className="group p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm hover:border-[#0F6E56]/40 transition-all flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Registered Buyers
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {loading ? "..." : (stats?.totalBuyers ?? 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-[#0F6E56] font-bold mt-2 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>View all buyers</span>
              <ArrowRight className="h-3 w-3" />
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-[#0F6E56] group-hover:text-white transition-colors">
            <Users className="h-6 w-6" />
          </div>
        </Link>

        {/* Total Registered Sellers */}
        <Link
          href="/worker/sellers"
          className="group p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm hover:border-[#0F6E56]/40 transition-all flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Registered Sellers
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {loading ? "..." : (stats?.totalSellers ?? 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-[#0F6E56] font-bold mt-2 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>View all sellers</span>
              <ArrowRight className="h-3 w-3" />
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-[#0F6E56] group-hover:text-white transition-colors">
            <Store className="h-6 w-6" />
          </div>
        </Link>

        {/* New Registrations Today */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              New Registrations Today
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {loading ? "..." : (stats?.newRegistrationsToday ?? 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-2">
              Buyers & sellers joined today
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <UserPlus className="h-6 w-6" />
          </div>
        </div>

        {/* Total Abandoned Checkouts */}
        <Link
          href="/worker/abandoned-checkouts"
          className="group p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm hover:border-red-300 transition-all flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Abandoned Checkouts
            </p>
            <h3 className="text-2xl font-black text-red-600 mt-1">
              {loading ? "..." : (stats?.totalAbandonedCheckouts ?? 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-red-600 font-bold mt-2 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Contact customers</span>
              <ArrowRight className="h-3 w-3" />
            </p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors">
            <ShoppingCart className="h-6 w-6" />
          </div>
        </Link>

        {/* Pending Follow-ups */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Pending Follow-ups
            </p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">
              {loading ? "..." : (stats?.pendingFollowUps ?? 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-2">
              Callback requests & unreachable calls
            </p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        {/* Completed Follow-ups */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Completed Follow-ups
            </p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {loading ? "..." : (stats?.completedFollowUps ?? 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-2">
              Calls completed & feedback recorded
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Recent Customer Activity</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Latest buyer registrations, seller registrations, and checkout attempts
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#0F6E56]" />
              <span>Loading recent activity...</span>
            </div>
          ) : !stats?.recentActivity || stats.recentActivity.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No recent customer activity recorded yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-6">Event</th>
                  <th className="py-3 px-6">Description</th>
                  <th className="py-3 px-6">Date & Time</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentActivity.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.type === "BUYER_REGISTRATION"
                              ? "bg-blue-100 text-blue-800"
                              : item.type === "SELLER_REGISTRATION"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.statusBadge || item.type}
                        </span>
                        <span className="font-bold text-slate-800 truncate max-w-xs">
                          {item.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 truncate max-w-sm">
                      {item.description}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 font-medium">
                      {new Date(item.timestamp).toLocaleDateString()} at{" "}
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {item.type === "BUYER_REGISTRATION" && (
                        <Link
                          href="/worker/buyers"
                          className="text-[#0F6E56] font-bold hover:underline"
                        >
                          View Buyers →
                        </Link>
                      )}
                      {item.type === "SELLER_REGISTRATION" && (
                        <Link
                          href="/worker/sellers"
                          className="text-[#0F6E56] font-bold hover:underline"
                        >
                          View Sellers →
                        </Link>
                      )}
                      {item.type === "ABANDONED_CHECKOUT" && (
                        <Link
                          href="/worker/abandoned-checkouts"
                          className="text-red-600 font-bold hover:underline"
                        >
                          Follow Up →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
