import React from "react";
import { Leaf } from "lucide-react";
import Link from "next/link";

interface LogoProps {
  className?: string;
  hideTextOnMobile?: boolean;
  light?: boolean;
}

export function Logo({ className = "", hideTextOnMobile = true, light = false }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center space-x-2 select-none cursor-pointer ${className}`}>
      <div className="bg-[#7AC943]/15 p-1.5 rounded-lg flex items-center justify-center">
        {/* Using a two-tone icon approach if possible, or simple stroke/fill */}
        <Leaf 
          className="h-6 w-6" 
          stroke="#0B5D3B"
          fill="#7AC943"
          strokeWidth={2}
        />
      </div>
      <span 
        className={`font-serif tracking-tighter font-black text-xl ${light ? "text-white" : "text-[#0B5D3B]"} ${hideTextOnMobile ? "hidden sm:inline-block" : ""}`}
        style={{ letterSpacing: "-0.05em" }}
      >
        Earth Centric
      </span>
    </Link>
  );
}
