import db from "@/lib/db";
import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getVerifiedClerkIdentity } from "@/lib/clerk-identity";
import { isConfiguredSellerEmail, isSuperAdminEmail, isWorkerEmail } from "@/lib/account-roles";
import { verifyEarthcentricSession } from "@/lib/session-token";

const MOCK_SELLER_ID = "cmvcbbtm80001txgw8dd0r3lk";
const MOCK_SELLER_EMAIL = "ar.eco.india2026@gmail.com";

async function getMockAuthenticatedUser() {
  const identity = await getVerifiedClerkIdentity();
  if (!identity) return null;

  const role = isSuperAdminEmail(identity.email)
    ? "ADMIN"
    : isConfiguredSellerEmail(identity.email) || identity.email === MOCK_SELLER_EMAIL
      ? "SELLER"
      : "BUYER";

  return {
    id: identity.id,
    email: identity.email,
    role,
    sellerId: role === "SELLER" ? MOCK_SELLER_ID : undefined,
  };
}

export interface AdminAuthResult {
  authorized: boolean;
  email: string;
  userId?: string;
  error?: string;
}

export interface AuthenticatedUserResult {
  authorized: boolean;
  userId?: string;
  email?: string;
  role?: string;
  sellerId?: string;
  mobileNumber?: string | null;
  mobileNumberCountryCode?: string | null;
  mobileNumberSubmitted?: boolean;
  buyerOnboardingCompleted?: boolean;
}

export async function verifyAuthenticatedUser(): Promise<AuthenticatedUserResult> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const user = await getMockAuthenticatedUser();
      return user
        ? {
            authorized: true,
            userId: user.id,
            email: user.email,
            role: user.role,
            sellerId: user.sellerId,
          }
        : { authorized: false };
    }

    const clerkAuth = await auth();
    if (clerkAuth?.userId) {
      let user = await db.user.findUnique({
        where: { id: clerkAuth.userId },
        select: {
          id: true,
          email: true,
          role: true,
          mobileNumber: true,
          mobileNumberCountryCode: true,
          mobileNumberSubmitted: true,
          buyerOnboardingCompleted: true,
          seller: { select: { id: true } },
        },
      });

      if (!user) {
        try {
          const clerkUser = await currentUser();
          const primaryAddress = clerkUser?.emailAddresses?.find(
            (e) => e.id === clerkUser.primaryEmailAddressId
          );
          const primaryEmail =
            primaryAddress?.verification?.status === "verified"
              ? primaryAddress.emailAddress.trim().toLowerCase()
              : clerkUser?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();

          if (primaryEmail) {
            const isSuperAdmin = isSuperAdminEmail(primaryEmail);
            const isWorker = isWorkerEmail(primaryEmail);
            const isConfiguredSeller = isConfiguredSellerEmail(primaryEmail);
            const targetRole = isSuperAdmin ? "ADMIN" : isWorker ? "WORKER" : isConfiguredSeller ? "SELLER" : "BUYER";
            const fullName =
              [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
              clerkUser?.username ||
              (isWorker ? "BLUE Gamer (Worker)" : "EarthCentric Buyer");

            user = await db.user.upsert({
              where: { email: primaryEmail },
              update: {
                id: clerkAuth.userId,
                name: fullName,
                role: targetRole,
                emailVerified: new Date(),
                buyerOnboardingCompleted: targetRole === "ADMIN" || targetRole === "SELLER" || targetRole === "WORKER",
                mobileNumberSubmitted: targetRole === "ADMIN" || targetRole === "SELLER" || targetRole === "WORKER",
              },
              create: {
                id: clerkAuth.userId,
                email: primaryEmail,
                name: fullName,
                role: targetRole,
                emailVerified: new Date(),
                buyerOnboardingCompleted: targetRole === "ADMIN" || targetRole === "SELLER" || targetRole === "WORKER",
                mobileNumberSubmitted: targetRole === "ADMIN" || targetRole === "SELLER" || targetRole === "WORKER",
              },
              select: {
                id: true,
                email: true,
                role: true,
                mobileNumber: true,
                mobileNumberCountryCode: true,
                mobileNumberSubmitted: true,
                buyerOnboardingCompleted: true,
                seller: { select: { id: true } },
              },
            });
          }
        } catch (e) {
          console.warn("verifyAuthenticatedUser currentUser lookup warning:", e);
        }
      }

      if (user) {
        const isWorker = isWorkerEmail(user.email);
        const isSuperAdmin = isSuperAdminEmail(user.email);
        const effectiveRole = isSuperAdmin ? "ADMIN" : isWorker ? "WORKER" : user.role;
        return {
          authorized: true,
          userId: user.id,
          email: user.email,
          role: effectiveRole,
          sellerId: user.seller?.id,
          mobileNumber: user.mobileNumber,
          mobileNumberCountryCode: user.mobileNumberCountryCode,
          mobileNumberSubmitted: isWorker || Boolean(user.mobileNumberSubmitted),
          buyerOnboardingCompleted: isWorker || Boolean(user.buyerOnboardingCompleted),
        };
      }

      // If database lookup had an issue but Clerk is authenticated, do not lock out
      return {
        authorized: true,
        userId: clerkAuth.userId,
        role: "BUYER",
        mobileNumberSubmitted: false,
        buyerOnboardingCompleted: false,
      };
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("earthcentric_session")?.value;
    if (sessionCookie) {
      const session = await verifyEarthcentricSession(sessionCookie);
      if (session) {
        const user = await db.user.findUnique({
          where: { id: session.id },
          select: {
            id: true,
            email: true,
            role: true,
            mobileNumber: true,
            mobileNumberCountryCode: true,
            mobileNumberSubmitted: true,
            buyerOnboardingCompleted: true,
            seller: { select: { id: true } },
          },
        });
        if (user) {
          const isWorker = isWorkerEmail(user.email);
          const isSuperAdmin = isSuperAdminEmail(user.email);
          const effectiveRole = isSuperAdmin ? "ADMIN" : isWorker ? "WORKER" : user.role;
          return {
            authorized: true,
            userId: user.id,
            email: user.email,
            role: effectiveRole,
            sellerId: user.seller?.id,
            mobileNumber: user.mobileNumber,
            mobileNumberCountryCode: user.mobileNumberCountryCode,
            mobileNumberSubmitted: isWorker || Boolean(user.mobileNumberSubmitted),
            buyerOnboardingCompleted: isWorker || Boolean(user.buyerOnboardingCompleted),
          };
        }
      }
    }

    return { authorized: false };
  } catch (error) {
    console.error("verifyAuthenticatedUser error:", error);
    return { authorized: false };
  }
}

