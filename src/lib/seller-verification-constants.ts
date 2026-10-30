/**
 * Centralized constants and helpers for Grandfathered & Verified Sellers
 * and the ₹1 Seller Registration Payment System.
 */

// Canonical Seller IDs for the three grandfathered existing sellers
export const GRANDFATHERED_SELLER_IDS = [
  "cmvcbbtm80001txgw8dd0r3lk", // AR ECO INDIA
  "sel-gpee9e8",               // SMT
  "sel-ns5xvde",               // SIH
] as const;

// Corresponding User IDs for the grandfathered sellers
export const GRANDFATHERED_USER_IDS = [
  "user_3KopVGVdy94cAVqZ4lzQjtWRCMK", // AR ECO INDIA
  "user_3H2YZdNRnQe8vKdvoDPxE6Htzqu", // SMT
  "user_3JOcQ6pi32lkiaJCQS7TOoqiJ65", // SIH
] as const;

export type RegistrationPaymentStatus = "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED";

/**
 * Checks if a seller profile ID or user ID belongs to one of the grandfathered sellers.
 */
export function isGrandfatheredSeller(...ids: (string | null | undefined)[]): boolean {
  return ids.some(id => {
    if (!id) return false;
    return (
      GRANDFATHERED_SELLER_IDS.includes(id as any) ||
      GRANDFATHERED_USER_IDS.includes(id as any)
    );
  });
}


/**
 * Checks if an account is a dummy, test, or auto-generated seller that should be excluded from public display.
 */
export function isDummyOrTestSeller(seller: {
  companyName?: string | null;
  email?: string | null;
  user?: { email?: string | null; name?: string | null } | null;
}): boolean {
  const email = (seller.email || seller.user?.email || "").toLowerCase();
  const name = (seller.companyName || "").toLowerCase();

  // Test email domains or prefixes
  if (email.endsWith("@earthcentric-test.com") || email.includes("seller-test-") || email.includes("test@") || email.includes("example.com")) {
    return true;
  }

  // Auto-generated test timestamp names (e.g. "Eco Earth Goods 1793264...", "Alice Organic Co 1793267...")
  if (/179[0-9]{8,}/.test(name) || name.startsWith("test ") || name.endsWith(" test")) {
    return true;
  }

  return false;
}

/**
 * Derives the canonical registration payment status of a seller.
 */
export function resolveRegistrationPaymentStatus(seller: {
  id?: string;
  userId?: string;
  registrationPaymentStatus?: string | null;
  registrationFeePaid?: boolean;
}): RegistrationPaymentStatus {
  if (isGrandfatheredSeller(seller.id) || isGrandfatheredSeller(seller.userId)) {
    // SIH paid ₹1, AR ECO INDIA and SMT are grandfathered NOT_REQUIRED
    if (seller.id === "sel-ns5xvde" || seller.userId === "user_3JOcQ6pi32lkiaJCQS7TOoqiJ65") {
      return "PAID";
    }
    return "NOT_REQUIRED";
  }

  if (seller.registrationPaymentStatus === "PAID" || seller.registrationFeePaid) {
    return "PAID";
  }

  if (seller.registrationPaymentStatus === "FAILED") {
    return "FAILED";
  }

  if (seller.registrationPaymentStatus === "NOT_REQUIRED") {
    return "NOT_REQUIRED";
  }

  return "PENDING";
}
