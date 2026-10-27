"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSellerProfile, SellerProfile } from "@/actions/sellers";
import { Button, Card, Badge, MetalButton } from "@/components/ui/shared";
import { SellerRegistrationWizard } from "@/components/seller/SellerRegistrationWizard";
import {
  CheckCircle2,
  Clock,
  AlertOctagon,
  LogIn,
  Store,
  UserX,
} from "lucide-react";

export default function VerificationPage() {
  const { user, isLoading, updateSellerStatus } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isReopened, setIsReopened] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      if (user?.id) {
        if (!initialLoaded) setLoading(true);
        try {
          const p = await getSellerProfile(user.id);
          if (isMounted) {
            setProfile(p);
          }
        } catch (err) {
          console.error("Error loading seller profile:", err);
        } finally {
          if (isMounted) {
            setLoading(false);
            setInitialLoaded(true);
          }
        }
      } else if (!isLoading) {
        if (isMounted) {
          setLoading(false);
          setInitialLoaded(true);
        }
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [user?.id, isLoading]);

  if (!initialLoaded && (loading || isLoading)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center space-y-3">
        <Clock className="h-8 w-8 text-primary animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground">Authenticating credentials...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <Card className="p-8 border-border/50 rounded-2xl shadow-sm space-y-5 bg-card">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
            <Store className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-primary">Seller Registration</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Please sign in to your Earth Centric account to start your seller onboarding and verification process.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="cool"
              onClick={() => router.push("/sign-in?redirect_url=/seller/verification")}
              className="px-6 gap-2"
            >
              <LogIn className="h-4 w-4" />
              Sign In to Continue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Detect if seller account was removed by admin
  const isRemoved = Boolean(
    profile?.isRemoved ||
    profile?.rejectionReason?.startsWith("[SELLER_REMOVED]:")
  );

  // ── Removed Seller State ──
  if (isRemoved && !isReopened) {
    const removalReasonText = profile?.rejectionReason?.replace("[SELLER_REMOVED]:", "").trim() || "Administrative review revocation.";
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="border-rose-500/30 p-8 text-center space-y-6 bg-card rounded-2xl shadow-xl">
          <div className="h-16 w-16 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <UserX className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <Badge variant="danger" className="bg-rose-100 text-rose-800 border-rose-300">
              Seller Status Revoked
            </Badge>
            <h2 className="text-2xl font-bold text-foreground">Your Seller Account Has Been Removed</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Your previous seller credentials and store have been offboarded by the Super Admin. If you wish to sell on Earthcentric again, you may submit a fresh verification application.
            </p>
          </div>

          <div className="border border-rose-500/20 bg-rose-500/5 p-4 rounded-xl max-w-md mx-auto text-xs text-rose-700 dark:text-rose-300 text-left space-y-1">
            <strong className="block text-foreground font-semibold">Reason Provided by Administrator:</strong>
            <p className="italic">{removalReasonText}</p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="default"
              onClick={() => setIsReopened(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 shadow-sm cursor-pointer"
            >
              Apply Again as Seller
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/marketplace")}
              className="px-6 text-xs cursor-pointer"
            >
              Explore Marketplace
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Approved State ──
  if ((profile?.verificationStatus === "APPROVED" || user?.sellerStatus === "APPROVED") && !isRemoved) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="border-border/40 p-8 text-center space-y-6 bg-card rounded-2xl shadow-lg">
          <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 fill-emerald-500/10" />
          </div>
          
          <div className="space-y-2">
            <Badge variant="success">Verification Completed</Badge>
            <h2 className="text-2xl font-bold text-primary">Your Brand is Verified!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Congratulations, <strong>{profile?.companyName || user.name}</strong>. Your credentials and sustainability claims have been audited and verified by our board.
            </p>
          </div>

          <div className="border border-border/40 bg-muted/20 p-4 rounded-xl space-y-3 max-w-sm mx-auto">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Assigned Badges
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="premium">Verified Business</Badge>
              <Badge variant="primary">Verified Sustainable Manufacturer</Badge>
            </div>
          </div>

          <div className="pt-2">
            <Button variant="cool" onClick={() => router.push("/seller/dashboard")} className="w-full sm:w-auto px-8">
              Proceed to Seller Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Pending Review State ──
  if ((profile?.verificationStatus === "PENDING" || user?.sellerStatus === "PENDING") && !isReopened && !isRemoved) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="border-border/60 p-8 text-center space-y-6 bg-card rounded-2xl shadow-sm">
          <div className="h-16 w-16 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Clock className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="text-amber-600 border-amber-500/30">
              Audit Pending
            </Badge>
            <h2 className="text-2xl font-bold text-primary">Verification in Progress</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Our sustainability analysts are reviewing your GST certificate, PAN records, Aadhaar verification, and initial product catalog. This process usually completes in 24 hours.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="cool" onClick={() => router.push("/marketplace")} className="px-6">
              Explore Marketplace Catalog
            </Button>
            <Button variant="outline" onClick={() => setIsReopened(true)} className="px-6 text-xs">
              View or Edit Submission
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Rejected State ──
  if ((profile?.verificationStatus === "REJECTED" || user?.sellerStatus === "REJECTED") && !isReopened && !isRemoved) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="border-red-500/20 p-8 text-center space-y-6 bg-card rounded-2xl shadow-lg">
          <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertOctagon className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <Badge variant="danger">Action Required</Badge>
            <h2 className="text-2xl font-bold text-primary">Verification Rejected</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              We encountered issues validating your credentials or product information. Please review the feedback below and resubmit.
            </p>
          </div>

          {profile?.rejectionReason && (
            <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-xl max-w-md mx-auto text-xs text-red-600 dark:text-red-400 text-left">
              <strong>Admin Feedback:</strong> {profile.rejectionReason}
            </div>
          )}

          <div className="pt-2">
            <MetalButton
              variant="error"
              onClick={() => {
                setIsReopened(true);
              }}
              className="w-full sm:w-auto"
            >
              Re-open Form & Fix Details
            </MetalButton>
          </div>
        </Card>
      </div>
    );
  }

  // ── Standard 3-Step Registration Flow ──
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <SellerRegistrationWizard
        userId={user.id}
        onSuccess={() => {
          if (updateSellerStatus) updateSellerStatus("PENDING");
          router.push("/seller/dashboard");
        }}
      />
    </div>
  );
}