/**
 * Strict server-side verification for buyer marketplace access.
 * Checks:
 * 1. Authenticated via Google (Clerk) or valid EarthCentric session
 * 2. Mobile number submitted and recorded
 * 3. Gmail OTP verified and onboarding marked complete
 * 
 * Sellers and Admins are granted immediate access.
 */
export async function verifyBuyerAuth(): Promise<{
  authorized: boolean;
  userId?: string;
  email?: string;
  role?: string;
  step?: "GOOGLE_LOGIN" | "MOBILE_NUMBER" | "OTP_VERIFICATION" | "COMPLETED";
  isVerified?: boolean;
  error?: string;
}> {
  try {
    const user = await verifyAuthenticatedUser();
    if (!user.authorized || !user.userId) {
      return {
        authorized: false,
        step: "GOOGLE_LOGIN",
        isVerified: false,
        error: "Sign in with your Google account to access the marketplace.",
      };
    }

    // Admins, Sellers and Workers are exempt from the mandatory buyer verification flow
    if (user.role === "ADMIN" || user.role === "SELLER" || user.role === "WORKER" || isWorkerEmail(user.email)) {
      return {
        authorized: true,
        userId: user.userId,
        email: user.email,
        role: user.role || "WORKER",
        step: "COMPLETED",
        isVerified: true,
      };
    }

    // For Buyers, check if onboarding is complete
    if (!user.buyerOnboardingCompleted) {
      return {
        authorized: true,
        userId: user.userId,
        email: user.email,
        role: "BUYER",
        step: !user.mobileNumberSubmitted ? "MOBILE_NUMBER" : "OTP_VERIFICATION",
        isVerified: false,
        error: "Please complete your buyer verification and delivery details to access the marketplace.",
      };
    }

    return {
      authorized: true,
      userId: user.userId,
      email: user.email,
      role: user.role || "BUYER",
      step: "COMPLETED",
      isVerified: true,
    };
  } catch (error) {
    console.error("verifyBuyerAuth error:", error);
    return {
      authorized: false,
      step: "GOOGLE_LOGIN",
      isVerified: false,
      error: "Error verifying buyer authorization status.",
    };
  }
}

/**
 * Verifies that the current request is made by an authorized Super Admin.
 * Checks custom session cookie (earthcentric_session) and Clerk authentication,
 * and validates the user record in PostgreSQL.
 */
