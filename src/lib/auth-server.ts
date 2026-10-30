import db from "@/lib/db";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { isSuperAdminEmail } from "@/lib/account-roles";
import { verifyEarthcentricSession } from "@/lib/session-token";

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
}

export async function verifyAuthenticatedUser(): Promise<AuthenticatedUserResult> {
  try {
    const clerkAuth = await auth();
    if (clerkAuth?.userId) {
      const user = await db.user.findUnique({
        where: { id: clerkAuth.userId },
        select: { id: true, email: true, role: true, seller: { select: { id: true } } },
      });
      if (user) {
        return {
          authorized: true,
          userId: user.id,
          email: user.email,
          role: user.role,
          sellerId: user.seller?.id,
        };
      }
      return { authorized: false };
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("earthcentric_session")?.value;
    if (!sessionCookie) return { authorized: false };

    const session = await verifyEarthcentricSession(sessionCookie);
    if (!session) return { authorized: false };

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, role: true, seller: { select: { id: true } } },
    });
    if (!user) return { authorized: false };

    return {
      authorized: true,
      userId: user.id,
      email: user.email,
      role: user.role,
      sellerId: user.seller?.id,
    };
  } catch (error) {
    console.error("verifyAuthenticatedUser error:", error);
    return { authorized: false };
  }
}

/**
 * Verifies that the current request is made by an authorized Super Admin.
 * Checks custom session cookie (earthcentric_session) and Clerk authentication,
 * and validates the user record in PostgreSQL.
 */
export async function verifyAdminAuth(): Promise<AdminAuthResult> {
  try {
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
        foundUser = await db.user.findUnique({
          where: { id: clerkAuth.userId },
          include: { seller: true },
        });
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
