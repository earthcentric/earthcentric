"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Globe from "@/components/ui/globe";
import { cn } from "@/lib/utils";

export interface ScrollGlobeSection {
  id: string;
  badge?: string;
  content: React.ReactNode;
}

interface ScrollGlobeProps {
  sections: ScrollGlobeSection[];
  globeConfig?: {
    positions: {
      top: string;
      left: string;
      scale: number;
    }[];
  };
  className?: string;
  sellerCount?: number;
}

const defaultGlobeConfig = {
  positions: [
    { top: "50%", left: "75%", scale: 1.3 },   // Section 1: Hero (Right side, balanced)
    { top: "25%", left: "50%", scale: 0.75 },  // Section 2: Credentials (Center top, compact)
    { top: "22%", left: "85%", scale: 1.7 },   // Section 3: Categories (Right edge, larger)
    { top: "50%", left: "50%", scale: 1.6 },   // Section 4: Verification (Center, backdrop)
    { top: "30%", left: "80%", scale: 1.4 },   // Section 5: Verified Sellers (Right side, large)
    { top: "35%", left: "20%", scale: 1.25 },  // Section 6: Testimonials (Left side, medium scale)
    { top: "70%", left: "75%", scale: 1.1 },   // Section 7: Mission / CTA (Right bottom, subtle)
  ]
};

// Parse percentage string to numerical viewport coordinate
const parsePercent = (str: string): number => parseFloat(str.replace('%', ''));

export default function ScrollGlobe({ sections, globeConfig = defaultGlobeConfig, className, sellerCount = 1 }: ScrollGlobeProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [globeTransform, setGlobeTransform] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameId = useRef<number | null>(null);

  // Track window resizing to detect mobile view
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Pre-calculate positions for performance
  const calculatedPositions = useMemo(() => {
    return globeConfig.positions.map(pos => ({
      top: parsePercent(pos.top),
      left: parsePercent(pos.left),
      scale: pos.scale
    }));
  }, [globeConfig.positions]);

  // Scroll tracking and Globe coordinate transition
  const updateScrollPosition = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0;

    setScrollProgress(progress);

    // Section detection using viewport center distance
    const viewportCenter = window.innerHeight / 2;
    let newActiveSection = 0;
    let minDistance = Infinity;

    sectionRefs.current.forEach((ref, index) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const distance = Math.abs(sectionCenter - viewportCenter);

        if (distance < minDistance) {
          minDistance = distance;
          newActiveSection = index;
        }
      }
    });

    // Apply the active transform based on section positioning
    const currentPos = calculatedPositions[newActiveSection] || calculatedPositions[0];
    const isMob = typeof window !== "undefined" && window.innerWidth < 768;
    const leftPos = isMob ? 50 : currentPos.left;
    const scaleFactor = isMob ? currentPos.scale * 0.65 : currentPos.scale;
    const transform = `translate3d(${leftPos}vw, ${currentPos.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${scaleFactor}, ${scaleFactor}, 1)`;

    setGlobeTransform(transform);
    setActiveSection(newActiveSection);
  }, [calculatedPositions]);

  // Set up scroll listeners
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        animationFrameId.current = requestAnimationFrame(() => {
          updateScrollPosition();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateScrollPosition(); // Initial call

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [updateScrollPosition]);

  // Initial positioning fallback
  useEffect(() => {
    const isMob = typeof window !== "undefined" && window.innerWidth < 768;
    const initialPos = calculatedPositions[0];
    const leftPos = isMob ? 50 : initialPos.left;
    const scaleFactor = isMob ? initialPos.scale * 0.65 : initialPos.scale;
    const initialTransform = `translate3d(${leftPos}vw, ${initialPos.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${scaleFactor}, ${scaleFactor}, 1)`;
    setGlobeTransform(initialTransform);
  }, [calculatedPositions]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full max-w-screen overflow-x-hidden min-h-screen bg-background text-foreground",
        className
      )}
    >
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-0.5 bg-gradient-to-r from-border/20 via-border/40 to-border/20 z-50">
        <div
          className="h-full bg-gradient-to-r from-primary via-accent to-primary will-change-transform shadow-sm"
          style={{
            transform: `scaleX(${scrollProgress})`,
            transformOrigin: 'left center',
            transition: 'transform 0.15s ease-out',
            filter: 'drop-shadow(0 0 2px rgba(163, 177, 138, 0.4))'
          }}
        />
      </div>

      {/* Fixed Right Navigation Dots */}
      <div className="hidden sm:flex fixed right-4 sm:right-6 lg:right-10 top-1/2 -translate-y-1/2 z-40">
        <div className="space-y-4 lg:space-y-6">
          {sections.map((section, index) => (
            <div key={section.id} className="relative group flex items-center justify-end">
              {/* Navigation Label */}
              <div
                className={cn(
                  "absolute right-6 lg:right-8 top-1/2 -translate-y-1/2",
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap",
                  "bg-card/90 backdrop-blur-md border border-border/50 shadow-lg pointer-events-none transition-all duration-300",
                  activeSection === index
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary font-bold">
                    {section.badge || `Section ${index + 1}`}
                  </span>
                </div>
              </div>

              {/* Navigation Indicator Dot */}
              <button
                onClick={() => {
                  sectionRefs.current[index]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                  });
                }}
                className={cn(
                  "relative w-2.5 h-2.5 lg:w-3.5 lg:h-3.5 rounded-full border-2 transition-all duration-300 hover:scale-125 focus:outline-none",
                  "before:absolute before:inset-0 before:rounded-full before:transition-all before:duration-300",
                  activeSection === index
                    ? "bg-primary border-primary shadow-md before:animate-ping before:bg-primary/20"
                    : "bg-transparent border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/10"
                )}
                aria-label={`Go to ${section.badge || `section ${index + 1}`}`}
              />
            </div>
          ))}
        </div>

        {/* Navigation vertical line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent -translate-x-1/2 -z-10" />
      </div>

      {/* Fixed Background Globe container - visible on mobile as a subtle watermark backdrop */}
      <div
        className="fixed z-10 pointer-events-none will-change-transform transition-all duration-[1400ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{
          transform: globeTransform,
          filter: `opacity(${isMobile ? (activeSection === 3 ? 0.12 : 0.22) : (activeSection === 3 ? 0.35 : 0.8)})`,
        }}
      >
        <div className="scale-75 md:scale-90 lg:scale-100 opacity-90">
          <Globe scrollProgress={scrollProgress} sellerCount={sellerCount} />
        </div>
      </div>

      {/* Wrapped Content Sections */}
      <div className="relative w-full">
        {sections.map((section, index) => (
          <div
            key={section.id}
            id={section.id}
            ref={(el) => { sectionRefs.current[index] = el; }}
            className="w-full relative z-20"
          >
            {section.content}
          </div>
        ))}
      </div>
    </div>
  );
}