export async function verifyAdminAuth(): Promise<AdminAuthResult> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const user = await getMockAuthenticatedUser();
      if (user && (user.role === "ADMIN" || isSuperAdminEmail(user.email))) {
        return { authorized: true, email: user.email, userId: user.id };
      }
      return {
        authorized: false,
        email: user?.email || "",
        error: "Unauthorized: Super Admin credentials required.",
      };
    }

    // 1. Check custom session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("earthcentric_session")?.value;
    
    if (sessionCookie) {
      try {
        const session = await verifyEarthcentricSession(sessionCookie);
        if (session && session.id) {
          const user = await db.user.findUnique({
            where: { id: session.id },
            select: { id: true, email: true, role: true },
          });

          if (user) {
            const isAdmin = user.role === "ADMIN" || isSuperAdminEmail(user.email);

            if (isAdmin) {
              return { authorized: true, email: user.email, userId: user.id };
            }
          }
        }
      } catch (cookieError) {
        console.error("Failed to verify earthcentric_session in verifyAdminAuth:", cookieError);
      }
    }

    // 2. Fallback: Check Clerk authentication
    try {
      const clerkAuth = await auth();
      if (clerkAuth?.userId) {
        const user = await db.user.findUnique({
          where: { id: clerkAuth.userId },
          select: { id: true, email: true, role: true },
        });

        if (user) {
          const isAdmin = user.role === "ADMIN" || isSuperAdminEmail(user.email);

          if (isAdmin) {
            return { authorized: true, email: user.email, userId: user.id };
          }
        }
      }
    } catch (clerkError) {
      console.error("Clerk admin auth check failed:", clerkError);
    }

    return { authorized: false, email: "", error: "Unauthorized: Super Admin credentials required." };
  } catch (error) {
    console.error("verifyAdminAuth encountered an error:", error);
    return {
      authorized: false,
      email: "",
      error: error instanceof Error ? error.message : "Internal authorization error.",
    };
  }
}

/**
 * Centralized activation check for sellers.
 * Checks whether seller application is APPROVED and if ₹1 registration fee is paid (when enabled).
 */
export async function checkSellerActivation(sellerIdOrUserId: string): Promise<{
  active: boolean;
  sellerApproved: boolean;
  feeRequired: boolean;
  feePaid: boolean;
  status: "RESTRICTED" | "PAYMENT_REQUIRED" | "ACTIVE";
  error?: string;
}> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (isMock) {
      return { active: true, sellerApproved: true, feeRequired: false, feePaid: true, status: "ACTIVE" };
    }

    const seller = await db.seller.findFirst({
      where: { OR: [{ id: sellerIdOrUserId }, { userId: sellerIdOrUserId }] },
      include: { user: true },
    });

    if (!seller) {
      return {
        active: false,
        sellerApproved: false,
        feeRequired: false,
        feePaid: false,
        status: "RESTRICTED",
        error: "Seller profile not found.",
      };
    }

    const sellerApproved = seller.verificationStatus === "APPROVED";
    if (!sellerApproved) {
      return {
        active: false,
        sellerApproved: false,
        feeRequired: false,
        feePaid: false,
        status: "RESTRICTED",
        error: `Seller application status is ${seller.verificationStatus}. Must be approved by Super Admin.`,
      };
    }

    const { isGrandfatheredSeller } = await import("@/lib/seller-verification-constants");
    const isGrandfathered = isGrandfatheredSeller(seller.id) || isGrandfatheredSeller(seller.userId) || (seller as any).registrationPaymentStatus === "NOT_REQUIRED";

    const { isSellerRegistrationFeeEnabled } = await import("@/lib/payout-config");
    const feeEnabled = await isSellerRegistrationFeeEnabled();
    const isPaid = isGrandfathered || Boolean(seller.registrationFeePaid || (seller as any).registrationPaymentStatus === "PAID");

    if (feeEnabled && !isPaid) {
      return {
        active: false,
        sellerApproved: true,
        feeRequired: true,
        feePaid: false,
        status: "PAYMENT_REQUIRED",
        error: "Pay the one-time ₹1 registration fee to continue activating your seller account.",
      };
    }

    return {
      active: true,
      sellerApproved: true,
      feeRequired: !isGrandfathered && feeEnabled,
      feePaid: true,
      status: "ACTIVE",
    };
  } catch (err: any) {
    console.error("checkSellerActivation error:", err);
    return {
      active: false,
      sellerApproved: false,
      feeRequired: false,
      feePaid: false,
      status: "RESTRICTED",
      error: "Error verifying seller activation.",
    };
  }
}

/**
 * Verifies that the current request belongs to the given seller or an admin.
 * If requireActive is true (default), also enforces that the seller is fully activated (approved and fee paid).
 */
