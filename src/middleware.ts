import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Public paths that never require authentication
  const isPublicPath =
    pathname === '/' ||
    pathname === '/marketplace' ||
    pathname === '/about' ||
    pathname === '/contact' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/blog' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/products/') ||
    pathname.startsWith('/api/categories');

  // Protected route categories
  const isAdminRoute = pathname.startsWith('/admin');
  const isSellerRoute = pathname.startsWith('/seller');
  const isBuyerRoute =
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/wishlist');

  // If it's a public path, allow through
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check custom session cookie for role-based access
  const sessionCookie = request.cookies.get('earthcentric_session')?.value;
  let session: { id?: string; role?: string; sellerStatus?: string } | null = null;

  if (sessionCookie) {
    try {
      session = JSON.parse(sessionCookie);
    } catch (e) {
      console.error('Invalid session cookie format');
    }
  }

  // Also check Clerk auth status
  const clerkAuth = await auth();
  const isClerkAuthenticated = !!clerkAuth?.userId;

  // For protected routes: require either Clerk auth OR a valid session cookie
  const isAuthenticated = isClerkAuthenticated || !!session?.id;

  if (!isAuthenticated && (isAdminRoute || isSellerRoute || isBuyerRoute)) {
    // Redirect to login
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based access control (only if session exists)
  if (session?.role) {
    const { role, sellerStatus } = session;

    // Admin routes: only ADMIN role
    if (isAdminRoute && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Seller routes: only approved SELLERs (except /seller/verification)
    if (isSellerRoute) {
      const isVerificationRoute = pathname === '/seller/verification';
      const isApprovedSeller = role === 'SELLER' && sellerStatus === 'APPROVED';

      if (!isApprovedSeller) {
        if (isVerificationRoute) {
          return NextResponse.next();
        }
        if (role === 'SELLER' && sellerStatus && sellerStatus !== 'APPROVED') {
          return NextResponse.redirect(new URL('/seller/verification', request.url));
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Approved sellers trying to access verification page → redirect to dashboard
      if (isApprovedSeller && isVerificationRoute) {
        return NextResponse.redirect(new URL('/seller/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

