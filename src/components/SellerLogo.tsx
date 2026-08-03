"use client";

import React, { useState } from "react";
import { Leaf } from "lucide-react";

interface SellerLogoProps {
  logoUrl?: string | null;
  companyLogo?: string | null;
  companyName?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | number;
  className?: string;
}

export function SellerLogo({
  logoUrl,
  companyLogo,
  companyName,
  size = "md",
  className = "",
}: SellerLogoProps) {
  const [hasError, setHasError] = useState(false);

  const activeUrl = logoUrl || companyLogo;

  let sizeClasses = "h-10 w-10";
  let iconSize = "h-5 w-5";

  if (size === "xs") {
    sizeClasses = "h-6 w-6";
    iconSize = "h-3 w-3";
  } else if (size === "sm") {
    sizeClasses = "h-8 w-8";
    iconSize = "h-4.5 w-4.5";
  } else if (size === "md") {
    sizeClasses = "h-10 w-10";
    iconSize = "h-5 w-5";
  } else if (size === "lg") {
    sizeClasses = "h-12 w-12";
    iconSize = "h-6 w-6";
  } else if (size === "xl") {
    sizeClasses = "h-16 w-16";
    iconSize = "h-8 w-8";
  } else if (size === "2xl") {
    sizeClasses = "h-20 w-20";
    iconSize = "h-10 w-10";
  }

  const style = typeof size === "number" ? { width: size, height: size } : {};

  return (
    <div
      style={style}
      className={`rounded-full border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}
    >
      {activeUrl && !hasError ? (
        <img
          src={activeUrl}
          alt={companyName || "Seller Logo"}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <Leaf className={`text-[#2d4a36] ${iconSize}`} />
      )}
    </div>
  );
}
