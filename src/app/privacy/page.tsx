"use client";

import React from "react";
import Link from "next/link";
import { Award, ShieldCheck, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F7F4ED] text-[#173528] py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Header */}
        <div className="space-y-4 border-b border-[#d0c6b8]/40 pb-8">
          <Link href="/" className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#6a7b6e] hover:text-[#173528] transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center space-x-2 text-primary font-bold text-lg pt-4">
            <Award className="h-6 w-6 text-emerald-600" />
            <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
          </div>
          <p className="text-xs text-muted-foreground">Last updated: June 16, 2026</p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#173528]">1. Information We Collect</h2>
            <p>
              We collect personal data when you register an account, purchase products, or submit sustainability verification audits. This includes company names, GSTIN registrations, organic compliance certificates, shipping coordinates, and transaction histories.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#173528]">2. Sourcing Verification Audits</h2>
            <p>
              To maintain EarthCentric's trust standard, all environmental badges, shipping tracking codes, and carbon footprint telemetry details are published transparently. By enrolling as a seller, you consent to third-party eco auditing and public review of certificate records.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#173528]">3. Data Security & Encryption</h2>
            <p>
              Your passwords are encrypted securely, and banking details are processed using compliance-grade payment gateways (Cashfree). We enforce strict database access locks to protect the integrity of seller records.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#173528]">4. Contact & Support</h2>
            <p>
              For data privacy inquiries or profile archival requests, please contact our auditing department at <strong>compliance@earthcentric.com</strong>.
            </p>
          </section>
        </div>

        {/* Footer info badge */}
        <div className="glass-panel rounded-2xl p-6 border border-[#d0c6b8]/50 flex items-center space-x-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <span className="text-xs font-semibold text-[#173528]">EarthCentric Carbon-Neutral Platform Trust Standard verified</span>
        </div>
      </div>
    </div>
  );
}
