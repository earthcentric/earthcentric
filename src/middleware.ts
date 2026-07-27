import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';

export default clerkMiddleware(async (auth, request) => {
  const sessionCookie = request.cookies.get('earthcentric_session')?.value;
  
  // Public paths that do not require authentication
  const publicPaths = ['/', '/auth/login', '/auth/signup', '/marketplace', '/products', '/about', '/contact', '/sign-in', '/sign-up'];
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith('/products/'));

  // Admin routes
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  // Seller routes
  const isSellerRoute = request.nextUrl.pathname.startsWith('/seller');
  // Buyer/User authenticated routes
  const isBuyerRoute = request.nextUrl.pathname.startsWith('/buyer') || request.nextUrl.pathname.startsWith('/checkout') || request.nextUrl.pathname.startsWith('/orders') || request.nextUrl.pathname.startsWith('/cart');

  let session = null;
  if (sessionCookie) {
    try {
      session = JSON.parse(sessionCookie);
    } catch (e) {
      console.error('Invalid session cookie');
    }
  }

  // If trying to access protected route without being logged in
  if (!session && (isAdminRoute || isSellerRoute || isBuyerRoute)) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // If logged in, enforce RBAC
  if (session) {
    const { role, sellerStatus } = session;

    // Prevent buyers/sellers from accessing admin routes
    if (isAdminRoute && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Prevent non-sellers from accessing seller routes (except buyers/pending sellers accessing verification)
    if (isSellerRoute) {
      const isVerificationRoute = request.nextUrl.pathname === '/seller/verification';
      const isApprovedSeller = role === 'SELLER' || sellerStatus === 'APPROVED';

      if (!isApprovedSeller) {
        if (isVerificationRoute) {
          return NextResponse.next();
        }
        if (sellerStatus && sellerStatus !== 'APPROVED') {
          return NextResponse.redirect(new URL('/seller/verification', request.url));
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (isApprovedSeller && isVerificationRoute) {
        return NextResponse.redirect(new URL('/seller/dashboard', request.url));
      }
    }
    
    // Redirect logged-in users away from auth pages
    if (request.nextUrl.pathname.startsWith('/auth/')) {
      if (role === 'ADMIN') return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      if (role === 'SELLER') return NextResponse.redirect(new URL(sellerStatus === 'APPROVED' ? '/seller/dashboard' : '/seller/verification', request.url));
      return NextResponse.redirect(new URL('/marketplace', request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
