import React from "react";
import Link from "next/link";

interface LogoProps {
  className?: string;
  hideTextOnMobile?: boolean;
  light?: boolean;
}

export function Logo({ className = "", hideTextOnMobile = true, light = false }: LogoProps) {
  if (light) {
    // On dark backgrounds: show white text + white leaf icon (no image)
    return (
      <Link href="/" className={`flex items-center select-none cursor-pointer ${className}`}>
        <div className={`relative flex items-center ${hideTextOnMobile ? "hidden sm:flex" : "flex"}`}>
          <span className="font-sans font-bold text-2xl text-white" style={{ letterSpacing: "0em" }}>
            Earth Centric
          </span>
          {/* Leaf cluster in white */}
          <div className="absolute pointer-events-none" style={{ right: "-6px", top: "-38px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 48 48" style={{ overflow: "visible", display: "block" }}>
              <g transform="translate(18, 38) rotate(-40)">
                <path d="M0,0 C-7,-8 -8,-20 0,-30 C8,-20 7,-8 0,0 Z" fill="rgba(255,255,255,0.7)" />
              </g>
              <g transform="translate(28, 36) rotate(-10)">
                <path d="M0,0 C-6,-7 -7,-18 0,-27 C7,-18 6,-7 0,0 Z" fill="rgba(255,255,255,1)" />
              </g>
              <g transform="translate(37, 38) rotate(30)">
                <path d="M0,0 C-5,-6 -5,-15 0,-22 C5,-15 5,-6 0,0 Z" fill="rgba(255,255,255,0.8)" />
              </g>
            </svg>
          </div>
        </div>
        {hideTextOnMobile && (
          <span className="sm:hidden font-sans font-bold text-2xl text-white">EC</span>
        )}
      </Link>
    );
  }

  // On light/white backgrounds: use the actual logo image with multiply blend
  return (
    <Link href="/" className={`flex items-center select-none cursor-pointer ${className}`}>
      <img
        src="/logo.png"
        alt="Earth Centric"
        className={`w-auto object-contain ${hideTextOnMobile ? "h-9 sm:h-12" : "h-12"}`}
        style={{ mixBlendMode: "multiply" }}
      />
    </Link>
  );
}
