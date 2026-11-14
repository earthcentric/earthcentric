import React from "react";
import { redirect } from "next/navigation";
import { verifyWorkerAuth } from "@/lib/auth-server";
import { WorkerSidebar } from "@/components/worker/WorkerSidebar";

export const metadata = {
  title: "Customer Feedback Management | EarthCentric",
  description: "EarthCentric Calling Executive & Customer Feedback Portal",
};

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side strict authorization check
  const auth = await verifyWorkerAuth();
  if (!auth.authorized) {
    redirect("/auth/buyer-login?redirect_url=/worker/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800 antialiased">
      <WorkerSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Customer Feedback Management
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Calling Executive Portal • Real-time Customer Outreach & Follow-up
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Database Sync</span>
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
