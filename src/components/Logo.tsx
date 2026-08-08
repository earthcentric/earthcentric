import React from "react";
import Link from "next/link";

interface LogoProps {
  className?: string;
  hideTextOnMobile?: boolean;
  light?: boolean;
}

export function Logo({ className = "", hideTextOnMobile = true, light = false }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center select-none cursor-pointer ${className}`}>
      <img
        src="/logo.png"
        alt="Earth Centric"
        className={`w-auto object-contain ${hideTextOnMobile ? "h-14 sm:h-20 md:h-24" : "h-24"}`}
      />
    </Link>
  );
}
