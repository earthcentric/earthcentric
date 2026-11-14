"use client";

import React from "react";
import { Phone, CheckCircle, Clock, PhoneOff, PhoneCall, MessageSquareQuote } from "lucide-react";

interface CustomerFeedbackBadgeProps {
  status?: string | null;
  className?: string;
}

export function CustomerFeedbackBadge({ status, className = "" }: CustomerFeedbackBadgeProps) {
  const norm = (status || "PENDING").toUpperCase();

  switch (norm) {
    case "FEEDBACK_RECEIVED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 ${className}`}
        >
          <CheckCircle className="h-3 w-3 text-emerald-600" />
          <span>Feedback Received</span>
        </span>
      );

    case "CALLED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 ${className}`}
        >
          <Phone className="h-3 w-3 text-blue-600" />
          <span>Called</span>
        </span>
      );

    case "CALLBACK_REQUESTED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 ${className}`}
        >
          <PhoneCall className="h-3 w-3 text-purple-600" />
          <span>Requested Callback</span>
        </span>
      );

    case "NOT_ANSWERED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 ${className}`}
        >
          <Clock className="h-3 w-3 text-amber-600" />
          <span>Call Not Answered</span>
        </span>
      );

    case "UNREACHABLE":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200 ${className}`}
        >
          <PhoneOff className="h-3 w-3 text-red-600" />
          <span>Number Unreachable</span>
        </span>
      );

    case "PENDING":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 ${className}`}
        >
          <Clock className="h-3 w-3 text-slate-400" />
          <span>Pending</span>
        </span>
      );
  }
}
