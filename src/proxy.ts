import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { verifyEarthcentricSession } from "@/lib/session-token";

export default clerkMiddleware(async (auth, request) => {
  const { pathname, search } = request.nextUrl;
  const fullPath = `${pathname}${search}`;

  // 1. Static and system assets - always public
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/location") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|json)$/)
  ) {
    return NextResponse.next();
  }

  // 2. Public information routes that never require authentication
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/") ||
    pathname === "/verified-sellers" ||
    pathname.startsWith("/verified-sellers/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up");

  // Protected route definitions
  const isMarketplaceRoute =
    pathname === "/marketplace" || pathname.startsWith("/marketplace/");
  const isProductDetailRoute =
    pathname.startsWith("/product/") || pathname.startsWith("/products/");
  const isCartRoute = pathname === "/cart" || pathname.startsWith("/cart/");
  const isCheckoutRoute =
    pathname === "/checkout" || pathname.startsWith("/checkout/");
  const isOrdersRoute = pathname === "/orders" || pathname.startsWith("/orders/");
  const isWishlistRoute =
    pathname === "/wishlist" || pathname.startsWith("/wishlist/");
  const isAccountRoute =
    (pathname === "/account" || pathname.startsWith("/account/")) &&
    request.nextUrl.searchParams.get("tab") !== "seller";
  const isAdminRoute = pathname.startsWith("/admin");
  const isSellerRoute = pathname.startsWith("/seller");

  // Combined buyer-protected routes
  const isBuyerProtectedRoute =
    isMarketplaceRoute ||
    isProductDetailRoute ||
    isCartRoute ||
    isCheckoutRoute ||
    isOrdersRoute ||
    isWishlistRoute ||
    isAccountRoute;

  // 3. Inspect sessions and Clerk identity
  const sessionCookie = request.cookies.get("earthcentric_session")?.value;
  const session = sessionCookie
    ? await verifyEarthcentricSession(sessionCookie)
    : null;

  const clerkAuth = await auth();
  const isClerkAuthenticated = !!clerkAuth?.userId;
  const isAuthenticated = isClerkAuthenticated || !!session?.id;

  // 4. Handle Seller routes
  if (isSellerRoute) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/sign-in", request.url);
      loginUrl.searchParams.set("redirect_url", fullPath);
      return NextResponse.redirect(loginUrl);
    }

    if (session?.role && session.role !== "SELLER" && session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/account?tab=seller", request.url));
    }

    const isVerificationRoute = pathname === "/seller/verification";
    const isApprovedSeller =
      session?.role === "ADMIN" ||
      (session?.role === "SELLER" && session?.sellerStatus === "APPROVED");

    if (session?.role === "SELLER" && !isApprovedSeller && !isVerificationRoute) {
      return NextResponse.redirect(new URL("/seller/verification", request.url));
    }

    if (isApprovedSeller && isVerificationRoute) {
      return NextResponse.redirect(new URL("/seller/dashboard", request.url));
    }

    return NextResponse.next();
  }

  // 5. Handle Admin routes
  if (isAdminRoute) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/sign-in", request.url);
      loginUrl.searchParams.set("redirect_url", fullPath);
      return NextResponse.redirect(loginUrl);
    }
    if (session?.role && session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 6. If it's a public route and NOT a buyer protected route, allow through
  if (isPublicRoute && !isBuyerProtectedRoute) {
    return NextResponse.next();
  }

  // 7. Enforce Buyer Mandatory Multi-Step Verification
  if (isBuyerProtectedRoute) {
    // A. Not logged in at all -> redirect to Step 1: Buyer Google Login
    if (!isAuthenticated) {
      const buyerLoginUrl = new URL("/auth/buyer-login", request.url);
      buyerLoginUrl.searchParams.set("redirect_url", fullPath);
      return NextResponse.redirect(buyerLoginUrl);
    }

    // B. If logged in as ADMIN or SELLER, grant access
    if (session?.role === "ADMIN" || session?.role === "SELLER") {
      return NextResponse.next();
    }

    // C. Logged in as BUYER: Verify completed onboarding
    // If session explicitly has buyerOnboardingCompleted === true, allow access
    if (session?.buyerOnboardingCompleted === true) {
      return NextResponse.next();
    }

    // Otherwise, redirect buyer to the dedicated multi-step login flow
    const buyerLoginUrl = new URL("/auth/buyer-login", request.url);
    buyerLoginUrl.searchParams.set("redirect_url", fullPath);
    return NextResponse.redirect(buyerLoginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
