"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Input } from "@/components/ui/shared";
import { Leaf, Mail, ShieldCheck, HelpCircle } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubsubscribed] = useState(false);
  const pathname = usePathname();

  if (pathname?.startsWith("/seller/dashboard") || pathname?.startsWith("/admin/dashboard")) return null;

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubsubscribed(true);
    alert("You're subscribed! Thank you for joining the EarthCentric community.");
    setEmail("");
  };

  return (
    <footer className="w-full border-t border-border bg-muted/30 pt-16 pb-8 transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 lg:grid-cols-4 lg:gap-8 pb-12 border-b border-border/40">
          {/* Brand and Mission */}
          <div className="space-y-4">
            <Logo hideTextOnMobile={false} />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Connecting conscious consumers with verified ethical manufacturers, sustainable brands, and carbon-neutral suppliers.
            </p>
            <div className="flex items-center space-x-2 pt-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-primary dark:text-foreground">100% Verified Sustainable</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary dark:text-accent mb-4">Shop Categories</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/marketplace?category=organic-apparel" className="text-muted-foreground hover:text-foreground transition-colors">
                  Organic Apparel
                </Link>
              </li>
              <li>
                <Link href="/marketplace?category=zero-waste-living" className="text-muted-foreground hover:text-foreground transition-colors">
                  Zero-Waste Living
                </Link>
              </li>
              <li>
                <Link href="/marketplace?category=renewable-energy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Renewable Energy
                </Link>
              </li>
              <li>
                <Link href="/marketplace?category=eco-home-goods" className="text-muted-foreground hover:text-foreground transition-colors">
                  Eco Home Goods
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary dark:text-accent mb-4">For Partners</h4>
            <ul className="space-y-2.5 text-sm">

              <li>
                <Link href="/seller/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                  Seller Dashboard
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                  Our Badges System
                </Link>
              </li>
              <li>
                <Link href="/admin/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                  Admin Approval Center
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">
                  Sustainability Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Story Newsletter */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary dark:text-accent mb-4 font-semibold">
              The Eco Bulletin
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Subscribe to receive curated sustainability stories, product highlights, and ethical brand interviews.
            </p>
            {subscribed ? (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                🌱 Thank you! You've joined the EarthCentric community.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background flex-1"
                />
                <Button type="submit" variant="cool" className="whitespace-nowrap flex items-center justify-center space-x-2">
                  <span>Subscribe</span>
                  <Mail className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Lower Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-8 text-xs text-muted-foreground gap-4">
          <p>© {new Date().getFullYear()} EarthCentric Marketplace. Carbon-Neutral Platform.</p>
          <div className="flex space-x-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/#how-it-works" className="hover:text-foreground transition-colors flex items-center space-x-1">
              <HelpCircle className="h-3 w-3" />
              <span>How Verification Works</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
