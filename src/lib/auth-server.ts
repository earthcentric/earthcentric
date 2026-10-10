import db from "@/lib/db";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { isSuperAdminEmail } from "@/lib/account-roles";

export interface AdminAuthResult {
  authorized: boolean;
  email: string;
  userId?: string;
  error?: string;
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
        const session = JSON.parse(sessionCookie);
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
      } catch (cookieErr) {
        console.warn("Failed to parse earthcentric_session in verifyAdminAuth:", cookieErr);
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
    } catch (clerkErr) {
      // Clerk auth check might fail in non-Clerk environments
    }

    return { authorized: false, email: "", error: "Unauthorized: Super Admin credentials required." };
  } catch (error: any) {
    console.error("verifyAdminAuth encountered an error:", error);
    return { authorized: false, email: "", error: error?.message || "Internal authorization error." };
  }
}

/**
 * Verifies that the current request belongs to the given seller or an admin.
 */
export async function verifySellerAuth(sellerId?: string): Promise<{ authorized: boolean; userId?: string; sellerId?: string }> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("earthcentric_session")?.value;
    
    if (sessionCookie) {
      const session = JSON.parse(sessionCookie);
      if (session && session.id) {
        const user = await db.user.findUnique({
          where: { id: session.id },
          include: { seller: true },
        });

        if (user) {
          if (user.role === "ADMIN" || isSuperAdminEmail(user.email)) {
            return { authorized: true, userId: user.id, sellerId: user.seller?.id };
          }
          if (user.role === "SELLER") {
            if (!sellerId || user.id === sellerId || user.seller?.id === sellerId) {
              return { authorized: true, userId: user.id, sellerId: user.seller?.id };
            }
          }
        }
      }
    }

    const clerkAuth = await auth();
    if (clerkAuth?.userId) {
      const user = await db.user.findUnique({
        where: { id: clerkAuth.userId },
        include: { seller: true },
      });

      if (user) {
        if (user.role === "ADMIN" || isSuperAdminEmail(user.email)) {
          return { authorized: true, userId: user.id, sellerId: user.seller?.id };
        }
        if (user.role === "SELLER") {
          if (!sellerId || user.id === sellerId || user.seller?.id === sellerId) {
            return { authorized: true, userId: user.id, sellerId: user.seller?.id };
          }
        }
      }
    }

    return { authorized: false };
  } catch (e) {
    console.error("verifySellerAuth error:", e);
    return { authorized: false };
  }
}
