"use server";

import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { verifyAdminAuth, verifyAuthenticatedUser, verifySellerAuth } from "@/lib/auth-server";
import {
  parseShippingConfig,
  quoteSellerShipments,
  type ShippingConfig,
  type ShippingQuoteResult,
} from "@/lib/shipping";
import { reverseGeocode } from "@/lib/location-services";

export interface WarehouseInput {
  address: string;
  street: string;
  landmark?: string | null;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  providerLocationId?: string | null;
  geocodingProvider?: string | null;
}

export async function getCheckoutShippingQuote(
  addressId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<{ success: boolean; quote?: ShippingQuoteResult; error?: string }> {
  const identity = await verifyAuthenticatedUser();
  if (!identity.authorized || !identity.userId) {
    return { success: false, error: "Sign in before checking delivery serviceability." };
  }
  try {
    const quote = await quoteSellerShipments(addressId, identity.userId, items);
    return { success: true, quote };
  } catch (error) {
    console.error("Shipping quote failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not calculate delivery charges.",
    };
  }
}

export async function getAdminShippingConfiguration(): Promise<{
  version: number;
  config: ShippingConfig;
} | null> {
  const admin = await verifyAdminAuth();
  if (!admin.authorized) throw new Error("Super Admin access is required.");
  const active = await db.shippingConfiguration.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
  });
  if (!active) return null;
  return { version: active.version, config: parseShippingConfig(active.config) };
}

export async function saveAdminShippingConfiguration(
  submittedConfig: ShippingConfig
): Promise<{ success: boolean; version?: number; error?: string }> {
  const admin = await verifyAdminAuth();
  if (!admin.authorized || !admin.userId) {
    return { success: false, error: "Super Admin access is required." };
  }
  try {
    const config = parseShippingConfig(submittedConfig);
    const configJson = JSON.parse(JSON.stringify(config)) as Prisma.InputJsonValue;
    const created = await db.$transaction(async (tx) => {
      const latest = await tx.shippingConfiguration.findFirst({ orderBy: { version: "desc" } });
      await tx.shippingConfiguration.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.shippingConfiguration.create({
        data: {
          version: (latest?.version || 0) + 1,
          enabled: config.enabled,
          config: configJson,
          createdBy: admin.userId!,
          isActive: true,
        },
      });
    });
    return { success: true, version: created.version };
  } catch (error) {
    console.error("Failed to save shipping configuration:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not save shipping configuration.",
    };
  }
}

export async function getAdminShippingReport() {
  const admin = await verifyAdminAuth();
  if (!admin.authorized) throw new Error("Super Admin access is required.");
  return db.orderShipmentSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      orderId: true,
      sellerId: true,
      seller: { select: { companyName: true } },
      warehousePin: true,
      buyerPin: true,
      shippingZone: true,
      estimateStatus: true,
      configurationVersion: true,
      feeBreakdown: true,
      actualCourierCost: true,
      courierName: true,
      createdAt: true,
      order: { select: { shippingFee: true } },
    },
  });
}

export async function updateActualCourierCost(
  snapshotId: string,
  actualCourierCost: number | null,
  courierName: string | null
): Promise<{ success: boolean; error?: string }> {
  const admin = await verifyAdminAuth();
  if (!admin.authorized) return { success: false, error: "Super Admin access is required." };
  if (typeof snapshotId !== "string" || !snapshotId.trim() ||
      (actualCourierCost !== null && (!Number.isFinite(actualCourierCost) || actualCourierCost < 0)) ||
      (courierName !== null && (typeof courierName !== "string" || courierName.trim().length > 120))) {
    return { success: false, error: "Enter a valid actual courier cost and provider name." };
  }
  try {
    const updated = await db.orderShipmentSnapshot.updateMany({
      where: { id: snapshotId.trim() },
      data: {
        actualCourierCost,
        courierName: courierName?.trim() || null,
      },
    });
    if (updated.count !== 1) return { success: false, error: "Shipment snapshot not found." };
    return { success: true };
  } catch (error) {
    console.error("Could not save actual courier cost:", error);
    return { success: false, error: "Could not save actual courier cost." };
  }
}

export async function getSellerWarehouse() {
  const identity = await verifySellerAuth(undefined, { requireActive: false });
  if (!identity.authorized || !identity.sellerId || !identity.userId) {
    return { success: false as const, error: "An authenticated seller account is required." };
  }
  const warehouse = await db.warehouseLocation.findFirst({
    where: { sellerId: identity.sellerId, isActive: true },
  });
  return { success: true as const, warehouse };
}