export async function verifySellerAuth(
  sellerId?: string,
  options?: { requireActive?: boolean }
): Promise<{
  authorized: boolean;
  userId?: string;
  sellerId?: string;
  isActive?: boolean;
  activationStatus?: string;
  error?: string;
}> {
  try {
    const shouldRequireActive = options?.requireActive !== false;
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const user = await getMockAuthenticatedUser();
      if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
        return { authorized: false, error: "Seller or Admin role required." };
      }

      if (
        user.role === "SELLER" &&
        sellerId &&
        sellerId !== user.id &&
        sellerId !== user.sellerId
      ) {
        return { authorized: false, error: "Unauthorized access to another seller profile." };
      }

      if (user.role === "SELLER" && shouldRequireActive && user.sellerId) {
        const activation = await checkSellerActivation(user.sellerId);
        if (!activation.active) {
          return {
            authorized: false,
            userId: user.id,
            sellerId: user.sellerId,
            isActive: false,
            activationStatus: activation.status,
            error: activation.error || "Seller account activation required.",
          };
        }
      }

      return {
        authorized: true,
        userId: user.id,
        sellerId: user.sellerId,
        isActive: true,
        activationStatus: "ACTIVE",
      };
    }

    let foundUser: any = null;

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("earthcentric_session")?.value;
    
    if (sessionCookie) {
      const session = await verifyEarthcentricSession(sessionCookie);
      if (session && session.id) {
        foundUser = await db.user.findUnique({
          where: { id: session.id },
          include: { seller: true },
        });
      }
    }

    if (!foundUser) {
      const clerkAuth = await auth();
      if (clerkAuth?.userId) {
        const clerkUser = await currentUser();
        const primaryAddress = clerkUser?.emailAddresses?.find(
          (e) => e.id === clerkUser.primaryEmailAddressId
        );
        const primaryEmail =
          primaryAddress?.verification?.status === "verified"
            ? primaryAddress.emailAddress.trim().toLowerCase()
            : undefined;
        if (primaryEmail) {
          foundUser = await db.user.findUnique({
            where: { email: primaryEmail },
            include: { seller: true },
          });
        }
      }
    }

    if (!foundUser) {
      return { authorized: false, error: "Authentication required." };
    }

    if (foundUser.role === "ADMIN" || isSuperAdminEmail(foundUser.email)) {
      return { authorized: true, userId: foundUser.id, sellerId: foundUser.seller?.id, isActive: true, activationStatus: "ACTIVE" };
    }

    if (foundUser.role === "SELLER") {
      const currentSellerId = foundUser.seller?.id;
      if (!currentSellerId) {
        return { authorized: false, error: "No seller profile linked to user account." };
      }

      if (sellerId && sellerId !== foundUser.id && sellerId !== currentSellerId) {
        return { authorized: false, error: "Unauthorized access to another seller profile." };
      }

      if (shouldRequireActive) {
        const act = await checkSellerActivation(currentSellerId);
        if (!act.active) {
          return {
            authorized: false,
            userId: foundUser.id,
            sellerId: currentSellerId,
            isActive: false,
            activationStatus: act.status,
            error: act.error || "Seller account activation required.",
          };
        }
      }

      return {
        authorized: true,
        userId: foundUser.id,
        sellerId: currentSellerId,
        isActive: true,
        activationStatus: "ACTIVE",
      };
    }

    return { authorized: false, error: "Seller or Admin role required." };
  } catch (e: any) {
    console.error("verifySellerAuth error:", e);
    return { authorized: false, error: e?.message || "Internal authorization error." };
  }
}

/**
 * Verifies that the current request is made by an authorized Worker (or Super Admin).
 * Checks the custom session cookie and Clerk authentication.
 * Workers can view buyer/seller data and record feedback, but cannot perform admin actions.
 */
export async function verifyWorkerAuth(): Promise<{ authorized: boolean; userId?: string; email?: string; error?: string }> {
  try {
    // 1. Check custom session cookie first
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("earthcentric_session")?.value;

    if (sessionCookie) {
      const session = await verifyEarthcentricSession(sessionCookie);
      if (session?.id) {
        const user = await db.user.findUnique({
          where: { id: session.id },
          select: { id: true, email: true, role: true },
        });
        if (user && (user.role === "WORKER" || user.role === "ADMIN" || isWorkerEmail(user.email) || isSuperAdminEmail(user.email))) {
          return { authorized: true, userId: user.id, email: user.email };
        }
      }
    }

    // 2. Fallback: Clerk authentication
    const clerkAuth = await auth();
    if (clerkAuth?.userId) {
      const user = await db.user.findUnique({
        where: { id: clerkAuth.userId },
        select: { id: true, email: true, role: true },
      });
      if (user && (user.role === "WORKER" || user.role === "ADMIN" || isWorkerEmail(user.email) || isSuperAdminEmail(user.email))) {
        return { authorized: true, userId: user.id, email: user.email };
      }
    }

    return { authorized: false, error: "Unauthorized: Worker credentials required." };
  } catch (error) {
    console.error("verifyWorkerAuth error:", error);
    return { authorized: false, error: "Internal authorization error." };
  }
}