export async function saveSellerWarehouse(
  input: WarehouseInput
): Promise<{ success: boolean; error?: string }> {
  const identity = await verifySellerAuth(undefined, { requireActive: false });
  if (!identity.authorized || !identity.sellerId || !identity.userId) {
    return { success: false, error: "An authenticated seller account is required." };
  }
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    return { success: false, error: "Warehouse persistence requires a configured database." };
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, error: "Warehouse details are invalid." };
  }

  const textFields = [input.address, input.street, input.postalCode, input.city, input.state, input.country];
  if (textFields.some((value) => typeof value !== "string" || !value.trim() || value.length > 300)) {
    return { success: false, error: "Complete the warehouse address, city, state, country, and PIN code." };
  }
  if ((input.landmark !== undefined && input.landmark !== null &&
       (typeof input.landmark !== "string" || input.landmark.length > 300)) ||
      (input.providerLocationId !== undefined && input.providerLocationId !== null &&
       (typeof input.providerLocationId !== "string" || input.providerLocationId.length > 300)) ||
      (input.geocodingProvider !== undefined && input.geocodingProvider !== null &&
       typeof input.geocodingProvider !== "string")) {
    return { success: false, error: "Optional warehouse location details are invalid." };
  }
  const postalCode = input.postalCode.trim();
  if (!/^\d{6}$/.test(postalCode)) {
    return { success: false, error: "Enter a valid 6-digit warehouse PIN code." };
  }
  const hasLatitude = input.latitude !== null && input.latitude !== undefined;
  const hasLongitude = input.longitude !== null && input.longitude !== undefined;
  if (hasLatitude !== hasLongitude) {
    return { success: false, error: "Both warehouse coordinates must be provided together." };
  }
  if (
    (hasLatitude && (!Number.isFinite(input.latitude) || input.latitude! < -90 || input.latitude! > 90)) ||
    (hasLongitude && (!Number.isFinite(input.longitude) || input.longitude! < -180 || input.longitude! > 180))
  ) {
    return { success: false, error: "The warehouse coordinates are invalid." };
  }
  if (hasLatitude) {
    if (input.geocodingProvider !== "Nominatim") {
      return { success: false, error: "Warehouse map coordinates must be verified by the configured geocoding provider." };
    }
    const existing = await db.warehouseLocation.findUnique({
      where: { sellerId: identity.sellerId },
      select: {
        latitude: true,
        longitude: true,
        postalCode: true,
        geocodingProvider: true,
        providerLocationId: true,
      },
    });
    const unchangedLocation =
      existing?.latitude === input.latitude &&
      existing?.longitude === input.longitude &&
      existing?.postalCode === postalCode &&
      existing?.geocodingProvider === input.geocodingProvider &&
      existing?.providerLocationId === (input.providerLocationId || null);
    if (!unchangedLocation) {
      try {
        const verified = await reverseGeocode(input.latitude!, input.longitude!);
        if (!verified || verified.postalCode !== postalCode) {
          return { success: false, error: "The warehouse map location could not be verified against its PIN code." };
        }
      } catch (error) {
        console.error("Could not verify warehouse coordinates:", error);
        return { success: false, error: "Warehouse coordinates could not be verified. You can save the address manually without map coordinates." };
      }
    }
  }
  if (input.geocodingProvider && input.geocodingProvider !== "Nominatim") {
    return { success: false, error: "Unsupported warehouse geocoding provider." };
  }

  try {
    await db.warehouseLocation.upsert({
      where: { sellerId: identity.sellerId },
      create: {
        sellerId: identity.sellerId,
        address: input.address.trim(),
        street: input.street.trim(),
        landmark: input.landmark?.trim() || null,
        postalCode,
        city: input.city.trim(),
        state: input.state.trim(),
        country: input.country.trim(),
        latitude: hasLatitude ? input.latitude! : null,
        longitude: hasLongitude ? input.longitude! : null,
        geocodingProvider: input.geocodingProvider || null,
        providerLocationId: input.providerLocationId?.slice(0, 100) || null,
      },
      update: {
        address: input.address.trim(),
        street: input.street.trim(),
        landmark: input.landmark?.trim() || null,
        postalCode,
        city: input.city.trim(),
        state: input.state.trim(),
        country: input.country.trim(),
        latitude: hasLatitude ? input.latitude! : null,
        longitude: hasLongitude ? input.longitude! : null,
        geocodingProvider: input.geocodingProvider || null,
        providerLocationId: input.providerLocationId?.slice(0, 100) || null,
        isActive: true,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to save seller warehouse:", error);
    return { success: false, error: "Could not save the warehouse address." };
  }
}
